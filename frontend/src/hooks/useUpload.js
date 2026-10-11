import { useState, useCallback } from "react";
import { toErrorMessage } from "../utils/apiError";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ACCEPTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

export const isValidImageFile = (file) => {
  if (!file) return false;

  if (ACCEPTED_TYPES.includes(file.type)) {
    return true;
  }

  const lower = file.name.toLowerCase();

  return ACCEPTED_EXTENSIONS.some((ext) =>
    lower.endsWith(ext)
  );
};

export function useUpload() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const uploadImage = useCallback(async (file) => {
    if (!isValidImageFile(file)) {
      const message =
        "Unsupported file format. Use JPG, JPEG, PNG or WEBP.";

      setError({ message });

      return {
        ok: false,
        message,
      };
    }

    setError(null);
    setUploading(false);

    const previewUrl = URL.createObjectURL(file);

    setUploadedImage({
      file,
      url: previewUrl,
      name: file.name,
    });

    return {
      ok: true,
      result: {
        file,
        imageUrl: previewUrl,
        name: file.name,
      },
    };
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
    errorMessage: error
      ? toErrorMessage(
          error,
          "Unable to select PCB image."
        )
      : null,
    uploadImage,
    clearUpload,
  };
}