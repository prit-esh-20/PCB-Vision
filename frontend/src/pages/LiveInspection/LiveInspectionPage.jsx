import { useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import GlassCard from "../../components/cards/GlassCard";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/common/Button";
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
  Aperture,
  Loader2,
} from "lucide-react";

// Capture-stage banner shown in the viewport while the frontend walks through
// the capture → analyze flow. All stages are presentation states only — no
// real camera capture or ML inference happens here yet.
const CAPTURE_STAGES = {
  CAPTURING: {
    icon: Aperture,
    title: "CAPTURING PCB...",
    hint: "Capture one PCB image",
    accent: "text-accent",
    pulse: "bg-accent led-fast",
  },
  CAPTURED: {
    icon: CheckCircle,
    title: "IMAGE CAPTURED",
    hint: "Ready for inspection",
    accent: "text-success",
    pulse: "bg-success led-slow",
  },
  PROCESSING: {
    icon: Loader2,
    title: "ANALYZING PCB...",
    hint: "Processing inspection",
    accent: "text-warning",
    pulse: "bg-warning led-fast",
  },
};

export default function LiveInspectionPage() {
  const { inspection, error, runInspection, scanPhase, pcbImage } = useInspection();

  const { cameraStatus } = useCameraStatus();

  const cameraConnected = cameraStatus.connected;
  const cameraDisconnected = cameraStatus.status === "DISCONNECTED" || !cameraConnected;

  const progress = useScanProgress();

  // Frontend-only capture presentation state. The real Raspberry Pi camera
  // backend will drive these stages later — no fake frames or images are
  // ever shown, and no fake inspection result is produced.
  const [captureStage, setCaptureStage] = useState(null); // CAPTURING | CAPTURED | PROCESSING
  const [notice, setNotice] = useState(null);

  // Same sequential scan state machine as the Dashboard: both pages read the
  // shared inspection lifecycle and visualize the exact same phase.
  const isScanning = scanPhase === "horizontal" || scanPhase === "vertical";

  // The inspection runs through the existing shared lifecycle
  // (useInspection → inspectionApi.runInspection). Results are never
  // invented here — whatever the backend returns is what renders.
  const isNotPcb =
    !!inspection &&
    (inspection.isPcb === false ||
      String(inspection.status || "").toUpperCase() === "NOT_PCB");

  const CAPTURE_STAGE_MS = 1400;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleStartInspection = async () => {
    if (isScanning || !cameraConnected) return;
    setNotice(null);
    if (!pcbImage) {
      // No PCB frame is available in the shared inspection store and the
      // camera capture backend is not connected yet, so nothing can be
      // captured. Surface the store's honest message instead of faking a
      // capture — the Dashboard upload remains the secondary testing path.
      setNotice(
        "No PCB image available. Camera capture is not connected yet — use TEST WITH PCB IMAGE on the Dashboard as the secondary testing path."
      );
      return;
    }
    // Presentation-only capture sequence over the real PCB frame: the future
    // camera backend will drive these same stages. No image or result is
    // fabricated in the meantime.
    setCaptureStage("CAPTURING");
    await wait(CAPTURE_STAGE_MS);
    setCaptureStage("CAPTURED");
    await wait(CAPTURE_STAGE_MS);
    setCaptureStage("PROCESSING");
    // The backend run contract requires the uploadId of the registered PCB
    // image (verified against /inspection/run). Send it when the shared store
    // has one so the real pipeline can find the frame to inspect.
    await runInspection(pcbImage?.uploadId ? { uploadId: pcbImage.uploadId } : undefined);
    setCaptureStage(null);
  };

  // Schematic PCB frame: a technical stand-in for the captured PCB area —
  // never presented as a live camera feed.
  const schematicFrame = (
    <svg
      className="relative z-[1] w-full h-full text-accent/20"
      viewBox="0 0 600 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="10" y="10" width="580" height="380" rx="8" stroke="currentColor" strokeWidth="1" />
      <circle cx="300" cy="200" r="50" stroke="currentColor" strokeWidth="1" />
      <circle cx="150" cy="120" r="30" stroke="currentColor" strokeWidth="1" />
      <rect x="420" y="80" width="80" height="80" rx="4" stroke="currentColor" strokeWidth="1" />
      <path d="M10 200h580M300 10v380" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
    </svg>
  );

  return (
    <AppLayout>
      {/* Main Console Workspace */}
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-[1440px] w-full">
        {/* Page title */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/10 pb-3">
          <div className="text-left">
            <h1 className="font-display text-lg md:text-xl font-bold text-white uppercase tracking-wider">
              PCB Inspection Panel
            </h1>
            <p className="font-mono text-[9px] text-accent/70 tracking-widest uppercase">
              Single-Capture PCB Inspection
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
              disabled={isScanning || !cameraConnected}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`}
              />
              {isScanning ? "INSPECTING..." : "START INSPECTION"}
            </Button>
          </div>
        </div>

        {/* Inspection area */}
        <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-5 items-start">
          {/* SINGLE IMAGE CAPTURE VIEW - Left panel */}
          <GlassCard className="flex flex-col" hoverLift={false}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-accent" />
                <span className="font-display text-[10px] tracking-widest text-[#9ca3af] uppercase font-bold">
                  PCB Capture / Inspection View
                </span>
              </div>
              <span className="rounded border border-accent/15 bg-[#050816] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-accent">
                Single Capture
              </span>
            </div>

            {/* Viewport Frame */}
            <div className="relative bg-black rounded-lg overflow-hidden border border-accent/5 my-2 w-full mx-auto flex items-center justify-center h-[340px] md:h-[430px] lg:h-[530px]">
              {/* Electronics Schematic background grid */}
              <div className="absolute inset-0 cyber-grid opacity-20" />

              {cameraDisconnected && !isScanning ? (
                <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center p-6">
                  <div className="p-4 rounded-full bg-danger/10 border border-danger/20 text-danger mb-1">
                    <Camera className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <h3 className="font-display text-base md:text-lg font-bold text-danger uppercase tracking-wider">
                    CAMERA DISCONNECTED
                  </h3>
                  <p className="font-mono text-xs md:text-sm text-slate-400 max-w-sm">
                    Connect the inspection camera to begin PCB capture.
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
                      {/* Grid of circuit tracks — schematic stand-in until a real
                          PCB frame (uploaded or captured) is available */}
                      {pcbImage?.url ? (
                        <img
                          src={pcbImage.url}
                          alt={pcbImage.name || "PCB under inspection"}
                          className="relative z-[1] block h-full w-full object-contain"
                        />
                      ) : (
                        schematicFrame
                      )}

                      {/* Frontend capture stages — presentation only, no fake imagery */}
                      {captureStage && (
                        <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-[2px]">
                          {(() => {
                            const stage = CAPTURE_STAGES[captureStage];
                            const Icon = stage.icon;
                            return (
                              <>
                                <div className="p-4 rounded-full border border-accent/20 bg-[#050816]/90">
                                  <Icon
                                    className={`w-7 h-7 ${stage.accent} ${
                                      captureStage !== "CAPTURED" ? "animate-pulse" : ""
                                    }`}
                                  />
                                </div>
                                <span
                                  className={`font-mono text-[11px] tracking-[0.3em] uppercase font-bold ${stage.accent}`}
                                >
                                  {stage.title}
                                </span>
                                <span className="font-mono text-[9px] text-slate-500">
                                  {stage.hint}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Not-a-PCB verdict from the backend — never fake detections */}
                      {inspection && !captureStage && isNotPcb && (
                        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-black/40 rounded-lg">
                          <span className="font-mono text-[11px] tracking-[0.3em] text-danger uppercase font-bold">
                            Not a PCB
                          </span>
                          <span className="max-w-[70%] text-center font-mono text-[9px] text-slate-400">
                            Uploaded image could not be identified as a valid PCB.
                          </span>
                        </div>
                      )}

                      {/* Real detections from the existing inspection flow —
                          rendered only when the backend returned them. No
                          boxes are generated when there is no ML result. */}
                      {inspection && !captureStage && !isNotPcb && (
                        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 rounded-lg">
                          {inspection.detections?.length > 0 ? (
                            inspection.detections.map((det) => (
                              <div
                                key={det.id}
                                className="absolute border-2 border-success bg-success/5 rounded font-mono text-[9px] text-success font-bold p-1"
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
                            ))
                          ) : (
                            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-600">
                              No detections available
                            </span>
                          )}
                        </div>
                      )}

                      {/* AOI scan animation — shared state with the Dashboard */}
                      {isScanning && pcbImage && (
                        <div className="absolute inset-0 z-[6] pointer-events-none" aria-hidden="true">
                          <ScanningOverlay phase={scanPhase} />
                        </div>
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

                  {/* Empty state — camera ready, waiting for the user to start */}
                  {!isScanning && !error && !inspection && !captureStage && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                      <span className="font-mono text-[11px] tracking-[0.3em] text-slate-400 uppercase font-bold">
                        Camera Ready
                      </span>
                      <span className="font-mono text-[9px] text-slate-600">
                        Place the PCB under the inspection camera
                      </span>
                      <Button
                        variant="primary"
                        className="flex items-center gap-1.5 py-1 px-2.5"
                        onClick={handleStartInspection}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        START INSPECTION
                      </Button>
                      <span className="font-mono text-[8px] uppercase tracking-widest text-slate-700">
                        Captures one PCB image
                      </span>
                      {notice && (
                        <span className="mt-1 max-w-[80%] text-center font-mono text-[9px] leading-relaxed text-warning">
                          {notice}
                        </span>
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
                      : cameraConnected
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {isScanning
                    ? "SCANNING"
                    : cameraConnected
                      ? "READY"
                      : "DISCONNECTED"}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isScanning ? "bg-accent led-fast" : cameraConnected ? "bg-success led-slow" : "bg-danger"}`}
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
                      : cameraConnected
                        ? "bg-success led-slow"
                        : "bg-danger"
                  }`}
                />
                <span
                  className={`font-mono text-[9px] tracking-widest uppercase font-bold ${
                    isScanning
                      ? "text-accent"
                      : cameraConnected
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {isScanning
                    ? "Scanning..."
                    : cameraConnected
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

            {(!inspection || isScanning) ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase font-bold">
                  {isScanning ? "Awaiting inspection result" : "XAI Analysis"}
                </span>
                <span className="font-mono text-[9px] text-slate-600">
                  {isScanning
                    ? "Inspection in progress."
                    : "Awaiting trained ML model and XAI pipeline."}
                </span>
              </div>
            ) : isNotPcb ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="font-mono text-[10px] tracking-[0.3em] text-danger uppercase font-bold">
                  XAI Analysis
                </span>
                <span className="font-mono text-[9px] text-slate-600">
                  No XAI analysis available — image is not a PCB.
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
                        inspection.status === "PASS"
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {inspection.status === "PASS" ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {inspection.status}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">
                      Defect
                    </span>
                    <span
                      className={`font-display text-[11px] font-extrabold uppercase tracking-wider ${
                        inspection.status === "FAIL"
                          ? "text-danger"
                          : "text-slate-300"
                      }`}
                    >
                      {inspection.status === "FAIL" &&
                      inspection.defectClass &&
                      inspection.defectClass !== "None"
                        ? inspection.defectClass
                        : "None"}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">
                      Confidence
                    </span>
                    <span className="font-display text-[11px] font-extrabold text-accent tracking-wider">
                      {inspection.confidence != null ? `${inspection.confidence}%` : "—"}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">
                      Inspection Time
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-300">
                      <Target className="w-3 h-3 text-accent" />
                      {inspection.inspectionTime != null ? inspection.inspectionTime : "—"}
                    </span>
                  </div>
                </div>

                {/* Model info */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] font-mono text-slate-500">
                  <span>
                    Model:{" "}
                    <strong className="text-slate-400">
                      {inspection.model || inspection.modelName || "—"}
                    </strong>
                  </span>
                </div>

                {/* XAI explanation — only when the backend provided one */}
                <div className="pt-2 border-t border-accent/5">
                  <span className="block font-mono text-[8px] text-slate-500 uppercase tracking-widest mb-1">
                    Model Rationale
                  </span>
                  <p className="font-sans text-[11px] text-slate-300 leading-relaxed text-left">
                    {inspection.xaiExplanation ||
                      "Awaiting trained ML model and XAI pipeline."}
                  </p>
                </div>
              </>
            )}
          </GlassCard>
        </div>
      </main>
    </AppLayout>
  );
}
