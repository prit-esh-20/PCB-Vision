import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { inspectionMock } from "../mock/inspectionMock";

// Convert backend inspection fields into the format expected by the frontend.
const normalizeInspection = (data) => {
  if (!data) return data;

  // Handle both the API response envelope and the raw inspection result.
  if (data.inspection && typeof data.inspection === "object") {
    return {
      ...data,
      inspection: normalizeInspection(data.inspection),
    };
  }

  const decision = data.decision ?? {};
  const xmccv = Array.isArray(data.xmccv) ? data.xmccv : [];
  const xai = data.xai ?? {};

  const rawDetections = Array.isArray(data.detections)
    ? data.detections
    : [];

  const detections = rawDetections.map((det, idx) => {
    const className =
      det.class_name ??
      det.className ??
      det.label ??
      det.id ??
      `Det ${idx + 1}`;

    const bbox = det.bbox ?? {};

    return {
      ...det,
      id: det.id ?? `${className}-${idx + 1}`,
      label: className,
      className,
      confidence: det.confidence ?? det.yoloConfidence ?? null,
      bbox: {
        ...bbox,
        x1: bbox.x1 ?? bbox.left,
        y1: bbox.y1 ?? bbox.top,
        x2:
          bbox.x2 ??
          (bbox.left != null && bbox.width != null
            ? bbox.left + bbox.width
            : undefined),
        y2:
          bbox.y2 ??
          (bbox.top != null && bbox.height != null
            ? bbox.top + bbox.height
            : undefined),
        left: bbox.left ?? bbox.x1,
        top: bbox.top ?? bbox.y1,
        width:
          bbox.width ??
          (bbox.x2 != null && bbox.x1 != null
            ? bbox.x2 - bbox.x1
            : undefined),
        height:
          bbox.height ??
          (bbox.y2 != null && bbox.y1 != null
            ? bbox.y2 - bbox.y1
            : undefined),
      },
    };
  });

  return {
    ...data,
    status: decision.overall_status ?? data.status ?? "INSPECTED",
    inspectionId: data.inspection_id ?? data.inspectionId ?? null,
    pcbId: data.board_id ?? data.pcbId ?? null,
    imageName: data.image_name ?? data.imageName ?? null,
    modelName: data.model_name ?? data.modelName ?? null,
    defectClass: data.defect_class ?? data.defectClass ?? null,
    inspectionTime:
      data.inspection_time ??
      data.inspectionTime ??
      data.cycleTime ??
      null,
    confidence: data.confidence ?? data.yoloConfidence ?? null,

    componentsCount: detections.length,
    detections,

    decision,
    xmccv,
    componentDetails: xmccv,
    verificationDetails: decision,

    xai,
    xaiExplanation: xai,
  };
};

// Inspection service.
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

    const { data } = await apiClient.post("/inspection/run", payload, {
      timeout: 240_000,
    });
    console.log("INSPECTION API RESPONSE:", data);
    return normalizeInspection(data);
  },
};
