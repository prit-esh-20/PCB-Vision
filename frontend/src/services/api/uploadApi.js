
import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { uploadMock } from "../mock/uploadMock";

// Upload service for PCB inspection and template creation.
export const uploadApi = {
  async uploadImage(file) {
    if (API_CONFIG.useMock) {
      return uploadMock.uploadImage(file);
    }

    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post(
      "/inspection/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );

    return {
      ...data,
      uploadId: data.id,
      imageUrl: `${API_CONFIG.baseUrl}/inspection/${data.id}/image`,
    };
  },

  async createTemplate({
    templateName,
    expectedImages,
    referenceImages,
  }) {
    if (API_CONFIG.useMock) {
      throw new Error(
        "Template creation requires the real backend."
      );
    }

    if (!templateName.trim()) {
      throw new Error("Please enter a template name.");
    }

    if (
      !referenceImages?.length ||
      referenceImages.length !== Number(expectedImages)
    ) {
      throw new Error(
        "The selected image count must match the expected image count."
      );
    }

    const formData = new FormData();
    formData.append("template_name", templateName.trim());
    formData.append("expected_images", String(expectedImages));

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
