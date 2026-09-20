import { useState, useEffect } from "react";
import { cameraApi } from "../services/api/cameraApi";

// Camera connection state from the backend/camera service.
// Values: CONNECTED | READY | DISCONNECTED | ERROR | INITIALIZING | UNKNOWN.
// The UI never invents a camera state — it only reflects this result.
export function useCameraStatus() {
  const [cameraStatus, setCameraStatus] = useState({
    status: "INITIALIZING",
    connected: false,
    message: "Checking camera connection...",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkCameraStatus = async () => {
      try {
        const res = await cameraApi.getStatus();

        if (!cancelled) {
          setCameraStatus({
            status: res?.status || "UNKNOWN",
            connected: res?.connected === true,
            message: res?.message || "",
          });

          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setCameraStatus({
            status: "ERROR",
            message: "Camera status unavailable.",
          });

          setLoading(false);
        }
      }
    };

    // Check immediately when the page loads
    checkCameraStatus();

    // Re-check every 5 seconds
    const interval = window.setInterval(() => {
      checkCameraStatus();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return { cameraStatus, loading };
}
