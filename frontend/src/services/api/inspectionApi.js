import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { inspectionMock } from "../mock/inspectionMock";

// Convert backend inspection fields into the format expected by the frontend.
const normalizeInspection = (data) => {
  if (!data) return data;

  const rawDetections = Array.isArray(data.detections) ? data.detections : [];

  return {
    ...data,

    // Backend → Frontend mapping
    status: data.status ?? "INSPECTED",
    pcbId: data.board_id ?? data.pcbId ?? null,
    imageName: data.image_name ?? data.imageName ?? null,
    modelName: data.model_name ?? data.modelName ?? null,
    defectClass: data.defect_class ?? data.defectClass ?? null,
    inspectionTime: data.inspection_time ?? data.inspectionTime ?? data.cycleTime ?? null,
    confidence: data.confidence ?? data.yoloConfidence ?? null,
    xaiExplanation: data.xai_explanation ?? data.xaiExplanation ?? null,
    detections: rawDetections.map((det, idx) => {
      const className = det.class_name ?? det.className ?? det.label ?? det.id ?? `Det ${idx + 1}`;
      const conf = det.confidence ?? det.yoloConfidence ?? null;
      const bbox = det.bbox || {};
      return {
        id: det.id || `${className}-${idx + 1}`,
        label: className,
        className,
        confidence: conf,
        bbox: {
          x1: bbox.x1 ?? bbox.left,
          y1: bbox.y1 ?? bbox.top,
          x2: bbox.x2 ?? (bbox.left != null && bbox.width != null ? bbox.left + bbox.width : undefined),
          y2: bbox.y2 ?? (bbox.top != null && bbox.height != null ? bbox.top + bbox.height : undefined),
          left: bbox.left ?? bbox.x1,
          top: bbox.top ?? bbox.y1,
          width: bbox.width ?? (bbox.x2 != null && bbox.x1 != null ? bbox.x2 - bbox.x1 : undefined),
          height: bbox.height ?? (bbox.y2 != null && bbox.y1 != null ? bbox.y2 - bbox.y1 : undefined),
        },
      };
    }),
  };
};

// Inspection service. Later the backend will provide the live camera feed.
// The UI only renders whatever this service returns.

export const inspectionApi = {
  async getLatestInspection() {
    if (API_CONFIG.useMock) {
      return inspectionMock.getLatestInspection();
    }

    const { data } = await apiClient.get("/inspection/latest");

    return normalizeInspection(data);
  },

  async getCameraStatus() {
    if (API_CONFIG.useMock) {
      return {
        status: "DISCONNECTED",
        connected: false,
        message: "Camera is not connected.",
      };
    }

    const { data } = await apiClient.get("/camera/status");
    return data;
  },

  async runInspection(payload) {
    if (API_CONFIG.useMock) {
      return inspectionMock.runInspection(payload);
    }

    const { data } = await apiClient.post(
      "/inspection/run",
      payload ?? {}
    );

    return normalizeInspection(data);
  },
};