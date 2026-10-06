import { useDashboardContext } from "../context/DashboardContext";

export function useDashboard() {
  const { stats, loading, error, refresh } = useDashboardContext();
  return { stats, loading, error, refresh };
}