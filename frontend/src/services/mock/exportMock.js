import { MOCK_INSPECTION_HISTORY, MOCK_INSPECTION_RESULT } from "./mockData";

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

// Deterministic CSV export built from the static inspection history records.
// Never invents rows — it exports exactly the records that exist.
export const exportMock = {
  async exportInspectionCsv() {
    await delay(400);
    const rows = MOCK_INSPECTION_HISTORY.map((record) => ({
      pcbId: record.id,
      timestamp: record.timestamp,
      status: record.status,
      defect: record.defect,
      confidence: record.confidence,
      cycleTime: record.cycleTime,
      componentsCount: record.componentsCount,
    }));

    const header = Object.keys(rows[0] || {});
    const lines = [
      header.join(","),
      ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(",")),
    ];
    return { rows: rows.length, csv: lines.join("\n") };
  },

  async exportInspectionJson() {
    await delay(400);

    const result = MOCK_INSPECTION_RESULT;
    const detections = (result.detections || []).map((det) => ({
      id: det.id,
      label: det.label,
      class_name: det.label,
      confidence: det.confidence,
      bbox: det.bbox,
    }));

    const structured = {
      inspection: {
        id: 1,
        board_id: result.pcbId,
        image_name: result.pcbId ? `${result.pcbId}.jpg` : null,
        model_name: result.model,
        status: result.status,
        confidence: result.confidence,
        defect_class: result.defects?.[0]?.class || result.defect || null,
        inspection_time: result.cycleTime,
        xai_explanation: result.xaiExplanation ?? null,
        created_at: result.timestamp,
      },
      detections,
      detection_count: detections.length,
    };

    const blob = new Blob([JSON.stringify(structured, null, 2)], {
      type: "application/json",
    });

    return {
      blob,
      rows: detections.length,
    };
  },
};
