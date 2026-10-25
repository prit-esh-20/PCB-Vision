import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { reportsMock } from "../mock/reportsMock";

// Resolve a backend-relative path ("/api/reports/1/view") into an absolute URL.
// Blob URLs returned by the mock services are passed through untouched.
export const resolveApiUrl = (url) => {
  if (!url) return null;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;

  const base = API_CONFIG.baseUrl.replace(/\/$/, "");
  return `${base}${url.replace(/^\/api/, "")}`;
};

const normalizeReport = (report) => {
  if (!report) return report;

  const downloadUrl = report.downloadUrl
    ? resolveApiUrl(report.downloadUrl)
    : null;

  const viewUrl = report.viewUrl
    ? resolveApiUrl(report.viewUrl)
    : report.downloadUrl
    ? resolveApiUrl(report.downloadUrl.replace(/\/download$/, "/view"))
    : downloadUrl;

  return {
    ...report,
    type: report.type || report.reportType,
    reportType: report.reportType || report.type,
    date: report.date || report.createdAt,
    size: report.size || "N/A",
    viewUrl,
    downloadUrl,
  };
};

const parseFilename = (headers, fallback) => {
  const disposition = headers?.["content-disposition"] || headers?.["Content-Disposition"];
  if (!disposition) return fallback;

  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1].trim()) : fallback;
};

// Quality Reports page service. Mirrors the backend endpoints
// GET /reports, POST /reports, GET /reports/:id, GET /reports/:id/view and
// GET /reports/:id/download.
export const reportsApi = {
  async getReports() {
    if (API_CONFIG.useMock) {
      const reports = await reportsMock.getReports();
      return reports.map(normalizeReport);
    }

    const { data } = await apiClient.get("/reports");
    return Array.isArray(data) ? data.map(normalizeReport) : [];
  },

  async createReport(payload) {
    if (API_CONFIG.useMock) {
      return normalizeReport(await reportsMock.createReport(payload));
    }

    const { data } = await apiClient.post("/reports", payload);
    return normalizeReport(data);
  },

  async getReport(reportId) {
    if (API_CONFIG.useMock) {
      return normalizeReport(await reportsMock.getReport(reportId));
    }

    const { data } = await apiClient.get(`/reports/${reportId}`);
    return normalizeReport(data);
  },

  async downloadReport(reportId) {
    if (API_CONFIG.useMock) {
      return reportsMock.downloadReport(reportId);
    }

    const report = await this.getReport(reportId);

    return {
      filename: report.fileName || `report-${reportId}.pdf`,
      downloadUrl: report.downloadUrl,
    };
  },

  // Fetch the actual PDF bytes so the UI can distinguish a real PDF from an
  // error response (the backend returns JSON for missing reports).
  async fetchReportPdf(reportId, { download = false } = {}) {
    if (API_CONFIG.useMock) {
      const record = await reportsMock.downloadReport(reportId);
      const response = await fetch(record.downloadUrl);
      if (!response.ok) {
        throw new Error("Unable to load the report file.");
      }
      return {
        blob: await response.blob(),
        filename: record.filename || `report-${reportId}.pdf`,
      };
    }

    let response;
    try {
      response = await apiClient.get(
        `/reports/${reportId}/${download ? "download" : "view"}`,
        {
          responseType: "blob",
          headers: { Accept: "application/pdf" },
        }
      );
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        throw new Error("The report file is missing on the server.");
      }
      throw err;
    }

    const blob = response.data;
    const contentType = blob?.type || "";

    if (!contentType.includes("application/pdf")) {
      // The API answered with JSON (or HTML); never hand that to the PDF viewer.
      throw new Error("The server did not return a PDF report.");
    }

    return {
      blob,
      filename: parseFilename(response.headers, `report-${reportId}.pdf`),
    };
  },
};
