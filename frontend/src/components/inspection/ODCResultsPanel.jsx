import {
  AlertTriangle,
  FileText,
} from "lucide-react";

import GlassCard from "../cards/GlassCard";

export default function ODCResultsPanel({
  inspection,
  className = "",
}) {
  if (!inspection) {
    return (
      <GlassCard
        className={`flex flex-col h-full ${className}`}
        hoverLift={false}
      >
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <FileText className="w-3.5 h-3.5 text-accent" />

          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            OCR Results
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
          <FileText className="w-8 h-8 text-slate-600" />

          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">
            Awaiting Inspection
          </span>
        </div>
      </GlassCard>
    );
  }

  const data = inspection?.inspection || inspection;

  const detections = Array.isArray(data?.detections)
    ? data.detections
    : [];

  const components = detections.length;

  const ocrRead = detections.filter(
    (detection) =>
      typeof detection?.ocr_text === "string" &&
      detection.ocr_text.trim().length > 0
  ).length;

  return (
    <GlassCard
      className={`flex flex-col h-full ${className}`}
      hoverLift={false}
    >
      {/* HEADER */}
      <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
        <FileText className="w-3.5 h-3.5 text-accent" />

        <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
          OCR Results
        </span>

        <span
          className={`ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider border ${
            ocrRead > 0
              ? "bg-success/10 text-success border-success/20"
              : "bg-warning/10 text-warning border-warning/20"
          }`}
        >
          {ocrRead > 0 ? "AVAILABLE" : "NO TEXT"}
        </span>
      </div>

      {/* ONLY THE TWO REQUIRED PARAMETERS */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="p-4 rounded-lg border border-accent/10 bg-[#050816]/40">
            <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">
              Components
            </p>

            <p className="font-mono text-2xl font-bold text-white mt-2">
              {components}
            </p>
          </div>

          <div className="p-4 rounded-lg border border-accent/10 bg-[#050816]/40">
            <p className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">
              OCR Read
            </p>

            <p className="font-mono text-2xl font-bold text-success mt-2">
              {ocrRead}
            </p>
          </div>
        </div>
      </div>

      {components === 0 && (
        <div className="flex items-center gap-2 pt-3 border-t border-accent/5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />

          <span className="font-mono text-[8px] text-slate-500">
            No YOLO components were detected.
          </span>
        </div>
      )}
    </GlassCard>
  );
}