from pathlib import Path

p = Path("src/pages/LiveInspection/LiveInspectionPage.jsx")
s = p.read_text(encoding="utf-8")

start = s.index("  const handleStartInspection = async () => {")
end = s.index("\n  const handleDetectionClick", start)

new_handler = '''  const handleStartInspection = async () => {
    if (isCapturing) return;

    if (inspectionMode === "template") {
      if (!selectedTemplate) {
        setNotice("Please select a saved template before starting inspection.");
        return;
      }

      if (!templateInspectionMethod) {
        setNotice("Please choose Camera Inspection or Upload Image.");
        return;
      }

      if (templateInspectionMethod === "upload") {
        setNotice("Select an image and use the upload inspection action.");
        return;
      }

      if (!cameraConnected) {
        setNotice("Camera is not connected. Cannot run template inspection.");
        return;
      }
    }

    setInspection(null);
    setSelectedDetection(null);
    setNotice("Running inspection on Raspberry Pi...");
    setIsCapturing(true);

    try {
      sessionStorage.removeItem(INSPECTION_STORAGE_KEY);

      const payload =
        inspectionMode === "template" && selectedTemplate
          ? {
              template_id:
                selectedTemplate.id ??
                selectedTemplate.template_id ??
                selectedTemplate.name ??
                selectedTemplate.template_name,
            }
          : {};

      const response = await apiClient.post("/inspection/run", payload);
      const result = response?.data;

      if (!result || result.status !== "success") {
        throw new Error(
          result?.message || result?.detail || "Inspection failed.",
        );
      }

      const normalizedInspection = normalizeInspectionResponse(result);
      saveInspectionResult(normalizedInspection);
      setInspection(normalizedInspection);
      setNotice("Inspection completed.");
    } catch (error) {
      console.error("PCB inspection failed:", error);

      const detail = error?.response?.data?.detail;
      let message =
        error?.response?.data?.message ||
        error?.message ||
        "Inspection failed. Check the backend logs.";

      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item) =>
            typeof item === "string" ? item : item?.msg || JSON.stringify(item),
          )
          .join("; ");
      }

      setNotice(message);
    } finally {
      setIsCapturing(false);
    }
  };
'''

p.write_text(s[:start] + new_handler + s[end:], encoding="utf-8")
print("Inspection handler updated.")
