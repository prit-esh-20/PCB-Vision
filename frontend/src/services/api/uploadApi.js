import API_CONFIG from "../../config/api";
import apiClient from "../apiClient";
import { uploadMock } from "../mock/uploadMock";

// Upload service. Sends the user's selected PCB image to the backend when a
// real backend is connected; otherwise resolves with the actual file's local
// object URL so the viewport previews the REAL uploaded image.
export const uploadApi = {
  async uploadImage(file) {

    if (API_CONFIG.useMock) return uploadMock.uploadImage(file);
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post("/inspection/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return {
      ...data,
      uploadId: data.id,
      imageUrl: `${API_CONFIG.baseUrl}/inspection/${data.id}/image`,
    };
  },
};
