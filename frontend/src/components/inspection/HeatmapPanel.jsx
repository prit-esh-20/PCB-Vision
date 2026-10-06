import { useState } from "react";
import {
  Layers,
  Image as ImageIcon,
  Thermometer,
  Brain,
  Scan,
} from "lucide-react";
import GlassCard from "../cards/GlassCard";


export default function HeatmapPanel({
  inspection,
  className = "",
}) {
  const [viewMode, setViewMode] = useState("heatmap");

  if (!inspection) {
    return (
      <GlassCard
        className={`flex flex-col h-full space-y-3 ${className}`}
        hoverLift={false}
      >
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <Layers className="w-3.5 h-3.5 text-accent" />

          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            XAI Visualization
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <Layers className="w-8 h-8 text-slate-600" />

          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">
            Awaiting Inspection
          </span>

          <span className="font-mono text-[9px] text-slate-600 max-w-xs">
            Complete an inspection to view XAI visualizations.
          </span>
        </div>
      </GlassCard>
    );
  }

  const xai = inspection?.xai || {};

  const inputUrl =
    inspection?.input_image ||
    inspection?.inputImage ||
    inspection?.images?.input ||
    null;

  const detectionUrl =
    inspection?.detection_image ||
    inspection?.detectionImage ||
    inspection?.images?.detection ||
    null;

  const heatmapUrl =
    xai?.heatmap_path ||
    xai?.heatmapUrl ||
    inspection?.images?.heatmap ||
    null;

  const overlayUrl =
    xai?.overlay_path ||
    xai?.overlayUrl ||
    inspection?.images?.overlay ||
    null;

  const thermalUrl =
    inspection?.thermal_image ||
    inspection?.thermalImage ||
    null;

  /*
   * XAI heatmap is deliberately first/default.
   *
   * No raw input image is layered underneath it.
   */
  const views = [
    {
      id: "heatmap",
      label: "XAI HEATMAP",
      icon: Brain,
      url: heatmapUrl,
    },
    {
      id: "overlay",
      label: "XAI OVERLAY",
      icon: Brain,
      url: overlayUrl,
    },
    {
      id: "detection",
      label: "DETECTIONS",
      icon: Scan,
      url: detectionUrl,
    },
    {
      id: "original",
      label: "INPUT",
      icon: ImageIcon,
      url: inputUrl,
    },
    {
      id: "thermal",
      label: "THERMAL",
      icon: Thermometer,
      url: thermalUrl,
    },
  ].filter((view) => Boolean(view.url));

  const currentView =
    views.find((view) => view.id === viewMode) ||
    views[0];

  if (!currentView) {
    return (
      <GlassCard
        className={`flex flex-col h-full space-y-3 ${className}`}
        hoverLift={false}
      >
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <Layers className="w-3.5 h-3.5 text-accent" />

          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            XAI Visualization
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <Layers className="w-8 h-8 text-slate-600" />

          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">
            No Visualization Data
          </span>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      className={`flex flex-col h-full space-y-3 ${className}`}
      hoverLift={false}
    >
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/5 pb-2">

        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-accent" />

          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            XAI Visualization
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">

          {views.map((view) => {
            const Icon = view.icon;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() =>
                  setViewMode(view.id)
                }
                className={`flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold uppercase tracking-wider transition-all ${
                  viewMode === view.id
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="w-3 h-3" />

                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* IMAGE */}
      <div className="relative h-80 bg-black/90 overflow-hidden flex items-center justify-center">

        <img
          src={currentView.url}
          alt={currentView.label}
          className="block max-h-full max-w-full w-full h-full object-contain"
        />

      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-3 px-1 py-2 text-[8px] font-mono text-slate-500">

        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent" />
          High Attention / Heat
        </span>

        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-700 border border-slate-500" />
          Low Attention / Cool
        </span>

        <span className="ml-auto text-slate-600">
          Source: {currentView.label}
        </span>
      </div>

      {/* XAI METADATA */}
      {viewMode === "heatmap" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[8px] font-mono">

          <div className="rounded border border-accent/10 bg-[#050816]/40 p-2">
            <span className="text-slate-500 uppercase">
              Status
            </span>

            <p className="text-success font-bold mt-1">
              {xai?.status || "SUCCESS"}
            </p>
          </div>

          <div className="rounded border border-accent/10 bg-[#050816]/40 p-2">
            <span className="text-slate-500 uppercase">
              Mode
            </span>

            <p className="text-white font-bold mt-1">
              {xai?.mode || "model_derived"}
            </p>
          </div>

          <div className="rounded border border-accent/10 bg-[#050816]/40 p-2">
            <span className="text-slate-500 uppercase">
              Target Class
            </span>

            <p className="text-white font-bold mt-1">
              {xai?.class_name ??
                xai?.className ??
                (xai?.class_id != null ? "Class " + xai.class_id : "—")}
            </p>
          </div>

          <div className="rounded border border-accent/10 bg-[#050816]/40 p-2">
            <span className="text-slate-500 uppercase">
              Processing
            </span>

            <p className="text-accent font-bold mt-1">
              {xai?.processing_time != null
                ? `${Number(
                    xai.processing_time
                  ).toFixed(2)}s`
                : "—"}
            </p>
          </div>

          <div className="rounded border border-accent/10 bg-[#050816]/40 p-2">
            <span className="text-slate-500 uppercase">
              Heatmap
            </span>

            <p className="text-success font-bold mt-1">
              {heatmapUrl
                ? "AVAILABLE"
                : "—"}
            </p>
          </div>

          <div className="rounded border border-accent/10 bg-[#050816]/40 p-2">
            <span className="text-slate-500 uppercase">
              Overlay
            </span>

            <p className="text-success font-bold mt-1">
              {overlayUrl
                ? "AVAILABLE"
                : "—"}
            </p>
          </div>
        </div>
      )}

      {viewMode === "thermal" && (
        <div className="pt-2 border-t border-accent/5 text-center">
          <p className="font-mono text-[8px] text-slate-500">
            Thermal visualization source.
          </p>
        </div>
      )}
    </GlassCard>
  );
}