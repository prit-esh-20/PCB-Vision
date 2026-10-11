import { CheckCircle, XCircle, AlertTriangle, GitBranch } from "lucide-react";
import GlassCard from "../cards/GlassCard";

export default function XMCCVResultsPanel({
  inspection,
  className = "",
}) {
  if (!inspection) {
    return (
      <GlassCard
        className={`flex flex-col h-full ${className}`}
        contentClassName="h-full flex flex-col min-h-0 w-full"
        hoverLift={false}
      >
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2 shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            X-MCCV Verification
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <GitBranch className="w-8 h-8 text-slate-600" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">
            Awaiting Inspection
          </span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">
            Run an inspection to view X-MCCV verification results.
          </span>
        </div>
      </GlassCard>
    );
  }

  // Support both direct and nested inspection responses.
  const data = inspection?.inspection || inspection;
  const xmccv = Array.isArray(data?.xmccv) ? data.xmccv : [];

  if (xmccv.length === 0) {
    return (
      <GlassCard
        className={`flex flex-col h-full ${className}`}
        contentClassName="h-full flex flex-col min-h-0 w-full"
        hoverLift={false}
      >
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2 shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            X-MCCV Verification
          </span>
          <span className="ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
            NO DATA
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center min-h-[160px]">
          <AlertTriangle className="w-8 h-8 text-warning" />
          <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">
            No Verification Data
          </span>
          <span className="font-mono text-[9px] text-slate-600 max-w-xs">
            X-MCCV did not return component verification results.
          </span>
        </div>
      </GlassCard>
    );
  }

  const getPassState = (value) => {
    if (value === null || value === undefined) return "na";

    if (typeof value === "boolean") {
      return value ? "pass" : "fail";
    }

    if (typeof value === "object") {
      if ("pass" in value) return value.pass ? "pass" : "fail";

      if ("status" in value) {
        if (value.status === "PASS") return "pass";
        if (value.status === "FAIL") return "fail";
        return "na";
      }
    }

    return Boolean(value) ? "pass" : "fail";
  };

  const parameterRows = [
    { key: "presence", label: "Presence" },
    { key: "count", label: "Count" },
    { key: "position", label: "Position" },
    { key: "identity", label: "Identity" },
    { key: "orientation", label: "Orientation" },
    { key: "polarity", label: "Polarity" },
    { key: "size_shape", label: "Size / Shape" },
    { key: "spacing", label: "Spacing" },
  ];

  const detectionOnly = xmccv.every(
    (component) =>
      component?.verification_mode === "detection_only",
  );

  const overallPass = xmccv.every(
    (component) => getPassState(component?.component_pass) === "pass",
  );

  // Display measurements, not PASS/FAIL, in detection-only mode.
  const getDetectionValue = (component, key) => {
    switch (key) {
      case "presence":
        return component?.presence === true ? "DETECTED" : "N/A";

      case "count":
        return typeof component?.count === "number"
          ? String(component.count)
          : "N/A";

      case "position": {
        const position = component?.position;

        if (position == null) return "N/A";

        if (typeof position === "object") {
          if (Array.isArray(position)) {
            return position
              .map((value) =>
                typeof value === "number" ? value.toFixed(3) : String(value),
              )
              .join(", ");
          }

          return Object.entries(position)
            .map(([key, value]) => {
              const formatted =
                typeof value === "number" ? value.toFixed(3) : String(value);
              return `${key}: ${formatted}`;
            })
            .join(", ");
        }

        return String(position);
      }

      case "identity":
        return component?.identity != null
          ? String(component.identity)
          : component?.class_name || "N/A";

      default:
        // Do not claim measurements that the backend has not supplied.
        return "N/A";
    }
  };

  return (
    <GlassCard
      className={`flex flex-col h-full max-h-[580px] w-full ${className}`}
      contentClassName="h-full flex flex-col min-h-0 w-full"
      hoverLift={false}
    >
      {/* HEADER */}
      <div className="flex items-center gap-2 border-b border-accent/5 pb-2 shrink-0">
        <GitBranch className="w-3.5 h-3.5 text-accent" />

        <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
          X-MCCV Verification
        </span>

        <span
          className={`ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider border ${
            detectionOnly
              ? "bg-slate-500/10 text-slate-300 border-slate-500/20"
              : overallPass
                ? "bg-success/10 text-success border-success/20"
                : "bg-danger/10 text-danger border-danger/20"
          }`}
        >
          {detectionOnly
            ? "DETECTION ONLY"
            : overallPass
              ? "VERIFIED"
              : "FAILED"}
        </span>
      </div>

      {/* COMPONENT RESULTS */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mt-3 space-y-4 pr-1.5 custom-scrollbar">
        {xmccv.map((component, componentIndex) => {
          const componentDetectionOnly =
            component?.verification_mode === "detection_only";

          const componentPass =
            getPassState(component?.component_pass) === "pass";

          return (
            <div
              key={`${component?.class_name || "component"}-${componentIndex}`}
              className="w-full rounded-lg border border-accent/10 bg-[#050816]/40 p-3"
            >
              {/* COMPONENT NAME */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-mono text-[8px] text-slate-500 uppercase tracking-widest">
                    Component
                  </p>

                  <p className="font-mono text-[11px] font-bold text-white mt-0.5">
                    {component?.class_name || `Component ${componentIndex + 1}`}
                  </p>

                  {typeof component?.confidence === "number" && (
                    <p className="font-mono text-[9px] text-slate-400 mt-1">
                      Confidence: {(component.confidence * 100).toFixed(1)}%
                    </p>
                  )}
                </div>

                <div
                  className={`flex items-center gap-1.5 font-mono text-[9px] font-bold ${
                    componentDetectionOnly
                      ? "text-slate-300"
                      : componentPass
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {componentDetectionOnly ? null : componentPass ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}

                  {componentDetectionOnly
                    ? "DETECTED"
                    : componentPass
                      ? "PASS"
                      : "FAIL"}
                </div>
              </div>

              {/* X-MCCV PARAMETERS / DETECTION MEASUREMENTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parameterRows.map((parameter) => {
                  const value = component?.[parameter.key];
                  const passState = getPassState(value);

                  const displayValue = componentDetectionOnly
                    ? getDetectionValue(component, parameter.key)
                    : passState === "pass"
                      ? "PASS"
                      : passState === "fail"
                        ? "FAIL"
                        : "N/A";

                  const valueColor = componentDetectionOnly
                    ? displayValue === "N/A"
                      ? "text-slate-500"
                      : "text-slate-200"
                    : passState === "pass"
                      ? "text-success"
                      : passState === "fail"
                        ? "text-danger"
                        : "text-slate-500";

                  return (
                    <div
                      key={parameter.key}
                      className="flex items-center justify-between gap-2 rounded border border-accent/10 bg-black/20 px-3 py-2"
                    >
                      <span className="font-mono text-[9px] text-slate-400">
                        {parameter.label}
                      </span>

                      <span
                        className={`text-right break-words font-mono text-[9px] font-bold ${valueColor}`}
                      >
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* COMPONENT VERIFICATION STATUS */}
              <div className="mt-3 rounded border border-accent/10 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] text-slate-400 uppercase">
                    {componentDetectionOnly ? "Verification" : "Component PASS"}
                  </span>

                  <span
                    className={`font-mono text-[9px] font-bold ${
                      componentDetectionOnly
                        ? "text-slate-300"
                        : componentPass
                          ? "text-success"
                          : "text-danger"
                    }`}
                  >
                    {componentDetectionOnly
                      ? "UNVERIFIED"
                      : componentPass
                        ? "PASS"
                        : "FAIL"}
                  </span>
                </div>
              </div>

              {/* REASON */}
              {component?.reason && (
                <div className="mt-2 rounded border border-accent/10 bg-black/20 px-3 py-2 w-full">
                  <p className="font-mono text-[8px] text-slate-500 uppercase tracking-widest">
                    Reason
                  </p>

                  <p className="font-mono text-[9px] text-slate-300 mt-1 leading-relaxed break-words">
                    {component.reason}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}