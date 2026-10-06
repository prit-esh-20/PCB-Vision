import { CheckCircle, XCircle, AlertTriangle, FileText, Download, ArrowRight, Shield } from "lucide-react";
import GlassCard from "../cards/GlassCard";
import { formatDuration, formatConfidence } from "../../utils/formatters";

export default function InspectionDecisionPanel({ inspection, onGenerateReport, onExport, className = "" }) {
  if (!inspection) {
    return (
      <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <Shield className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">Final Inspection Decision</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <Shield className="w-8 h-8 text-slate-600" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">No Inspection Data</span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">Complete an inspection to view the final decision and evidence.</span>
        </div>
      </GlassCard>
    );
  }

  const status = (inspection?.status || "").toUpperCase();
  const isPass = status === "PASS";
  const isFail = status === "FAIL";
  const isNotPcb = inspection?.isPcb === false || status === "NOT_PCB";
  const decision = inspection?.decision || {};
  const xmccv = inspection?.xmccv || [];
  const xai = inspection?.xai || {};
  const detections = inspection?.detections || [];
  const verificationDetails = inspection?.verificationDetails || {};

  const overallStatus = decision?.overall_status || status;
  const decisionReason = decision?.reason || decision?.rationale || "";
  const correctiveActions = decision?.corrective_actions || decision?.recommendations || [];
  const affectedRegions = decision?.affected_regions || decision?.defect_regions || [];

  return (
    <GlassCard className={`flex flex-col h-full space-y-3 ${className}`} hoverLift={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/5 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">Final Inspection Decision</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-display font-bold uppercase tracking-wider ${
            isPass ? "border-success/30 bg-success/10 text-success" :
            isFail ? "border-danger/30 bg-danger/10 text-danger" :
            "border-warning/30 bg-warning/10 text-warning"
          }`}>
            {isPass ? <CheckCircle className="h-3.5 w-3.5" /> : isFail ? <XCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {overallStatus || status || "PENDING"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border border-accent/10 bg-[#050816]/40">
          <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">
            Inspection ID
          </p>

          <p className="font-mono text-[11px] font-bold text-white mt-0.5">
            {inspection?.inspection_id ||
              inspection?.inspection?.inspection_id ||
              "—"}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-accent/10 bg-[#050816]/40">
          <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">Inspection Time</p>
          <p className="font-mono text-[11px] font-bold text-[#00E5FF] mt-0.5">
            {inspection?.inspectionTime || inspection?.inspection_time || inspection?.cycleTime ? formatDuration(inspection.inspectionTime || inspection.inspection_time || inspection.cycleTime) : "—"}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-accent/10 bg-[#050816]/40">
          <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">YOLO Confidence</p>
          <p className="font-mono text-[11px] font-bold text-accent mt-0.5">{formatConfidence(inspection?.confidence)}</p>
        </div>
      </div>

      {isNotPcb && (
        <div className="p-3 rounded-lg border border-danger/20 bg-danger/5">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider">Not a Valid PCB</span>
          </div>
          <p className="mt-1 font-sans text-[10px] text-slate-400">The uploaded image could not be identified as a valid PCB. Please upload a clear, well-lit PCB image and rerun the inspection.</p>
        </div>
      )}

      {decisionReason && (
        <div className="p-3 rounded-lg border border-accent/10 bg-[#050816]/40">
          <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">Decision Rationale</p>
          <p className="font-sans text-[10px] text-slate-300 mt-1 leading-relaxed">{decisionReason}</p>
        </div>
      )}

      {(affectedRegions.length > 0 || (isFail && detections.length > 0)) && (
        <div className="space-y-1.5">
          <span className="font-sans text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-warning" />
            Affected Regions / Defects
          </span>
          <div className="space-y-1">
            {affectedRegions.length > 0 ? affectedRegions.map((region, idx) => (
              <div key={idx} className="flex justify-between items-center py-1.5 border-b border-accent/5 px-2 bg-[#050816]/30 rounded">
                <span className="text-slate-300 font-mono text-[10px]">{region.name || region.component || `Region ${idx + 1}`}</span>
                <span className="font-mono text-[10px] font-bold text-danger">{region.defect || region.type || "Defect"}</span>
              </div>
            )) : detections.map((det, idx) => (
              <div key={det.id || idx} className="flex justify-between items-center py-1.5 border-b border-accent/5 px-2 bg-[#050816]/30 rounded">
                <span className="text-slate-300 font-mono text-[10px]">{det.className || det.label || det.class_name || `Detection ${idx + 1}`}</span>
                <span className="font-mono text-[10px] font-bold text-warning">{formatConfidence(det.confidence)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(xmccv.length > 0 || Object.keys(verificationDetails).length > 0) && (
        <div className="space-y-1.5">
          <span className="font-sans text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-accent" />
            X-MCCV Verification Summary
          </span>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              { label: "Presence", pass: verificationDetails.presence?.every(p => p.status === "PASS") ?? true },
              { label: "Position", pass: verificationDetails.position?.every(p => p.status === "PASS") ?? true },
              { label: "Orientation", pass: verificationDetails.orientation?.every(p => p.status === "PASS") ?? true },
              { label: "Count", pass: true },
            ].map((check) => (
              <div key={check.label} className="p-2 rounded border border-accent/10 bg-[#050816]/40">
                <p className={`font-mono text-[9px] font-bold ${check.pass ? "text-success" : "text-danger"}`}>
                  {check.pass ? <CheckCircle className="w-3 h-3 inline-block mr-1" /> : <XCircle className="w-3 h-3 inline-block mr-1" />}
                  {check.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {xai?.explanation && (
        <div className="p-3 rounded-lg border border-accent/10 bg-[#050816]/40 border-l-4 border-l-accent">
          <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">XAI Explanation</p>
          <p className="font-sans text-[10px] text-slate-300 mt-1 leading-relaxed">{xai.explanation}</p>
        </div>
      )}

      {correctiveActions.length > 0 && (
        <div className="space-y-1.5">
          <span className="font-sans text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3 text-accent" />
            Corrective Actions
          </span>
          <div className="space-y-1">
            {correctiveActions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded border border-accent/10 bg-[#050816]/40">
                <span className="text-accent mt-0.5">→</span>
                <span className="font-sans text-[10px] text-slate-300">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-accent/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500 font-mono text-[9px]">
          <span>Model:</span>
          <span className="text-white">{inspection?.modelName || inspection?.model_name || "PCBVision YOLO11s"}</span>
          <span>|</span>
          <span>Timestamp: {inspection?.created_at ? new Date(inspection.created_at).toLocaleString() : "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          {onGenerateReport && (
            <button
              onClick={onGenerateReport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-white/[0.03] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/80 transition-all hover:border-accent/40 hover:bg-accent/5 hover:text-white"
            >
              <FileText className="h-3.5 w-3.5" />
              Generate Report
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-white/[0.03] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/80 transition-all hover:border-accent/40 hover:bg-accent/5 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export Data
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}