import { CheckCircle, XCircle, AlertTriangle, GitBranch } from "lucide-react";
import GlassCard from "../cards/GlassCard";

export default function XMCCVResultsPanel({ inspection, className = "" }) {
  if (!inspection) {
    return (
      <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <GitBranch className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">MCCV / X-MCCV Verification</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <GitBranch className="w-8 h-8 text-slate-600" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">Awaiting Inspection</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">Run an inspection to view MCCV/X-MCCV verification results.</span>
        </div>
      </GlassCard>
    );
  }

  const xmccv = inspection?.xmccv || [];
  const componentDetails = inspection?.componentDetails || [];
  const verificationDetails = inspection?.verificationDetails || inspection?.decision || {};
  const presence = verificationDetails?.presence || [];
  const position = verificationDetails?.position || [];
  const orientation = verificationDetails?.orientation || [];
  const count = verificationDetails?.count || {};

  const hasXMCCV = xmccv.length > 0 || presence.length > 0 || position.length > 0 || orientation.length > 0 || Object.keys(count).length > 0;

  if (!hasXMCCV) {
    return (
      <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <GitBranch className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">MCCV / X-MCCV Verification</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <AlertTriangle className="w-8 h-8 text-warning" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">No Verification Data</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">X-MCCV verification results not available in this inspection.</span>
        </div>
      </GlassCard>
    );
  }

  const renderChecklist = (title, icon, items, getStatus, getLabel, getDetail) => {
    if (!items.length) return null;
    return (
      <div className="space-y-1.5">
        <span className="font-sans text-[9.5px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
          <icon className="w-3.5 h-3.5 text-accent" />
          {title}
        </span>
        <div className="space-y-1">
          {items.map((item, idx) => {
            const status = getStatus(item);
            const isPass = status === "PASS";
            return (
              <div key={idx} className="flex justify-between items-center py-1.5 border-b border-accent/5">
                <span className="text-slate-300 font-mono text-[10px]">{getLabel(item)}</span>
                <span className={`font-mono text-[10px] font-bold ${isPass ? "text-success" : "text-danger"}`} flex items-center gap-1>
                  {isPass ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {status} {getDetail(item) && `(${getDetail(item)})`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
      <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
        <GitBranch className="w-3.5 h-3.5 text-accent" />
        <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">MCCV / X-MCCV Verification</span>
        <span className="ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/30">
          {inspection?.status === "PASS" ? "VERIFIED" : "MISMATCH"}
        </span>
      </div>

      <div className="space-y-4 font-mono text-[10.5px]">
        {renderChecklist(
          "1. Presence Verification",
          CheckCircle,
          presence.length > 0 ? presence : componentDetails.filter(c => c.presence !== undefined).map(c => ({ component: c.name, status: c.presence ? "PASS" : "FAIL", confidence: c.confidence })),
          (item) => item.status,
          (item) => item.component,
          (item) => item.confidence ? `${item.confidence.toFixed(1)}%` : null
        )}

        {renderChecklist(
          "2. Position Alignment",
          AlertTriangle,
          position,
          (item) => item.status,
          (item) => `Offset ${item.component}`,
          (item) => item.offset ? `${item.offset} (limit: ${item.limit})` : null
        )}

        {renderChecklist(
          "3. Angular Drift",
          GitBranch,
          orientation,
          (item) => item.status,
          (item) => `Drift ${item.component}`,
          (item) => item.rotation ? `${item.rotation} (limit: ${item.limit})` : null
        )}

        {Object.keys(count).length > 0 && (
          <div className="space-y-1.5">
            <span className="font-sans text-[9.5px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-accent" />
              4. Component Count
            </span>
            <div className="space-y-1">
              {Object.entries(count).map(([type, data]) => (
                <div key={type} className="flex justify-between items-center py-1.5 border-b border-accent/5">
                  <span className="text-slate-300 font-mono text-[10px] capitalize">{type}</span>
                  <span className={`font-mono text-[10px] font-bold ${data.status === "PASS" ? "text-success" : "text-danger"}`}>
                    {data.status === "PASS" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {data.status} (Detected: {data.detected}, Expected: {data.expected})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {componentDetails.length > 0 && (
        <div className="mt-4 pt-4 border-t border-accent/5">
          <span className="font-sans text-[9.5px] uppercase tracking-wider text-slate-400 font-bold">Component Details</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {componentDetails.map((comp, idx) => (
              <div key={idx} className="p-2 rounded bg-[#050816]/40 border border-accent/5">
                <p className="font-mono text-[9px] text-white font-bold">{comp.name}</p>
                <p className="font-mono text-[8px] text-slate-400 mt-0.5">{comp.reason || "No details"}</p>
                <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[8px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${comp.presence ? "bg-success" : "bg-danger"}`} title="Presence" />
                  <span className={`h-1.5 w-1.5 rounded-full ${comp.position ? "bg-success" : "bg-danger"}`} title="Position" />
                  <span className={`h-1.5 w-1.5 rounded-full ${comp.orientation ? "bg-success" : "bg-danger"}`} title="Orientation" />
                  <span className={`h-1.5 w-1.5 rounded-full ${comp.count ? "bg-success" : "bg-danger"}`} title="Count" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}