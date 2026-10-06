import { AlertTriangle, CheckCircle, MapPin, Lightbulb, Image as ImageIcon, Sparkles } from "lucide-react";
import GlassCard from "../cards/GlassCard";

export default function XAIExplanationPanel({
  inspection,
  xai,
  isPass,
  isNotPcb,
  isMlPending,
  isInspected,
  xaiVisualUrl,
  className = "",
}) {
  if (!inspection) {
    return (
      <GlassCard className={`flex flex-col h-full !p-5 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2.5">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
            XAI Inspection Analysis
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[220px]">
          <Sparkles className="h-8 w-8 text-slate-600" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">Awaiting Inspection</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs px-4">Complete an inspection to generate XAI results.</span>
        </div>
      </GlassCard>
    );
  }

  const xaiData = xai || inspection?.xai || {};
  const explanation = xaiData.explanation || xaiData.class_name || inspection?.xai_explanation || "";
  const defect = xaiData.defect || inspection?.defect_class || "";
  const location = xaiData.location || "";
  const recommendation = xaiData.recommendation || "";
  const missingComponents = xaiData.missing_components || [];
  const overlayUrl = xaiVisualUrl || xaiData.overlay_path || xaiData.heatmap_path || xaiData.visualization || null;
  const mode = xaiData.mode || "unknown";
  const xaiStatus = xaiData.status || "pending";

  const whatWrong = isNotPcb
    ? "The uploaded image could not be identified as a valid PCB."
    : isInspected && !isPass
    ? defect || "Defect detected. XAI analysis is pending."
    : isInspected && isPass
    ? "No significant visual defect detected. Board passed inspection."
    : isMlPending
    ? "ML inspection model has not been integrated yet."
    : explanation || "XAI analysis not available.";

  const whyPass = isMlPending
    ? "The ML inspection model has not been integrated yet. This PASS result is a temporary backend state."
    : isPass
    ? explanation || "The inspected component regions and PCB layout appear consistent with the expected visual pattern."
    : "";

  const where = location
    ? location
    : isInspected && !isPass
    ? "Affected region identified by detection bounding boxes."
    : isMlPending
    ? "Defect location will be available after ML inspection is integrated."
    : "The backend has not provided the affected region yet.";

  const fix = isInspected && !isPass
    ? recommendation || "Inspect the highlighted region and rerun the inspection. Refer to X-MCCV verification for component-level details."
    : isMlPending
    ? "No corrective action is available yet. ML-based defect detection will provide the actual recommendation."
    : isPass
    ? "No corrective action required. Board can proceed to the next stage."
    : "Corrective action details are not available from the backend yet.";

  return (
    <GlassCard className={`flex flex-col h-full !p-5 ${className}`} hoverLift={false}>
      <div className="flex items-center gap-2 border-b border-accent/5 pb-2.5">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
          XAI Inspection Analysis
        </span>
        <span className={`ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider ${mode === "gradcam" ? "bg-success/15 text-success border border-success/30" : "bg-warning/15 text-warning border border-warning/30"}`}>
          {mode.toUpperCase()}
        </span>
      </div>

      <div className="space-y-4">
        {isNotPcb ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-danger" />
              <label className="font-mono text-[9px] text-danger uppercase tracking-widest block font-bold">What's Wrong?</label>
            </div>
            <p className="font-sans text-[11px] text-slate-300 leading-relaxed">{whatWrong}</p>
            <p className="font-sans text-[10px] text-slate-500 leading-relaxed">Try uploading a clear, well-lit image of the PCB and rerun the inspection.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={`h-3.5 w-3.5 ${isPass ? "text-success" : "text-danger"}`} />
                <label className="font-mono text-[9px] text-accent uppercase tracking-widest block font-bold">
                  {isPass ? "Why Did It Pass?" : "What's Wrong?"}
                </label>
                {!isPass && <span className="h-1.5 w-1.5 rounded-full bg-danger led-slow" />}
              </div>
              <p className="font-sans text-[11px] text-slate-300 leading-relaxed">{whatWrong}</p>
            </div>

            {isPass && whyPass && (
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] text-success uppercase tracking-widest block font-bold">Pass Rationale</label>
                <p className="font-sans text-[11px] text-slate-300 leading-relaxed">{whyPass}</p>
              </div>
            )}

            {!isPass && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-warning" />
                  <label className="font-mono text-[9px] text-warning uppercase tracking-widest block font-bold">Where Is It?</label>
                </div>
                <p className="font-sans text-[11px] text-slate-300 leading-relaxed">{where}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-mono text-[9px] text-slate-400 uppercase tracking-widest block font-bold">Visual Explanation</label>
              <div className="relative h-32 rounded-lg border border-accent/5 bg-black/90 overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(50,213,131,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(50,213,131,0.05) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                {overlayUrl ? (
                  <img src={overlayUrl} alt="XAI visualization" className="absolute inset-0 h-full w-full object-contain opacity-60" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-[9px] text-slate-600">
                    {xaiStatus === "completed" ? "No visualization available" : "Awaiting XAI pipeline integration"}
                  </span>
                )}
              </div>
              <p className="font-sans text-[10px] text-slate-500 leading-relaxed">Highlighted region shows where the model focused during inspection.</p>
            </div>

            {missingComponents.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  <label className="font-mono text-[9px] text-warning uppercase tracking-widest block font-bold">Missing Components</label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {missingComponents.map((comp, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-warning/15 border border-warning/30 text-warning font-mono text-[8px]">{comp}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-accent" />
                <label className="font-mono text-[9px] text-accent uppercase tracking-widest block font-bold">How To Fix It?</label>
              </div>
              <p className="font-sans text-[11px] text-slate-300 leading-relaxed">{fix}</p>
            </div>

            <div className="pt-2 border-t border-accent/5">
              <p className="font-mono text-[8px] text-slate-500">XAI Status: <span className={`font-bold ${xaiStatus === "completed" ? "text-success" : "text-warning"}`}>{xaiStatus}</span></p>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}