import { useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import { useCameraStatus } from "../../hooks/useCameraStatus";
import apiClient from "../../services/apiClient";
import {
  Activity,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

import InspectionImagePanel from "../../components/inspection/InspectionImagePanel";
import XAIExplanationPanel from "../../components/inspection/XAIExplanationPanel";
import XMCCVResultsPanel from "../../components/inspection/XMCCVResultsPanel";
import HeatmapPanel from "../../components/inspection/HeatmapPanel";
import ODCResultsPanel from "../../components/inspection/ODCResultsPanel";
import InspectionDecisionPanel from "../../components/inspection/InspectionDecisionPanel";

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
    sessionStorage.setItem(
      INSPECTION_STORAGE_KEY,
      JSON.stringify(inspection)
    );
  } catch (error) {
    console.error("Unable to save inspection result:", error);
  }
}

function normalizeInspectionResponse(response) {
  const result = response?.data ?? response ?? {};
  const raw = result?.inspection ?? {};

  const rawDetections = Array.isArray(raw.detections)
    ? raw.detections
    : [];

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
      det?.confidence ??
      det?.yolo_confidence ??
      det?.yoloConfidence ??
      null;

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
          (
            bbox.left != null && bbox.width != null
              ? bbox.left + bbox.width
              : undefined
          ),

        y2:
          bbox.y2 ??
          (
            bbox.top != null && bbox.height != null
              ? bbox.top + bbox.height
              : undefined
          ),

        left: bbox.left ?? bbox.x1,
        top: bbox.top ?? bbox.y1,

        width:
          bbox.width ??
          (
            bbox.x2 != null && bbox.x1 != null
              ? bbox.x2 - bbox.x1
              : undefined
          ),

        height:
          bbox.height ??
          (
            bbox.y2 != null && bbox.y1 != null
              ? bbox.y2 - bbox.y1
              : undefined
          ),
      },

      ocr_text:
        det?.ocr_text ??
        det?.ocrText ??
        "",
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
    (
      detectionConfidences.length > 0
        ? Math.max(...detectionConfidences)
        : null
    );

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
    images?.input ??
    raw?.image_url ??
    raw?.imageUrl ??
    null;

  const detectionImageUrl =
    images?.detection ??
    raw?.detection_image_url ??
    raw?.detectionImageUrl ??
    null;

  const heatmapImageUrl =
    images?.heatmap ??
    null;

  const overlayImageUrl =
    images?.overlay ??
    null;

  const xai = {
    ...rawXai,

    heatmap_path:
      heatmapImageUrl ??
      rawXai?.heatmap_path ??
      null,

    overlay_path:
      overlayImageUrl ??
      rawXai?.overlay_path ??
      null,

    processing_time:
      rawXai?.processing_time ??
      rawXai?.processingTime ??
      null,
  };

  const xmccv = Array.isArray(raw?.xmccv)
    ? raw.xmccv
    : [];

  const decision = {
    ...rawDecision,

    overall_status:
      rawDecision?.overall_status ??
      rawDecision?.status ??
      raw?.status ??
      "FAIL",

    reason:
      rawDecision?.reason ??
      rawDecision?.rationale ??
      "",
  };

  const boardId =
    raw?.board_id ??
    raw?.boardId ??
    database?.board_id ??
    database?.boardId ??
    null;

  const inspectionId =
    raw?.inspection_id ??
    raw?.inspectionId ??
    database?.inspection_id ??
    null;

  const status = String(
    decision?.overall_status ??
    raw?.status ??
    result?.status ??
    "FAIL"
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

  const cameraConnected = cameraStatus.connected;

  const [notice, setNotice] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [inspection, setInspection] = useState(loadSavedInspection);
  const [selectedDetection, setSelectedDetection] = useState(null);

  const handleStartInspection = async () => {
    if (isCapturing) return;

    setInspection(null);
    setSelectedDetection(null);
    setNotice("Running inspection on Raspberry Pi...");
    setIsCapturing(true);

    try {
      sessionStorage.removeItem(INSPECTION_STORAGE_KEY);

      /*
       * DO NOT use browser camera capture here.
       *
       * Raspberry Pi /inspection/run owns the complete
       * physical camera inspection workflow.
       */
      const response = await apiClient.post(
        "/inspection/run",
        {},
        {
          timeout: 240000,
        }
      );

      const result = response?.data;

      if (!result || result.status !== "success") {
        throw new Error(
          result?.message ||
          result?.detail ||
          "Inspection failed."
        );
      }

      const normalizedInspection =
      normalizeInspectionResponse(result);

    // Persist the exact normalized inspection response.
    // No ML processing or decision logic is changed.
    saveInspectionResult(normalizedInspection);
    setInspection(normalizedInspection);

    setNotice("Inspection completed.");
    } catch (error) {
      console.error(
        "PCB inspection failed:",
        error
      );

      const detail =
        error?.response?.data?.detail;

      let message =
        error?.response?.data?.message ||
        error?.message ||
        "Inspection failed. Check the backend logs.";

      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.msg ||
                JSON.stringify(item)
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
      selectedDetection?.id === detection?.id
        ? null
        : detection
    );
  };

  const status =
    String(
      inspection?.status || ""
    ).toUpperCase();

  const isPass = status === "PASS";
  const isFail = status === "FAIL";

  const isNotPcb =
    inspection?.isPcb === false ||
    status === "NOT_PCB";

  const xai =
    inspection?.xai || {};

  const xaiVisualUrl =
    xai?.overlay_path ||
    xai?.heatmap_path ||
    null;

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
  const scanPhase = isCapturing
    ? "horizontal"
    : "idle";

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1600px] w-full">

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

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md border font-display text-[9px] uppercase tracking-wider font-bold ${
                cameraConnected
                  ? "border-success/20 bg-success/5 text-success"
                  : "border-danger/20 bg-danger/5 text-danger"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />

              Camera:{" "}
              {cameraConnected
                ? "Connected"
                : "Disconnected"}
            </div>

            {inspection && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-accent/15 bg-[#050816] font-mono text-[9px]">
                <span className="text-slate-400">
                  Inspection ID:
                </span>

                <span className="text-white font-bold">
                  {inspection.inspection_id || inspection.inspectionId || "—"}
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

                {inspection.status ||
                  "PROCESSING"}
              </span>
            )}

            <Button
              variant="secondary"
              className="flex items-center gap-1.5 py-1 px-2.5"
              onClick={handleStartInspection}
              disabled={
                !cameraConnected ||
                isCapturing
              }
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isCapturing
                    ? "animate-spin"
                    : ""
                }`}
              />

              {isCapturing
                ? "INSPECTING..."
                : "START INSPECTION"}
            </Button>
          </div>
        </div>

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

              {isFail && (
                <AlertTriangle className="w-3.5 h-3.5 text-danger" />
              )}

              {isPass && (
                <CheckCircle className="w-3.5 h-3.5 text-success" />
              )}

              {notice}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)] gap-5 items-stretch">

          <InspectionImagePanel
            inspection={inspection}
            pcbImage={pcbImage}
            uploadedImage={uploadedImage}
            imageDims={null}
            scanPhase={scanPhase}
            scanning={scanning}
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

          <XMCCVResultsPanel
            inspection={inspection}
          />

          <HeatmapPanel
            inspection={inspection}
          />

          <ODCResultsPanel
            inspection={inspection}
          />

          <InspectionDecisionPanel
            inspection={inspection}
            onGenerateReport={() => {}}
            onExport={() => {}}
          />

        </div>
      </main>
    </AppLayout>
  );
}