
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
  }) {
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

    const formData = new FormData();

    formData.append(
      "template_name",
      templateName.trim()
    );

    formData.append(
      "expected_images",
      String(imageCount)
    );

    const { data } = await apiClient.post(
      "/templates/create",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 180000,
      }
    );

    return data;
  },
};
