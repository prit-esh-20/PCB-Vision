import psutil
import csv
from io import StringIO
from datetime import datetime, timezone
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import uuid
from sqlalchemy.orm import Session
from fastapi import UploadFile, File, Depends, FastAPI, Query
from database import get_db
from models import Inspection, Detection, Report, Notification
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

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
            "scanDateTime": inspection.created_at,
            "targetModel": inspection.model_name,
            "status": inspection.status,
            "defectClass": inspection.defect_class or "None",
            "yoloConfidence": inspection.confidence,
            "cycleTime": inspection.inspection_time,

            # Fields not available in the current DB schema
            "operator": None,
            "componentsCount": None,
            "defectCoordinates": None,
            "gradCamExplanation": inspection.xai_explanation or "",
            "verificationDetails": None,
        })

    return {
        "records": records,
        "totalRecords": total_records,
        "pages": pages,
        "page": page,
        "pageSize": pageSize,
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

    # ---------------------------------------------------------
    # Report identity and file location
    # ---------------------------------------------------------

    report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
    filename = f"{report_id}.pdf"

    reports_dir = UPLOAD_DIR / "reports"
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
            "cpu": f"{psutil.cpu_percent(interval=0.1):.1f}%",
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
        return {
            "status": "ERROR",
            "message": "Inspection record not found"
        }

    inspection.status = "PASS"
    inspection.model_name = "Pending"
    inspection.xai_explanation = "ML inspection pending."

    notification = Notification(
        type="success",
        title="Inspection Completed",
        message=f"PCB inspection completed for {inspection.board_id}.",
        inspection_id=inspection.id
    )

    db.add(notification)
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

@app.get("/api/notifications")
def get_notifications(
    db: Session = Depends(get_db)
):
    notifications = (
        db.query(Notification)
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

