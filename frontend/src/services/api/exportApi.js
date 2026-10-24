import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { exportMock } from "../mock/exportMock";

// Export service. Streams inspection records from the backend as a CSV/JSON
// download when connected; otherwise exports the deterministic static
// records through the mock layer.
export const exportApi = {
  /**
   * Export ALL inspection records as CSV (legacy full-history export).
   */
  async exportInspectionCsv() {
    if (API_CONFIG.useMock) return exportMock.exportInspectionCsv();

    const { data, headers } = await apiClient.get("/inspection/export/csv", {
      responseType: "blob",
    });
    return {
      rows: Number(headers["x-total-records"] || 0) || 0,
      blob: data,
      filename: headers["content-disposition"],
    };
  },

  /**
   * Export a SINGLE inspection as CSV with all detections and details.
   * Uses the specific inspection's backend endpoint.
   */
  async exportInspectionCsvById(inspectionId) {
    if (API_CONFIG.useMock) {
      // In mock mode, fall back to the full-history export
      return exportMock.exportInspectionCsv();
    }

    const { data, headers } = await apiClient.get(
      `/inspection/${inspectionId}/export/csv`,
      { responseType: "blob" }
    );

    return {
      blob: data,
      filename: headers["content-disposition"],
      rows: Number(headers["x-total-records"] || 1) || 1,
    };
  },

  /**
   * Export a SINGLE inspection as JSON with all detections and details.
   * Uses the specific inspection's backend endpoint.
   */
  async exportInspectionJsonById(inspectionId) {
    if (API_CONFIG.useMock) {
      // In mock mode, synthesize a JSON blob from the static data
      return exportMock.exportInspectionJson();
    }

    const { data } = await apiClient.get(
      `/inspection/${inspectionId}/export/json`,
      { responseType: "blob" }
    );

    return { blob: data };
  },
};
