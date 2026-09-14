import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { inspectionMock } from "../mock/inspectionMock";

// Convert backend inspection fields into the format expected by the frontend.
const normalizeInspection = (data) => {
  if (!data) return data;

  return {
    ...data,

    // Backend → Frontend
    pcbId: data.board_id ?? data.pcbId ?? null,
    imageName: data.image_name ?? data.imageName ?? null,
    modelName: data.model_name ?? data.modelName ?? null,
    defectClass: data.defect_class ?? data.defectClass ?? null,
    inspectionTime: data.inspection_time ?? data.inspectionTime ?? null,
    xaiExplanation: data.xai_explanation ?? data.xaiExplanation ?? null,
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