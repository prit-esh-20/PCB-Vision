import { useState, useEffect, useCallback } from "react";
import { rpiApi } from "../services/api/rpiApi";

export function useRpiStatus() {
  const [rpiStatus, setRpiStatus] = useState({
    status: "CHECKING",
    connected: false,
    message: "Checking Raspberry Pi connection...",
    details: null,
  });
  const [loading, setLoading] = useState(true);

  const checkRpiStatus = useCallback(async () => {
    try {
      const res = await rpiApi.checkHealth();

      setRpiStatus({
        status: res?.connected ? "CONNECTED" : "DISCONNECTED",
        connected: res?.connected === true,
        message: res?.message || (res?.connected ? "Raspberry Pi connected." : "Raspberry Pi disconnected."),
        details: res?.details || null,
      });
    } catch (err) {
      setRpiStatus({
        status: "ERROR",
        connected: false,
        message: `Raspberry Pi connection error: ${err.message}`,
        details: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runCheck = async () => {
      await checkRpiStatus();
    };

    runCheck();

    const interval = window.setInterval(() => {
      if (!cancelled) {
        runCheck();
      }
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [checkRpiStatus]);

  return {
    rpiStatus,
    loading,
    refresh: checkRpiStatus,
  };
}