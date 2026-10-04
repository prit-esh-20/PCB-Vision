import { useState, useEffect, useCallback } from "react";
import { rpiApi } from "../services/api/rpiApi";

// RPi connection state from the backend /api/rpi/health endpoint.
// Values: CONNECTED | DISCONNECTED | CHECKING | ERROR.
// This is separate from camera status - RPi API reachable ≠ camera ready.
export function useRpiStatus() {
  const [rpiStatus, setRpiStatus] = useState({
    status: "CHECKING",
    connected: false,
    message: "Checking Raspberry Pi connection...",
    details: null,
  });
  const [loading, setLoading] = useState(true);

  
  const [cameraStatus, setCameraStatus] = useState({
    status: "UNKNOWN",
    connected: false,
    message: "Checking camera status...",
  });

  const checkCameraStatus = useCallback(async () => {
    try {
      const res = await rpiApi.checkCameraStatus();

      setCameraStatus({
        status: res?.connected
          ? "READY"
          : "DISCONNECTED",
        connected: res?.connected === true,
        message: res?.message || "Camera status unavailable.",
      });
    } catch (err) {
      setCameraStatus({
        status: "ERROR",
        connected: false,
        message: `Camera status error: ${err.message}`,
      });
    }
  }, []);


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

    // Check immediately when the hook mounts
    runCheck();
    checkCameraStatus();

    // Re-check every 10 seconds
    const interval = window.setInterval(() => {
      if (!cancelled) {
        runCheck();
        checkCameraStatus();
      }
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [checkRpiStatus, checkCameraStatus]);

  return {
  rpiStatus,
  cameraStatus,
  loading,
  refresh: async () => {
    await Promise.all([checkRpiStatus(), checkCameraStatus()]);
  },
};
}