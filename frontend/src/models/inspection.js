// ============================================================================
// SHARED INSPECTION RECORD MODEL
// ----------------------------------------------------------------------------
// Canonical contract for an inspection record used by Live Inspection,
// Inspection History, and Analytics/Reports. It mirrors the database record
// shape so every layer renders the SAME fields — never independently-defined
// per page.
//
// InspectionRecord {
//   id, pcbId, scanDateTime, targetModel, status, defectClass,
//   yoloConfidence, cycleTime, ...detail fields
// }
// ============================================================================

export const INSPECTION_RECORD_FIELDS = [
  "id",
  "pcbId",
  "scanDateTime",
  "targetModel",
  "status",
  "defectClass",
  "yoloConfidence",
  "cycleTime",
];

// Maps any record (backend or mock) into the exact shape the table and
// details view render. Backend fields take precedence; mock/legacy names
// are accepted as fallbacks.
export function normalizeInspectionRecord(record) {
  if (!record) return null;

  const id = record.id ?? record.inspectionId ?? record.board_id ?? record.pcbId ?? "";
  const pcbId = record.pcbId ?? record.board_id ?? record.boardId ?? record.id ?? "";
  const timestamp = record.scanDateTime ?? record.created_at ?? record.createdAt ?? record.timestamp ?? null;
  const model = record.targetModel ?? record.model_name ?? record.modelName ?? record.model ?? "PCBVision YOLO11s";
  const status = record.status ? String(record.status).toUpperCase() : "UNKNOWN";
  const defect = record.defectClass ?? record.defect_class ?? record.defect ?? "None";
  const confidence = record.yoloConfidence ?? record.confidence ?? null;
  const cycleTime = record.cycleTime ?? record.inspection_time ?? record.inspectionTime ?? null;
  const imagePath = record.imagePath ?? record.image_path ?? record.imageUrl ?? record.image_url ?? null;

  return {
    id,
    pcbId,
    boardId: pcbId,
    timestamp,
    scanDateTime: timestamp,
    model,
    targetModel: model,
    status,
    defect,
    defectClass: defect,
    confidence,
    yoloConfidence: confidence,
    cycleTime,
    inspectionTime: cycleTime,
    imagePath,
    imageUrl: imagePath,
    operator: record.operator ?? null,
    componentsCount: record.componentsCount ?? record.components_count ?? null,
    defectCoordinates: record.defectCoordinates ?? record.defect_coordinates ?? null,
    gradCamExplanation: record.gradCamExplanation ?? record.xai_explanation ?? record.xaiExplanation ?? "",
    xaiExplanation: record.gradCamExplanation ?? record.xai_explanation ?? record.xaiExplanation ?? "",
    verificationDetails: record.verificationDetails ?? record.verification_details ?? null,
  };
}

export function normalizeInspectionList(records = []) {
  return records.map(normalizeInspectionRecord).filter(Boolean);
}