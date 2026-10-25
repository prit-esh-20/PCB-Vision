import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { reportMock } from "../mock/reportMock";
import { resolveApiUrl } from "./reportsApi";

// Report generation service for the Dashboard action. In mock mode the PDF is
// built in the browser through the dedicated report service; with the backend
// connected, the inspection data is forwarded to POST /reports/generate and the
// server returns the download information.
export const reportApi = {
  async generateReport(inspection, options = {}) {
    if (API_CONFIG.useMock) return reportMock.generateReport(inspection, options);

    const payload = {
      inspectionId: inspection?.id || inspection?.inspectionId || null,
      ...options,
    };

    const { data } = await apiClient.post("/reports/generate", payload);

    return {
      ...data,
      viewUrl: resolveApiUrl(data?.viewUrl),
      downloadUrl: resolveApiUrl(data?.downloadUrl),
    };
  },
};
