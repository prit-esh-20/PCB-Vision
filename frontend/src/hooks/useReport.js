import { useState, useCallback, useRef } from "react";
import { reportApi } from "../services/api/reportApi";
import API_CONFIG from "../config/api";
import { toErrorMessage } from "../utils/apiError";

const triggerDownload = (url, filename) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

// Report generation action. In mock mode the report PDF is built in the
// browser (via the dedicated report service) and downloaded automatically;
// with the backend connected, the same call requests a report from
// POST /reports/generate and downloads the returned file.
export function useReport() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);

  const generateReport = useCallback(async (inspection, options = {}) => {
    if (runningRef.current) {
      return { ok: false, message: "Report generation is already running." };
    }
    if (!inspection) {
      return { ok: false, message: "Complete a PCB inspection before generating a report." };
    }

    runningRef.current = true;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const response = await reportApi.generateReport(inspection, options);
      setResult(response);

      // Mock mode returns an object URL for the blob
      if (response?.downloadUrl) {
        triggerDownload(
          response.downloadUrl,
          response.filename || `PCBVision_Inspection_Report_${inspection?.pcbId || "PCB"}.pdf`,
        );
      }

      return { ok: true, result: response };
    } catch (err) {
      const message = toErrorMessage(err, "Unable to generate report.");
      setError(err);
      return { ok: false, message };
    } finally {
      setGenerating(false);
      runningRef.current = false;
    }
  }, []);

  return {
    generating,
    result,
    error,
    errorMessage: error ? toErrorMessage(error, "Unable to generate report.") : null,
    generateReport,
  };
}
