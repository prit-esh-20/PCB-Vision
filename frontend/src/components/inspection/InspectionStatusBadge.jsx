import { CheckCircle, XCircle, Loader2, AlertTriangle, Clock } from "lucide-react";

const STATUS_CONFIG = {
  PASS: { icon: CheckCircle, color: "text-success bg-success/15 border-success/30", label: "PASS", bg: "bg-success/10" },
  FAIL: { icon: XCircle, color: "text-danger bg-danger/15 border-danger/30", label: "FAIL", bg: "bg-danger/10" },
  INSPECTING: { icon: Loader2, color: "text-warning bg-warning/15 border-warning/30", label: "INSPECTING", bg: "bg-warning/10", animate: true },
  STARTING: { icon: Loader2, color: "text-warning bg-warning/15 border-warning/30", label: "STARTING", bg: "bg-warning/10", animate: true },
  READY: { icon: Clock, color: "text-slate-400 bg-slate-700/15 border-slate-600/30", label: "READY", bg: "bg-slate-700/10" },
  PENDING: { icon: Clock, color: "text-warning bg-warning/15 border-warning/30", label: "PENDING", bg: "bg-warning/10" },
  NOT_PCB: { icon: AlertTriangle, color: "text-warning bg-warning/15 border-warning/30", label: "NOT PCB", bg: "bg-warning/10" },
  ERROR: { icon: AlertTriangle, color: "text-danger bg-danger/15 border-danger/30", label: "ERROR", bg: "bg-danger/10" },
  UNKNOWN: { icon: AlertTriangle, color: "text-slate-500 bg-slate-700/15 border-slate-600/30", label: "UNKNOWN", bg: "bg-slate-700/10" },
};

export default function InspectionStatusBadge({
  status,
  size = "md",
  showIcon = true,
  showLabel = true,
  className = "",
}) {
  const normalizedStatus = (status || "UNKNOWN").toUpperCase();
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.UNKNOWN;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[8px] gap-1",
    md: "px-3 py-1 text-[9px] gap-1.5",
    lg: "px-4 py-1.5 text-[10px] gap-2",
  };

  return (
    <span className={`inline-flex items-center font-mono font-bold uppercase tracking-wider rounded-lg border ${sizeClasses[size]} ${config.color} ${className}`}>
      {showIcon && <Icon className={`h-3 w-3 ${config.animate ? "animate-spin" : ""}`} />}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function InspectionStatusDot({ status, size = "md", className = "" }) {
  const normalizedStatus = (status || "UNKNOWN").toUpperCase();
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.UNKNOWN;

  const sizeClasses = {
    sm: "h-1.5 w-1.5",
    md: "h-2.5 w-2.5",
    lg: "h-3.5 w-3.5",
  };

  return (
    <span className={`inline-block rounded-full ${config.bg} ${sizeClasses[size]} ${className}`} />
  );
}