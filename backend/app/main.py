from datetime import datetime, timezone
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import uuid
from sqlalchemy.orm import Session
from fastapi import UploadFile, File, Depends
from database import get_db
from models import Inspection, Detection, Report
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from fastapi import FastAPI

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
    uploadId: int

@app.post("/api/inspection/upload")
async def upload_pcb(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    image_data = await file.read()
    file_path = UPLOAD_DIR / f"{uuid.uuid4().hex[:8].upper()}_{file.filename}"
    file_path.write_bytes(image_data)

    inspection = Inspection(
        board_id=f"PCB-{uuid.uuid4().hex[:8].upper()}",
        image_name=file.filename,
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

    return {
        "id": inspection.id,
        "board_id": inspection.board_id,
        "filename": inspection.image_name,
        "status": inspection.status,
        "message": "PCB image uploaded and inspection record created"
    }


@app.get("/api/inspections")
def get_inspections(db: Session = Depends(get_db)):

    inspections = (
        db.query(Inspection)
        .order_by(Inspection.created_at.desc())
        .all()
    )

    return inspections

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

    start_of_yesterday = start_of_today.replace(
        day=start_of_today.day - 1
    )

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
            "rpiTemp": "—",
            "cpu": "—",
            "fps": "—",
        },
        "yesterday": yesterday_stats,
    }

@app.get("/api/camera/status")
def get_camera_status():
    return {
        "status": "DISCONNECTED",
        "connected": False,
        "message": "Camera is not connected."
    }

@app.post("/api/inspection/run")
def run_inspection(
    request: InspectionRequest,
    db: Session = Depends(get_db)
):
    inspection = (
        db.query(Inspection)
        .filter(Inspection.id == request.uploadId)
        .first()
    )

    if not inspection:
        return {"status": "ERROR", "message": "Inspection record not found"}

    inspection.status = "PASS"
    inspection.model_name = "Pending"
    inspection.xai_explanation = "ML inspection pending."

    db.commit()
    db.refresh(inspection)

    return inspection

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


