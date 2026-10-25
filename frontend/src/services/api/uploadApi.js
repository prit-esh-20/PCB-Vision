import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { uploadMock } from "../mock/uploadMock";

// Upload service for PCB inspection and Raspberry Pi template capture.
export const uploadApi = {
  async inspectUploadedImage(file) {
    if (API_CONFIG.useMock) {
      return uploadMock.uploadImage(file);
    }

    if (!file) {
      throw new Error("PCB image is required.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post(
      "/inspection/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return data;
  },

  // Step 1: Start a template capture session.
  async startTemplate({ templateName, expectedImages }) {
    if (API_CONFIG.useMock) {
      throw new Error(
        "Template creation requires the real backend."
      );
    }

    if (!templateName?.trim()) {
      throw new Error("Please enter a template name.");
    }

    const imageCount = Number(expectedImages);

    if (![4, 5].includes(imageCount)) {
      throw new Error(
        "Reference image count must be 4 or 5."
      );
    }

    const { data } = await apiClient.post(
      "/template/start",
      {
        template_name: templateName.trim(),
        expected_images: imageCount,
      }
    );

    if (!data.session_id) {
      throw new Error(
        "Backend did not return a template session ID."
      );
    }

    return data;
  },

  // Step 2: Capture exactly one image per function call.
  async captureTemplateImage(sessionId) {
    if (API_CONFIG.useMock) {
      throw new Error(
        "Template capture requires the real backend."
      );
    }

    if (!sessionId) {
      throw new Error(
        "No active template capture session."
      );
    }

    const { data } = await apiClient.post(
      "/template/next",
      {
        session_id: sessionId,
      }
    );

    return data;
  },

  // Step 3: Finish and save after all images are captured.
  async finishTemplate(sessionId) {
    if (API_CONFIG.useMock) {
      throw new Error(
        "Template creation requires the real backend."
      );
    }

    if (!sessionId) {
      throw new Error(
        "No active template capture session."
      );
    }

    const { data } = await apiClient.post(
      "/template/finish",
      {
        session_id: sessionId,
      }
    );

    return data;
  },

  // Cancel an active template capture session and discard partial progress.
  async cancelTemplate(sessionId) {
    if (API_CONFIG.useMock) {
      throw new Error(
        "Template creation requires the real backend."
      );
    }

    if (!sessionId) {
      throw new Error(
        "No active template capture session."
      );
    }

    const { data } = await apiClient.post(
      "/template/cancel",
      {
        session_id: sessionId,
      }
    );

    return data;
  },
};
