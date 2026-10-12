import { CheckCircle, XCircle, AlertTriangle, GitBranch } from "lucide-react";
import GlassCard from "../cards/GlassCard";

export default function XMCCVResultsPanel({ inspection, className = "" }) {
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

  /*
   * The Windows backend may return the RPi inspection either directly
   * or inside inspection.inspection. Support both forms.
   */
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

  /*
   * Supports both:
   *   true / false
   *
   * and:
   *   { pass: true }
   */
  const getPassState = (value) => {
    if (value === null || value === undefined) return "na";

    if (typeof value === "boolean") {
      return value ? "pass" : "fail";
    }

    if (typeof value === "object") {
      if ("pass" in value) return value.pass ? "pass" : "fail";
      if ("status" in value) {
        return value.status === "PASS" ? "pass" : "fail";
      }
    }

    return "na";
  };

  const parameterRows = [
    {
      key: "presence",
      label: "Presence",
    },
    {
      key: "count",
      label: "Count",
    },
    {
      key: "position",
      label: "Position",
    },
    {
      key: "identity",
      label: "Identity",
    },
    {
      key: "orientation",
      label: "Orientation",
    },
    {
      key: "polarity",
      label: "Polarity",
    },
    {
      key: "size_shape",
      label: "Size / Shape",
    },
    {
      key: "spacing",
      label: "Spacing",
    },
  ];

  const formatNumber = (value, digits = 3) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : "N/A";
  };

  const getDisplayValue = (component, key) => {
    const value = component?.[key];
    if (key === "presence") return value === true ? "DETECTED" : value === false ? "NOT DETECTED" : "N/A";
    if (key === "count") return value == null ? "N/A" : String(value);
    if (key === "position") {
      if (!value || typeof value !== "object" || value.x == null || value.y == null) return "N/A";
      return `X: ${formatNumber(value.x)} · Y: ${formatNumber(value.y)}`;
    }
    if (key === "identity") return value ?? component?.class_name ?? "N/A";
    if (key === "orientation" || key === "polarity") return value == null ? "N/A" : String(value);
    if (key === "size_shape") {
      if (!value || typeof value !== "object") return "N/A";
      const width = value.normalized_width ?? value.width;
      const height = value.normalized_height ?? value.height;
      if (width == null || height == null) return "N/A";
      const ratio = value.aspect_ratio;
      const area = value.normalized_area;
      return `W: ${formatNumber(width)} · H: ${formatNumber(height)}${ratio == null ? "" : ` · AR: ${formatNumber(ratio, 2)}`}${area == null ? "" : ` · Area: ${formatNumber(area, 5)}`}`;
    }
    if (key === "spacing") {
      if (value == null) return "N/A";
      if (typeof value === "number") return `${formatNumber(value, 4)} normalized`;
      if (typeof value !== "object") return "N/A";
      const distance = value.normalized_distance ?? value.distance;
      if (distance == null) return "N/A";
      const neighbor = value.nearest_component ? ` to ${value.nearest_component}` : "";
      return `${formatNumber(distance, 4)} normalized${neighbor}`;
    }
    return value == null ? "N/A" : String(value);
  };

  const detectionOnly =
    xmccv.length > 0 &&
    xmccv.every(
      (component) =>
        component?.verification_mode === "detection_only",
    );

  const overallPass = xmccv.length > 0 && xmccv.every(
    (component) => getPassState(component?.component_pass) === "pass",
  );
  const overallFail = xmccv.some(
    (component) => getPassState(component?.component_pass) === "fail",
  );

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
                : overallFail
                  ? "bg-danger/10 text-danger border-danger/20"
                  : "bg-slate-500/10 text-slate-300 border-slate-500/20"
          }`}
        >
          {detectionOnly
            ? "DETECTION ONLY"
            : overallPass
              ? "VERIFIED"
              : overallFail
                ? "FAILED"
                : "UNVERIFIED"}
        </span>
      </div>

      {/* COMPONENT RESULTS */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mt-3 space-y-4 pr-1.5 custom-scrollbar">
        {xmccv.map((component, componentIndex) => {
          const componentDetectionOnly =
            component?.verification_mode === "detection_only";

          const componentPassState =
            component?.component_status?.toLowerCase() === "pass"
              ? "pass"
              : component?.component_status?.toLowerCase() === "fail"
                ? "fail"
                : getPassState(component?.component_pass);

          const componentPass = componentPassState === "pass";

          return (
            <div
              key={componentIndex}
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
                </div>

                <div
                  className={`flex items-center gap-1.5 font-mono text-[9px] font-bold ${
                    componentPassState === "pass"
                      ? "text-success"
                      : componentPassState === "fail"
                        ? "text-danger"
                        : "text-slate-300"
                  }`}
                >
                  {componentPassState === "pass" ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : componentPassState === "fail" ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : null}

                  {componentPassState === "pass"
                    ? "PASS"
                    : componentPassState === "fail"
                      ? "FAIL"
                      : componentDetectionOnly
                        ? "DETECTED"
                        : "UNVERIFIED"}
                </div>
              </div>

              {/* ALL X-MCCV PARAMETERS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parameterRows.map((parameter) => {
                  const value = component?.[parameter.key];
                  const displayValue = getDisplayValue(component, parameter.key);
                  const passState = getPassState(value);
                  const isRawMeasurement = ["position", "identity", "orientation", "polarity", "size_shape", "spacing"].includes(parameter.key);
                  const valueClass = componentDetectionOnly || isRawMeasurement
                    ? "text-slate-200"
                    : passState === "pass" ? "text-success" : passState === "fail" ? "text-danger" : "text-slate-400";
                  return (
                    <div key={parameter.key} className="flex flex-col gap-1 rounded border border-accent/10 bg-black/20 px-3 py-2 min-w-0">
                      <span className="font-mono text-[9px] text-slate-400">{parameter.label}</span>
                      <span className={`font-mono text-[10px] font-bold break-words ${valueClass}`} title={displayValue}>{displayValue}</span>
                    </div>
                  );
                })}
              </div>

              {/* COMPONENT PASS */}
              <div className="mt-3 rounded border border-accent/10 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-slate-400 uppercase">
                    Component PASS
                  </span>

                  <span
                    className={`font-mono text-[9px] font-bold ${
                      componentPassState === "pass" ? "text-success" : componentPassState === "fail" ? "text-danger" : "text-slate-300"
                    }`}
                  >
                    {componentPassState === "pass"
                      ? "PASS"
                      : componentPassState === "fail"
                        ? "FAIL"
                        : componentDetectionOnly
                          ? "DETECTED"
                          : "UNVERIFIED"}
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