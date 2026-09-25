import { useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import GlassCard from "../../components/cards/GlassCard";
import Button from "../../components/common/Button";
import { useCameraStatus } from "../../hooks/useCameraStatus";
import {
  Camera,
  Activity,
  RefreshCw,
  Eye,
} from "lucide-react";

export default function LiveInspectionPage() {
  const { cameraStatus } = useCameraStatus();

  const cameraConnected = cameraStatus.connected;
  const cameraDisconnected = cameraStatus.status === "DISCONNECTED" || !cameraConnected;

  const [notice, setNotice] = useState(null);

  const handleStartInspection = () => {
    if (!cameraConnected) return;
    setNotice("Hardware capture workflow reserved for Arducam integration.");
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
                cameraConnected
                  ? "border-success/20 bg-success/5 text-success"
                  : "border-danger/20 bg-danger/5 text-danger"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Camera Status:{" "}
              {cameraConnected ? "Connected" : "Disconnected"}
            </div>

            <Button
              variant="secondary"
              className="flex items-center gap-1.5 py-1 px-2.5"
              onClick={handleStartInspection}
              disabled={!cameraConnected}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              START INSPECTION
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

              {cameraDisconnected ? (
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
                  {/* Image container — centered PCB frame */}
                  <div className="relative z-0 flex h-full w-full items-center justify-center">
                    <div
                      className="relative w-full max-h-full overflow-hidden"
                      style={{ aspectRatio: "600 / 400" }}
                    >
                      {schematicFrame}
                    </div>
                  </div>

                  {/* Empty state — camera ready, waiting for hardware capture workflow */}
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
                      disabled={!cameraConnected}
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
                </>
              )}

              {/* Bottom Diagnostics Tag */}
              <div className="absolute bottom-3 left-3 z-[20] flex items-center gap-2 bg-[#050816]/90 border border-accent/15 px-3 py-1.5 rounded font-mono text-[9px] shadow-lg">
                <span className="text-[#9ca3af]">CAMERA STATUS:</span>
                <span
                  className={`font-bold ${
                    cameraConnected
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {cameraConnected
                    ? "READY"
                    : "DISCONNECTED"}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${cameraConnected ? "bg-success led-slow" : "bg-danger"}`}
                />
              </div>
            </div>

            {/* Compact inspection status strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-3 py-2 rounded-md border border-accent/10 bg-[#050816]/50">
              {/* Camera status */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    cameraConnected
                      ? "bg-success led-slow"
                      : "bg-danger"
                  }`}
                />
                <span
                  className={`font-mono text-[9px] tracking-widest uppercase font-bold ${
                    cameraConnected
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {cameraConnected
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
                  —
                </span>
              </div>

              <span className="hidden md:inline font-mono text-accent/25">
                |
              </span>

              {/* PASS/FAIL verdict */}
              <span className="font-mono text-[9px] text-slate-600 uppercase tracking-widest">
                No result
              </span>
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

            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase font-bold">
                XAI Analysis
              </span>
              <span className="font-mono text-[9px] text-slate-600">
                Awaiting trained ML model and XAI pipeline.
              </span>
            </div>
          </GlassCard>
        </div>
      </main>
    </AppLayout>
  );
}

