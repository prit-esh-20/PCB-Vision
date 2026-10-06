import { useState } from "react";
import { Layers, Eye, EyeOff, Image as ImageIcon, Thermometer, Brain } from "lucide-react";
import GlassCard from "../cards/GlassCard";

export default function HeatmapPanel({ inspection, className = "" }) {
  if (!inspection) {
    return (
      <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">Heatmap Visualization</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <Layers className="w-8 h-8 text-slate-600" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">Awaiting Inspection</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">Complete an inspection to view heatmap visualizations.</span>
        </div>
      </GlassCard>
    );
  }

  const xai = inspection?.xai || {};
  const heatmapUrl = xai?.heatmap_path || xai?.heatmapUrl || xai?.evidence_path || null;
  const overlayUrl = xai?.overlay_path || xai?.overlayUrl || xai?.visualization || null;
  const thermalUrl = inspection?.thermal_image || inspection?.thermalImage || null;
  const originalUrl = inspection?.image_path || inspection?.imagePath || null;
  const detectionImageUrl = inspection?.detection_image || inspection?.detectionImage || null;

  const hasHeatmap = heatmapUrl || overlayUrl;
  const hasThermal = thermalUrl;
  const hasOriginal = originalUrl;
  const hasDetection = detectionImageUrl;

  if (!hasHeatmap && !hasThermal && !hasOriginal && !hasDetection) {
    return (
      <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">Heatmap Visualization</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <Layers className="w-8 h-8 text-slate-600" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">No Heatmap Data</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">No heatmap or thermal visualization available for this inspection.</span>
        </div>
      </GlassCard>
    );
  }

  const [viewMode, setViewMode] = useState("original");
  const [opacity, setOpacity] = useState(0.6);

  const views = [
    { id: "original", label: "Original", icon: ImageIcon, available: hasOriginal, url: originalUrl },
    { id: "detection", label: "Detections", icon: Brain, available: hasDetection, url: detectionImageUrl },
    { id: "heatmap", label: "XAI Heatmap", icon: Brain, available: hasHeatmap, url: heatmapUrl || overlayUrl },
    { id: "thermal", label: "Thermal", icon: Thermometer, available: hasThermal, url: thermalUrl },
  ].filter((v) => v.available);

  const currentView = views.find((v) => v.id === viewMode) || views[0];
  if (currentView && viewMode !== currentView.id) {
    setViewMode(currentView.id);
  }

  return (
    <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/5 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">Heatmap Visualization</span>
        </div>
        <div className="flex items-center gap-1">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              disabled={!v.available}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold uppercase tracking-wider transition-all ${
                viewMode === v.id
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <v.icon className="w-3 h-3" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-64 rounded-lg border border-accent/5 bg-black/90 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(50,213,131,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(50,213,131,0.05) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {currentView.url ? (
          <img
            src={currentView.url}
            alt={`${currentView.label} visualization`}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: viewMode === "heatmap" || viewMode === "thermal" ? opacity : 1 }}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-[9px] text-slate-600">Visualization unavailable</span>
        )}
        {(viewMode === "heatmap" || viewMode === "thermal") && hasOriginal && (
          <div className="absolute inset-0 h-full w-full object-contain opacity-30">
            <img src={originalUrl} alt="Original PCB" className="h-full w-full object-contain" />
          </div>
        )}
      </div>

      {(viewMode === "heatmap" || viewMode === "thermal") && hasOriginal && (
        <div className="flex items-center gap-3 px-1">
          <label className="font-mono text-[9px] text-slate-400">Overlay Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="flex-1 h-2 appearance-none bg-slate-800 rounded-lg accent-accent"
          />
          <span className="font-mono text-[9px] text-white w-10 text-right">{(opacity * 100).toFixed(0)}%</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-1 py-2 text-[8px] font-mono text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span>High Attention / Heat</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-700 border border-slate-500" />
          <span>Low Attention / Cool</span>
        </span>
        <span className="ml-auto text-slate-600">
          Source: {currentView.label}
          {currentView.id === "heatmap" && xai.mode && ` (${xai.mode})`}
          {currentView.id === "thermal" && " (Thermal Sensor)"}
        </span>
      </div>

      {!hasHeatmap && (
        <div className="pt-2 border-t border-accent/5 text-center">
          <p className="font-mono text-[8px] text-slate-500">XAI attribution heatmap not available. Enable Grad-CAM in the inspection pipeline.</p>
        </div>
      )}
      {!hasThermal && (
        <div className="pt-2 border-t border-accent/5 text-center">
          <p className="font-mono text-[8px] text-slate-500">Thermal visualization not available. Thermal sensor not connected or not implemented.</p>
        </div>
      )}
    </GlassCard>
  );
}