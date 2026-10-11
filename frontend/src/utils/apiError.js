// Converts an unknown thrown value into a human-readable message.
// Axios errors prefer their response data message; everything else falls
// back to the raw message with a backend-availability hint.
export const toErrorMessage = (err, fallback) => {
  if (!err) return fallback;

  const data = err?.response?.data;
  const candidates = [
    data?.message,
    data?.detail,
    data?.error,
    err?.message,
    err?.detail,
    err?.error,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (value && typeof value === "object") {
      if (typeof value.message === "string") return value.message;
      if (typeof value.detail === "string") return value.detail;

      if (Array.isArray(value)) {
        return value
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.msg || JSON.stringify(item)
          )
          .join("; ");
      }

      return JSON.stringify(value);
    }
  }

  if (err?.code === "ECONNABORTED") {
    return "Request timed out. Please try again.";
  }

  if (err?.code === "ERR_NETWORK") {
    return "Backend connection unavailable.";
  }

  return fallback;
};
