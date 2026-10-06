import { useEffect, useState, useRef } from "react";
import AppLayout from "../../components/layout/AppLayout";
import GlassCard from "../../components/cards/GlassCard";
import Button from "../../components/common/Button";
import { useCameraStatus } from "../../hooks/useCameraStatus";
import { cameraApi } from "../../services/api/cameraApi";
import apiClient from "../../services/apiClient";
import { Camera, Activity, RefreshCw, Eye, GitBranch, Thermometer, Brain, FileCheck, Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Maximize } from "lucide-react";
import InspectionImagePanel from "../../components/inspection/InspectionImagePanel";
import XAIExplanationPanel from "../../components/inspection/XAIExplanationPanel";
import XMCCVResultsPanel from "../../components/inspection/XMCCVResultsPanel";
import HeatmapPanel from "../../components/inspection/HeatmapPanel";
import ODCResultsPanel from "../../components/inspection/ODCResultsPanel";
import InspectionDecisionPanel from "../../components/inspection/InspectionDecisionPanel";

export default function LiveInspectionPage() {
  const { cameraStatus } = useCameraStatus();
  const cameraConnected = cameraStatus.connected;
  const cameraDisconnected = cameraStatus.status === "DISCONNECTED" || !cameraConnected;

  const [notice, setNotice] = useState("");
  const [capturedImageUrl, setCapturedImageUrl] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [imageDims, setImageDims] = useState(null);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const imageRef = useRef(null);

  useEffect(() => {
    return () => {
      if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    };
  }, [capturedImageUrl]);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      setImageDims({ width: naturalWidth, height: naturalHeight });
    }
  };

  const handleStartInspection = async () => {
    if (isCapturing) return;

    setIsCapturing(true);
    setNotice("Running inspection on Raspberry Pi...");
    setInspection(null);
    setSelectedDetection(null);

    try {
      const response = await apiClient.post(
        "/inspection/run",
        {},
        { timeout: 240000 }
      );

      const result = response.data;

      if (result.status !== "success") {
        throw new Error(
          result.message || "Inspection failed."
        );
      }

      setInspection(result);
      setNotice("Inspection completed.");
    } catch (error) {
      console.error("PCB inspection failed:", error);

      const detail = error.response?.data?.detail;

      let message =
        error.response?.data?.message ||
        error.message ||
        "Inspection failed. Check the backend logs.";

      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.msg || JSON.stringify(item)
          )
          .join("; ");
      } else if (detail && typeof detail === "object") {
        message = JSON.stringify(detail);
      }

      setNotice(message);
    } finally {
      setIsCapturing(false);
    }
  };


  const handleDetectionClick = (detection) => {
    setSelectedDetection(selectedDetection?.id === detection.id ? null : detection);
  };

  const isPass = inspection?.status === "PASS";
  const isFail = inspection?.status === "FAIL";
  const isNotPcb = inspection?.isPcb === false || String(inspection?.status || "").toUpperCase() === "NOT_PCB";
  const isMlPending = inspection?.modelName === "Pending";
  const isInspected = inspection?.status === "INSPECTED";
  const xai = inspection?.xai || {};
  const xaiVisualUrl = xai?.overlay_path || xai?.heatmap_path || xai?.visualization || null;
  const scanPhase = isCapturing ? "horizontal" : "idle";
  const scanning = isCapturing;

  const uploadedImage = capturedImageUrl ? { url: capturedImageUrl, name: "Captured PCB" } : null;
  const pcbImage = uploadedImage;

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1600px] w-full">
        {/* ---- TOP INSPECTION HEADER ---- */}
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
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border font-display text-[9px] uppercase tracking-wider font-bold ${cameraConnected ? "border-success/20 bg-success/5 text-success" : "border-danger/20 bg-danger/5 text-danger"}`}>
              <Activity className="w-3.5 h-3.5" />
              Camera: {cameraConnected ? "Connected" : "Disconnected"}
            </div>

            {inspection && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-accent/15 bg-[#050816] font-mono text-[9px]">
                <span className="text-slate-400">Board ID:</span>
                <span className="text-white font-bold">{inspection.board_id || inspection.pcbId || "—"}</span>
              </div>
            )}

            {inspection && (
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-display font-bold uppercase tracking-wider ${isPass ? "border-success/30 bg-success/10 text-success" : isFail ? "border-danger/30 bg-danger/10 text-danger" : "border-warning/30 bg-warning/10 text-warning"}`}>
                {isPass ? <CheckCircle className="h-3.5 w-3.5" /> : isFail ? <XCircle className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {inspection.status || "PROCESSING"}
              </span>
            )}

            <Button
              variant="secondary"
              className="flex items-center gap-1.5 py-1 px-2.5"
              onClick={handleStartInspection}
              disabled={!cameraConnected || isCapturing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCapturing ? "animate-spin" : ""}`} />
              {isCapturing ? "INSPECTING..." : "START INSPECTION"}
            </Button>
          </div>
        </div>

        {notice && (
          <div className={`p-3 rounded-lg border ${isCapturing ? "border-warning/30 bg-warning/5" : isFail ? "border-danger/30 bg-danger/5" : isPass ? "border-success/30 bg-success/5" : "border-accent/10 bg-[#050816]/50"}`}>
            <p className="font-mono text-[10px] text-slate-300 break-words flex items-center gap-2">
              {isCapturing && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
              {isFail && <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
              {isPass && <CheckCircle className="w-3.5 w-3.5 text-success" />}
              {notice}
            </p>
          </div>
        )}

        {/* ---- PRIMARY INSPECTION AREA (Two-Column: ~60% / ~40%) ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)] gap-5 items-stretch">
          {/* LEFT PANEL - Live PCB Inspection */}
          <InspectionImagePanel
            inspection={inspection}
            pcbImage={pcbImage}
            uploadedImage={uploadedImage}
            imageDims={imageDims}
            scanPhase={scanPhase}
            scanning={scanning}
            selectedDetection={selectedDetection}
            onDetectionClick={handleDetectionClick}
            showAnnotations={true}
          />

          {/* RIGHT PANEL - XAI Inspection Summary */}
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

        {/* ---- SECONDARY RESULTS GRID (2x2 equal columns) ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* 1. MCCV / X-MCCV Verification Panel */}
          <XMCCVResultsPanel
            inspection={inspection}
          />

          {/* 2. Heatmap Visualization Panel */}
          <HeatmapPanel
            inspection={inspection}
          />

          {/* 3. ODC Results Panel */}
          <ODCResultsPanel
            inspection={inspection}
          />

          {/* 4. Final Decision and Evidence Panel */}
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