// Converts an unknown thrown value into a human-readable message.
// Axios errors prefer their response data message; everything else falls
// back to the raw message with a backend-availability hint.
export const toErrorMessage = (err, fallback) => {
  if (!err) return fallback;

  const dataMessage =
    err?.response?.data?.message ||
    err?.response?.data?.detail ||
    err?.response?.data?.error;

  if (dataMessage) return String(dataMessage);

  // ECONNABORTED = Axios timeout. For the inspection run endpoint the backend
  // may have finished after the client gave up — don't claim unavailability.
  if (err?.code === "ECONNABORTED") {
    const url = err?.config?.url ?? "";
    if (url.includes("/inspection/run")) {
      return "Inspection is taking longer than expected. Check the Dashboard — the result may already be available.";
    }
    return "Request timed out. Please try again.";
  }

  const raw = err?.message || "";
  if (/network|connect|socket/i.test(raw)) {
    return "Backend connection unavailable.";
  }

  return raw || fallback;
};
