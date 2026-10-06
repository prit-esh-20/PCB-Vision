import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { cameraMock } from "../mock/cameraMock";

// Camera service. Reports the real camera connection state from the backend
// (CONNECTED / DISCONNECTED / ERROR / INITIALIZING). The mock layer honestly
// reports DISCONNECTED because no camera device exists in mock mode.
export const cameraApi = {
  async getStatus() {
    if (API_CONFIG.useMock) return cameraMock.getStatus();

    const { data } = await apiClient.get("/camera/status");
    return data;
  },

  async capture() {
    if (API_CONFIG.useMock) {
      throw new Error("Camera capture requires the Raspberry Pi connection.");
    }

    const response = await apiClient.post(
      "/camera/capture",
      {},
      {
        responseType: "blob",
        timeout: 60000,
      },
    );

    return response.data;
  },

  async uploadCapturedImage(imageBlob) {
    const imageFile = new File(
      [imageBlob],
      `pcb_capture_${Date.now()}.jpg`,
      { type: "image/jpeg" }
    );

    const formData = new FormData();
    formData.append("file", imageFile);

    const response = await apiClient.post(
      "/inspection/upload",
      formData,
      { timeout: 60000 }
    );

    return response.data;
  },
}