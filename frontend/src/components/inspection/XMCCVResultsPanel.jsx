import { CheckCircle, XCircle, AlertTriangle, GitBranch } from "lucide-react";
import GlassCard from "../cards/GlassCard";

export default function XMCCVResultsPanel({ inspection, className = "" }) {
  if (!inspection) {
    return (
      <GlassCard
        className={`flex flex-col h-full ${className}`}
        hoverLift={false}
      >
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <GitBranch className="w-3.5 h-3.5 text-accent" />

          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            X-MCCV Verification
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
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
        hoverLift={false}
      >
        <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
          <GitBranch className="w-3.5 h-3.5 text-accent" />

          <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
            X-MCCV Verification
          </span>

          <span className="ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
            NO DATA
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
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

    return Boolean(value) ? "pass" : "fail";
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

  const overallPass = xmccv.every(
    (component) => getPassState(component?.component_pass) === "pass",
  );

  return (
    <GlassCard
      className={`flex flex-col h-full ${className}`}
      hoverLift={false}
    >
      {/* HEADER */}
      <div className="flex items-center gap-2 border-b border-accent/5 pb-2">
        <GitBranch className="w-3.5 h-3.5 text-accent" />

        <span className="font-display text-[10px] tracking-widest text-white uppercase font-bold">
          X-MCCV Verification
        </span>

        <span
          className={`ml-auto px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider border ${
            overallPass
              ? "bg-success/10 text-success border-success/20"
              : "bg-danger/10 text-danger border-danger/20"
          }`}
        >
          {overallPass ? "VERIFIED" : "FAILED"}
        </span>
      </div>

      {/* COMPONENT RESULTS */}
      <div className="flex-1 overflow-auto mt-3 space-y-4">
        {xmccv.map((component, componentIndex) => {
          const componentPass =
            getPassState(component?.component_pass) === "pass";

          return (
            <div
              key={componentIndex}
              className="rounded-lg border border-accent/10 bg-[#050816]/40 p-3"
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
                    componentPass ? "text-success" : "text-danger"
                  }`}
                >
                  {componentPass ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}

                  {componentPass ? "PASS" : "FAIL"}
                </div>
              </div>

              {/* ALL X-MCCV PARAMETERS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parameterRows.map((parameter) => {
                  const passState = getPassState(component?.[parameter.key]);

                  return (
                    <div
                      key={parameter.key}
                      className="flex items-center justify-between rounded border border-accent/10 bg-black/20 px-3 py-2"
                    >
                      <span className="font-mono text-[9px] text-slate-400">
                        {parameter.label}
                      </span>

                      <span
                        className={`flex items-center gap-1 font-mono text-[9px] font-bold ${
                          passState === "pass"
                            ? "text-success"
                            : passState === "fail"
                              ? "text-danger"
                              : "text-slate-500"
                        }`}
                      >
                        {passState === "pass" ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : passState === "fail" ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}

                        {passState === "pass"
                          ? "PASS"
                          : passState === "fail"
                            ? "FAIL"
                            : "N/A"}
                      </span>
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
                      componentPass ? "text-success" : "text-danger"
                    }`}
                  >
                    {componentPass ? "PASS" : "FAIL"}
                  </span>
                </div>
              </div>

              {/* REASON */}
              {component?.reason && (
                <div className="mt-2 rounded border border-accent/10 bg-black/20 px-3 py-2">
                  <p className="font-mono text-[8px] text-slate-500 uppercase tracking-widest">
                    Reason
                  </p>

                  <p className="font-mono text-[9px] text-slate-300 mt-1 leading-relaxed">
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
