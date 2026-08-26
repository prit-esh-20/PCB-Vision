from sqlalchemy.orm import Session
from fastapi import UploadFile, File, Depends
from database import get_db
from models import Inspection, Detection, Report
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from fastapi import FastAPI

app = FastAPI(
    title="PCBVision API",
    description="Backend API for PCBVision Intelligent PCB Inspection",
    version="1.0.0"
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

@app.post("/api/inspection/upload")
async def upload_pcb(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    image_data = await file.read()

    inspection = Inspection(
        board_id="PCB-TEST-001",
        image_name=file.filename,
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