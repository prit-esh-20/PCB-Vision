import { useState, useEffect } from "react";
import { analyticsApi } from "../services/api/analyticsApi";

// Fetches the fixed analytics dataset from the backend.
// This data includes chart configs, quality summaries, defect breakdowns,
// throughput, and 7-day trends. It does NOT include the live inspection
// KPIs (Boards Inspected Today, Pass Rate, Failed Boards, Avg Inspection Time)
// which come from a separate data source.
export function useAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .getAnalytics()
      .then((res) => {
        if (!cancelled) {
          // Only return the fixed analytics fields; KPIs that belong to
          // the live inspection source are excluded here.
          const { kpis, ...fixedData } = res || {};
          setData(fixedData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}