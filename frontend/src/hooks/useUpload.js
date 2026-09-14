import { useState, useCallback, useRef } from "react";
import { uploadApi } from "../services/api/uploadApi";
import { toErrorMessage } from "../utils/apiError";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export const isValidImageFile = (file) => {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

// Upload state for the PCB image picker. The file itself is validated on the
// client; the actual upload goes through uploadApi. The preview always shows
// the real selecteda file — never a placeholder.
export function useUpload() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const runningRef = useRef(false);

  const uploadImage = useCallback(async (file) => {
    if (runningRef.current) {
      return { ok: false, message: "An upload is already in progress." };
    }
    if (!isValidImageFile(file)) {
      setError({ message: "Unsupported file format. Use JPG, JPEG, PNG or WEBP." });
      return { ok: false, message: "Unsupported file format. Use JPG, JPEG, PNG or WEBP." };
    }

    runningRef.current = true;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadApi.uploadImage(file);
      setUploadedImage({
        url: result.imageUrl,
        name: file.name,
        uploadId: result.uploadId || null,
      });
      return { ok: true, result };
    } catch (err) {
      const message = toErrorMessage(err, "Unable to upload PCB image.");
      setError(err);
      return { ok: false, message };
    } finally {
      setUploading(false);
      runningRef.current = false;
    }
  }, []);

  const clearUpload = useCallback(() => {
    setUploadedImage((current) => {
      if (current?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    setError(null);
  }, []);

  return {
    uploadedImage,
    uploading,
    error,
    errorMessage: error ? toErrorMessage(error, "Unable to upload PCB image.") : null,
    uploadImage,
    clearUpload,
  };
}
