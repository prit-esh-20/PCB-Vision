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

  return {
    id: record.id ?? record.inspectionId ?? "",
    timestamp: record.scanDateTime ?? record.timestamp,
    model: record.targetModel ?? record.model,
    status: record.status,
    defect: record.defectClass ?? record.defect ?? "None",
    confidence: record.yoloConfidence ?? record.confidence,
    cycleTime: record.cycleTime,
    imagePath: record.imagePath ?? null,
    operator: record.operator,
    componentsCount: record.componentsCount,
    defectCoordinates: record.defectCoordinates ?? null,
    gradCamExplanation: record.gradCamExplanation ?? record.xaiExplanation ?? "",
    verificationDetails: record.verificationDetails ?? null,
  };
}

export function normalizeInspectionList(records = []) {
  return records.map(normalizeInspectionRecord).filter(Boolean);
}