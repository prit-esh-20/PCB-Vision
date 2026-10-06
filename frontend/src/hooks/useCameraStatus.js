import { useCameraStatusContext } from "../context/CameraStatusContext";

export function useCameraStatus() {
  const { cameraStatus, loading, refresh } = useCameraStatusContext();
  return { cameraStatus, loading, refresh };
}