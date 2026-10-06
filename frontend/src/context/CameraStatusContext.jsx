import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { cameraApi } from "../services/api/cameraApi";
import { rpiApi } from "../services/api/rpiApi";

const CameraStatusContext = createContext(null);

export const CAMERA_STATUS = {
  INITIALIZING: "INITIALIZING",
  CONNECTED: "CONNECTED",
  DISCONNECTED: "DISCONNECTED",
  CAMERA_UNAVAILABLE: "CAMERA_UNAVAILABLE",
  ERROR: "ERROR",
};

export function CameraStatusProvider({ children }) {
  const [cameraStatus, setCameraStatus] = useState({
    status: CAMERA_STATUS.INITIALIZING,
    connected: false,
    message: "Checking camera connection...",
    rpiStatus: {
      status: "CHECKING",
      connected: false,
      message: "Checking Raspberry Pi connection...",
      details: null,
    },
  });
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef(null);
  const isPollingRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const lastValidStatusRef = useRef(null);
  const cameraStatusRef = useRef(cameraStatus);

  useEffect(() => {
    cameraStatusRef.current = cameraStatus;
  }, [cameraStatus]);

  const checkStatus = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const [cameraRes, rpiRes] = await Promise.allSettled([
        cameraApi.getStatus(),
        rpiApi.checkHealth(),
      ]);

      const currentStatus = cameraStatusRef.current;
      let newStatus = currentStatus.status;
      let newConnected = currentStatus.connected;
      let newMessage = currentStatus.message;
      let newRpiStatus = { ...currentStatus.rpiStatus };

      if (cameraRes.status === "fulfilled" && cameraRes.value) {
        const data = cameraRes.value;
        newConnected = data.connected === true;

        if (newConnected) {
          newStatus = CAMERA_STATUS.CONNECTED;
          newMessage = data.message || "Camera ready";
          consecutiveFailuresRef.current = 0;
        } else if (data.status === "INITIALIZING") {
          newStatus = CAMERA_STATUS.INITIALIZING;
          newMessage = data.message || "Camera initializing...";
        } else if (data.status === "ERROR") {
          newStatus = CAMERA_STATUS.ERROR;
          newMessage = data.message || "Camera error";
        } else {
          newStatus = CAMERA_STATUS.CAMERA_UNAVAILABLE;
          newMessage = data.message || "Camera unavailable";
        }
      } else if (cameraRes.status === "rejected") {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 3 && lastValidStatusRef.current) {
          newStatus = CAMERA_STATUS.ERROR;
          newMessage = `Camera status check failed (${consecutiveFailuresRef.current} consecutive failures)`;
        }
      }

      if (rpiRes.status === "fulfilled" && rpiRes.value) {
        newRpiStatus = {
          status: rpiRes.value.connected ? "CONNECTED" : "DISCONNECTED",
          connected: rpiRes.value.connected === true,
          message: rpiRes.value.message || (rpiRes.value.connected ? "Raspberry Pi connected" : "Raspberry Pi disconnected"),
          details: rpiRes.value.details || null,
        };
      } else if (rpiRes.status === "rejected") {
        newRpiStatus = {
          status: "ERROR",
          connected: false,
          message: `Raspberry Pi connection check failed: ${rpiRes.reason?.message || "Unknown error"}`,
          details: null,
        };
      }

      const nextStatus = {
        status: newStatus,
        connected: newConnected,
        message: newMessage,
        rpiStatus: newRpiStatus,
      };

      if (newConnected || newStatus === CAMERA_STATUS.CONNECTED) {
        lastValidStatusRef.current = nextStatus;
      }

      setCameraStatus(nextStatus);
    } catch (err) {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3 && lastValidStatusRef.current) {
        setCameraStatus({
          ...lastValidStatusRef.current,
          status: CAMERA_STATUS.ERROR,
          message: `Camera status check failed: ${err.message}`,
        });
      }
    } finally {
      isPollingRef.current = false;
      setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    checkStatus();
    intervalRef.current = window.setInterval(checkStatus, 5000);
  }, [checkStatus]);

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
    await checkStatus();
  }, [checkStatus]);

  const value = {
    cameraStatus,
    loading,
    refresh,
  };

  return (
    <CameraStatusContext.Provider value={value}>
      {children}
    </CameraStatusContext.Provider>
  );
}

export function useCameraStatusContext() {
  const ctx = useContext(CameraStatusContext);
  if (!ctx) {
    throw new Error("useCameraStatusContext must be used within CameraStatusProvider");
  }
  return ctx;
}