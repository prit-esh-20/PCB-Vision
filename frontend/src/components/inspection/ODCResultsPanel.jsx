import { AlertTriangle, CheckCircle, FileText, Search } from "lucide-react";
import GlassCard from "../cards/GlassCard";

export default function ODCResultsPanel({ inspection, className = "" }) {
  if (!inspection) {
    return (
      <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <FileText className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">ODC Results</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <FileText className="w-8 h-8 text-slate-600" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">Awaiting Inspection</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">Complete an inspection to view ODC classification results.</span>
        </div>
      </GlassCard>
    );
  }

  const odc = inspection?.odc || inspection?.odcResults || inspection?.odc_results || null;

  if (!odc) {
    return (
      <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <FileText className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">ODC Results</span>
          <span className="ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider bg-slate-700 text-slate-400 border border-slate-600">UNAVAILABLE</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <AlertTriangle className="w-8 h-8 text-warning" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">ODC Not Implemented</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-[80%] text-center">
            ODC (Optical Defect Classification) results are not available in the current inspection pipeline.
            This panel will populate when the backend returns ODC classification data.
          </span>
        </div>
      </GlassCard>
    );
  }

  const classification = odc?.classification || odc?.defect_type || "Unknown";
  const confidence = odc?.confidence || odc?.score || 0;
  const observations = odc?.observations || odc?.details || [];
  const validationStatus = odc?.validation_status || odc?.status || "pending";
  const evidence = odc?.evidence || odc?.supporting_images || [];

  return (
    <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
      <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
        <FileText className="w-3.5 h-3.5 text-accent" />
        <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">ODC Results</span>
        <span className={`ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider ${
          validationStatus === "validated" ? "bg-success/15 text-success border border-success/30" :
          validationStatus === "failed" ? "bg-danger/15 text-danger border border-danger/30" :
          "bg-warning/15 text-warning border border-warning/30"
        }`}>
          {validationStatus.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-accent/10 bg-[#050816]/40">
            <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">Classification</p>
            <p className="font-mono text-[11px] font-bold text-white mt-0.5">{classification}</p>
          </div>
          <div className="p-3 rounded-lg border border-accent/10 bg-[#050816]/40">
            <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">Confidence</p>
            <p className="font-mono text-[11px] font-bold text-accent mt-0.5">{typeof confidence === "number" && confidence <= 1 ? (confidence * 100).toFixed(1) : confidence}%</p>
          </div>
        </div>

        {observations.length > 0 && (
          <div className="space-y-1.5">
            <span className="font-sans text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Search className="w-3 h-3 text-accent" />
              Observations
            </span>
            <div className="space-y-1">
              {observations.map((obs, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-accent/5 px-2">
                  <span className="text-slate-300 font-mono text-[10px]">{obs.label || obs.name || `Observation ${idx + 1}`}</span>
                  <span className={`font-mono text-[10px] font-bold ${obs.status === "PASS" || obs.pass ? "text-success" : obs.status === "FAIL" || obs.fail ? "text-danger" : "text-warning"}`}>
                    {obs.status || (obs.pass ? "PASS" : obs.fail ? "FAIL" : "PENDING")}
                    {obs.confidence && ` (${typeof obs.confidence === "number" && obs.confidence <= 1 ? (obs.confidence * 100).toFixed(1) : obs.confidence}%)`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {evidence.length > 0 && (
          <div className="space-y-1.5">
            <span className="font-sans text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-accent" />
              Supporting Evidence
            </span>
            <div className="grid grid-cols-2 gap-2">
              {evidence.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded border border-accent/10 bg-black/50 overflow-hidden">
                  {img.url && <img src={img.url} alt={`ODC Evidence ${idx + 1}`} className="h-full w-full object-cover opacity-70" />}
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/70 text-[7px] font-mono text-slate-400 text-center">
                    {img.label || `Evidence ${idx + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-accent/5">
          <p className="font-mono text-[8px] text-slate-500">ODC data sourced from inspection pipeline. Fields may vary by implementation.</p>
        </div>
      </div>
    </GlassCard>
  );
}