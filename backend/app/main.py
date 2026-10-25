import os
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
from models import (
    Inspection,
    Detection,
    Report,
    Notification,
    AnalyticsSnapshot,
)
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
@app.post("/inspection/upload")
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
        
        result = await run_rpi_uploaded_inspection(str(file_path))
        inspection_data = result.get("inspection", result)

        print("RPI RESULT:", result)
        print("INSPECTION DATA:", inspection_data)
        print("DECISION:", inspection_data.get("decision"))
        print("STATUS:", inspection_data.get("status"))


        # The RPi API returns:
        # {"status": "success", "inspection": {...}}
        inspection_data = result.get("inspection", result)

        if not isinstance(inspection_data, dict):
            raise RuntimeError(
                "Raspberry Pi returned an invalid inspection result."
            )

        decision = inspection_data.get("decision", {})
        print("[DEBUG] PI DECISION:", repr(inspection_data.get("decision")))
        print("[DEBUG] PI STATUS:", repr(inspection_data.get("status")))
        print("[DEBUG] PI INSPECTION KEYS:", list(inspection_data.keys()))
        
        status = (
            decision.get("overall_status")
            or decision.get("status")
            or inspection_data.get("status")
            or "UNVERIFIED"
        )
        inspection.status = status
        inspection.model_name = "YOLO"

        # Extract inspection time from Pi response (multiple possible field names)
        inspection_time_raw = (
            inspection_data.get("inspection_time")
            or inspection_data.get("inspectionTime")
            or inspection_data.get("processing_time")
            or inspection_data.get("processingTime")
            or inspection_data.get("cycle_time")
            or inspection_data.get("cycleTime")
        )
        # Normalize inspection time: Pi may return seconds as float or string,
        # or confidence-scaled value. Use raw value as-is; the compute_daily_stats
        # function filters out invalid values.
        inspection.inspection_time = inspection_time_raw

        detections = inspection_data.get("detections", [])
        confidence_values = [
            float(item["confidence"])
            for item in detections
            if item.get("confidence") is not None
        ]
        # Confidence from Pi is in 0-1 range; convert to percentage for storage
        if confidence_values:
            max_conf = max(confidence_values)
            if max_conf <= 1.0:
                inspection.confidence = round(max_conf * 100.0, 1)
            else:
                inspection.confidence = round(max_conf, 1)
        else:
            inspection.confidence = None

        defect_classes = []
        for det in detections:
            cname = det.get("class_name")
            if cname:
                defect_classes.append(str(cname))
        # Classify defect class: only known defect types; ordinary component
        # detections are not defects unless explicitly classified.
        KNOWN_DEFECT_CLASSES = {
            "Solder Bridge",
            "Missing Component",
            "Polarity Mismatch",
            "Misalignment",
            "Wrong Part",
        }
        if defect_classes:
            matched = [c for c in defect_classes if c in KNOWN_DEFECT_CLASSES]
            if matched:
                inspection.defect_class = ", ".join(dict.fromkeys(matched))
            else:
                # No known defect classes found; preserve "None" rather than
                # listing component names as defects.
                inspection.defect_class = "None"

        # If there are no detections at all, also set defect_class to None
        if not detections:
            inspection.defect_class = None

        for detection in detections:
            bbox = detection.get("bbox") or {}
            db_detection = Detection(
                inspection_id=inspection.id,
                class_name=str(detection.get("class_name", "unknown")),
                confidence=detection.get("confidence"),
                x_min=bbox.get("x1"),
                y_min=bbox.get("y1"),
                x_max=bbox.get("x2"),
                y_max=bbox.get("y2"),
                detection_type="YOLO",
            )
            db.add(db_detection)

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

# -----------------------------------------------------------------------------
# Analytics and Statistics Aggregation Engine
# -----------------------------------------------------------------------------
KNOWN_DEFECT_CLASSES = {
    "Solder Bridge",
    "Missing Component",
    "Polarity Mismatch",
    "Misalignment",
    "Wrong Part",
}

def get_system_timezone():
    tz_env = os.getenv("SYSTEM_TIMEZONE")
    if tz_env:
        try:
            import zoneinfo
            return zoneinfo.ZoneInfo(tz_env)
        except Exception:
            pass
    local_tz = datetime.now().astimezone().tzinfo
    return local_tz if local_tz is not None else timezone.utc

def to_local_datetime(dt: datetime, sys_tz) -> datetime:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(sys_tz)

def is_verified_completed(record: Inspection) -> bool:
    """Only inspections with confirmed final outcomes (PASS or FAIL) are completed."""
    status = str(record.status or "").strip().upper()
    return status in ("PASS", "FAIL")

def is_verified_pass(record: Inspection) -> bool:
    return str(record.status or "").strip().upper() == "PASS"

def is_verified_fail(record: Inspection) -> bool:
    return str(record.status or "").strip().upper() == "FAIL"

def count_record_defects(record: Inspection) -> int:
    """Count actual defects on failed boards, without treating detected components as defects."""
    if is_verified_pass(record):
        return 0
    if not is_verified_fail(record):
        return 0
    raw = str(record.defect_class or "").strip()
    if not raw or raw.lower() == "none":
        return 1
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    matched = [p for p in parts if p in KNOWN_DEFECT_CLASSES]
    return len(matched) if matched else 1


def compute_daily_stats(records: list[Inspection]) -> dict:
    # All saved inspections count as activity.
    inspected = len(records)

    # PASS/FAIL results are used only for verified quality metrics.
    completed = [r for r in records if is_verified_completed(r)]
    passed = sum(1 for r in completed if is_verified_pass(r))
    failed = sum(1 for r in completed if is_verified_fail(r))

    if completed:
        pass_rate = round((passed / len(completed)) * 100.0, 1)
    else:
        pass_rate = None

    # Processing time and confidence use all records that have valid values.
    valid_times = [
        float(r.inspection_time)
        for r in records
        if r.inspection_time is not None
        and float(r.inspection_time) > 0
    ]
    avg_cycle_time = (
        round(sum(valid_times) / len(valid_times), 2)
        if valid_times else None
    )

    valid_confidences = [
        float(r.confidence)
        for r in records
        if r.confidence is not None
    ]
    if valid_confidences:
        multiplier = (
            100.0 if max(valid_confidences) <= 1.0 else 1.0
        )
        avg_confidence = round(
            (sum(valid_confidences) / len(valid_confidences))
            * multiplier,
            1,
        )
    else:
        avg_confidence = None

    # Count defects only from verified failures.
    defects = sum(count_record_defects(r) for r in completed if is_verified_fail(r))

    return {
        "inspected": inspected,
        "verified": len(completed),
        "pass": passed,
        "fail": failed,
        "passRate": pass_rate,
        "avgCycleTime": avg_cycle_time,
        "avgConfidence": avg_confidence,
        "defects": defects,
    }


def compute_comparison_trends(today: dict, yesterday: dict) -> dict:
    if yesterday["inspected"] > 0:
        diff_pct = round(((today["inspected"] - yesterday["inspected"]) / yesterday["inspected"]) * 100.0, 1)
        inspected_trend = f"{diff_pct:+.1f}%"
        inspected_up = diff_pct >= 0
    else:
        inspected_trend = None
        inspected_up = True

    if today["passRate"] is not None and yesterday["passRate"] is not None:
        diff = round(today["passRate"] - yesterday["passRate"], 1)
        pass_rate_trend = f"{diff:+.1f}%"
        pass_rate_up = diff >= 0
    else:
        pass_rate_trend = None
        pass_rate_up = True

    if yesterday["inspected"] > 0:
        diff = today["fail"] - yesterday["fail"]
        failed_trend = f"{diff:+d}" if diff != 0 else "0"
        failed_up = diff <= 0
    else:
        failed_trend = None
        failed_up = True

    if today["avgCycleTime"] is not None and yesterday["avgCycleTime"] is not None:
        diff = round(today["avgCycleTime"] - yesterday["avgCycleTime"], 2)
        cycle_time_trend = f"{diff:+.2f}s"
        cycle_time_up = diff <= 0
    else:
        cycle_time_trend = None
        cycle_time_up = True

    if yesterday["defects"] > 0:
        diff_pct = round(((today["defects"] - yesterday["defects"]) / yesterday["defects"]) * 100.0, 1)
        defects_trend = f"{diff_pct:+.1f}%"
        defects_up = diff_pct <= 0
    elif today["defects"] > 0:
        defects_trend = f"+{today['defects']}"
        defects_up = False
    else:
        defects_trend = None
        defects_up = True

    if today["avgConfidence"] is not None and yesterday["avgConfidence"] is not None:
        diff = round(today["avgConfidence"] - yesterday["avgConfidence"], 1)
        confidence_trend = f"{diff:+.1f}%"
        confidence_up = diff >= 0
    else:
        confidence_trend = None
        confidence_up = True

    return {
        "inspectedTrend": inspected_trend,
        "inspectedUp": inspected_up,
        "passRateTrend": pass_rate_trend,
        "passRateUp": pass_rate_up,
        "failTrend": failed_trend,
        "failUp": failed_up,
        "cycleTimeTrend": cycle_time_trend,
        "cycleTimeUp": cycle_time_up,
        "defectsTrend": defects_trend,
        "defectsUp": defects_up,
        "confidenceTrend": confidence_trend,
        "confidenceUp": confidence_up,
    }


@app.get("/api/analytics")
@app.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    snapshot = (
        db.query(AnalyticsSnapshot)
        .filter(AnalyticsSnapshot.dataset == "dashboard")
        .first()
    )

    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail="Fixed dashboard analytics data not found in database."
        )

    try:
        return json.loads(snapshot.data)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=500,
            detail="Stored dashboard analytics data is invalid."
        )


@app.get("/api/reports")
def get_reports(
    db: Session = Depends(get_db)
):
    reports = (
        db.query(Report)
        .order_by(Report.created_at.desc())
        .all()
    )

    results = []

    for report in reports:
        report_path = Path(report.file_path) if report.file_path else None
        file_available = bool(report_path and report_path.exists())

        inspection = None
        if report.inspection_id is not None:
            inspection = (
                db.query(Inspection)
                .filter(Inspection.id == report.inspection_id)
                .first()
            )

        results.append(
            {
                "id": report.id,
                "reportId": report.report_id,
                "title": report.title,
                "type": report.report_type,
                "reportType": report.report_type,
                "inspectionId": report.inspection_id,
                "pcbId": inspection.board_id if inspection else None,
                "fileName": report.file_name,
                "filePath": report.file_path,
                "size": (
                    f"{report_path.stat().st_size / 1024:.1f} KB"
                    if file_available
                    else "N/A"
                ),
                "status": report.status,
                "date": report.created_at,
                "createdAt": report.created_at,
                "fileAvailable": file_available,
                "viewUrl": f"/api/reports/{report.id}/view",
                "downloadUrl": f"/api/reports/{report.id}/download",
            }
        )

    return results

def _generate_inspection_report(
    inspection,
    report_data,
    db,
    reports_dir,
):
    """Build the detailed inspection PDF and persist a Report row.

    The layout lives in app.report_builder so the report structure is kept in
    one place. Reused by both POST /reports (latest inspection) and
    POST /reports/generate (specific inspection id).
    """
    from app.report_builder import build_inspection_report

    return build_inspection_report(
        inspection,
        report_data,
        db,
        reports_dir,
        Report,
        Notification,
    )


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
        raise HTTPException(
            status_code=404,
            detail="No inspection data available to generate report.",
        )

    reports_dir = UPLOAD_DIR / "reports"

    try:
        return _generate_inspection_report(inspection, report_data, db, reports_dir)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate report: {exc}",
        ) from exc


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
        raise HTTPException(
            status_code=404,
            detail="No inspection data available to generate report.",
        )

    reports_dir = UPLOAD_DIR / "reports"

    try:
        return _generate_inspection_report(inspection, payload, db, reports_dir)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate report: {exc}",
        ) from exc


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
        raise HTTPException(status_code=404, detail="Report not found")

    report_path = Path(report.file_path) if report.file_path else None
    file_available = bool(report_path and report_path.exists())

    inspection = None
    if report.inspection_id is not None:
        inspection = (
            db.query(Inspection)
            .filter(Inspection.id == report.inspection_id)
            .first()
        )

    return {
        "id": report.id,
        "reportId": report.report_id,
        "title": report.title,
        "type": report.report_type,
        "reportType": report.report_type,
        "inspectionId": report.inspection_id,
        "pcbId": inspection.board_id if inspection else None,
        "fileName": report.file_name,
        "filePath": report.file_path,
        "size": (
            f"{report_path.stat().st_size / 1024:.1f} KB"
            if file_available
            else "N/A"
        ),
        "status": report.status,
        "date": report.created_at,
        "createdAt": report.created_at,
        "fileAvailable": file_available,
        "viewUrl": f"/api/reports/{report.id}/view",
        "downloadUrl": f"/api/reports/{report.id}/download",
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
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.file_path:
        raise HTTPException(status_code=404, detail="Report file not available")

    file_path = Path(report.file_path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=report.file_name or file_path.name,
        headers={"Cache-Control": "no-store"},
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
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.file_path:
        raise HTTPException(status_code=404, detail="Report file not available")

    file_path = Path(report.file_path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found")

    filename = report.file_name or file_path.name

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-store",
        },
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
@app.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db)
):
    # Use UTC boundaries since Inspection.created_at is stored in UTC.
    # This ensures consistent "today" across all timezones.
    now_utc = datetime.now(timezone.utc)
    start_of_today_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today_utc = start_of_today_utc + timedelta(days=1)
    start_of_yesterday_utc = start_of_today_utc - timedelta(days=1)
    end_of_yesterday_utc = start_of_today_utc

    # Fetch inspections since start of yesterday (UTC)
    inspections = (
        db.query(Inspection)
        .filter(Inspection.created_at >= start_of_yesterday_utc)
        .filter(Inspection.created_at < end_of_today_utc)
        .all()
    )

    today_records = [
        r for r in inspections
        if r.created_at and r.created_at >= start_of_today_utc
    ]
    yesterday_records = [
        r for r in inspections
        if r.created_at and r.created_at >= start_of_yesterday_utc and r.created_at < end_of_yesterday_utc
    ]

    today_stats = compute_daily_stats(today_records)
    yesterday_stats = compute_daily_stats(yesterday_records)
    trends = compute_comparison_trends(today_stats, yesterday_stats)

    return {
        "today": {
            "inspected": today_stats["inspected"],
            "pass": today_stats["pass"],
            "fail": today_stats["fail"],
            "passRate": today_stats["passRate"],
            "avgCycleTime": today_stats["avgCycleTime"],
            "inspectedTrend": trends["inspectedTrend"],
            "inspectedUp": trends["inspectedUp"],
            "passRateTrend": trends["passRateTrend"],
            "passRateUp": trends["passRateUp"],
            "failTrend": trends["failTrend"],
            "failUp": trends["failUp"],
            "avgCycleTimeTrend": trends["cycleTimeTrend"],
            "avgCycleTimeUp": trends["cycleTimeUp"],
            "systemUptime": "—",
            "rpiTemp": get_rpi_temperature(),
            "cpu": get_rpi_cpu_usage(),
            "fps": "—",
        },
        "yesterday": {
            "inspected": yesterday_stats["inspected"],
            "pass": yesterday_stats["pass"],
            "fail": yesterday_stats["fail"],
            "passRate": yesterday_stats["passRate"],
            "avgCycleTime": yesterday_stats["avgCycleTime"],
        },
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
            print("[AI Explanation] Response:", result)

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
@app.post("/inspection/run")
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
        print("[DEBUG] PI DECISION:", repr(inspection_data.get("decision")))
        print("[DEBUG] PI STATUS:", repr(inspection_data.get("status")))

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
        
        if not isinstance(xai_result, dict):
            xai_result = {}

        ai_explanation = None

        if xai_result:
            ai_explanation = {
                key: xai_result[key]
                for key in (
                    "defect",
                    "location",
                    "explanation",
                    "recommendation",
                    "llm_status",
                    "llm_model",
                )
                if xai_result.get(key) is not None
            }

        if not ai_explanation:
            ai_explanation = None

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
        
        inspection = Inspection(
            board_id=board_id,
            image_name=image_name,
            image_path=str(image_path) if image_path else None,
            model_name="PCBVision YOLO11s",
            status=str(status).upper(),
            confidence=highest_confidence,
            defect_class=defect_class,
            inspection_time=inspection_time,
            xai_explanation=str(xai_result or {}),
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
        import traceback

        db.rollback()
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Raspberry Pi inspection/database operation failed: "
                f"{type(exc).__name__}: {exc}"
            ),
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