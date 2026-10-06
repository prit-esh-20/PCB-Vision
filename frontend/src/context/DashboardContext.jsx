import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { dashboardApi } from "../services/api/dashboardApi";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const intervalRef = useRef(null);
  const isPollingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const res = await dashboardApi.getStatistics();

      setStats(res);
      setError(null);
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err);
    } finally {
      isPollingRef.current = false;
      setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    fetchStats();
    intervalRef.current = window.setInterval(fetchStats, 30000);
  }, [fetchStats]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const refresh = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  const value = {
    stats,
    loading: loading && !hasLoadedOnce,
    error,
    refresh,
    hasLoadedOnce,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboardContext must be used within DashboardProvider");
  }
  return ctx;
}