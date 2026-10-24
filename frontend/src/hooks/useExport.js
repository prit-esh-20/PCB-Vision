import { useState, useCallback, useRef } from "react";
import { exportApi } from "../services/api/exportApi";
import { toErrorMessage } from "../utils/apiError";

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const timestamp = () =>
  new Date().toISOString().replace(/[:.]/g, "-");

const parseFilename = (disposition, fallback) => {
  if (!disposition) return fallback;
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
};

// CSV export action. Exports the inspection records available from the
// backend (or the deterministic mock records) — never invented data. If no
// records exist, surfaces a clear error.
export function useExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [rowCount, setRowCount] = useState(null);
  const runningRef = useRef(false);

  const exportCsv = useCallback(async (inspection = null) => {
    if (runningRef.current) {
      return { ok: false, message: "An export is already running." };
    }

    runningRef.current = true;
    setExporting(true);
    setError(null);

    try {
      let response;
      let filename;

      if (inspection) {
        // Export a single inspection by ID
        response = await exportApi.exportInspectionCsvById(
          inspection.id || inspection.inspectionId
        );
        filename = parseFilename(
          response.filename,
          `PCBVision_Inspection_${inspection.pcbId || "PCB"}.csv`
        );
      } else {
        // Legacy: export all inspections
        response = await exportApi.exportInspectionCsv();
        filename = parseFilename(
          response.filename,
          `pcbvision_inspection_export.csv`
        );
      }

      if (response.rows === 0 && !response.blob) {
        setError({ message: "No inspection records available for export." });
        return {
          ok: false,
          message: "No inspection records available for export.",
        };
      }

      if (response.blob) {
        saveBlob(response.blob, filename);
      } else if (response.csv) {
        saveBlob(
          new Blob([response.csv], { type: "text/csv;charset=utf-8" }),
          filename
        );
      }

      setRowCount(response.rows || 0);
      return { ok: true, rows: response.rows, filename };
    } catch (err) {
      const message = toErrorMessage(err, "Unable to export inspection data.");
      setError(err);
      return { ok: false, message };
    } finally {
      setExporting(false);
      runningRef.current = false;
    }
  }, []);

  const exportJson = useCallback(async (inspection = null) => {
    if (runningRef.current) {
      return { ok: false, message: "An export is already running." };
    }

    runningRef.current = true;
    setExporting(true);
    setError(null);

    try {
      if (!inspection) {
        return {
          ok: false,
          message: "Select an inspection before exporting.",
        };
      }

      const response = await exportApi.exportInspectionJsonById(
        inspection.id || inspection.inspectionId
      );

      const filename = `PCBVision_Inspection_${
        inspection.pcbId || "PCB"
      }.json`;
      saveBlob(response.blob, filename);

      return { ok: true, filename };
    } catch (err) {
      const message = toErrorMessage(err, "Unable to export inspection data.");
      setError(err);
      return { ok: false, message };
    } finally {
      setExporting(false);
      runningRef.current = false;
    }
  }, []);

  return {
    exporting,
    error,
    errorMessage: error ? toErrorMessage(error, "Unable to export inspection data.") : null,
    rowCount,
    exportCsv,
    exportJson,
  };
}
