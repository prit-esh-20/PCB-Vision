"""Detailed PCBVision inspection report builder.

This module builds the structured multi-section inspection PDF that the
existing ``_generate_inspection_report`` endpoint delegates to. It reuses the
existing ``Report`` / ``Inspection`` / ``Detection`` models and the existing
upload directory layout; no schema or endpoint changes are required here.

All content is taken from persisted inspection records. When evidence (image,
heatmap, overlay, X-MCCV results) is not available, the report states that
explicitly instead of fabricating data.
"""

from __future__ import annotations

import ast
import re
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image as PILImage, ImageDraw, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.rpi_client import RPI_BASE_URL, make_rpi_image_url
from models import Detection

# ---------------------------------------------------------------------------
# Semantic constants
# ---------------------------------------------------------------------------

# Classes that represent an actual PCB defect rather than an ordinary
# component detection. Anything outside this set is reported as a component.
DEFECT_CLASS_NAMES = {
    "solder bridge",
    "missing component",
    "polarity mismatch",
    "misalignment",
    "wrong part",
    "short circuit",
    "open circuit",
    "tombstone",
    "tombstoning",
    "insufficient solder",
    "excess solder",
    "solder ball",
    "cold joint",
    "delamination",
    "crack",
}

DEFECT_KEYWORDS = (
    "solder bridge",
    "missing component",
    "polarity",
    "misalign",
    "wrong part",
    "short circuit",
    "open circuit",
)

STATUS_PASS = "PASS"
STATUS_FAIL = "FAIL"
STATUS_UNVERIFIED = "UNVERIFIED"

REMOTE_IMAGE_TIMEOUT = 5.0
MAX_DETECTION_ROWS = 60

# Palette (kept consistent with the existing PCBVision report styling)
PCB_GREEN = colors.HexColor("#20D486")
DARK_GREEN = colors.HexColor("#073D2A")
LIGHT_BG = colors.HexColor("#F4F8F6")
BORDER = colors.HexColor("#C9D8D1")
TEXT = colors.HexColor("#17231F")
MUTED = colors.HexColor("#64756E")
WHITE = colors.white
PASS_GREEN = colors.HexColor("#168A58")
FAIL_RED = colors.HexColor("#C93636")
WARN_AMBER = colors.HexColor("#B7791F")
HEADER_BG = colors.HexColor("#0B1F18")
TEXT_MUTED = colors.HexColor("#8FA3A0")
XAI_BG = colors.HexColor("#F0F8F4")


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _text(value, fallback="N/A") -> str:
    if value is None:
        return fallback
    value = str(value).strip()
    return value if value else fallback


def _escape(value, fallback="N/A") -> str:
    """Escape user/data supplied text for use inside a ReportLab Paragraph."""
    value = _text(value, fallback)
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _fmt_confidence(value):
    if value is None:
        return "N/A"
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return "N/A"
    if numeric <= 1.5:
        numeric *= 100
    return f"{numeric:.1f}%"


def _fmt_duration(value):
    if value is None:
        return "N/A"
    try:
        return f"{float(value):.2f} seconds"
    except (TypeError, ValueError):
        return _text(value)


def _fmt_datetime(value):
    if not value:
        return "N/A"
    try:
        return value.strftime("%d %b %Y, %H:%M UTC")
    except (AttributeError, ValueError):
        return _text(value)


def _classify_detection(class_name: str) -> str:
    name = (class_name or "").strip().lower()
    if name in DEFECT_CLASS_NAMES:
        return "Defect"
    if any(keyword in name for keyword in DEFECT_KEYWORDS):
        return "Defect"
    return "Component"


def _parse_xai_payload(raw):
    """Return the stored XAI data as a dict.

    Older inspections stored ``str(xai_result)`` (a Python dict repr); newer
    ones may store plain explanation text. Both shapes are handled.
    """
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    value = str(raw).strip()
    if value.startswith("{") and value.endswith("}"):
        try:
            parsed = ast.literal_eval(value)
            if isinstance(parsed, dict):
                return parsed
        except (ValueError, SyntaxError):
            pass
    return {"explanation": value}


def _fit(path: Path, max_width: float, max_height: float):
    with PILImage.open(path) as image:
        width, height = image.size
    if not width or not height:
        return max_width, max_height
    scale = min(max_width / width, max_height / height)
    return width * scale, height * scale


def _save_optimized(image, out_path: Path, max_side: int = 1600, quality: int = 88):
    """Downscale and compress an image so report PDFs stay reasonably small."""
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    image.thumbnail((max_side, max_side), PILImage.LANCZOS)
    actual_path = out_path.with_suffix(".jpg")
    image.save(actual_path, "JPEG", quality=quality, optimize=True)
    return actual_path


def _load_remote_image(source_path: str, out_path: Path):
    """Try to fetch an inspection/XAI artifact from the Raspberry Pi."""
    if not RPI_BASE_URL or not source_path:
        return None
    try:
        url = make_rpi_image_url(str(source_path))
        if not url:
            return None
        with httpx.Client(timeout=REMOTE_IMAGE_TIMEOUT) as client:
            response = client.get(url)
        if response.status_code != 200 or not response.content:
            return None
        with PILImage.open(BytesIO(response.content)) as image:
            rgb = ImageOps.exif_transpose(image).convert("RGB")
        return _save_optimized(rgb, out_path)
    except Exception:
        return None


def _resolve_image(source_path, out_path: Path):
    """Resolve an image path to a local JPEG, checking local disk then the Pi."""
    if not source_path:
        return None
    try:
        local = Path(str(source_path))
        if local.exists() and local.is_file():
            with PILImage.open(local) as image:
                rgb = ImageOps.exif_transpose(image).convert("RGB")
            return _save_optimized(rgb, out_path)
    except Exception:
        pass
    return _load_remote_image(str(source_path), out_path)


def _annotate(source_png: Path, detections, out_path: Path):
    """Draw detection bounding boxes on the inspection image."""
    try:
        with PILImage.open(source_png) as image:
            canvas = image.convert("RGB")
        draw = ImageDraw.Draw(canvas)
        width, height = canvas.size
        stroke = max(2, int(min(width, height) / 320))
        for detection in detections:
            x1, y1 = detection.x_min, detection.y_min
            x2, y2 = detection.x_max, detection.y_max
            if None in (x1, y1, x2, y2):
                continue
            x1, x2 = sorted((float(x1), float(x2)))
            y1, y2 = sorted((float(y1), float(y2)))
            x1 = max(0, min(width - 1, x1))
            x2 = max(0, min(width - 1, x2))
            y1 = max(0, min(height - 1, y1))
            y2 = max(0, min(height - 1, y2))
            is_defect = _classify_detection(detection.class_name) == "Defect"
            color = (255, 77, 109) if is_defect else (0, 229, 255)
            draw.rectangle([x1, y1, x2, y2], outline=color, width=stroke)
            label = str(detection.class_name or "object")
            confidence = _fmt_confidence(detection.confidence)
            if confidence != "N/A":
                label = f"{label} {confidence}"
            text_y = y1 - stroke * 6
            if text_y < 0:
                text_y = min(height - stroke * 6, y1 + stroke)
            draw.text((x1 + stroke, text_y), label, fill=color)
        return _save_optimized(canvas, out_path, quality=90)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Report builder
# ---------------------------------------------------------------------------

def build_inspection_report(inspection, report_data, db, reports_dir, Report, Notification):
    """Build the detailed inspection PDF and persist the Report row."""
    reports_dir = Path(reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)

    report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
    filename = f"{report_id}.pdf"
    file_path = reports_dir / filename

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

    styles = getSampleStyleSheet()

    report_title = ParagraphStyle(
        "ReportTitle", parent=styles["Heading1"],
        fontName="Helvetica-Bold", fontSize=20, leading=24,
        textColor=TEXT, spaceAfter=4,
    )
    report_subtitle = ParagraphStyle(
        "ReportSubtitle", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9, leading=12,
        textColor=MUTED, spaceAfter=10,
    )
    section_title = ParagraphStyle(
        "SectionTitle", parent=styles["Heading2"],
        fontName="Helvetica-Bold", fontSize=11, leading=14,
        textColor=DARK_GREEN, spaceBefore=6, spaceAfter=7,
    )
    body = ParagraphStyle(
        "Body", parent=styles["BodyText"],
        fontName="Helvetica", fontSize=9, leading=14, textColor=TEXT,
    )
    small = ParagraphStyle(
        "Small", parent=styles["BodyText"],
        fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED,
    )
    cell_label_style = ParagraphStyle(
        "TableLabel", parent=styles["BodyText"],
        fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=MUTED,
    )
    cell_value_style = ParagraphStyle(
        "TableValue", parent=styles["BodyText"],
        fontName="Helvetica", fontSize=8.5, leading=12, textColor=TEXT,
    )
    table_cell = ParagraphStyle(
        "TableCell", parent=styles["BodyText"],
        fontName="Helvetica", fontSize=8, leading=11, textColor=TEXT,
    )
    table_header = ParagraphStyle(
        "TableHeader", parent=styles["BodyText"],
        fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=TEXT_MUTED,
    )
    xai_text = ParagraphStyle(
        "XAIText", parent=styles["BodyText"],
        fontName="Helvetica", fontSize=9, leading=14, textColor=TEXT,
    )

    def cell_label(value):
        return Paragraph(_escape(value), cell_label_style)

    def cell_value(value):
        return Paragraph(str(value), cell_value_style)

    def plain_cell(value):
        return Paragraph(_escape(value), table_cell)

    def plain_header(value):
        return Paragraph(str(value), table_header)

    # ------------------------------------------------------------------
    # Header / footer
    # ------------------------------------------------------------------

    def draw_header_footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(PCB_GREEN)
        canvas.setLineWidth(1.2)
        canvas.line(18 * mm, PAGE_HEIGHT - 17 * mm, PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 17 * mm)

        canvas.setFont("Helvetica-Bold", 13)
        canvas.setFillColor(PCB_GREEN)
        canvas.drawString(18 * mm, PAGE_HEIGHT - 13 * mm, "PCB")
        canvas.setFillColor(TEXT)
        canvas.drawString(30 * mm, PAGE_HEIGHT - 13 * mm, "Vision")

        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(
            PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 13 * mm,
            "INTELLIGENT PCB INSPECTION SYSTEM",
        )

        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, 13 * mm, PAGE_WIDTH - 18 * mm, 13 * mm)

        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(
            18 * mm, 8 * mm,
            f"PCBVision • Quality Audit Report • {report_id} • Inspection {inspection.id}",
        )
        canvas.drawRightString(
            PAGE_WIDTH - 18 * mm, 8 * mm,
            f"Page {document.page}",
        )
        canvas.restoreState()

    # ------------------------------------------------------------------
    # Data preparation
    # ------------------------------------------------------------------

    status = (inspection.status or STATUS_UNVERIFIED).upper()
    if status == STATUS_PASS:
        status_color = PASS_GREEN
    elif status == STATUS_FAIL:
        status_color = FAIL_RED
    else:
        status_color = WARN_AMBER

    model_name = _text(inspection.model_name, "Not recorded")
    image_name = _text(inspection.image_name, "N/A")
    inspection_time = inspection.inspection_time
    confidence = inspection.confidence
    created_at = _fmt_datetime(inspection.created_at)
    generated_at = _fmt_datetime(datetime.now())

    report_scope = str(report_data.get("reportScope", "SUMMARY") or "SUMMARY").upper()
    scope_profiles = {
        "SUMMARY": (
            "Executive Inspection Summary",
            "A concise overview of the PCB inspection result, inspection status, and key findings.",
        ),
        "FULL": (
            "Complete Inspection Report",
            "A comprehensive inspection record containing inspection details, detection information, XAI findings, and audit configuration.",
        ),
        "X-MCCV": (
            "X-MCCV Explainability Report",
            "An explainability-focused report containing AI findings, diagnostic information, and available model interpretation data.",
        ),
    }
    if report_scope not in scope_profiles:
        report_scope = "SUMMARY"
    report_profile_title, report_profile_description = scope_profiles[report_scope]

    detections = (
        db.query(Detection)
        .filter(Detection.inspection_id == inspection.id)
        .order_by(Detection.id)
        .all()
    )
    detections = list(detections)

    xai = _parse_xai_payload(inspection.xai_explanation)

    defect_detections = [d for d in detections if _classify_detection(d.class_name) == "Defect"]
    component_detections = [d for d in detections if _classify_detection(d.class_name) == "Component"]

    unique_classes = []
    for detection in detections:
        name = _text(detection.class_name, "unknown")
        if name not in unique_classes:
            unique_classes.append(name)

    story = []
    unavailable = []

    # ------------------------------------------------------------------
    # Title block
    # ------------------------------------------------------------------

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("PCB Inspection Report", report_title))
    story.append(Paragraph(report_profile_title, ParagraphStyle(
        "ProfileTitle", parent=body, fontName="Helvetica-Bold",
        fontSize=10, leading=13, textColor=PCB_GREEN, spaceAfter=3,
    )))
    story.append(Paragraph(report_profile_description, small))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Automated Quality Inspection & Compliance Summary", report_subtitle))

    # ------------------------------------------------------------------
    # A. Branded metadata
    # ------------------------------------------------------------------

    story.append(Paragraph("Report Information", section_title))

    identification_data = [
        [
            cell_label("REPORT ID"), cell_value(_escape(report_id)),
            cell_label("REPORT TYPE"), cell_value(_escape(report_scope)),
        ],
        [
            cell_label("GENERATED"), cell_value(_escape(generated_at)),
            cell_label("REPORT STATUS"), cell_value("GENERATED"),
        ],
        [
            cell_label("INSPECTION ID"), cell_value(_escape(inspection.id)),
            cell_label("PCB / BOARD ID"), cell_value(_escape(inspection.board_id)),
        ],
        [
            cell_label("INSPECTION STATUS"), cell_value(_escape(status)),
            cell_label("MODEL"), cell_value(_escape(model_name)),
        ],
    ]

    identification_table = Table(
        identification_data,
        colWidths=[27 * mm, 56 * mm, 27 * mm, 56 * mm],
    )
    identification_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(identification_table)
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------------
    # B. Inspection overview
    # ------------------------------------------------------------------

    story.append(Paragraph("Inspection Overview", section_title))

    overview_rows = [
        [cell_label("INSPECTION ID"), cell_value(_escape(inspection.id))],
        [cell_label("BOARD ID"), cell_value(_escape(inspection.board_id))],
        [cell_label("INSPECTED AT"), cell_value(_escape(created_at))],
        [cell_label("FINAL STATUS"), cell_value(
            f"<b>{_escape(status)}</b>"
        )],
        [cell_label("MODEL"), cell_value(_escape(model_name))],
        [cell_label("DETECTIONS"), cell_value(str(len(detections)))],
        [cell_label("DURATION"), cell_value(_escape(_fmt_duration(inspection_time)))],
        [cell_label("CONFIDENCE"), cell_value(_escape(_fmt_confidence(confidence)))],
        [cell_label("IMAGE FILE"), cell_value(_escape(image_name))],
    ]

    overview_table = Table(overview_rows, colWidths=[45 * mm, 121 * mm])
    overview_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(overview_table)
    story.append(Spacer(1, 6 * mm))

    # Prominent status strip
    result_table = Table(
        [[
            Paragraph(f"<b>{_escape(status)}</b>", ParagraphStyle(
                "Status", parent=body, fontName="Helvetica-Bold",
                fontSize=14, leading=17, textColor=WHITE, alignment=TA_CENTER,
            )),
            cell_value(
                f"<b>Defect class field:</b> {_escape(inspection.defect_class or 'None reported')}<br/>"
                f"<b>Detected component classes:</b> {_escape(', '.join(unique_classes) or 'None')}<br/>"
                f"<b>Detection records:</b> {len(detections)}"
            ),
        ]],
        colWidths=[40 * mm, 126 * mm],
    )
    result_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), status_color),
        ("BACKGROUND", (1, 0), (1, 0), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(result_table)
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------------
    # C. PCB image and visual evidence
    # ------------------------------------------------------------------

    image_heading = Paragraph("PCB Image and Visual Evidence", section_title)

    source_png = _resolve_image(inspection.image_path, reports_dir / f"{report_id}_inspection")
    annotated_png = None
    if source_png and detections:
        annotated_png = _annotate(source_png, detections, reports_dir / f"{report_id}_annotated")

    if annotated_png:
        display_image = annotated_png
        caption = "Annotated inspection image — detected regions marked (defects in red, components in cyan)."
    elif source_png:
        display_image = source_png
        caption = "Original inspection image captured for this inspection."
    else:
        display_image = None
        caption = None
        unavailable.append("inspection image")

    if display_image:
        width, height = _fit(display_image, 150 * mm, 85 * mm)
        figure_cell = [
            RLImage(str(display_image), width=width, height=height),
            Spacer(1, 2 * mm),
            Paragraph(
                f"<i>Figure 1 — {_escape(caption)} Inspection {_escape(inspection.board_id)}"
                f" ({_escape(image_name)}).</i>",
                small,
            ),
        ]
        story.append(
            KeepTogether([
                image_heading,
                Table(
                    [[figure_cell]],
                    colWidths=[166 * mm],
                    style=TableStyle([
                        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
                        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 8),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ]),
                ),
            ])
        )
    else:
        story.append(image_heading)
        story.append(Paragraph(
            "The original inspection image is not available on the report server for this "
            "inspection. The recorded image reference is "
            f"<b>{_escape(inspection.image_path)}</b>. "
            "No placeholder image has been inserted.",
            small,
        ))
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------------
    # D. Detection summary
    # ------------------------------------------------------------------

    story.append(Paragraph("Detection Summary", section_title))

    if detections:
        detection_header = [
            plain_header("#"),
            plain_header("Detected Class"),
            plain_header("Confidence"),
            plain_header("Source"),
            plain_header("Type"),
            plain_header("Bounding Box (px)"),
        ]
        detection_rows = [detection_header]
        for index, detection in enumerate(detections[:MAX_DETECTION_ROWS], start=1):
            bbox = "Not recorded"
            if None not in (detection.x_min, detection.y_min, detection.x_max, detection.y_max):
                bbox = (
                    f"({float(detection.x_min):.0f}, {float(detection.y_min):.0f}) – "
                    f"({float(detection.x_max):.0f}, {float(detection.y_max):.0f})"
                )
            detection_rows.append([
                plain_cell(index),
                plain_cell(detection.class_name or "unknown"),
                plain_cell(_fmt_confidence(detection.confidence)),
                plain_cell(detection.detection_type or "YOLO"),
                plain_cell(_classify_detection(detection.class_name)),
                plain_cell(bbox),
            ])

        detection_table = Table(
            detection_rows,
            colWidths=[8 * mm, 34 * mm, 18 * mm, 22 * mm, 22 * mm, 62 * mm],
            repeatRows=1,
        )

        table_style = [
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
        for row_index, detection in enumerate(detections[:MAX_DETECTION_ROWS], start=1):
            if _classify_detection(detection.class_name) == "Defect":
                table_style.append(("BACKGROUND", (4, row_index), (4, row_index), colors.HexColor("#FDECEC")))
        detection_table.setStyle(TableStyle(table_style))
        story.append(detection_table)

        if len(detections) > MAX_DETECTION_ROWS:
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(
                f"{len(detections) - MAX_DETECTION_ROWS} additional detection records are stored "
                "for this inspection but are not listed in the table.",
                small,
            ))
    else:
        story.append(Paragraph(
            "No detection records were returned for this inspection.",
            small,
        ))

    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        f"<b>Defect-class detections:</b> {len(defect_detections)} &nbsp;&nbsp; "
        f"<b>Component detections:</b> {len(component_detections)}. "
        "Component detections (for example ESP32, Arduino Nano, capacitors, or ICs) are "
        "reported as observed components, not as confirmed PCB defects.",
        small,
    ))
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------------
    # E. XAI analysis
    # ------------------------------------------------------------------

    story.append(Paragraph("XAI Analysis", section_title))

    # 1. What was detected
    story.append(Paragraph("What was detected", ParagraphStyle(
        "SubHeading", parent=body, fontName="Helvetica-Bold", fontSize=9.5,
        leading=12, textColor=DARK_GREEN, spaceBefore=2, spaceAfter=4,
    )))

    xai_detected = (
        ", ".join(unique_classes)
        if unique_classes
        else _text(xai.get("defect"), "No detections reported")
    )
    what_rows = [
        [cell_label("PREDICTED CLASS(ES)"), cell_value(_escape(xai_detected))],
        [cell_label("HIGHEST CONFIDENCE"), cell_value(_escape(_fmt_confidence(confidence)))],
        [cell_label("INSPECTION STATUS"), cell_value(_escape(status))],
        [cell_label("XAI MODE"), cell_value(_escape(xai.get("mode"), "Not recorded"))],
        [cell_label("XAI STATUS"), cell_value(_escape(xai.get("status"), "Not recorded"))],
    ]
    what_table = Table(what_rows, colWidths=[50 * mm, 116 * mm])
    what_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(what_table)
    story.append(Spacer(1, 4 * mm))

    # 2. Where it was detected
    story.append(Paragraph("Where it was detected", ParagraphStyle(
        "SubHeading", parent=body, fontName="Helvetica-Bold", fontSize=9.5,
        leading=12, textColor=DARK_GREEN, spaceBefore=2, spaceAfter=4,
    )))

    spatial_rows = [
        [cell_label("DETECTED REGION"), cell_label("COORDINATES / EVIDENCE")],
    ]
    for detection in detections[:15]:
        if None not in (detection.x_min, detection.y_min, detection.x_max, detection.y_max):
            region = (
                f"({float(detection.x_min):.0f}, {float(detection.y_min):.0f}) – "
                f"({float(detection.x_max):.0f}, {float(detection.y_max):.0f})"
            )
        else:
            region = "Coordinates not recorded"
        spatial_rows.append([
            cell_value(_escape(detection.class_name or "unknown")),
            cell_value(_escape(region)),
        ])

    if len(spatial_rows) == 1:
        story.append(Paragraph(
            "No spatial detection information was recorded for this inspection.",
            small,
        ))
    else:
        spatial_table = Table(spatial_rows, colWidths=[60 * mm, 106 * mm])
        spatial_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(spatial_table)
        if len(detections) > 15:
            story.append(Paragraph(
                f"{len(detections) - 15} additional detections are listed in the detection table above.",
                small,
            ))
    if annotated_png:
        story.append(Paragraph(
            "Highlighted regions are also shown on the annotated inspection image in the "
            "PCB Image and Visual Evidence section.",
            small,
        ))
    story.append(Spacer(1, 4 * mm))

    # 3. Visual explanation (Grad-CAM heatmap / overlay)
    story.append(Paragraph("Visual explanation", ParagraphStyle(
        "SubHeading", parent=body, fontName="Helvetica-Bold", fontSize=9.5,
        leading=12, textColor=DARK_GREEN, spaceBefore=2, spaceAfter=4,
    )))

    heatmap_path = _resolve_image(
        xai.get("heatmap_path"), reports_dir / f"{report_id}_heatmap"
    )
    overlay_path = _resolve_image(
        xai.get("overlay_path"), reports_dir / f"{report_id}_overlay"
    )

    xai_visuals = [
        (heatmap_path, "Figure 2 — Grad-CAM attention heatmap generated for this inspection."),
        (overlay_path, "Figure 3 — XAI overlay generated for this inspection."),
    ]
    rendered_visual = False
    for visual_path, visual_caption in xai_visuals:
        if not visual_path:
            continue
        width, height = _fit(visual_path, 140 * mm, 75 * mm)
        visual_cell = [
            RLImage(str(visual_path), width=width, height=height),
            Spacer(1, 2 * mm),
            Paragraph(f"<i>{_escape(visual_caption)}</i>", small),
        ]
        story.append(
            Table(
                [[visual_cell]],
                colWidths=[166 * mm],
                style=TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
                    ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]),
            )
        )
        story.append(Spacer(1, 3 * mm))
        rendered_visual = True

    if not rendered_visual:
        unavailable.append("XAI heatmap/overlay")
        story.append(Paragraph(
            "XAI visual artifacts (Grad-CAM heatmap and overlay) are not available on the "
            "report server for this inspection. No synthetic heatmap has been generated.",
            small,
        ))

    story.append(Paragraph(
        "<b>Interpretation note:</b> highlighted regions represent the model's visual "
        "attention. They indicate where the model focused during detection and are not, "
        "by themselves, definitive proof of a physical PCB defect.",
        small,
    ))
    story.append(Spacer(1, 4 * mm))

    # 4. Explanation and recommended action
    story.append(Paragraph("Explanation and recommended action", ParagraphStyle(
        "SubHeading", parent=body, fontName="Helvetica-Bold", fontSize=9.5,
        leading=12, textColor=DARK_GREEN, spaceBefore=2, spaceAfter=4,
    )))

    explanation_text = _text(xai.get("explanation"), "")

    # Only fall back to the stored raw value when it is genuinely plain text;
    # a raw dict repr is structured data, not a readable explanation.
    if not explanation_text:
        raw_explanation = str(inspection.xai_explanation or "").strip()
        if raw_explanation and not (
            raw_explanation.startswith("{") and raw_explanation.endswith("}")
        ):
            explanation_text = raw_explanation

    if explanation_text:
        xai_paragraph = Paragraph(
            "<b>Stored explanation:</b><br/>" + _escape(explanation_text).replace("\n", "<br/>"),
            xai_text,
        )
    else:
        xai_paragraph = Paragraph(
            "No XAI explanation was recorded for this inspection.",
            xai_text,
        )

    recommendation_text = _text(xai.get("recommendation"), "")

    # Older records store a plain-text explanation that embeds the
    # recommendation ("Recommendation: ..."). Surface it as a structured item.
    if not recommendation_text and explanation_text:
        match = re.search(
            r"Recommendation\s*[:\-]\s*(.+)",
            explanation_text,
            re.IGNORECASE | re.DOTALL,
        )
        if match:
            recommendation_text = match.group(1).strip()

    if recommendation_text:
        recommendation_paragraph = Paragraph(
            "<b>Recommended action:</b><br/>" + _escape(recommendation_text).replace("\n", "<br/>"),
            xai_text,
        )
    else:
        recommendation_paragraph = Paragraph(
            "<b>Recommended action:</b> No recommended action was recorded for this inspection.",
            xai_text,
        )

    xai_box = Table(
        [[xai_paragraph], [recommendation_paragraph]],
        colWidths=[166 * mm],
    )
    xai_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), XAI_BG),
        ("BOX", (0, 0), (-1, -1), 1, PCB_GREEN),
        ("LINEBEFORE", (0, 0), (0, -1), 4, PCB_GREEN),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, BORDER),
    ]))
    story.append(xai_box)
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------------
    # F. Full inspection details
    # ------------------------------------------------------------------

    story.append(Paragraph("Full Inspection Details", section_title))

    detail_rows = [
        ("DATABASE RECORD ID", inspection.id),
        ("BOARD ID", inspection.board_id),
        ("STATUS", status),
        ("MODEL", model_name),
        ("HIGHEST CONFIDENCE", _fmt_confidence(confidence)),
        ("DEFECT CLASS FIELD", inspection.defect_class),
        ("INSPECTION DURATION", _fmt_duration(inspection_time)),
        ("INSPECTION IMAGE NAME", image_name),
        ("INSPECTION IMAGE PATH", inspection.image_path),
        ("DETECTION RECORDS", len(detections)),
        ("DETECTED COMPONENTS", ", ".join(unique_classes) or "None"),
        ("XAI MODE", xai.get("mode")),
        ("XAI STATUS", xai.get("status")),
        ("XAI EVIDENCE PATH", xai.get("evidence_path")),
        ("XAI HEATMAP PATH", xai.get("heatmap_path")),
        ("XAI OVERLAY PATH", xai.get("overlay_path")),
        ("INSPECTED AT", created_at),
        ("REPORT ID", report_id),
        ("REPORT GENERATED AT", generated_at),
    ]

    detail_data = [
        [cell_label(label), cell_value(_escape(value))]
        for label, value in detail_rows
    ]
    detail_table = Table(detail_data, colWidths=[52 * mm, 114 * mm], repeatRows=0)
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(detail_table)
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------------
    # G. X-MCCV verification
    # ------------------------------------------------------------------

    story.append(Paragraph("X-MCCV Verification", section_title))

    missing_components = xai.get("missing_components")
    if isinstance(missing_components, (list, tuple)):
        missing_text = ", ".join(str(item) for item in missing_components) or "None reported"
    elif missing_components:
        missing_text = str(missing_components)
    else:
        missing_text = "Not recorded"

    is_verified_verdict = status in (STATUS_PASS, STATUS_FAIL)

    if not is_verified_verdict:
        verification_note = (
            f"This inspection is marked {status}. Detection results are available, but "
            "X-MCCV verification did not complete, so the result must not be interpreted "
            "as a PASS or FAIL verdict."
        )
    else:
        verification_note = (
            "X-MCCV verification outcome for this inspection is reported as "
            f"{status}. Per-inspection X-MCCV verification records are not stored in "
            "the report database, so only the overall outcome is shown."
        )

    verification_rows = [
        [cell_label("VERIFICATION OUTCOME"), cell_value(_escape(status))],
        [
            cell_label("DETECTION-ONLY RESULT"),
            cell_value("Yes" if not is_verified_verdict else "Not recorded"),
        ],
        [cell_label("MISSING COMPONENTS"), cell_value(_escape(missing_text))],
        [cell_label("VERIFICATION RECORDS"), cell_value("Not stored for this inspection")],
    ]
    verification_table = Table(verification_rows, colWidths=[52 * mm, 114 * mm])
    verification_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(verification_table)
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(_escape(verification_note), small))
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------------
    # H. Report scope and audit information
    # ------------------------------------------------------------------

    story.append(Paragraph("Report Scope and Audit Information", section_title))

    scope_rows = [
        [cell_label("SCOPE"), cell_value(_escape(report_scope)),
         cell_label("PCB TYPE"), cell_value(_escape(report_data.get("pcbType", "All PCB Types")))],
        [cell_label("START DATE"), cell_value(_escape(report_data.get("startDate", "N/A"))),
         cell_label("END DATE"), cell_value(_escape(report_data.get("endDate", "N/A")))],
        [cell_label("DATA SOURCES"),
         cell_value("Inspections, Detections, stored XAI explanation, inspection image"),
         cell_label("MODEL"), cell_value(_escape(model_name))],
        [         cell_label("UNAVAILABLE EVIDENCE"),
         cell_value(_escape(", ".join(unavailable) if unavailable else "None")),
         cell_label("VERIFICATION"), cell_value(_escape("Recorded" if status in (STATUS_PASS, STATUS_FAIL) else "Incomplete"))],
    ]
    scope_table = Table(scope_rows, colWidths=[29 * mm, 54 * mm, 29 * mm, 54 * mm])
    scope_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(scope_table)
    story.append(Spacer(1, 7 * mm))

    # ------------------------------------------------------------------
    # I. Integrity notice
    # ------------------------------------------------------------------

    story.append(HRFlowable(width="100%", thickness=0.7, color=BORDER, spaceBefore=2, spaceAfter=8))
    story.append(Paragraph("<b>Report Integrity Notice</b>", ParagraphStyle(
        "IntegrityTitle", parent=body, fontName="Helvetica-Bold",
        fontSize=8.5, textColor=DARK_GREEN, spaceAfter=3,
    )))
    story.append(Paragraph(
        "This document was generated automatically by the PCBVision inspection system. "
        "Inspection results, detections, and explanations are based on the data available "
        "at the time the report was generated. Unavailable evidence is reported explicitly "
        "and has not been substituted with synthetic content.",
        small,
    ))

    # ------------------------------------------------------------------
    # Build the PDF and persist the record
    # ------------------------------------------------------------------

    try:
        doc.build(story, onFirstPage=draw_header_footer, onLaterPages=draw_header_footer)
    except Exception:
        # Never leave a partial/empty PDF behind.
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise

    file_size = file_path.stat().st_size if file_path.exists() else 0
    if file_size <= 0:
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise RuntimeError("Generated report PDF is empty.")

    report_title_db = {
        "SUMMARY": "PCB Inspection Report — Overview",
        "FULL": "PCB Inspection Report — Full Details",
        "X-MCCV": "PCB Inspection Report — X-MCCV",
    }[report_scope]

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
        inspection_id=inspection.id,
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
        "viewUrl": f"/api/reports/{report.id}/view",
        "downloadUrl": f"/api/reports/{report.id}/download",
    }
