import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";

// RPi service for Raspberry Pi connectivity and template operations.
export const rpiApi = {
  async checkHealth() {
    if (API_CONFIG.useMock) {
      return {
        connected: false,
        message: "Mock mode: Raspberry Pi not available.",
        details: null,
      };
    }

    const { data } = await apiClient.get("/rpi/health");
    return data;
  },

  async checkCameraStatus() {
    if (API_CONFIG.useMock) {
      return {
        connected: false,
        status: "DISCONNECTED",
        message: "Mock mode: camera status unavailable.",
      };
    }

    const { data } = await apiClient.get("/camera/status");
    return data;
  },


  async createTemplate({ templateName, referenceImages }) {
    if (API_CONFIG.useMock) {
      throw new Error("Template creation requires the real backend.");
    }

    if (!templateName.trim()) {
      throw new Error("Please enter a template name.");
    }

    if (!referenceImages?.length) {
      throw new Error("Please select at least one reference image.");
    }

    const formData = new FormData();
    formData.append("template_name", templateName.trim());

    referenceImages.forEach((file) => {
      formData.append("reference_images", file);
    });

    const { data } = await apiClient.post(
      "/template/create",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      }
    );

    return data;
  },
};