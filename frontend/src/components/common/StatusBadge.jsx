export default function StatusBadge({ status, className = "" }) {
  const normalized = status ? status.toUpperCase() : "UNKNOWN";

  const config = {
    PASS: {
      bg: "bg-success/10 border-success/30 text-success shadow-[0_0_10px_rgba(0,255,156,0.05)]",
      dot: "bg-success led-slow",
      label: "PASS"
    },
    FAIL: {
      bg: "bg-danger/10 border-danger/30 text-danger shadow-[0_0_10px_rgba(255,77,109,0.05)]",
      dot: "bg-danger led-fast",
      label: "FAIL"
    },
    INSPECTED: {
      bg: "bg-accent/10 border-accent/30 text-accent shadow-[0_0_10px_rgba(50,213,131,0.05)]",
      dot: "bg-accent led-slow",
      label: "INSPECTED"
    },
    WARNING: {
      bg: "bg-warning/10 border-warning/30 text-warning shadow-[0_0_10px_rgba(255,200,87,0.05)]",
      dot: "bg-warning led-slow",
      label: "WARNING"
    },
    UNKNOWN: {
      bg: "bg-slate-800 border-slate-700 text-slate-400",
      dot: "bg-slate-500",
      label: "UNKNOWN"
    }
  };

  const current = config[normalized] || config.UNKNOWN;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold tracking-widest uppercase select-none ${current.bg} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}
