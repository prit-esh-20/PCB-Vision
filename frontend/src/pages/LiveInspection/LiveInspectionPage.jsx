import { useState, useEffect } from "react";
import AppLayout from "../../components/layout/AppLayout";
import GlassCard from "../../components/cards/GlassCard";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/common/Button";
import { inspectionApi } from "../../services/api/inspectionApi";
import { useInspection, useScanProgress } from "../../hooks/useInspection";
import ScanningOverlay from "../../components/animations/ScanningOverlay";
import { useCameraStatus } from "../../hooks/useCameraStatus";
import {
  Camera,
  Activity,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Target,
  AlertTriangle,
} from "lucide-react";

export default function LiveInspectionPage() {
  const { inspection, error, runInspection, scanPhase, pcbImage, setPcbImage } = useInspection();

   const { cameraStatus } = useCameraStatus();

  const cameraDisconnected =
    cameraStatus?.status === "DISCONNECTED";

  const progress = useScanProgress();

  const [visualMode, setVisualMode] = useState("yolo");


  const modes = [
    { id: "yolo", label: "YOLO Detect" },
    { id: "gradcam", label: "Grad-CAM Overlay" },
    { id: "split", label: "Side-by-Side" },
  ];

  // The Live Inspection viewport is camera-fed — its schematic PCB frame
  // stands in for the live feed, so it registers that frame as the pcbImage
  // the shared inspection state requires. It never overwrites an image the
  // user uploaded on the Dashboard. Nothing here ever starts a scan.

  // Same sequential scan state machine as the Dashboard: both pages read the
  // shared inspection lifecycle and visualize the exact same phase.
  const isScanning = scanPhase === "horizontal" || scanPhase === "vertical";

  // The scan is a purely visual overlay: existing detection boxes and the
  // status strip stay visible and stable while scanning (no data is touched).
  // Only the XAI panel waits for the scan to finish before revealing the
  // latest result. The inspection itself runs asynchronously — mock today,
  // real API later.
  const isNotPcb =
    !!inspection &&
    (inspection.isPcb === false ||
      String(inspection.status || "").toUpperCase() === "NOT_PCB");
  const xaiInspection = isScanning ? null : inspection;

  const handleStartInspection = async () => {
    if (isScanning) return;
    await runInspection();
  };

  return (
    <AppLayout>
      {/* Main Console Workspace */}
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1440px] w-full">
        {/* Page title */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/10 pb-3">
          <div className="text-left">
            <h1 className="font-display text-lg md:text-xl font-bold text-white uppercase tracking-wider">
              Live Inspection Panel
            </h1>
            <p className="font-mono text-[9px] text-accent/70 tracking-widest uppercase">
              Explainable Automated Edge Vision Analyzer
            </p>
          </div>

          {/* Quick controls */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md border font-display text-[9px] uppercase tracking-wider font-bold ${
                cameraStatus.connected
                  ? "border-success/20 bg-success/5 text-success"
                  : "border-danger/20 bg-danger/5 text-danger"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Camera Status:{" "}
              {cameraStatus.connected ? "Connected" : "Disconnected"}
            </div>

            <Button
              variant="secondary"
              className="flex items-center gap-1.5 py-1 px-2.5"
              onClick={handleStartInspection}
              disabled={isScanning || !cameraStatus.connected}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`}
              />
              {isScanning ? "INSPECTING..." : "START INSPECTION"}
            </Button>
          </div>
        </div>

        {/* Inspection feed */}
        <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-5 items-start">
          {/* OPTICAL OUTPUT CAPTURE - Left panel */}
          <GlassCard className="flex flex-col" hoverLift={false}>
            {/* Visualizer Mode Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-accent" />
                <span className="font-display text-[10px] tracking-widest text-[#9ca3af] uppercase font-bold">
                  Optical Output Capture
                </span>
              </div>

              {/* Mode Toggles */}
              <div className="flex bg-[#050816] rounded-md p-1 border border-accent/15 self-start md:self-auto">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setVisualMode(mode.id)}
                    disabled={cameraDisconnected || isScanning}
                    className={`px-3 py-1 font-display text-[8px] uppercase tracking-widest font-extrabold rounded-sm transition-all ${
                      cameraDisconnected
                        ? "cursor-not-allowed text-slate-700 opacity-50"
                        : visualMode === mode.id
                          ? "bg-accent text-[#050816] shadow-[0_0_8px_#00E5FF]"
                          : "cursor-pointer text-[#9ca3af] hover:text-white"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Viewport Frame - dominant PCB feed */}
            <div className="relative bg-black rounded-lg overflow-hidden border border-accent/5 my-2 w-full mx-auto flex items-center justify-center h-[340px] md:h-[430px] lg:h-[530px]">
              {/* Electronics Schematic background grid */}
              <div className="absolute inset-0 cyber-grid opacity-20" />

              {cameraDisconnected ? (
                <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center p-6">
                  <div className="p-4 rounded-full bg-danger/10 border border-danger/20 text-danger mb-1">
                    <Camera className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <h3 className="font-display text-base md:text-lg font-bold text-danger uppercase tracking-wider">
                    CAMERA DISCONNECTED
                  </h3>
                  <p className="font-mono text-xs md:text-sm text-slate-400 max-w-sm">
                    Connect the inspection camera to begin live capture.
                  </p>
                </div>
              ) : (
                <>
                  {/* Image container — centered PCB frame; overlays share the same coordinate space */}
                  <div className="relative z-0 flex h-full w-full items-center justify-center">
                    <div
                      className="relative w-full max-h-full overflow-hidden"
                      style={{ aspectRatio: "600 / 400" }}
                    >
                      {/* Grid of circuit tracks */}
                      <svg
                        className="relative z-[1] w-full h-full text-accent/20"
                        viewBox="0 0 600 400"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect
                          x="10"
                          y="10"
                          width="580"
                          height="380"
                          rx="8"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <circle
                          cx="300"
                          cy="200"
                          r="50"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <circle
                          cx="150"
                          cy="120"
                          r="30"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <rect
                          x="420"
                          y="80"
                          width="80"
                          height="80"
                          rx="4"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <path
                          d="M10 200h580M300 10v380"
                          stroke="currentColor"
                          strokeWidth="0.5"
                          strokeDasharray="4 4"
                        />
                      </svg>

                      {/* Render Visual Mode 1: Standard YOLO Bounding Boxes */}
                      {inspection && visualMode === "yolo" && isNotPcb && (
                        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-black/40 rounded-lg">
                          <span className="font-mono text-[11px] tracking-[0.3em] text-danger uppercase font-bold">
                            Not a PCB
                          </span>
                          <span className="max-w-[70%] text-center font-mono text-[9px] text-slate-400">
                            Uploaded image could not be identified as a valid PCB.
                          </span>
                        </div>
                      )}

                      {inspection && visualMode === "yolo" && !isNotPcb && (
                        <>
                          {inspection.detections?.length > 0 &&
                            inspection.detections.map((det) => (
                              <div
                                key={det.id}
                                className="absolute z-[2] border-2 border-success bg-success/5 rounded font-mono text-[9px] text-success font-bold p-1"
                                style={{
                                  left: `${det.bbox.left}%`,
                                  top: `${det.bbox.top}%`,
                                  width: `${det.bbox.width}%`,
                                  height: `${det.bbox.height}%`,
                                }}
                              >
                                <span className="block">{det.label}</span>
                                <span>CONF: {det.confidence}%</span>
                              </div>
                            ))}
                        </>
                      )}

                      {/* Render Visual Mode 2: Grad-CAM Overlay Heatmap */}
                      {inspection && visualMode === "gradcam" && (
                        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/20">
                          <div className="rounded-lg border border-accent/10 bg-[#050816]/90 px-5 py-4 text-center shadow-xl">
                            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-accent">
                              Grad-CAM Overlay
                            </div>

                            <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                              Awaiting trained ML model
                            </div>

                            <p className="mt-1 max-w-xs font-sans text-[10px] leading-relaxed text-slate-600">
                              The XAI heatmap will be generated here once the trained inspection
                              model and Grad-CAM pipeline are connected.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* AOI scan animation — same container as the PCB image, above
                          the image and the detection overlays */}
                      {isScanning && pcbImage && (
                        <ScanningOverlay phase={scanPhase} />
                      )}
                    </div>
                  </div>

                  {/* Error state */}
                  {!isScanning && error && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 gap-2">
                      <span className="font-mono text-[10px] tracking-[0.3em] text-danger uppercase font-bold">
                        Unable to retrieve inspection data
                      </span>
                      <button
                        onClick={handleStartInspection}
                        className="font-mono text-[9px] text-accent underline underline-offset-4 cursor-pointer"
                      >
                        Please try again
                      </button>
                    </div>
                  )}

                  {/* Empty state — no inspection result yet */}
                  {!isScanning && !error && !inspection && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
                      <span className="font-mono text-[11px] tracking-[0.3em] text-slate-400 uppercase font-bold">
                        Waiting for inspection
                      </span>
                      <span className="font-mono text-[9px] text-slate-600">
                        Press START INSPECTION to run an inspection
                      </span>
                    </div>
                  )}

                  {/* Render Visual Mode 3: Split (Side-by-Side) */}
                  {inspection && visualMode === "split" && (
                    <div className="relative grid h-full w-full grid-cols-2 divide-x divide-accent/20">

                      {/* LEFT — YOLO Detection */}
                      <div className="relative flex h-full w-full items-center justify-center">
                        <div className="absolute left-2 top-2 z-[4] rounded border border-accent/10 bg-[#050816]/95 px-2 py-0.5">
                          <span className="font-mono text-[8px] uppercase tracking-widest text-accent">
                            YOLO DETECT
                          </span>
                        </div>

                        <div className="flex flex-col items-center justify-center px-4 text-center">
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                            Detection Output
                          </span>

                          <span className="mt-2 font-mono text-[9px] uppercase tracking-widest text-slate-600">
                            Awaiting trained ML model
                          </span>
                        </div>
                      </div>

                      {/* RIGHT — Grad-CAM XAI */}
                      <div className="relative flex h-full w-full items-center justify-center bg-accent/[0.02]">
                        <div className="absolute left-2 top-2 z-[4] rounded border border-accent/10 bg-[#050816]/95 px-2 py-0.5">
                          <span className="font-mono text-[8px] uppercase tracking-widest text-accent">
                            XAI HEATMAP
                          </span>
                        </div>

                        <div className="flex flex-col items-center justify-center px-4 text-center">
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                            Grad-CAM Explanation
                          </span>

                          <span className="mt-2 font-mono text-[9px] uppercase tracking-widest text-slate-600">
                            Awaiting trained ML model
                          </span>

                          <p className="mt-1 max-w-[220px] font-sans text-[9px] leading-relaxed text-slate-700">
                            The visual explanation will appear here when the trained model and
                            Grad-CAM pipeline are connected.
                          </p>
                        </div>
                      </div>

                      {/* AOI scan animation */}
                      {isScanning && pcbImage && (
                        <ScanningOverlay phase={scanPhase} />
                      )}
                    </div>
                  )}

                  {/* Compact scan progress indicator — viewport corner, clear of the PCB */}
                  {isScanning && (
                    <div className="absolute bottom-2 right-2 z-[12] flex items-center gap-2 rounded-md border border-accent/15 bg-[#050816]/90 px-2.5 py-1.5 font-mono text-[8px] shadow-lg">
                      <span className="text-slate-400 uppercase tracking-widest">
                        Inspection in progress
                      </span>
                      <div className="h-[3px] w-16 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-accent shadow-[0_0_6px_rgba(50,213,131,0.6)]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="font-bold text-accent tracking-wider">
                        {Math.floor(progress)}%
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Bottom Diagnostics Tag */}
              <div className="absolute bottom-3 left-3 z-[20] flex items-center gap-2 bg-[#050816]/90 border border-accent/15 px-3 py-1.5 rounded font-mono text-[9px] shadow-lg">
                <span className="text-[#9ca3af]">CAMERA STATUS:</span>
                <span
                  className={`font-bold ${
                    isScanning
                      ? "text-accent"
                      : cameraStatus.connected
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {isScanning
                    ? "SCANNING"
                    : cameraStatus.connected
                      ? "READY"
                      : "DISCONNECTED"}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isScanning ? "bg-accent led-fast" : "bg-success led-slow"}`}
                />
                {inspection && <StatusBadge status={inspection.status} />}
              </div>
            </div>

            {/* Compact inspection status strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-3 py-2 rounded-md border border-accent/10 bg-[#050816]/50">
              {/* Camera status */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isScanning
                      ? "bg-accent led-fast"
                      : cameraStatus.connected
                        ? "bg-success led-slow"
                        : "bg-danger"
                  }`}
                />
                <span
                  className={`font-mono text-[9px] tracking-widest uppercase font-bold ${
                    isScanning
                      ? "text-accent"
                      : cameraStatus.connected
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {isScanning
                    ? "Scanning..."
                    : cameraStatus.connected
                      ? "Camera Ready"
                      : "Camera Disconnected"}
                </span>
              </div>

              <span className="hidden md:inline font-mono text-accent/25">
                |
              </span>

              {/* PCB ID */}
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] tracking-widest text-slate-500 uppercase font-bold">
                  PCB ID
                </span>
                <span className="font-mono text-[10px] text-white font-bold tracking-wider">
                  {inspection ? inspection.pcbId : "—"}
                </span>
              </div>

              <span className="hidden md:inline font-mono text-accent/25">
                |
              </span>

              {/* PASS/FAIL verdict */}
              {inspection ? (
                <StatusBadge status={inspection.status} />
              ) : (
                <span className="font-mono text-[9px] text-slate-600 uppercase tracking-widest">
                  No result
                </span>
              )}

              {/* Defect detail on FAIL */}
              {inspection?.status === "FAIL" &&
                inspection?.defectClass &&
                inspection.defectClass !== "None" && (
                  <span className="flex items-center gap-1.5 font-mono text-[9px] text-danger">
                    <AlertTriangle className="w-3 h-3 animate-pulse" />
                    <span className="font-bold uppercase">
                      {inspection.defectClass}
                    </span>
                  </span>
                )}
            </div>
          </GlassCard>

          {/* XAI INSPECTION SUMMARY - Right panel */}
          <GlassCard className="space-y-3" hoverLift={false}>
            <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
              <Eye className="w-3.5 h-3.5 text-accent" />
              <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
                XAI Inspection Summary
              </span>
            </div>

            {!xaiInspection ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase font-bold">
                  XAI Analysis
                </span>
                <span className="font-mono text-[9px] text-slate-600">
                  Waiting for inspection result.
                </span>
              </div>
            ) : (
              <>
                {/* Detection / Defect / Confidence / Location - 2x2 compact grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div className="text-left">
                    <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">
                      Detection
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-display text-[11px] font-extrabold uppercase tracking-wider ${
                        xaiInspection.status === "PASS"
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {xaiInspection.status === "PASS" ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {xaiInspection.status}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">
                      Defect
                    </span>
                    <span
                      className={`font-display text-[11px] font-extrabold uppercase tracking-wider ${
                        xaiInspection.status === "FAIL"
                          ? "text-danger"
                          : "text-slate-300"
                      }`}
                    >
                      {xaiInspection.status === "FAIL" &&
                        xaiInspection.defectClass &&
                        xaiInspection.defectClass !== "None"
                          ? xaiInspection.defectClass
                          : "None"}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">
                      Confidence
                    </span>
                    <span className="font-display text-[11px] font-extrabold text-accent tracking-wider">
                      {xaiInspection.confidence}%
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">
                      Location
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-300">
                      <Target className="w-3 h-3 text-accent" />
                      "—"
                    </span>
                  </div>
                </div>

                {/* Short AI explanation */}
                <div className="pt-2 border-t border-accent/5">
                  <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-1">
                    Model Rationale
                  </span>
                  <p className="font-sans text-[11px] text-slate-300 leading-relaxed text-left">
                    {xaiInspection.xaiExplanation}
                  </p>
                </div>

                {/* Model info */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] font-mono text-slate-500">
                  <span>
                    Model:{" "}
                    <strong className="text-slate-400">
                      {xaiInspection.model}
                    </strong>
                  </span>
                  <span>
                    Layer:{" "}
                    <strong className="text-slate-400">
                      {xaiInspection.gradCamLayer}
                    </strong>
                  </span>
                </div>
              </>
            )}
          </GlassCard>
        </div>
      </main>
    </AppLayout>
  );
}
