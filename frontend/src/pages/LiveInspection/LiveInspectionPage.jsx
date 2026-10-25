import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import { useCameraStatus } from "../../hooks/useCameraStatus";
import { useReport } from "../../hooks/useReport";
import apiClient from "../../services/apiClient";
import { uploadApi } from "../../services/api/uploadApi";
import {
  Activity,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Upload,
  Camera,
  Image,
  X,
  FileText,
  Layers,
} from "lucide-react";

import InspectionImagePanel from "../../components/inspection/InspectionImagePanel";
import XAIExplanationPanel from "../../components/inspection/XAIExplanationPanel";
import XMCCVResultsPanel from "../../components/inspection/XMCCVResultsPanel";
import HeatmapPanel from "../../components/inspection/HeatmapPanel";
import ODCResultsPanel from "../../components/inspection/ODCResultsPanel";
import InspectionDecisionPanel from "../../components/inspection/InspectionDecisionPanel";
import TemplateModePanel from "../../components/inspection/TemplateModePanel";

const INSPECTION_STORAGE_KEY = "pcbvision:lastSuccessfulInspection";

function loadSavedInspection() {
  try {
    const saved = sessionStorage.getItem(INSPECTION_STORAGE_KEY);

    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Unable to restore saved inspection:", error);
    return null;
  }
}

function saveInspectionResult(inspection) {
  try {
    sessionStorage.setItem(INSPECTION_STORAGE_KEY, JSON.stringify(inspection));
  } catch (error) {
    console.error("Unable to save inspection result:", error);
  }
}

function normalizeInspectionResponse(response) {
  const result = response?.data ?? response ?? {};
  const raw = result?.inspection ?? {};

  const rawDetections = Array.isArray(raw.detections) ? raw.detections : [];

  const images = result?.images ?? {};
  const database = result?.database ?? {};
  const rawDecision = raw?.decision ?? {};
  const rawXai = raw?.xai ?? {};

  const detections = rawDetections.map((det, index) => {
    const bbox = det?.bbox ?? {};

    const className =
      det?.class_name ??
      det?.className ??
      det?.label ??
      `Detection ${index + 1}`;

    const confidence =
      det?.confidence ?? det?.yolo_confidence ?? det?.yoloConfidence ?? null;

    return {
      ...det,

      id: det?.id ?? `${className}-${index + 1}`,

      class_name: className,
      className,
      label: className,

      confidence,

      bbox: {
        ...bbox,

        x1: bbox.x1 ?? bbox.left,
        y1: bbox.y1 ?? bbox.top,

        x2:
          bbox.x2 ??
          (bbox.left != null && bbox.width != null
            ? bbox.left + bbox.width
            : undefined),

        y2:
          bbox.y2 ??
          (bbox.top != null && bbox.height != null
            ? bbox.top + bbox.height
            : undefined),

        left: bbox.left ?? bbox.x1,
        top: bbox.top ?? bbox.y1,

        width:
          bbox.width ??
          (bbox.x2 != null && bbox.x1 != null ? bbox.x2 - bbox.x1 : undefined),

        height:
          bbox.height ??
          (bbox.y2 != null && bbox.y1 != null ? bbox.y2 - bbox.y1 : undefined),
      },

      ocr_text: det?.ocr_text ?? det?.ocrText ?? "",
    };
  });

  const detectionConfidences = detections
    .map((det) => Number(det.confidence))
    .filter((value) => Number.isFinite(value));

  const yoloConfidence =
    raw?.confidence ??
    raw?.yoloConfidence ??
    database?.confidence ??
    database?.yolo_confidence ??
    (detectionConfidences.length > 0
      ? Math.max(...detectionConfidences)
      : null);

  const inspectionTime =
    raw?.inspection_time ??
    raw?.inspectionTime ??
    raw?.processing_time ??
    raw?.processingTime ??
    database?.inspection_time ??
    database?.inspectionTime ??
    rawXai?.processing_time ??
    rawXai?.processingTime ??
    null;

  const inputImageUrl =
    images?.input ?? raw?.image_url ?? raw?.imageUrl ?? null;

  const detectionImageUrl =
    images?.detection ??
    raw?.detection_image_url ??
    raw?.detectionImageUrl ??
    null;

  const heatmapImageUrl = images?.heatmap ?? null;

  const overlayImageUrl = images?.overlay ?? null;

  const xai = {
    ...rawXai,

    heatmap_path: heatmapImageUrl ?? rawXai?.heatmap_path ?? null,

    overlay_path: overlayImageUrl ?? rawXai?.overlay_path ?? null,

    processing_time: rawXai?.processing_time ?? rawXai?.processingTime ?? null,
  };

  const xmccv = Array.isArray(raw?.xmccv) ? raw.xmccv : [];

  const decision = {
    ...rawDecision,

    overall_status:
      rawDecision?.overall_status ??
      rawDecision?.status ??
      raw?.status ??
      "FAIL",

    reason: rawDecision?.reason ?? rawDecision?.rationale ?? "",
  };

  const boardId =
    raw?.board_id ??
    raw?.boardId ??
    database?.board_id ??
    database?.boardId ??
    null;

  const inspectionId =
    raw?.inspection_id ?? raw?.inspectionId ?? database?.inspection_id ?? null;

  const status = String(
    decision?.overall_status ?? raw?.status ?? result?.status ?? "FAIL",
  ).toUpperCase();

  return {
    ...raw,

    inspection_id: inspectionId,
    inspectionId,

    board_id: boardId,
    boardId,
    pcbId: boardId,

    status,
    decision,

    /*
     * IMPORTANT:
     * Raw input remains available here,
     * but it is NOT used by the main inspection viewer.
     */
    input_image: inputImageUrl,
    inputImage: inputImageUrl,

    /*
     * Main viewer uses YOLO bounding-box image.
     */
    image_path: detectionImageUrl,
    imagePath: detectionImageUrl,
    image_url: detectionImageUrl,
    imageUrl: detectionImageUrl,

    detection_image: detectionImageUrl,
    detectionImage: detectionImageUrl,
    detection_image_url: detectionImageUrl,

    detections,

    componentsCount: detections.length,

    confidence: yoloConfidence,
    yoloConfidence,

    ocr: detections
      .filter((det) => det.ocr_text)
      .map((det) => ({
        component: det.class_name,
        text: det.ocr_text,
        detectionId: det.id,
      })),

    xmccv,
    componentDetails: xmccv,

    xai,
    xaiExplanation: xai,

    inspection_time: inspectionTime,
    inspectionTime,
    cycleTime: inspectionTime,

    images: {
      input: inputImageUrl,
      detection: detectionImageUrl,
      heatmap: heatmapImageUrl,
      overlay: overlayImageUrl,
    },

    apiResponse: result,
  };
}

export default function LiveInspectionPage() {
  const { cameraStatus } = useCameraStatus();
  const { generating, generateReport, errorMessage: reportError } = useReport();
  const location = useLocation();
  const navigate = useNavigate();

  // If navigated from Dashboard "Test with PCB Image" button, default to upload mode
  const initialMode = location.state?.mode === "upload" ? "upload" : "camera";

  const cameraConnected = cameraStatus.connected;

  const [inspectionMode, setInspectionMode] = useState(initialMode);
  const [notice, setNotice] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [inspection, setInspection] = useState(loadSavedInspection);
  const [selectedDetection, setSelectedDetection] = useState(null);

  // Template mode state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateInspectionMethod, setTemplateInspectionMethod] = useState("");

  // Upload mode state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setNotice("Please select a valid image file (JPG, PNG, etc.).");
      return;
    }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setUploadPreview(e.target.result);
    reader.readAsDataURL(file);
    setNotice("");
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleUploadInspection = async () => {
    if (!uploadFile || isUploading) return;
    setInspection(null);
    setSelectedDetection(null);
    setIsUploading(true);
    setNotice("Uploading PCB image for inspection...");
    try {
      sessionStorage.removeItem(INSPECTION_STORAGE_KEY);
      const result = await uploadApi.inspectUploadedImage(
          uploadFile,
          inspectionMode === "template" ? selectedTemplate : null
        );
      if (
        !result ||
        (result.status !== "success" && !result.inspection)
      ) {
        throw new Error(
          result?.message || result?.detail || "Upload inspection failed.",
        );
      }
      const normalizedInspection = normalizeInspectionResponse(result);
      saveInspectionResult(normalizedInspection);
      setInspection(normalizedInspection);
      setNotice("Upload inspection completed.");
    } catch (error) {
      console.error("Upload PCB inspection failed:", error);
      const detail = error?.response?.data?.detail;
      let message =
        error?.response?.data?.message ||
        error?.message ||
        "Upload inspection failed. Check the backend logs.";
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail))
        message = detail
          .map((item) =>
            typeof item === "string" ? item : item?.msg || JSON.stringify(item),
          )
          .join("; ");
      setNotice(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartInspection = async () => {
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

  const handleDetectionClick = (detection) => {
    setSelectedDetection(
      selectedDetection?.id === detection?.id ? null : detection,
    );
  };

  const status = String(inspection?.status || "").toUpperCase();

  const isPass = status === "PASS";
  const isFail = status === "FAIL";

  const isNotPcb = inspection?.isPcb === false || status === "NOT_PCB";

  const xai = inspection?.xai || {};

  const xaiVisualUrl = xai?.overlay_path || xai?.heatmap_path || null;

  /*
   * MAIN VIEW:
   * YOLO bounding-box image, NOT raw input image.
   */
  const pcbImage = inspection?.detection_image
    ? {
        url: inspection.detection_image,
        name: "YOLO Detection Result",
      }
    : null;

  const uploadedImage = null;

  const isMlPending = false;
  const isInspected = Boolean(inspection);

  const scanning = isCapturing;
  const scanPhase = isCapturing ? "horizontal" : "idle";

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1600px] w-full">
        {/* â”€â”€ Page Header â”€â”€ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-accent/10 pb-3">
          <div>
            <h1 className="font-display text-lg md:text-xl font-bold text-white uppercase tracking-wider">
              PCB Inspection
            </h1>
            <p className="font-mono text-[9px] text-accent/70 tracking-widest uppercase">
              Detailed Inspection Workspace
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex items-center rounded-lg border border-accent/10 bg-[#050816] p-0.5">
              <button
                onClick={() => {
                  setInspectionMode("camera");
                  setNotice("");
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${
                  inspectionMode === "camera"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                <Camera className="h-3 w-3" />
                Camera
              </button>
              <button
                onClick={() => {
                  setInspectionMode("upload");
                  setNotice("");
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${
                  inspectionMode === "upload"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                <Upload className="h-3 w-3" />
                Upload
              </button>
              <button
                onClick={() => {
                  setInspectionMode("template");
                  setNotice("");
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${
                  inspectionMode === "template"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                <Layers className="h-3 w-3" />
                Template
              </button>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md border font-display text-[9px] uppercase tracking-wider font-bold ${
                cameraConnected
                  ? "border-success/20 bg-success/5 text-success"
                  : "border-danger/20 bg-danger/5 text-danger"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Camera: {cameraConnected ? "Connected" : "Disconnected"}
            </div>

            {inspection && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-accent/15 bg-[#050816] font-mono text-[9px]">
                <span className="text-slate-400">Inspection ID:</span>
                <span className="text-white font-bold">
                  {inspection.inspection_id || inspection.inspectionId || "â€”"}
                </span>
              </div>
            )}

            {inspection && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-display font-bold uppercase tracking-wider ${
                  isPass
                    ? "border-success/30 bg-success/10 text-success"
                    : isFail
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-warning/30 bg-warning/10 text-warning"
                }`}
              >
                {isPass ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : isFail ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {inspection.status || "PROCESSING"}
              </span>
            )}

            {inspection && !isCapturing && !isUploading && (
              <button
                type="button"
                onClick={() => generateReport(inspection)}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/80 transition-all hover:border-accent/40 hover:bg-accent/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Generate PDF inspection report"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3 text-accent" />
                    <span>Generate Report</span>
                  </>
                )}
              </button>
            )}

            {inspectionMode === "camera" && (
              <Button
                variant="secondary"
                className="flex items-center gap-1.5 py-1 px-2.5"
                onClick={handleStartInspection}
                disabled={!cameraConnected || isCapturing}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCapturing ? "animate-spin" : ""}`}
                />
                {isCapturing ? "INSPECTING..." : "START INSPECTION"}
              </Button>
            )}

            {inspectionMode === "template" && (
              <Button
                variant="secondary"
                className="flex items-center gap-1.5 py-1 px-2.5"
                onClick={handleStartInspection}
                disabled={!cameraConnected || !selectedTemplate || isCapturing}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCapturing ? "animate-spin" : ""}`}
                />
                {isCapturing ? "INSPECTING..." : "START INSPECTION"}
              </Button>
            )}
          </div>
        </div>

        {/* â”€â”€ Template Mode Panel â”€â”€ */}
        {inspectionMode === "template" && (
          <div className="space-y-4">
            <TemplateModePanel
              selectedTemplate={selectedTemplate}
              onTemplateSelect={(template) => {
                setSelectedTemplate(template);
                setTemplateInspectionMethod("");
                setNotice("");
              }}
              onNavigateToCreate={() => navigate("/dashboard")}
            />

            {selectedTemplate && (
              <div className="rounded-xl border border-accent/20 bg-[#08140F]/60 p-5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">
                  Choose Inspection Method
                </h3>

                <p className="text-sm text-slate-400">
                  How would you like to inspect this PCB against the selected
                  template?
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateInspectionMethod("camera");
                      setNotice("");
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      templateInspectionMethod === "camera"
                        ? "border-accent bg-accent/10"
                        : "border-white/10 hover:border-accent/40"
                    }`}
                  >
                    <Camera className="mb-2 h-5 w-5 text-accent" />
                    <span className="block font-semibold text-white">
                      Camera Inspection
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      Capture the PCB using the connected camera.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTemplateInspectionMethod("upload");
                      setNotice("");
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      templateInspectionMethod === "upload"
                        ? "border-accent bg-accent/10"
                        : "border-white/10 hover:border-accent/40"
                    }`}
                  >
                    <Upload className="mb-2 h-5 w-5 text-accent" />
                    <span className="block font-semibold text-white">
                      Upload Image
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      Choose a PCB image to compare with this template.
                    </span>
                  </button>
                </div>

                {templateInspectionMethod === "upload" && (
                  <p className="text-sm text-amber-300">
                    Select an image in the upload panel below. The selected
                    template must be used for the comparison.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Upload Mode Panel â”€â”€ */}
        {(inspectionMode === "upload" || (inspectionMode === "template" && templateInspectionMethod === "upload")) && (
          <div className="rounded-xl border border-accent/10 bg-[#08140F]/60 p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-accent/5 pb-3">
              <Upload className="h-4 w-4 text-accent" />
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Upload PCB Image for Inspection
              </span>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-all ${
                isDragging
                  ? "border-accent/60 bg-accent/5"
                  : uploadFile
                    ? "border-success/40 bg-success/5"
                    : "border-accent/20 bg-white/[0.015] hover:border-accent/40 hover:bg-accent/[0.025]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
              {uploadFile ? (
                <>
                  {uploadPreview && (
                    <img
                      src={uploadPreview}
                      alt="PCB preview"
                      className="max-h-48 rounded-lg object-contain border border-accent/10"
                    />
                  )}
                  <p className="font-mono text-[10px] text-success">
                    {uploadFile.name}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFile(null);
                      setUploadPreview(null);
                      setNotice("");
                    }}
                    className="absolute right-3 top-3 text-slate-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Image className="h-8 w-8 text-slate-600" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    Drag &amp; drop a PCB image, or click to browse
                  </p>
                  <p className="font-mono text-[9px] text-slate-600">
                    JPG, PNG, BMP, WEBP supported
                  </p>
                </>
              )}
            </div>

            {uploadFile && (
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  className="flex items-center gap-2"
                  onClick={handleUploadInspection}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                      Inspecting...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" /> Run Inspection
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {notice && (
          <div
            className={`p-3 rounded-lg border ${
              isCapturing
                ? "border-warning/30 bg-warning/5"
                : isFail
                  ? "border-danger/30 bg-danger/5"
                  : isPass
                    ? "border-success/30 bg-success/5"
                    : "border-accent/10 bg-[#050816]/50"
            }`}
          >
            <p className="font-mono text-[10px] text-slate-300 break-words flex items-center gap-2">
              {isCapturing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              )}

              {isFail && <AlertTriangle className="w-3.5 h-3.5 text-danger" />}

              {isPass && <CheckCircle className="w-3.5 h-3.5 text-success" />}

              {notice}
            </p>
          </div>
        )}

        {reportError && !generating && (
          <div className="p-3 rounded-lg border border-danger/30 bg-danger/5">
            <p className="font-mono text-[10px] text-danger break-words flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />
              <span>Report generation failed: {reportError}</span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)] gap-5 items-stretch">
        <InspectionImagePanel
          inspection={inspection}
          pcbImage={inspectionMode === "upload" ? null : pcbImage}
          uploadedImage={
            inspectionMode === "upload" && uploadPreview
              ? {
                  url: uploadPreview,
                  name: uploadFile?.name || "Uploaded PCB Image",
                }
              : uploadedImage
          }
          imageDims={null}
          scanPhase={scanPhase}
          scanning={scanning || isUploading}
          selectedDetection={selectedDetection}
          onDetectionClick={handleDetectionClick}
          showAnnotations={true}
        />

          <XAIExplanationPanel
            inspection={inspection}
            xai={xai}
            isPass={isPass}
            isNotPcb={isNotPcb}
            isMlPending={isMlPending}
            isInspected={isInspected}
            xaiVisualUrl={xaiVisualUrl}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <XMCCVResultsPanel inspection={inspection} />

          <HeatmapPanel inspection={inspection} />

          <ODCResultsPanel inspection={inspection} />

          <InspectionDecisionPanel
            inspection={inspection}
            onGenerateReport={
              inspection && !isCapturing && !isUploading
                ? () => generateReport(inspection)
                : undefined
            }
            generating={generating}
            onExport={() => {}}
          />
        </div>
      </main>
    </AppLayout>
  );
}

