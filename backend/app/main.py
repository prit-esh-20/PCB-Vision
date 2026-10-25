import sys
import httpx
from pathlib import Path
import psutil
import time
import csv
import json
from io import StringIO
from datetime import datetime, timezone, timedelta
from app.rpi_client import (
    check_rpi_connection,
    check_rpi_camera_status,
    capture_rpi_image,
    start_rpi_template,
    capture_next_rpi_template_image,
    finish_rpi_template,
    cancel_rpi_template,
    list_rpi_templates,
    run_rpi_inspection,
    run_rpi_uploaded_inspection,
    make_rpi_image_url,
    RPI_BASE_URL,
)
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi import HTTPException
import uuid
from template_models import TemplateSession
from sqlalchemy.orm import Session
from fastapi import UploadFile, File, Depends, FastAPI, Query
from database import get_db
from models import Inspection, Detection, Report, Notification
from sqlalchemy import text
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

class CreateTemplateRequest(BaseModel):
    template_name: str = Field(min_length=1, max_length=100)
    expected_images: int = Field(ge=4, le=5)

class TemplateSessionRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=200)




# Allow backend to import the project-level ML package
PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.inference import inspect_pcb

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

EXPLANATION_SERVICE_URL = "http://127.0.0.1:8100/inspection/explain"

camera_fps = {
    "value": None,
    "last_frame_time": None,
}

def update_camera_fps():
    now = time.time()

    if camera_fps["last_frame_time"] is not None:
        elapsed = now - camera_fps["last_frame_time"]

        if elapsed > 0:
            camera_fps["value"] = round(1 / elapsed, 1)

    camera_fps["last_frame_time"] = now

def get_rpi_cpu_usage():
    try:
        with open("/proc/device-tree/model", "r") as file:
            model = file.read().strip("\x00").strip()

        if "Raspberry Pi" not in model:
            return "—"

        return f"{psutil.cpu_percent(interval=0.1):.1f}%"

    except (FileNotFoundError, OSError):
        return "—"

def get_rpi_temperature():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as file:
            temperature = int(file.read().strip()) / 1000
        return f"{temperature:.1f}°C"
    except (FileNotFoundError, ValueError, OSError):
        return "—"

app = FastAPI(
    title="PCBVision API",
    description="Backend API for PCBVision Intelligent PCB Inspection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "PCBVision API is running"
    }

@app.get("/api/rpi/health")
async def rpi_health():
    result = await check_rpi_connection()
    return result

# Camera-driven template creation.
# Each call to /next captures exactly one image on the Raspberry Pi.
# Creating a template does not start inspection or activate the template.

@app.get("/api/templates")
async def get_templates():
    try:
        return await list_rpi_templates()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve templates from Raspberry Pi: {exc}",
        ) from exc


@app.post("/api/template/start", status_code=201)
async def start_template_creation(
    request: CreateTemplateRequest,
    db: Session = Depends(get_db),
):
    template_name = request.template_name.strip()
    if not template_name:
        raise HTTPException(status_code=400, detail="Template name cannot be blank.")

    try:
        pi_result = await start_rpi_template(
            template_name=template_name,
            expected_images=request.expected_images,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not start template capture on Raspberry Pi: {exc}",
        ) from exc

    session_id = pi_result.get("session_id")
    if not session_id:
        raise HTTPException(
            status_code=502,
            detail="Raspberry Pi did not return a template session ID.",
        )

    # Store the Raspberry Pi session ID in the existing template_id field,
    # avoiding a database schema migration.
    db_record = TemplateSession(
        template_id=str(session_id),
        expected_images=request.expected_images,
        captured_images=0,
        status="IN_PROGRESS",
    )

    try:
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
    except Exception as exc:
        db.rollback()
        try:
            await cancel_rpi_template(str(session_id))
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Template session could not be saved to the database: {exc}",
        ) from exc

    return {
        "message": "Template capture session started.",
        "session_id": str(session_id),
        "template_id": db_record.template_id,
        "template_name": template_name,
        "expected_images": db_record.expected_images,
        "captured_images": db_record.captured_images,
        "status": db_record.status,
        "raspberry_pi_result": pi_result,
    }


@app.post("/api/template/next")
async def capture_next_template_image(
    request: TemplateSessionRequest,
    db: Session = Depends(get_db),
):
    db_record = (
        db.query(TemplateSession)
        .filter(TemplateSession.template_id == request.session_id)
        .first()
    )
    if not db_record:
        raise HTTPException(status_code=404, detail="Template session not found.")
    if db_record.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=409,
            detail=f"Template session is not active (status: {db_record.status}).",
        )
    if db_record.captured_images >= db_record.expected_images:
        raise HTTPException(
            status_code=409,
            detail="All requested reference images have already been captured.",
        )

    try:
        pi_result = await capture_next_rpi_template_image(request.session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Raspberry Pi template capture failed: {exc}",
        ) from exc

    captured = pi_result.get("captured_images")
    if captured is None:
        captured = pi_result.get("current_image")
    if captured is None:
        # The Pi endpoint successfully returned a capture; advance by one
        # only if its response did not provide an explicit count.
        captured = db_record.captured_images + 1

    try:
        db_record.captured_images = min(
            int(captured),
            db_record.expected_images,
        )
        db.commit()
        db.refresh(db_record)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Capture succeeded on Raspberry Pi but database progress could not be saved: {exc}",
        ) from exc

    return {
        "message": "Reference image captured.",
        "session_id": request.session_id,
        "expected_images": db_record.expected_images,
        "captured_images": db_record.captured_images,
        "status": db_record.status,
        "capture": pi_result,
    }


@app.post("/api/template/finish")
async def finish_template_creation(
    request: TemplateSessionRequest,
    db: Session = Depends(get_db),
):
    db_record = (
        db.query(TemplateSession)
        .filter(TemplateSession.template_id == request.session_id)
        .first()
    )
    if not db_record:
        raise HTTPException(status_code=404, detail="Template session not found.")
    if db_record.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=409,
            detail=f"Template session cannot be finished (status: {db_record.status}).",
        )
    if db_record.captured_images != db_record.expected_images:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Capture all {db_record.expected_images} images before finishing. "
                f"Currently captured: {db_record.captured_images}."
            ),
        )

    try:
        pi_result = await finish_rpi_template(request.session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Raspberry Pi could not build/save the template: {exc}",
        ) from exc

    db_record.status = "COMPLETED"
    try:
        db.commit()
        db.refresh(db_record)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Template was saved on Raspberry Pi but database status update failed: {exc}",
        ) from exc

    return {
        "message": "Template saved successfully. Inspection was not started.",
        "session_id": request.session_id,
        "template_id": db_record.template_id,
        "expected_images": db_record.expected_images,
        "captured_images": db_record.captured_images,
        "status": db_record.status,
        "raspberry_pi_result": pi_result,
    }


@app.post("/api/template/cancel")
async def cancel_template_creation(
    request: TemplateSessionRequest,
    db: Session = Depends(get_db),
):
    db_record = (
        db.query(TemplateSession)
        .filter(TemplateSession.template_id == request.session_id)
        .first()
    )
    if not db_record:
        raise HTTPException(status_code=404, detail="Template session not found.")
    if db_record.status == "COMPLETED":
        raise HTTPException(
            status_code=409,
            detail="A completed template cannot be cancelled.",
        )

    try:
        pi_result = await cancel_rpi_template(request.session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Raspberry Pi could not cancel the template session: {exc}",
        ) from exc

    db_record.status = "CANCELLED"
    db.commit()
    db.refresh(db_record)

    return {
        "message": "Template capture session cancelled.",
        "session_id": request.session_id,
        "status": db_record.status,
        "raspberry_pi_result": pi_result,
    }


@app.get("/api/inspection/image")
async def get_inspection_image(path: str):
    if not path.startswith("/home/pi4/PCBVISION/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid inspection image path",
        )

    if not RPI_BASE_URL:
        raise HTTPException(
            status_code=503,
            detail="Raspberry Pi address is not configured",
        )

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.get(
                f"{RPI_BASE_URL}/inspection/image",
                params={"path": path},
            )

        if response.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail="Image not found on Raspberry Pi",
            )

        if response.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Raspberry Pi image request failed: "
                    f"HTTP {response.status_code}"
                ),
            )

        content_type = response.headers.get(
            "content-type", "application/octet-stream"
        )

        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=502,
                detail="Raspberry Pi did not return an image",
            )

        return Response(
            content=response.content,
            media_type=content_type,
        )

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Raspberry Pi: {exc}",
        ) from exc

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "PCBVision API"
    }
    
@app.get("/api/health/database")
def database_health(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1"))
        result.fetchone()

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception as e:
        return {
            "status": "error",
            "database": "not connected",
            "detail": str(e)
        }

class InspectionRequest(BaseModel):
    uploadId: int | None = None

@app.post("/api/inspection/upload")
async def upload_pcb(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    image_data = await file.read()

    if not image_data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    safe_filename = Path(file.filename or "pcb_image.jpg").name

    file_path = (
        UPLOAD_DIR
        / f"{uuid.uuid4().hex[:8].upper()}_{safe_filename}"
    )
    file_path.write_bytes(image_data)

    inspection = Inspection(
        board_id=f"PCB-{uuid.uuid4().hex[:8].upper()}",
        image_name=safe_filename,
        image_path=str(file_path),
        model_name="Pending",
        status="uploaded",
        confidence=None,
        defect_class=None,
        inspection_time=None,
        xai_explanation="ML inspection pending."
    )

    db.add(inspection)
    db.commit()
    db.refresh(inspection)

    try:
        result = await run_rpi_uploaded_inspection(
            str(file_path)
        )

        # The RPi API returns:
        # {"status": "success", "inspection": {...}}
        inspection_data = result.get("inspection", result)

        if not isinstance(inspection_data, dict):
            raise RuntimeError(
                "Raspberry Pi returned an invalid inspection result."
            )

        inspection.status = inspection_data.get(
            "status", "UNVERIFIED"
        )

        inspection.model_name = "YOLO"
        inspection.confidence = max(
            (
                float(item["confidence"])
                for item in inspection_data.get("detections", [])
                if item.get("confidence") is not None
            ),
            default=None
        )
        inspection.inspection_time = inspection_data.get(
            "inspection_time"
        )

        db.commit()
        db.refresh(inspection)

        return {
            "id": inspection.id,
            "board_id": inspection.board_id,
            "filename": inspection.image_name,
            "status": inspection.status,
            "message": "PCB image uploaded and inspected successfully.",
            "inspection": inspection_data,
        }

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=f"PCB image was uploaded, but inspection failed: {exc}"
        ) from exc

    finally:
        await file.close()


@app.get("/api/inspections")
def get_inspections(db: Session = Depends(get_db)):

    inspections = (
        db.query(Inspection)
        .order_by(Inspection.created_at.desc())
        .all()
    )

    return inspections

@app.get("/api/inspection/export/csv")
def export_inspection_csv(
    db: Session = Depends(get_db)
):
    inspections = (
        db.query(Inspection)
        .order_by(Inspection.created_at.desc())
        .all()
    )

    output = StringIO()

    writer = csv.writer(output)

    writer.writerow([
        "ID",
        "Board ID",
        "Image Name",
        "Model",
        "Status",
        "Confidence",
        "Defect Class",
        "Inspection Time",
        "XAI Explanation",
        "Created At",
    ])

    for inspection in inspections:
        writer.writerow([
            inspection.id,
            inspection.board_id,
            inspection.image_name,
            inspection.model_name,
            inspection.status,
            inspection.confidence,
            inspection.defect_class,
            inspection.inspection_time,
            inspection.xai_explanation,
            inspection.created_at,
        ])

    output.seek(0)

    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
    )

    response.headers["Content-Disposition"] = (
        'attachment; filename="pcbvision_inspection_export.csv"'
    )

    response.headers["X-Total-Records"] = str(len(inspections))

    return response


@app.get("/api/inspection/{inspection_id}/export/csv")
def export_single_inspection_csv(
    inspection_id: int,
    db: Session = Depends(get_db)
):
    """Export a single inspection as CSV with all detections and details."""
    inspection = (
        db.query(Inspection)
        .filter(Inspection.id == inspection_id)
        .first()
    )

    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    detections = (
        db.query(Detection)
        .filter(Detection.inspection_id == inspection_id)
        .all()
    )

    output = StringIO()
    writer = csv.writer(output)

    # Inspection metadata row (first row)
    writer.writerow([
        "Inspection ID",
        "Board ID",
        "Image Name",
        "Model",
        "Status",
        "Confidence (%)",
        "Defect Class",
        "Inspection Time (s)",
        "XAI Explanation",
        "Created At",
        "Detection Count",
    ])

    writer.writerow([
        inspection.id,
        inspection.board_id,
        inspection.image_name or "N/A",
        inspection.model_name or "N/A",
        inspection.status or "N/A",
        f"{inspection.confidence:.2f}" if inspection.confidence is not None else "N/A",
        inspection.defect_class or "None detected",
        f"{inspection.inspection_time:.2f}" if inspection.inspection_time is not None else "N/A",
        inspection.xai_explanation or "N/A",
        inspection.created_at.isoformat() if inspection.created_at else "N/A",
        len(detections),
    ])

    # If there are detections, add them as separate rows
    if detections:
        writer.writerow([])  # Empty row separator
        writer.writerow([
            "Detection ID",
            "Class Name",
            "Confidence (%)",
            "X Min",
            "Y Min",
            "X Max",
            "Y Max",
            "Detection Type",
        ])

        for detection in detections:
            writer.writerow([
                detection.id,
                detection.class_name,
                f"{detection.confidence:.2f}" if detection.confidence is not None else "N/A",
                detection.x_min if detection.x_min is not None else "N/A",
                detection.y_min if detection.y_min is not None else "N/A",
                detection.x_max if detection.x_max is not None else "N/A",
                detection.y_max if detection.y_max is not None else "N/A",
                detection.detection_type or "YOLO",
            ])

    output.seek(0)

    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
    )

    safe_board_id = (inspection.board_id or "PCB").replace("/", "-").replace("\\", "-")
    response.headers["Content-Disposition"] = (
        f'attachment; filename="PCBVision_Inspection_{safe_board_id}.csv"'
    )

    response.headers["X-Total-Records"] = str(1 + len(detections))

    return response


@app.get("/api/inspection/{inspection_id}/export/json")
def export_single_inspection_json(
    inspection_id: int,
    db: Session = Depends(get_db)
):
    """Export a single inspection as JSON with all detections and details."""
    inspection = (
        db.query(Inspection)
        .filter(Inspection.id == inspection_id)
        .first()
    )

    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    detections = (
        db.query(Detection)
        .filter(Detection.inspection_id == inspection_id)
        .all()
    )

    # Build structured JSON response
    detection_list = []
    for detection in detections:
        detection_list.append({
            "id": detection.id,
            "class_name": detection.class_name,
            "confidence": detection.confidence,
            "bbox": {
                "x_min": detection.x_min,
                "y_min": detection.y_min,
                "x_max": detection.x_max,
                "y_max": detection.y_max,
            },
            "detection_type": detection.detection_type or "YOLO",
        })

    result = {
        "inspection": {
            "id": inspection.id,
            "board_id": inspection.board_id,
            "image_name": inspection.image_name,
            "model_name": inspection.model_name,
            "status": inspection.status,
            "confidence": inspection.confidence,
            "defect_class": inspection.defect_class,
            "inspection_time": inspection.inspection_time,
            "xai_explanation": inspection.xai_explanation,
            "created_at": inspection.created_at.isoformat() if inspection.created_at else None,
        },
        "detections": detection_list,
        "detection_count": len(detection_list),
    }

    response = Response(
        content=json.dumps(result, indent=2, default=str),
        media_type="application/json",
    )

    safe_board_id = (inspection.board_id or "PCB").replace("/", "-").replace("\\", "-")
    response.headers["Content-Disposition"] = (
        f'attachment; filename="PCBVision_Inspection_{safe_board_id}.json"'
    )

    return response

@app.get("/api/inspection-history")
def get_inspection_history(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    defect: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Inspection)

    # Search by PCB ID or image name
    if search:
        search_term = f"%{search}%"

        query = query.filter(
            (Inspection.board_id.ilike(search_term)) |
            (Inspection.image_name.ilike(search_term))
        )

    # Filter by inspection status
    if status and status.upper() != "ALL":
        query = query.filter(
        Inspection.status.ilike(status)
    )

    if defect and defect.upper() != "ALL":
        query = query.filter(
        Inspection.defect_class.ilike(defect)
    )

    # Newest inspections first
    query = query.order_by(
        Inspection.created_at.desc()
    )

    total_records = query.count()

    offset = (page - 1) * pageSize

    inspections = (
        query
        .offset(offset)
        .limit(pageSize)
        .all()
    )

    pages = (
        (total_records + pageSize - 1) // pageSize
        if total_records
        else 1
    )

    records = []

    for inspection in inspections:
        records.append({
            "id": inspection.id,
            "pcbId": inspection.board_id,
            "board_id": inspection.board_id,
            "scanDateTime": inspection.created_at,
            "created_at": inspection.created_at,
            "targetModel": inspection.model_name or "PCBVision YOLO11s",
            "model_name": inspection.model_name,
            "status": inspection.status,
            "defectClass": inspection.defect_class or "None",
            "defect_class": inspection.defect_class or "None",
            "yoloConfidence": inspection.confidence,
            "confidence": inspection.confidence,
            "cycleTime": inspection.inspection_time,
            "inspection_time": inspection.inspection_time,
            "imagePath": f"/api/inspection/{inspection.id}/image" if inspection.image_path else None,
            "image_name": inspection.image_name,

            # Fields not available in the current DB schema
            "operator": None,
            "componentsCount": None,
            "defectCoordinates": None,
            "gradCamExplanation": inspection.xai_explanation or "",
            "xai_explanation": inspection.xai_explanation or "",
            "verificationDetails": None,
        })

    return {
        "records": records,
        "totalRecords": total_records,
        "pages": pages,
        "page": page,
        "pageSize": pageSize,
    }

@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    start_today = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    start_yesterday = start_today - timedelta(days=1)

    start_7_days = start_today - timedelta(days=6)

    # ---------------------------------------------------------
    # Today's inspections
    # ---------------------------------------------------------
    today_inspections = (
        db.query(Inspection)
        .filter(Inspection.created_at >= start_today)
        .all()
    )

    yesterday_inspections = (
        db.query(Inspection)
        .filter(
            Inspection.created_at >= start_yesterday,
            Inspection.created_at < start_today,
        )
        .all()
    )

    recent_inspections = (
        db.query(Inspection)
        .filter(Inspection.created_at >= start_7_days)
        .all()
    )

    def calculate_yield(records):
        if not records:
            return 0.0

        passed = sum(
            1 for record in records
            if str(record.status or "").upper() == "PASS"
        )

        return round((passed / len(records)) * 100, 1)

    def calculate_average(records, field):
        values = [
            getattr(record, field)
            for record in records
            if getattr(record, field) is not None
        ]

        if not values:
            return 0.0

        return round(sum(values) / len(values), 2)

    # ---------------------------------------------------------
    # KPI calculations
    # ---------------------------------------------------------
    today_yield = calculate_yield(today_inspections)
    yesterday_yield = calculate_yield(yesterday_inspections)

    today_defects = sum(
        1
        for record in today_inspections
        if str(record.status or "").upper() != "PASS"
    )

    yesterday_defects = sum(
        1
        for record in yesterday_inspections
        if str(record.status or "").upper() != "PASS"
    )

    today_confidence = calculate_average(
        today_inspections,
        "confidence",
    )

    yesterday_confidence = calculate_average(
        yesterday_inspections,
        "confidence",
    )

    today_cycle_time = calculate_average(
        today_inspections,
        "inspection_time",
    )

    yesterday_cycle_time = calculate_average(
        yesterday_inspections,
        "inspection_time",
    )

    defect_change = 0.0
    if yesterday_defects:
        defect_change = round(
            ((today_defects - yesterday_defects) / yesterday_defects) * 100,
            1,
        )

    confidence_change = round(
        today_confidence - yesterday_confidence,
        1,
    )

    cycle_change = round(
        today_cycle_time - yesterday_cycle_time,
        2,
    )

    yield_change = round(
        today_yield - yesterday_yield,
        1,
    )

    # ---------------------------------------------------------
    # Defect categories
    # ---------------------------------------------------------
    defect_counts = {}

    for record in today_inspections:
        defect = str(record.defect_class or "").strip()

        if not defect or defect.lower() == "none":
            continue

        defect_counts[defect] = defect_counts.get(defect, 0) + 1

    defect_chart = [
        {
            "name": name,
            "count": count,
        }
        for name, count in sorted(
            defect_counts.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    # ---------------------------------------------------------
    # Hourly throughput
    # ---------------------------------------------------------
    hourly_throughput = []

    for hour in range(24):
        hour_records = [
            record
            for record in today_inspections
            if record.created_at
            and record.created_at.hour == hour
        ]

        if not hour_records:
            continue

        passed = sum(
            1
            for record in hour_records
            if str(record.status or "").upper() == "PASS"
        )

        hourly_throughput.append({
            "hour": f"{hour:02d}:00",
            "inspected": len(hour_records),
            "pass": passed,
            "fail": len(hour_records) - passed,
        })

    # ---------------------------------------------------------
    # Seven-day trend
    # ---------------------------------------------------------
    trend_7_days = []

    for offset in range(6, -1, -1):
        day_start = start_today - timedelta(days=offset)
        day_end = day_start + timedelta(days=1)

        day_records = [
            record
            for record in recent_inspections
            if record.created_at
            and day_start <= record.created_at < day_end
        ]

        trend_7_days.append({
            "day": day_start.strftime("%a"),
            "passRate": calculate_yield(day_records),
            "avgTime": calculate_average(
                day_records,
                "inspection_time",
            ),
        })

    # ---------------------------------------------------------
    # Response
    # ---------------------------------------------------------
    return {
        "kpis": [
            {
                "label": "Yield Rate",
                "value": today_yield,
                "suffix": "%",
                "decimals": 1,
                "trend": f"{yield_change:+.1f}%",
                "up": yield_change >= 0,
            },
            {
                "label": "Today's Defects",
                "value": today_defects,
                "suffix": "",
                "decimals": 0,
                "trend": f"{defect_change:+.1f}%",
                "up": defect_change <= 0,
            },
            {
                "label": "Avg Confidence",
                "value": today_confidence,
                "suffix": "%",
                "decimals": 1,
                "trend": f"{confidence_change:+.1f}%",
                "up": confidence_change >= 0,
            },
            {
                "label": "Inspection Time",
                "value": today_cycle_time,
                "suffix": "s",
                "decimals": 2,
                "trend": f"{cycle_change:+.2f}s",
                "up": cycle_change <= 0,
            },
        ],
        "qualitySummary": [
            {
                "name": "PASS RATE",
                "value": today_yield,
                "color": "#00FF9C",
            },
            {
                "name": "DEFECT RATE",
                "value": round(100 - today_yield, 1),
                "color": "#FF4D6D",
            },
        ],
        "donutStats": [
            {
                "label": "Today's Target",
                "value": 95.0,
            },
            {
                "label": "Yesterday's Yield",
                "value": yesterday_yield,
            },
            {
                "label": "Daily Improvement",
                "value": abs(yield_change),
                "up": yield_change >= 0,
            },
        ],
        "yieldRate": today_yield,
        "defectChart": defect_chart,
        "hourlyThroughput": hourly_throughput,
        "trend7Days": trend_7_days,
    }

@app.get("/api/reports")
def get_reports(
    db: Session = Depends(get_db)
):
    reports = (
        db.query(Report)
        .order_by(Report.created_at.desc())
        .all()
    )

    return [
        {
            "id": report.id,
            "reportId": report.report_id,
            "title": report.title,
            "reportType": report.report_type,
            "inspectionId": report.inspection_id,
            "fileName": report.file_name,
            "filePath": report.file_path,
            "status": report.status,
            "createdAt": report.created_at,
        }
        for report in reports
    ]

def _generate_inspection_report(
    inspection,
    report_data,
    db,
    reports_dir,
):
    """Build a PDF report for a specific inspection and persist a Report row.

    Reused by both the legacy POST /reports endpoint (latest inspection) and
    the new POST /reports/generate endpoint (specific inspection id).
    """
    # ---------------------------------------------------------
    # Report identity and file location
    # ---------------------------------------------------------

    report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
    filename = f"{report_id}.pdf"

    reports_dir.mkdir(parents=True, exist_ok=True)
    file_path = reports_dir / filename

    # ---------------------------------------------------------
    # ReportLab imports
    # ---------------------------------------------------------

    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
    Image as RLImage,
)
    from PIL import Image as PILImage

    # ---------------------------------------------------------
    # Document setup
    # ---------------------------------------------------------

    PAGE_WIDTH, PAGE_HEIGHT = A4

    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=28 * mm,
        bottomMargin=20 * mm,
        title="PCBVision Inspection Report",
        author="PCBVision",
        subject="Automated PCB Inspection Report",
    )

    # ---------------------------------------------------------
    # Color palette
    # ---------------------------------------------------------

    PCB_GREEN = colors.HexColor("#20D486")
    DARK_GREEN = colors.HexColor("#073D2A")
    DEEP_GREEN = colors.HexColor("#03251B")
    DARK_BG = colors.HexColor("#081713")
    LIGHT_BG = colors.HexColor("#F4F8F6")
    BORDER = colors.HexColor("#C9D8D1")
    TEXT = colors.HexColor("#17231F")
    MUTED = colors.HexColor("#64756E")
    WHITE = colors.white
    PASS_GREEN = colors.HexColor("#168A58")
    FAIL_RED = colors.HexColor("#C93636")
    HEADER_BG = colors.HexColor("#0B1F18")
    TEXT_MUTED = colors.HexColor("#8FA3A0")

    # ---------------------------------------------------------
    # Styles
    # ---------------------------------------------------------

    styles = getSampleStyleSheet()

    report_title = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=25,
        textColor=TEXT,
        spaceAfter=4,
    )

    report_subtitle = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=MUTED,
        spaceAfter=12,
    )

    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=DARK_GREEN,
        spaceBefore=5,
        spaceAfter=7,
    )

    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=14,
        textColor=TEXT,
    )

    small = ParagraphStyle(
        "Small",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=MUTED,
    )

    table_label = ParagraphStyle(
        "TableLabel",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=MUTED,
    )

    table_value = ParagraphStyle(
        "TableValue",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=TEXT,
    )

    xai_text = ParagraphStyle(
        "XAIText",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=14,
        textColor=TEXT,
    )

    # ---------------------------------------------------------
    # Header / footer
    # ---------------------------------------------------------

    def draw_header_footer(canvas, document):
        canvas.saveState()

        # Header line
        canvas.setStrokeColor(PCB_GREEN)
        canvas.setLineWidth(1.2)
        canvas.line(
            18 * mm,
            PAGE_HEIGHT - 17 * mm,
            PAGE_WIDTH - 18 * mm,
            PAGE_HEIGHT - 17 * mm,
        )

        # Brand
        canvas.setFont("Helvetica-Bold", 13)
        canvas.setFillColor(PCB_GREEN)
        canvas.drawString(
            18 * mm,
            PAGE_HEIGHT - 13 * mm,
            "PCB",
        )

        canvas.setFillColor(TEXT)
        canvas.drawString(
            30 * mm,
            PAGE_HEIGHT - 13 * mm,
            "Vision",
        )

        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(
            PAGE_WIDTH - 18 * mm,
            PAGE_HEIGHT - 13 * mm,
            "INTELLIGENT PCB INSPECTION SYSTEM",
        )

        # Footer
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(
            18 * mm,
            13 * mm,
            PAGE_WIDTH - 18 * mm,
            13 * mm,
        )

        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)

        canvas.drawString(
            18 * mm,
            8 * mm,
            "PCBVision • Quality Audit Report",
        )

        canvas.drawRightString(
            PAGE_WIDTH - 18 * mm,
            8 * mm,
            f"Page {document.page}",
        )

        canvas.restoreState()

    # ---------------------------------------------------------
    # Helper for table cells
    # ---------------------------------------------------------

    def cell_label(value):
        return Paragraph(str(value), table_label)

    def cell_value(value):
        return Paragraph(str(value), table_value)

    # ---------------------------------------------------------
    # Data preparation
    # ---------------------------------------------------------

    status = (inspection.status or "N/A").upper()
    defect = inspection.defect_class or "None detected"
    model_name = inspection.model_name or "Pending"
    image_name = inspection.image_name or "N/A"

    inspection_time = inspection.inspection_time or 0

    explanation = (
        inspection.xai_explanation
        or "No explanation is currently available."
    )

    report_scope = report_data.get("reportScope", "SUMMARY").upper()

    start_date = report_data.get("startDate", "N/A")
    end_date = report_data.get("endDate", "N/A")

    pcb_type_id = report_data.get("pcbTypeId")

    embed_gradcam = bool(
        report_data.get("embedGradCam", False)
    )

    include_opencv_coordinates = bool(
        report_data.get("includeOpenCvCoordinates", False)
    )

    # ---------------------------------------------------------
    # Build document
    # ---------------------------------------------------------

    story = []
    
    # ---------------------------------------------------------
    # Report type configuration
    # ---------------------------------------------------------

    if report_scope == "SUMMARY":
        report_profile_title = "Executive Inspection Summary"
        report_profile_description = (
            "A concise overview of the PCB inspection result, "
            "inspection status, and key findings."
        )

    elif report_scope == "FULL":
        report_profile_title = "Complete Inspection Report"
        report_profile_description = (
            "A comprehensive inspection record containing "
            "inspection details, detection information, XAI findings, "
            "and audit configuration."
        )

    elif report_scope == "X-MCCV":
        report_profile_title = "X-MCCV Explainability Report"
        report_profile_description = (
            "An explainability-focused report containing AI findings, "
            "diagnostic information, and available model interpretation data."
        )

    else:
        report_scope = "SUMMARY"
        report_profile_title = "Executive Inspection Summary"
        report_profile_description = (
            "A concise overview of the PCB inspection result, "
            "inspection status, and key findings."
        )
        
    is_summary = report_scope == "SUMMARY"
    is_full = report_scope == "FULL"
    is_xmccv = report_scope == "X-MCCV"

    # Title
    story.append(Spacer(1, 5 * mm))

    if is_summary:
        report_title_text = "PCB Inspection Report — Overview"
    elif is_full:
        report_title_text = "PCB Inspection Report — Full Details"
    else:
        report_title_text = "PCB Inspection Report — X-MCCV"

    story.append(
        Paragraph(
            report_title_text,
            report_title,
        )
    )
    
    story.append(
        Paragraph(
            report_profile_title,
            ParagraphStyle(
                "ProfileTitle",
                parent=body,
                fontName="Helvetica-Bold",
                fontSize=10,
                leading=13,
                textColor=PCB_GREEN,
                spaceAfter=3,
            ),
        )
    )

    story.append(
        Paragraph(
            report_profile_description,
            small,
        )
    )

    story.append(Spacer(1, 4 * mm))

    story.append(
        Paragraph(
            "Automated Quality Inspection & Compliance Summary",
            report_subtitle,
        )
    )

    # ---------------------------------------------------------
    # Report identification block
    # ---------------------------------------------------------

    generated_date = (
        inspection.created_at.strftime("%d %b %Y, %H:%M UTC")
        if inspection.created_at
        else "N/A"
    )

    identification_data = [
        [
            cell_label("REPORT ID"),
            cell_value(report_id),
            cell_label("PCB ID"),
            cell_value(inspection.board_id),
        ],
        [
            cell_label("GENERATED"),
            cell_value(generated_date),
            cell_label("REPORT TYPE"),
            cell_value(report_scope),
        ],
    ]

    identification_table = Table(
        identification_data,
        colWidths=[
            25 * mm,
            58 * mm,
            25 * mm,
            58 * mm,
        ],
    )

    identification_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
                ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    story.append(identification_table)
    story.append(Spacer(1, 7 * mm))

    # ---------------------------------------------------------
    # Inspection result
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "Inspection Result",
            section_title,
        )
    )

    status_color = PASS_GREEN if status == "PASS" else FAIL_RED

    result_data = [
        [
            Paragraph(
                f"<b>{status}</b>",
                ParagraphStyle(
                    "Status",
                    parent=body,
                    fontName="Helvetica-Bold",
                    fontSize=15,
                    textColor=WHITE,
                    alignment=TA_CENTER,
                ),
            ),
            cell_value(
                f"<b>Defect:</b> {defect}<br/>"
                f"<b>Inspection Time:</b> {inspection_time:.2f} seconds<br/>"
                f"<b>Model:</b> {model_name}"
            ),
        ]
    ]

    result_table = Table(
        result_data,
        colWidths=[32 * mm, 134 * mm],
    )

    result_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), status_color),
                ("BACKGROUND", (1, 0), (1, 0), LIGHT_BG),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )

    story.append(result_table)
    story.append(Spacer(1, 7 * mm))

    # ---------------------------------------------------------
    # Inspection details
    # ---------------------------------------------------------

    if is_full:

        story.append(
            Paragraph(
                "Inspection Details",
                section_title,
            )
        )

        details_data = [
            [
                cell_label("PCB IMAGE"),
                cell_value(image_name),
            ],
            [
                cell_label("DEFECT CLASS"),
                cell_value(defect),
            ],
            [
                cell_label("MODEL"),
                cell_value(model_name),
            ],
            [
                cell_label("INSPECTION TIME"),
                cell_value(f"{inspection_time:.2f} seconds"),
            ],
        ]

        details_table = Table(
            details_data,
            colWidths=[48 * mm, 118 * mm],
        )

        details_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
                    ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )

        story.append(details_table)
        story.append(Spacer(1, 7 * mm))

    # ---------------------------------------------------------
    # PCB Image
    # ---------------------------------------------------------

    if inspection.image_path:
        pcb_path = Path(inspection.image_path)

        if pcb_path.exists():
            try:
                # Convert image to PNG so ReportLab can reliably embed it
                temp_image_path = reports_dir / f"{report_id}_pcb.png"

                with PILImage.open(pcb_path) as img:
                    img = img.convert("RGB")
                    img.save(temp_image_path, "PNG")

                    img_width, img_height = img.size

                max_width = 150 * mm
                max_height = 85 * mm

                scale = min(
                    max_width / img_width,
                    max_height / img_height,
                )

                display_width = img_width * scale
                display_height = img_height * scale

                story.append(
                    Paragraph(
                        "Inspected PCB Image",
                        section_title,
                    )
                )

                pcb_image = RLImage(
                    str(temp_image_path),
                    width=display_width,
                    height=display_height,
                )

                story.append(
                    Table(
                        [[pcb_image]],
                        colWidths=[166 * mm],
                        style=TableStyle(
                            [
                                (
                                    "BACKGROUND",
                                    (0, 0),
                                    (-1, -1),
                                    LIGHT_BG,
                                ),
                                (
                                    "BOX",
                                    (0, 0),
                                    (-1, -1),
                                    0.7,
                                    BORDER,
                                ),
                                (
                                    "ALIGN",
                                    (0, 0),
                                    (-1, -1),
                                    "CENTER",
                                ),
                                (
                                    "VALIGN",
                                    (0, 0),
                                    (-1, -1),
                                    "MIDDLE",
                                ),
                                (
                                    "LEFTPADDING",
                                    (0, 0),
                                    (-1, -1),
                                    8,
                                ),
                                (
                                    "RIGHTPADDING",
                                    (0, 0),
                                    (-1, -1),
                                    8,
                                ),
                                (
                                    "TOPPADDING",
                                    (0, 0),
                                    (-1, -1),
                                    8,
                                ),
                                (
                                    "BOTTOMPADDING",
                                    (0, 0),
                                    (-1, -1),
                                    8,
                                ),
                            ]
                        ),
                    )
                )

                story.append(Spacer(1, 7 * mm))

            except Exception:
                pass
    
    # ---------------------------------------------------------
    # XAI explanation
    # ---------------------------------------------------------

    if is_xmccv:
        xai_title = "X-MCCV Explainability Analysis"
        xai_content = (
            f"<b>Primary Finding:</b> {explanation}<br/><br/>"
            "<b>Explainability Status:</b> X-MCCV explainability analysis "
            "is configured for this report. Grad-CAM visualization and "
            "raw OpenCV coordinate extraction will be populated when the "
            "ML inspection pipeline is integrated."
        )

    elif is_full:
        xai_title = "AI Inspection Explanation"
        xai_content = (
            f"<b>Inspection Explanation:</b> {explanation}<br/><br/>"
            "<b>Explainability Status:</b> The explanation shown here is "
            "based on the inspection data currently available to the "
            "PCBVision system."
        )

    else:
        xai_title = "Inspection Explanation"
        xai_content = (
            f"<b>Finding:</b> {explanation}"
        )

    story.append(
        Paragraph(
            xai_title,
            section_title,
        )
    )

    xai_table = Table(
        [
            [
                Paragraph(
                    xai_content,
                    xai_text,
                )
            ]
        ],
        colWidths=[166 * mm],
    )

    xai_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0F8F4")),
                ("BOX", (0, 0), (-1, -1), 1, PCB_GREEN),
                ("LINEBEFORE", (0, 0), (0, -1), 4, PCB_GREEN),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )

    story.append(xai_table)
    story.append(Spacer(1, 7 * mm))

    # ---------------------------------------------------------
    # Report scope
    # ---------------------------------------------------------

    story.append(
        Paragraph(
            "Report Scope",
            section_title,
        )
    )

    scope_data = [
        [
            cell_label("SCOPE"),
            cell_value(report_scope),
            cell_label("PCB TYPE"),
            cell_value(report_data.get("pcbType", "All PCB Types")),
        ],
        [
            cell_label("START DATE"),
            cell_value(start_date),
            cell_label("END DATE"),
            cell_value(end_date),
        ],
    ]

    scope_table = Table(
        scope_data,
        colWidths=[
            25 * mm,
            58 * mm,
            25 * mm,
            58 * mm,
        ],
    )

    scope_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
                ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(scope_table)
    story.append(Spacer(1, 8 * mm))

    # ---------------------------------------------------------
    # Detection Summary
    # ---------------------------------------------------------

    if is_summary:
        story.append(Paragraph("Detection Summary", section_title))

        detection_data = [
            [cell_label("DEFECT CLASS"), cell_value(defect)],
            [cell_label("RESULT"), cell_value(status)],
        ]

    elif is_full:
        story.append(Paragraph("Detection Summary", section_title))

        detection_data = [
            [cell_label("DEFECT CLASS"), cell_value(defect)],
            [cell_label("RESULT"), cell_value(status)],
            [cell_label("MODEL"), cell_value(model_name)],
            [cell_label("INSPECTION TIME"), cell_value(f"{inspection_time:.2f} seconds")],
        ]

    else:  # X-MCCV
        story.append(Paragraph("Detection Summary", section_title))

        detection_data = [
            [cell_label("DEFECT CLASS"), cell_value(defect)],
            [cell_label("RESULT"), cell_value(status)],
            [cell_label("EXPLAINABILITY"), cell_value("X-MCCV Analysis")],
        ]

    detection_table = Table(
        detection_data,
        colWidths=[65 * mm, 101 * mm]
    )

    detection_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (0, -1), TEXT_MUTED),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    story.append(detection_table)
    story.append(Spacer(1, 8 * mm))

    # ---------------------------------------------------------
    # Audit configuration
    # ---------------------------------------------------------

    if is_full or is_xmccv:

        story.append(
            Paragraph(
                "Audit Configuration",
                section_title,
            )
        )

        heatmaps = "Enabled" if embed_gradcam else "Disabled"

        coordinates = (
            "Included"
            if include_opencv_coordinates
            else "Excluded"
        )

        audit_data = [
            [
                cell_label("GRAD-CAM HEATMAPS"),
                cell_value(heatmaps),
            ],
            [
                cell_label("RAW OPENCV COORDINATES"),
                cell_value(coordinates),
            ],
        ]

        audit_table = Table(
            audit_data,
            colWidths=[65 * mm, 101 * mm],
        )

        audit_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
                    ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )

        story.append(audit_table)
        story.append(Spacer(1, 9 * mm))

    # ---------------------------------------------------------
    # Final note
    # ---------------------------------------------------------

    story.append(
        HRFlowable(
            width="100%",
            thickness=0.7,
            color=BORDER,
            spaceBefore=2,
            spaceAfter=8,
        )
    )

    story.append(
        Paragraph(
            "<b>Report Integrity Notice</b>",
            ParagraphStyle(
                "IntegrityTitle",
                parent=body,
                fontName="Helvetica-Bold",
                fontSize=8.5,
                textColor=DARK_GREEN,
                spaceAfter=3,
            ),
        )
    )

    story.append(
        Paragraph(
            "This document was generated automatically by the PCBVision "
            "inspection system. Inspection results and explanations are "
            "based on the data available at the time the report was generated.",
            small,
        )
    )

    # ---------------------------------------------------------
    # Generate PDF
    # ---------------------------------------------------------

    doc.build(
        story,
        onFirstPage=draw_header_footer,
        onLaterPages=draw_header_footer,
    )

    # ---------------------------------------------------------
    # Save database record
    # ---------------------------------------------------------

    file_size = file_path.stat().st_size

    if is_summary:
        report_title_db = "PCB Inspection Report — Overview"
    elif is_full:
        report_title_db = "PCB Inspection Report — Full Details"
    else:
        report_title_db = "PCB Inspection Report — X-MCCV"

    report = Report(
        report_id=report_id,
        title=report_title_db,
        report_type=report_scope,
        inspection_id=inspection.id,
        file_name=filename,
        file_path=str(file_path),
        status="GENERATED",
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    notification = Notification(
        type="success",
        title="Report Generated",
        message=f"{report.title} was generated successfully.",
        inspection_id=inspection.id
    )

    db.add(notification)
    db.commit()

    return {
        "id": report.id,
        "reportId": report.report_id,
        "title": report.title,
        "type": report.report_type,
        "reportType": report.report_type,
        "inspectionId": report.inspection_id,
        "pcbId": inspection.board_id,
        "filename": filename,
        "fileName": filename,
        "filePath": str(file_path),
        "size": f"{file_size / 1024:.1f} KB",
        "status": report.status,
        "date": report.created_at,
        "createdAt": report.created_at,
        "downloadUrl": f"/api/reports/{report.id}/download",
    }


@app.post("/api/reports")
def create_report(
    report_data: dict,
    db: Session = Depends(get_db)
):
    inspection = (
        db.query(Inspection)
        .order_by(Inspection.created_at.desc())
        .first()
    )

    if not inspection:
        return {
            "status": "ERROR",
            "message": "No inspection data available to generate report."
        }

    reports_dir = UPLOAD_DIR / "reports"
    return _generate_inspection_report(inspection, report_data, db, reports_dir)


@app.post("/api/reports/generate")
def generate_report(
    payload: dict,
    db: Session = Depends(get_db)
):
    """Generate a downloadable PDF report for a specific inspection.

    The inspection id is taken from the request body so the Dashboard can
    request a report for the inspection currently displayed on screen. Falls
    back to the latest inspection when no id is supplied.
    """
    inspection_id = payload.get("inspectionId") or payload.get("inspection_id")
    inspection = None

    if inspection_id is not None:
        try:
            inspection = (
                db.query(Inspection)
                .filter(Inspection.id == int(inspection_id))
                .first()
            )
        except (TypeError, ValueError):
            inspection = None

    if inspection is None:
        inspection = (
            db.query(Inspection)
            .order_by(Inspection.created_at.desc())
            .first()
        )

    if not inspection:
        return {
            "status": "ERROR",
            "message": "No inspection data available to generate report."
        }

    reports_dir = UPLOAD_DIR / "reports"
    return _generate_inspection_report(inspection, payload, db, reports_dir)


@app.get("/api/reports/{report_id}")
def get_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    report = (
        db.query(Report)
        .filter(Report.id == report_id)
        .first()
    )

    if not report:
        return {
            "status": "ERROR",
            "message": "Report not found"
        }

    return {
        "id": report.id,
        "reportId": report.report_id,
        "title": report.title,
        "reportType": report.report_type,
        "inspectionId": report.inspection_id,
        "fileName": report.file_name,
        "filePath": report.file_path,
        "status": report.status,
        "createdAt": report.created_at,
        "downloadUrl": f"/api/reports/{report.id}/download"
    }

@app.get("/api/reports/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    report = (
        db.query(Report)
        .filter(Report.id == report_id)
        .first()
    )

    if not report:
        return {
            "status": "ERROR",
            "message": "Report not found"
        }

    if not report.file_path:
        return {
            "status": "ERROR",
            "message": "Report file not available"
        }

    file_path = Path(report.file_path)

    if not file_path.exists():
        return {
            "status": "ERROR",
            "message": "Report file not found"
        }

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=report.file_name
    )
    
@app.get("/api/reports/{report_id}/view")
def view_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    report = (
        db.query(Report)
        .filter(Report.id == report_id)
        .first()
    )

    if not report:
        return {
            "status": "ERROR",
            "message": "Report not found"
        }

    if not report.file_path:
        return {
            "status": "ERROR",
            "message": "Report file not available"
        }

    file_path = Path(report.file_path)

    if not file_path.exists():
        return {
            "status": "ERROR",
            "message": "Report file not found"
        }

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline"
        }
    )

@app.get("/api/inspection-history/{inspection_id}")
def get_inspection_history_details(
    inspection_id: int,
    db: Session = Depends(get_db)
):
    inspection = (
        db.query(Inspection)
        .filter(Inspection.id == inspection_id)
        .first()
    )

    if not inspection:
        return {
            "status": "ERROR",
            "message": "Inspection record not found"
        }

    return {
        "id": inspection.id,
        "pcbId": inspection.board_id,
        "scanDateTime": inspection.created_at,
        "targetModel": inspection.model_name,
        "status": inspection.status,
        "defectClass": inspection.defect_class,
        "yoloConfidence": inspection.confidence,
        "cycleTime": inspection.inspection_time,
        "imagePath": inspection.image_path,
        "operator": None,
        "componentsCount": None,
        "defectCoordinates": None,
        "gradCamExplanation": inspection.xai_explanation or "",
        "verificationDetails": None,
    }

@app.get("/api/inspection/latest")
def get_latest_inspection(
    db: Session = Depends(get_db)
):
    inspection = (
        db.query(Inspection)
        .order_by(Inspection.created_at.desc())
        .first()
    )

    if not inspection:
        return {"status": "ERROR", "message": "No inspection found"}

    return inspection

@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    start_of_today = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    start_of_yesterday = start_of_today - timedelta(days=1)

    today_inspections = (
        db.query(Inspection)
        .filter(Inspection.created_at >= start_of_today)
        .all()
    )

    yesterday_inspections = (
        db.query(Inspection)
        .filter(
            Inspection.created_at >= start_of_yesterday,
            Inspection.created_at < start_of_today
        )
        .all()
    )

    def calculate_stats(inspections):
        passed = sum(
            1 for inspection in inspections
            if str(inspection.status).upper() == "PASS"
        )

        failed = sum(
            1 for inspection in inspections
            if str(inspection.status).upper() == "FAIL"
        )

        # Inspected = total completed inspections (PASS + FAIL)
        inspected = passed + failed

        pass_rate = (
            round((passed / inspected) * 100, 1)
            if inspected
            else 0
        )

        completed_times = [
            inspection.inspection_time
            for inspection in inspections
            if inspection.inspection_time is not None
        ]

        avg_cycle_time = (
            round(
                sum(completed_times) / len(completed_times),
                2
            )
            if completed_times
            else 0
        )

        return {
            "inspected": inspected,
            "pass": passed,
            "fail": failed,
            "passRate": pass_rate,
            "avgCycleTime": avg_cycle_time,
        }

    today_stats = calculate_stats(today_inspections)
    yesterday_stats = calculate_stats(yesterday_inspections)

    return {
        "today": {
            **today_stats,
            "systemUptime": "—",
            "rpiTemp": get_rpi_temperature(),
            "cpu": get_rpi_cpu_usage(),
            "fps": "—",
        },
        "yesterday": yesterday_stats,
    }

@app.get("/api/camera/status")
async def get_camera_status():
    result = await check_rpi_camera_status()
    return result

@app.post("/api/camera/capture")
async def capture_camera_image():
    try:
        image_bytes = await capture_rpi_image()

        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={
                "Content-Disposition": 'inline; filename="latest_capture.jpg"'
            },
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

async def get_ai_explanation(
    inspection_data: dict,
    status: str,
    detections: list,
    xmccv_results: list,
    xai_result: dict,
) -> dict | None:
    """
    Request an explanation from the separate AI service.
    Does not modify inspection results or the final decision.
    """
    payload = {
        "status": str(status).upper(),
        "board_type": inspection_data.get("board_type", "Unknown"),
        "detections": detections,
        "xmccv_results": xmccv_results,
        "xai_evidence": xai_result,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                EXPLANATION_SERVICE_URL,
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

        if (
            isinstance(result, dict)
            and result.get("status") == "success"
            and isinstance(result.get("explanation"), str)
        ):
            return result

        print("[AI Explanation] Unexpected response format.")
        return None

    except Exception as exc:
        print(
            f"[AI Explanation] Service unavailable: "
            f"{type(exc).__name__}"
        )
        return None

@app.post("/api/inspection/run")
async def run_inspection(
    request: InspectionRequest | None = None,
    db: Session = Depends(get_db)
):
    try:
        # ---------------------------------------------------------
        # 1. Run the authoritative inspection on Raspberry Pi
        # ---------------------------------------------------------
        if request and request.uploadId:
            uploaded_inspection = (
                db.query(Inspection)
                .filter(Inspection.id == request.uploadId)
                .first()
            )

            if not uploaded_inspection:
                raise RuntimeError(
                    f"Uploaded inspection {request.uploadId} was not found."
                )

            if not uploaded_inspection.image_path:
                raise RuntimeError(
                    "Uploaded inspection does not have an image path."
                )

            rpi_result = await run_rpi_uploaded_inspection(
                uploaded_inspection.image_path
            )
        else:
            print("[DEBUG] Sending inspection request to Raspberry Pi...")
            rpi_result = await run_rpi_inspection()
            print("[DEBUG] Raspberry Pi inspection response received.")

        if not isinstance(rpi_result, dict):
            raise RuntimeError("Invalid response received from Raspberry Pi.")

        inspection_data = rpi_result.get("inspection")

        if not isinstance(inspection_data, dict):
            raise RuntimeError(
                "Raspberry Pi response does not contain inspection data."
            )

        # ---------------------------------------------------------
        # 2. Extract Pi inspection result
        # ---------------------------------------------------------
        pi_inspection_id = inspection_data.get("inspection_id")
        decision = inspection_data.get("decision", {})

        # Determine status: prefer decision.overall_status, fall back to inspection.status
        status = (
            decision.get("overall_status")
            or decision.get("status")
            or inspection_data.get("status")
            or "FAIL"
        )

        input_type = inspection_data.get("input_type", "camera")
        image_path = inspection_data.get("image_path")
        detection_image = inspection_data.get("detection_image")

        # Extract inspection time from Pi response (multiple possible field names)
        inspection_time = (
            inspection_data.get("inspection_time")
            or inspection_data.get("inspectionTime")
            or inspection_data.get("processing_time")
            or inspection_data.get("processingTime")
            or inspection_data.get("cycle_time")
            or inspection_data.get("cycleTime")
        )

        detections = inspection_data.get("detections", [])
        xmccv_results = inspection_data.get("xmccv", [])
        xai_result = inspection_data.get("xai", {})

        # ---------------------------------------------------------
        # 3. Generate the Windows PCB ID
        # ---------------------------------------------------------
        board_id = f"PCB-{uuid.uuid4().hex[:8].upper()}"

        image_name = (
            Path(image_path).name
            if image_path
            else f"{board_id}.jpg"
        )

        # ---------------------------------------------------------
        # 4. Determine highest YOLO confidence
        # ---------------------------------------------------------
        confidence_values = []

        for detection in detections:
            confidence = detection.get("confidence")

            if confidence is not None:
                try:
                    confidence_values.append(float(confidence))
                except (TypeError, ValueError):
                    pass

        highest_confidence = (
            max(confidence_values)
            if confidence_values
            else None
        )

        # ---------------------------------------------------------
        # 5. Determine defect/component summary
        # ---------------------------------------------------------
        defect_classes = []

        for detection in detections:
            class_name = detection.get("class_name")

            if class_name:
                defect_classes.append(str(class_name))

        defect_class = (
            ", ".join(dict.fromkeys(defect_classes))
            if defect_classes
            else None
        )

        # ---------------------------------------------------------
        # 6. Store XAI information
        # ---------------------------------------------------------
        xai_explanation = {
            "inspection_id": pi_inspection_id,
            "mode": xai_result.get("mode"),
            "status": xai_result.get("status"),
            "evidence_path": xai_result.get("evidence_path"),
            "overlay_path": xai_result.get("overlay_path"),
            "heatmap_path": xai_result.get("heatmap_path"),
            "missing_components": xai_result.get(
                "missing_components",
                []
            ),
        }

        # ---------------------------------------------------------
        # 7. Create Windows Inspection record
        # ---------------------------------------------------------
        inspection = Inspection(
            board_id=board_id,
            image_name=image_name,
            image_path=image_path,
            model_name="PCBVision YOLO11s",
            status=status,
            confidence=highest_confidence,
            defect_class=defect_class,
            inspection_time=inspection_time,
            xai_explanation=str(xai_explanation),
        )

        db.add(inspection)
        db.flush()

        # ---------------------------------------------------------
        # 8. Create Detection records
        # ---------------------------------------------------------
        for detection in detections:
            bbox = detection.get("bbox") or {}

            db_detection = Detection(
                inspection_id=inspection.id,
                class_name=str(
                    detection.get("class_name", "unknown")
                ),
                confidence=detection.get("confidence"),
                x_min=bbox.get("x1"),
                y_min=bbox.get("y1"),
                x_max=bbox.get("x2"),
                y_max=bbox.get("y2"),
                detection_type="YOLO",
            )

            db.add(db_detection)

        # ---------------------------------------------------------
        # 9. Create PASS/FAIL notification
        # ---------------------------------------------------------
        overall_status = str(status).upper()

        if overall_status == "PASS":
            notification_type = "SUCCESS"
            notification_title = "PCB Inspection Passed"
            notification_message = (
                f"PCB {board_id} passed inspection."
            )
        else:
            notification_type = "ERROR"
            notification_title = "PCB Inspection Failed"
            notification_message = (
                f"PCB {board_id} failed inspection."
            )

        notification = Notification(
            type=notification_type,
            title=notification_title,
            message=notification_message,
            is_read=False,
            inspection_id=inspection.id,
        )

        db.add(notification)

        # ---------------------------------------------------------
        # 10. Commit everything
        # ---------------------------------------------------------
        db.commit()
        db.refresh(inspection)
        ai_explanation = await get_ai_explanation(
            inspection_data=inspection_data,
            status=status,
            detections=detections,
            xmccv_results=xmccv_results,
            xai_result=xai_result,
        )

        # ---------------------------------------------------------
        # 11. Return Pi result + Windows DB information
        # ---------------------------------------------------------
        return {
            "status": "success",
            "inspection": inspection_data,
            "database": {
                "inspection_id": inspection.id,
                "board_id": inspection.board_id,
                "status": inspection.status,
                "image_name": inspection.image_name,
            },
            "images": {
                "input": make_rpi_image_url(image_path),
                "detection": make_rpi_image_url(detection_image),
                "heatmap": make_rpi_image_url(xai_result.get("heatmap_path")),
                "overlay": make_rpi_image_url(xai_result.get("overlay_path")),
            },
            
            "results": {
                "detections": detections,
                "xmccv": xmccv_results,
                "decision": decision,
                "xai": xai_result,
                "ai_explanation": ai_explanation,
            },
        }

    except RuntimeError as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Raspberry Pi inspection/database operation failed: {exc}",
        ) from exc


@app.get("/api/inspection/{inspection_id}/image")
def get_inspection_image(
    inspection_id: int,
    db: Session = Depends(get_db)
):
    inspection = (
        db.query(Inspection)
        .filter(Inspection.id == inspection_id)
        .first()
    )

    if not inspection:
        return {"error": "Inspection not found"}

    if not inspection.image_path:
        return {"error": "Image path not available"}

    image_path = Path(inspection.image_path)

    if not image_path.exists():
        return {"error": "Image file not found"}

    return FileResponse(
        path=image_path,
        filename=inspection.image_name
    )

@app.get("/api/notifications")
def get_notifications(
    db: Session = Depends(get_db)
):
    today = datetime.now().replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    notifications = (
        db.query(Notification)
        .filter(Notification.created_at >= today)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "id": notification.id,
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "isRead": notification.is_read,
            "inspectionId": notification.inspection_id,
            "createdAt": notification.created_at,
        }
        for notification in notifications
    ]
    
@app.patch("/api/notifications/read")
def mark_notifications_read(
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.is_read == False
    ).update(
        {Notification.is_read: True},
        synchronize_session=False
    )

    db.commit()

    return {
        "status": "SUCCESS",
        "message": "Notifications marked as read"
    }

@app.get("/api/settings")
def get_system_settings():
    return {
        "yolo": {
            "weights": "Pending trained model",
            "confidenceThreshold": 0.50,
            "iouThreshold": 0.45,
        },
        "camera": {
            "videoNode": "Raspberry Pi Camera",
            "targetFps": 30,
        },
        "gradCam": {
            "targetLayer": "Pending trained model",
            "overlayTransparency": 0.50,
        },
        "alerts": {
            "warningAudio": False,
            "autoArchiveFailures": True,
        },
        "hardware": {
            "socModel": "Raspberry Pi",
            "architecture": "ARM64",
            "os": "Raspberry Pi OS",
            "memory": "System dependent",
        },
    }