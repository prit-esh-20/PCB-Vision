import { useState, useEffect } from "react";
import { inspectionApi } from "../services/api/inspectionApi";
// Import mock inspection history for computation when live data is unavailable.
// This provides deterministic data for development; in production with a real
// backend, the API would supply statistics directly.
import {
  MOCK_INSPECTION_HISTORY,
} from "../services/mock/mockData";

// Inspection status constants
const STATUS_PASS = "PASS";
const STATUS_FAIL = "FAIL";

// Helper: check if an inspection timestamp is from today.
// Normalizes ISO timestamps to date strings for comparison.
function isToday(timestampString) {
  if (!timestampString) return false;
  const inspectionDate = new Date(timestampString).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  return inspectionDate === today;
}

export function useInspectionStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Try to fetch the latest inspection to get basic data.
    // Then compute stats from inspection history available in mock data.
    // In a production setup with real-time history, this would query
    // a backend statistics endpoint or accumulate inspections from
    // the inspection store.
    async function fetchStats() {
      try {
        // Use mock inspection history for computation.
        // This is deterministic development data; replace with real
        // inspection history from the backend when available.
        const history = MOCK_INSPECTION_HISTORY || [];

        // Compute Boards Inspected Today
        const todayInspections = history.filter((insp) =>
          isToday(insp.timestamp)
        );
        const boardsInspectedToday = todayInspections.length;

        // Compute Pass Rate
        const totalInspections = history.length;
        const passedInspections = history.filter(
          (insp) => insp.status === STATUS_PASS
        ).length;
        const passRate = totalInspections > 0 ? (passedInspections / totalInspections) * 100 : 0;

        // Compute Failed Boards
        const failedBoards = history.filter(
          (insp) => insp.status === STATUS_FAIL
        ).length;

        // Compute Average Inspection Time
        const cycleTimes = history
          .filter((insp) => insp.cycleTime != null)
          .map((insp) => parseFloat(insp.cycleTime));
        const avgInspectionTime =
          cycleTimes.length > 0
            ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
            : 0;

        setStats({
          boardsInspectedToday,
          passRate,
          failedBoards,
          avgInspectionTime,
        });
        setLoading(false);
      } catch (err) {
        setError(err);
        setLoading(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading, error };
}