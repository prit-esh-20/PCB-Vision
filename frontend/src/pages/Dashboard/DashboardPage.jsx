import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "../../components/layout/AppLayout";
import GlassCard from "../../components/cards/GlassCard";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useDashboard } from "../../hooks/useDashboard";
import { useCameraStatus } from "../../hooks/useCameraStatus";
import { useAnalytics } from "../../hooks/useAnalytics";
import { TREND_7_DAYS } from "../../services/mock/mockData";
import NotificationHost from "../../components/common/NotificationHost";
import Modal from "../../components/common/Modal";
import { uploadApi } from "../../services/api/uploadApi";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  Camera,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Bell,
  Search,
  ChevronDown,
  Settings,
  LogOut,
  User,
  X,
  Plus,
  Wifi,
  Server,
  WifiOff,
  FileCheck,
  BarChart3,
  TrendingUp,
  PieChart as LucidePie,
  Gauge,
  ShieldCheck,
  AlertOctagon,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

const defaultSparklineData = TREND_7_DAYS.map((d) => ({ value: d.passRate }));

const CAMERA_BADGE = {
  CONNECTED: {
    dot: "bg-success led-fast",
    label: "Camera Ready",
    cls: "text-success border-accent/30 bg-accent/10",
  },
  READY: {
    dot: "bg-success led-fast",
    label: "Camera Ready",
    cls: "text-success border-accent/30 bg-accent/10",
  },
  INITIALIZING: {
    dot: "bg-warning led-slow",
    label: "Camera Initializing",
    cls: "text-warning border-warning/30 bg-warning/10",
  },
  ERROR: {
    dot: "bg-danger led-fast",
    label: "Camera Error",
    cls: "text-danger border-danger/30 bg-danger/10",
  },
  DISCONNECTED: {
    dot: "bg-slate-500",
    label: "Camera Disconnected",
    cls: "text-slate-400 border-white/10 bg-white/5",
  },
  UNKNOWN: {
    dot: "bg-slate-500",
    label: "Camera Unknown",
    cls: "text-slate-400 border-white/10 bg-white/5",
  },
};

// ── Analytics Semantic Palette ─────────────────────────────────────────────
const ANALYTICS_C = {
  pass: "#00FF9C",
  warn: "#FFC857",
  crit: "#FF4D6D",
  info: "#00E5FF",
  xai: "#a855f7",
  glow: "rgba(31,227,138,0.25)",
  tooltipBg: "#08140F",
};

// Default fallback – PCBVision neon green
const DEFAULT_ANALYTICS_BAR_COLOR = "#00FF9C";

const ANALYTICS_BAR_COLORS = {
  // Canonical defect classes
  "Solder Bridge": "#FF4D6D",
  "Missing Component": "#FFC857",
  "Polarity Mismatch": "#67D5EB",
  Misalignment: "#22D3EE",
  "Wrong Part": "#A855F7",
  "Uncategorized Defect": "#00FF9C",
  // Snake_case / lowercase PCB defect classes
  missing_pad: "#FFC857",
  short: "#FF4D6D",
  open_circuit: "#00E5FF",
  mouse_bite: "#A855F7",
  spur: "#22D3EE",
  spurious_copper: "#67D5EB",
};

const getAnalyticsBarColor = (entry) => {
  if (!entry) return DEFAULT_ANALYTICS_BAR_COLOR;
  const name = typeof entry === "string" ? entry : entry.name || "";
  if (ANALYTICS_BAR_COLORS[name]) return ANALYTICS_BAR_COLORS[name];
  const normalized = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  for (const [key, val] of Object.entries(ANALYTICS_BAR_COLORS)) {
    if (key.trim().toLowerCase().replace(/[\s-]+/g, "_") === normalized) return val;
  }
  if (entry.color && entry.color !== "#000000" && entry.color !== "black") return entry.color;
  return DEFAULT_ANALYTICS_BAR_COLOR;
};

function AnalyticsTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="tooltip-pop pointer-events-none rounded-xl border px-4 py-2.5 font-mono"
      style={{
        background: ANALYTICS_C.tooltipBg,
        border: `1px solid ${ANALYTICS_C.glow}`,
        borderRadius: 12,
        boxShadow:
          "0 0 24px rgba(31,227,138,0.12), 0 12px 32px rgba(0,0,0,0.5)",
      }}
    >
      <p
        className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: "#7ce7ac" }}
      >
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry, i) => {
          if (entry.value == null) return null;
          const color = entry.color || entry.payload?.color || "#32d583";
          return (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="text-slate-200">{entry.name}</span>
              <span className="ml-3 pl-1 font-bold text-success">
                {entry.value}
                {suffix}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsHourlyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const inspected = d.inspected || 0;
  const passed = d.pass || 0;
  const failed = inspected - passed;
  const confidence = inspected > 0
    ? (d.confidence != null ? `${d.confidence}%` : `${((passed / inspected) * 100).toFixed(1)}%`)
    : "—";

  const rows = [
    { label: "Inspected", value: inspected, color: ANALYTICS_C.info },
    { label: "Passed", value: passed, color: ANALYTICS_C.pass },
    { label: "Failed", value: failed, color: ANALYTICS_C.crit },
    { label: "Confidence", value: confidence, color: ANALYTICS_C.xai },
  ];
  return (
    <div
      className="tooltip-pop pointer-events-none rounded-xl border px-4 py-2.5 font-mono"
      style={{
        background: ANALYTICS_C.tooltipBg,
        border: `1px solid ${ANALYTICS_C.glow}`,
        borderRadius: 12,
        boxShadow:
          "0 0 24px rgba(31,227,138,0.12), 0 12px 32px rgba(0,0,0,0.5)",
      }}
    >
      <p
        className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: "#7ce7ac" }}
      >
        {label} Shift Window
      </p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-6 text-[10px]"
          >
            <span className="text-slate-400">{r.label}</span>
            <span className="font-bold" style={{ color: r.color }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function YieldTrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="tooltip-pop pointer-events-none rounded-xl border px-4 py-2.5 font-mono"
      style={{
        background: ANALYTICS_C.tooltipBg,
        border: `1px solid ${ANALYTICS_C.glow}`,
        borderRadius: 12,
        boxShadow:
          "0 0 24px rgba(31,227,138,0.12), 0 12px 32px rgba(0,0,0,0.5)",
      }}
    >
      <p
        className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: "#7ce7ac" }}
      >
        {d.fullDate || d.date || label} {d.weekday ? `(${d.weekday})` : ""}
      </p>
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Completed Inspections:</span>
          <span className="font-bold text-white">{d.inspected ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Passed Units:</span>
          <span className="font-bold text-success">{d.pass ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Failed Units:</span>
          <span className="font-bold text-danger">{d.fail ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-6 pt-1 border-t border-accent/10">
          <span className="text-slate-200">Pass Yield:</span>
          <span className="font-bold text-accent">
            {d.passRate != null ? `${d.passRate}%` : "No completed inspections"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CycleTimeTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="tooltip-pop pointer-events-none rounded-xl border px-4 py-2.5 font-mono"
      style={{
        background: ANALYTICS_C.tooltipBg,
        border: `1px solid ${ANALYTICS_C.glow}`,
        borderRadius: 12,
        boxShadow:
          "0 0 24px rgba(31,227,138,0.12), 0 12px 32px rgba(0,0,0,0.5)",
      }}
    >
      <p
        className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: "#7ce7ac" }}
      >
        {d.fullDate || d.date || label} {d.weekday ? `(${d.weekday})` : ""}
      </p>
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Completed Inspections:</span>
          <span className="font-bold text-white">{d.inspected ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-6 pt-1 border-t border-accent/10">
          <span className="text-slate-200">Avg Duration:</span>
          <span className="font-bold text-cyan-400">
            {d.avgTime != null ? `${d.avgTime}s` : "No valid duration data"}
          </span>
        </div>
        {d.processLimit != null && (
          <div className="flex items-center justify-between gap-6">
            <span className="text-slate-400">Process Limit:</span>
            <span className="font-bold text-warning">{d.processLimit}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

const AnalyticsGlowCursor = ({ points }) => {
  if (!points || !points.length) return null;
  const x = points[0].x;
  return (
    <line
      x1={x}
      y1={0}
      x2={x}
      y2={2000}
      stroke="rgba(31,227,138,0.22)"
      strokeWidth={1}
      strokeDasharray="3 3"
    />
  );
};

const AnalyticsActiveBar = (props) => {
  const { x, y, width, height, fill } = props;
  const safeFill = fill && fill !== "#000000" && fill !== "black" ? fill : DEFAULT_ANALYTICS_BAR_COLOR;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={4}
      fill={safeFill}
      style={{
        filter: "brightness(1.22) drop-shadow(0 0 8px rgba(0, 255, 156, 0.4))",
        transform: "scaleY(1.02)",
        transformOrigin: "50% 100%",
        transition: "transform 180ms ease-out, filter 180ms ease-out",
      }}
    />
  );
};

function AnalyticsDonutStat({ label, value, suffix = "%", prefix = "", color, up }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-accent/[0.06] bg-[#0d1b17]/50 px-2 py-2.5">
      <span className="font-mono text-[8px] uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span
        className={`mt-0.5 flex items-baseline font-mono text-sm font-bold ${color}`}
      >
        {up && <span className="mr-0.5 text-[9px]">▲</span>}
        {prefix}
        {value}
        {suffix}
      </span>
    </div>
  );
}

function AnalyticsMiniKpi({
  label,
  value,
  suffix,
  decimals,
  icon: Icon,
  valueClass,
  accent,
  trend,
  up,
  delay,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-xl border border-accent/10 bg-[rgba(13,27,23,0.66)] px-4 py-3 backdrop-blur-xl transition-[border-color,box-shadow] duration-250 hover:border-accent/25 hover:shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[9px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition-all duration-250 group-hover:border-accent/30 group-hover:bg-accent/10 ${accent}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`font-mono text-2xl font-extrabold ${valueClass}`}>
          {value == null ? "—" : decimals ? value.toFixed(decimals) : value}
        </span>
        {suffix && value != null && (
          <span className="text-xs font-bold text-slate-400">{suffix}</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {trend && trend !== "—" ? (
          <>
            <span
              className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold ${up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
            >
              {up ? "▲" : "▼"} {trend}
            </span>
            <span className="font-mono text-[9px] text-slate-500">vs yesterday</span>
          </>
        ) : (
          <span className="font-mono text-[9px] text-slate-500">No comparison data</span>
        )}
      </div>
    </motion.div>
  );
}

const defectDetails = {
  "Solder Bridge": {
    weekly: 128,
    boards: ["PCB-1203", "PCB-3102", "PCB-4421"],
    severity: "Critical",
    action:
      "Review soldering profile & stencil alignment. Re-run AOI on affected batch.",
  },
  "Missing Component": {
    weekly: 96,
    boards: ["PCB-1188", "PCB-3001", "PCB-4007"],
    severity: "High",
    action:
      "Check pick-and-place feeder calibration and component reel stock.",
  },
  "Polarity Mismatch": {
    weekly: 64,
    boards: ["PCB-2051", "PCB-2774", "PCB-3312"],
    severity: "High",
    action: "Verify component orientation rules in the placement program.",
  },
  Misalignment: {
    weekly: 48,
    boards: ["PCB-1203", "PCB-3102", "PCB-4421"],
    severity: "Medium",
    action: "Re-calibrate fiducial alignment sensors before next shift.",
  },
  "Wrong Part": {
    weekly: 24,
    boards: ["PCB-1990", "PCB-2122"],
    severity: "Critical",
    action: "Audit component kitting and reel traceability immediately.",
  },
};

const severityStyles = {
  Critical: "border-danger/30 bg-danger/10 text-danger",
  High: "border-warning/30 bg-warning/10 text-warning",
  Medium: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
};

function AnalyticsSkeletonCard({ className = "h-[340px]" }) {
  return (
    <div
      className={`rounded-2xl border border-accent/5 bg-[rgba(13,27,23,0.5)] p-5 ${className}`}
    >
      <div className="skeleton-shimmer h-3 w-40 rounded-md" />
      <div className="skeleton-shimmer mt-6 h-[70%] rounded-lg" />
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { stats, hasLoadedOnce } = useDashboard();
  const { items, markAllAsRead } = useNotifications();
  const { cameraStatus } = useCameraStatus();
  const rpiStatus = cameraStatus.rpiStatus;

  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
  } = useAnalytics();

  const dynamicSparklineData = useMemo(() => {
    if (analyticsData?.trend7Days?.length) {
      return analyticsData.trend7Days.map((d) => ({
        value: d.passRate != null ? d.passRate : 0,
      }));
    }
    return defaultSparklineData;
  }, [analyticsData]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState(null);

  // Template creation modal state
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [templateImageCount, setTemplateImageCount] = useState(4);
  const [templateName, setTemplateName] = useState("");
  const [templateModalMessage, setTemplateModalMessage] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [capturedCount, setCapturedCount] = useState(0);
  const [startingCapture, setStartingCapture] = useState(false);
  const [capturingImage, setCapturingImage] = useState(false);
  const [finishingTemplate, setFinishingTemplate] = useState(false);
  const [cancellingSession, setCancellingSession] = useState(false);

  const anyActionInProgress =
    startingCapture ||
    capturingImage ||
    finishingTemplate ||
    cancellingSession;

  const resetTemplateSession = useCallback(() => {
    setSessionId(null);
    setCapturedCount(0);
    setStartingCapture(false);
    setCapturingImage(false);
    setFinishingTemplate(false);
    setCancellingSession(false);
  }, []);

  const notifRef = useRef(null);
  const userRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotifications(false);
      if (userRef.current && !userRef.current.contains(e.target))
        setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const formatTime = (d) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const formatDate = (d) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // ---- Template creation modal handlers ----
  const handleStartCapture = useCallback(async () => {
    if (!templateName.trim()) {
      setTemplateModalMessage("Please enter a template name.");
      return;
    }

    if (templateImageCount < 4 || templateImageCount > 5) {
      setTemplateModalMessage(
        "Reference image count must be between 4 and 5.",
      );
      return;
    }

    setStartingCapture(true);
    setTemplateModalMessage("");

    try {
      const result = await uploadApi.startTemplate({
        templateName,
        expectedImages: templateImageCount,
      });

      const newSessionId = result.session_id || result.template_id;
      if (!newSessionId) {
        throw new Error("Backend did not return a template session ID.");
      }

      setSessionId(newSessionId);
      setCapturedCount(Number(result.captured_images ?? 0) || 0);
      setTemplateModalMessage(
        "Session started. Capture reference images one at a time.",
      );
    } catch (err) {
      setTemplateModalMessage(
        err?.message ||
          "Could not start template capture session. Please try again.",
      );
    } finally {
      setStartingCapture(false);
    }
  }, [templateName, templateImageCount]);

  const handleCaptureImage = useCallback(async () => {
    if (!sessionId) {
      setTemplateModalMessage(
        "No active template capture session. Start capture first.",
      );
      return;
    }

    if (capturingImage) return;
    setCapturingImage(true);
    setTemplateModalMessage("");

    try {
      const result = await uploadApi.captureTemplateImage(sessionId);
      const newCount = Number(result.captured_images ?? 0);
      if (Number.isFinite(newCount)) {
        setCapturedCount(newCount);
      }
      setTemplateModalMessage(
        `Image ${newCount} of ${templateImageCount} captured. Reposition PCB for next angle.`,
      );
    } catch (err) {
      setTemplateModalMessage(
        err?.message || "Capture failed. Check camera alignment and try again.",
      );
    } finally {
      setCapturingImage(false);
    }
  }, [sessionId, capturingImage, templateImageCount]);

  const handleFinishTemplate = useCallback(async () => {
    if (!sessionId) return;
    setFinishingTemplate(true);
    setTemplateModalMessage("");

    try {
      await uploadApi.finishTemplate(sessionId);
      setTemplateModalMessage("Template created and saved successfully!");
      setTimeout(() => {
        setShowCreateTemplateModal(false);
        setTemplateName("");
        setTemplateImageCount(4);
        setTemplateModalMessage("");
        resetTemplateSession();
      }, 1500);
    } catch (err) {
      setTemplateModalMessage(
        err?.message ||
          "Could not save template on Raspberry Pi. Please retry.",
      );
    } finally {
      setFinishingTemplate(false);
    }
  }, [sessionId, resetTemplateSession]);

  const handleCancelTemplateSession = useCallback(async () => {
    if (!sessionId) return;
    setCancellingSession(true);
    try {
      await uploadApi.cancelTemplate(sessionId);
    } catch (err) {
      console.warn("Cancel template session error:", err);
    } finally {
      setSessionId(null);
      setCapturedCount(0);
      setCancellingSession(false);
    }
  }, [sessionId]);

  const cameraBadge = CAMERA_BADGE[cameraStatus.status] || CAMERA_BADGE.UNKNOWN;

  const selectedDefectInfo = selectedDefect
    ? { ...selectedDefect, ...defectDetails[selectedDefect.name] }
    : null;

  return (
    <AppLayout>
      <NotificationHost />
      {/* ========== TOP BAR ========== */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-accent/10 bg-primary-bg/90 px-6 backdrop-blur-xl">
        <div
          className={`relative flex items-center transition-all duration-300 ${searchFocused ? "w-[500px]" : "w-80"}`}
        >
          <Search className="absolute left-3 h-4 w-4 text-slate-500 transition-colors duration-300 group-focus-within:text-accent" />
          <input
            ref={searchRef}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search Boards, Reports, Components..."
            className="w-full rounded-lg border border-white/[0.06] bg-secondary-bg/60 py-2 pl-10 pr-16 text-xs text-white placeholder:text-slate-500 outline-none transition-all duration-300 focus:border-accent/30 focus:ring-2 focus:ring-accent/15 backdrop-blur-sm"
          />
          <span className="absolute right-3 rounded border border-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-600 font-mono">
            Ctrl+K
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                const nextState = !showNotifications;
                setShowNotifications(nextState);
                if (nextState) {
                  markAllAsRead();
                }
              }}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-[7px] font-bold text-white">
                {items.filter((item) => !item.isRead).length}
              </span>
            </button>
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 w-72 rounded-xl border border-accent/10 bg-card-bg p-3 shadow-2xl backdrop-blur-2xl"
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Notifications
                  </p>
                  <div className="space-y-1 max-h-[320px] overflow-y-auto overscroll-contain pr-1">
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="font-semibold uppercase tracking-wider text-slate-300">
                          NO NOTIFICATIONS
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          You're all caught up for today.
                        </p>
                      </div>
                    ) : (
                      items.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-300 transition-colors hover:bg-white/5"
                        >
                          <span
                            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.type === "fail" ? "bg-danger" : n.type === "success" ? "bg-success" : "bg-accent"}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-slate-200">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-slate-400">{n.message}</p>
                            <p className="text-[10px] text-slate-600">
                              {n.time}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={userRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-1.5 transition-colors hover:border-accent/20 hover:bg-white/5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-bg">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
              <span className="text-xs font-medium text-white">
                {user?.name || "User"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </button>
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-48 rounded-xl border border-accent/10 bg-card-bg p-2 shadow-2xl backdrop-blur-2xl"
                >
                  {[
                    { label: "Profile", icon: User },
                    { label: "Settings", icon: Settings },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          if (item.label === "Profile") {
                            setShowProfile(true);
                          }
                          if (item.label === "Settings") {
                            setShowUserMenu(false);
                            navigate("/settings");
                          }
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-accent/5" />
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate("/", { replace: true });
                      setTimeout(() => {
                        logout();
                      }, 0);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-danger"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5 p-6"
      >
        {/* ---- HEADER (Preserved unchanged) ---- */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              PCBVision
            </h1>
            <p className="text-xs text-slate-500">
              PCB Inspection Control Console
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-right">
            <div className="text-right">
              <p className="font-mono text-sm font-bold text-white">
                {formatTime(currentTime)}
              </p>
              <p className="font-mono text-[10px] text-slate-500">
                {formatDate(currentTime)}
              </p>
            </div>
            <div className="h-10 w-px bg-accent/10" />
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success led-fast" />
                <span className="font-mono text-xs font-bold text-success uppercase tracking-wider">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                {[
                  {
                    label: "CAMERA",
                    value: cameraBadge.label.replace("Camera ", ""),
                    color: cameraStatus.connected
                      ? "text-success"
                      : "text-danger",
                  },
                  {
                    label: "CPU",
                    value: stats ? stats.today.cpu : "—",
                    color: "text-accent",
                  },
                  {
                    label: "TEMP",
                    value: stats ? stats.today.rpiTemp : "—",
                    color: "text-warning",
                  },
                ].map((m) => (
                  <span
                    key={m.label}
                    className="font-mono text-[10px] text-slate-500"
                  >
                    <span className="text-slate-600">{m.label}</span>{" "}
                    <span className={`font-semibold ${m.color}`}>
                      {m.value}
                    </span>
                  </span>
                ))}
              </div>
              {/* Raspberry Pi connectivity status */}
              <div className="flex items-center gap-2 mt-2">
                {rpiStatus.status === "CONNECTED" ? (
                  <>
                    <Wifi className="h-3 w-3 text-success" />
                    <span className="font-mono text-[10px] text-success uppercase tracking-wider">
                      RPi Connected
                    </span>
                  </>
                ) : rpiStatus.status === "DISCONNECTED" ? (
                  <>
                    <WifiOff className="h-3 w-3 text-danger" />
                    <span className="font-mono text-[10px] text-danger uppercase tracking-wider">
                      RPi Disconnected
                    </span>
                  </>
                ) : rpiStatus.status === "ERROR" ? (
                  <>
                    <Server className="h-3 w-3 text-warning" />
                    <span className="font-mono text-[10px] text-warning uppercase tracking-wider">
                      RPi Error
                    </span>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                    <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                      RPi Checking...
                    </span>
                  </>
                )}
              </div>
            </div>
            {/* CREATE NEW TEMPLATE button */}
            <div className="lg:ml-auto">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setTemplateImageCount(4);
                  setTemplateName("");
                  setTemplateModalMessage("");
                  resetTemplateSession();
                  setShowCreateTemplateModal(true);
                }}
                className="group inline-flex items-center gap-2 rounded-xl border border-accent/20 bg-white/[0.03] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-sm transition-all duration-300 text-white/80 hover:border-accent/40 hover:bg-accent/5 hover:text-white hover:shadow-[0_0_20px_rgba(50,213,131,0.1)]"
              >
                <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" />
                Create New Template
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ---- KPI CARDS (backend-driven, preserved exactly) ---- */}
        {stats ? (
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              {
                title: "Boards Inspected Today",
                value: stats.today.inspected,
                icon: Camera,
                trend: stats.today.inspectedTrend || "—",
                up: stats.today.inspectedUp ?? true,
                sparkColor: "#32d583",
              },
              {
                title: "Pass Rate",
                value: stats.today.passRate,
                suffix: "%",
                icon: CheckCircle,
                trend: stats.today.passRateTrend || "—",
                up: stats.today.passRateUp ?? true,
                sparkColor: "#32d583",
              },
              {
                title: "Failed Boards",
                value: stats.today.fail,
                icon: AlertTriangle,
                trend: stats.today.failTrend || "—",
                up: stats.today.failUp ?? false,
                sparkColor: "#ff4d6d",
              },
              {
                title: "Avg Inspection Time",
                value: stats.today.avgCycleTime,
                decimals: 2,
                suffix: "s",
                icon: Clock,
                trend: stats.today.avgCycleTimeTrend || "—",
                up: stats.today.avgCycleTimeUp ?? true,
                sparkColor: "#32d583",
              },
            ].map((card) => (
              <GlassCard
                key={card.title}
                className="group relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {card.title}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-extrabold text-white">
                        {card.value == null
                          ? "—"
                          : card.decimals
                          ? card.value.toFixed(card.decimals)
                          : card.value}
                      </span>
                      {card.suffix && card.value != null && (
                        <span className="text-sm font-semibold text-accent">
                          {card.suffix}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-accent/15 bg-accent/5 p-2.5 transition-colors duration-300 group-hover:border-accent/40 group-hover:bg-accent/10">
                    <card.icon className="h-5 w-5 text-accent transition-transform duration-300 group-hover:scale-110" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-accent/5 pt-3">
                  {card.trend && card.trend !== "—" ? (
                    <span
                      className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        card.up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                      }`}
                    >
                      {card.up ? "↑" : "↓"} {card.trend}
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400">
                      —
                    </span>
                  )}
                  <div className="h-6 w-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dynamicSparklineData}>
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={card.sparkColor}
                          fill={card.sparkColor}
                          fillOpacity={0.15}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </GlassCard>
            ))}
          </motion.div>
        ) : !hasLoadedOnce ? (
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-[92px] rounded-xl" />
            ))}
          </motion.div>
        ) : null}

        {/* ---- INTEGRATED SYSTEM QUALITY ANALYTICS ---- */}
        <motion.div variants={itemVariants} className="space-y-6">
          {analyticsError && !analyticsData ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 font-mono text-xs text-slate-500 uppercase tracking-widest rounded-xl border border-accent/5 bg-[#08140F]/60">
              <span className="text-danger">Unable to retrieve analytics data.</span>
              <span className="text-slate-600 normal-case">Please check backend connectivity.</span>
            </div>
          ) : analyticsLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="skeleton-shimmer h-[92px] rounded-xl"
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
                <div className="md:col-span-1 lg:col-span-4">
                  <AnalyticsSkeletonCard />
                </div>
                <div className="md:col-span-1 lg:col-span-8">
                  <AnalyticsSkeletonCard />
                </div>
                <div className="lg:col-span-12">
                  <AnalyticsSkeletonCard className="h-[350px]" />
                </div>
                <div className="lg:col-span-6">
                  <AnalyticsSkeletonCard className="h-[320px]" />
                </div>
                <div className="lg:col-span-6">
                  <AnalyticsSkeletonCard className="h-[320px]" />
                </div>
              </div>
            </div>
          ) : (
            (() => {
              const {
                kpis = [],
                qualitySummary = [],
                donutStats = [],
                yieldRate = 0,
                defectChart = [],
                hourlyThroughput = [],
                trend7Days = [],
              } = analyticsData || {};

              // Remove duplicate metrics already represented in primary Dashboard KPIs
              // ("Yield Rate" duplicates "Pass Rate", "Inspection Time" duplicates "Avg Inspection Time")
              const duplicateLabels = new Set([
                "Yield Rate",
                "Inspection Time",
                "Avg Inspection Time",
              ]);
              const distinctKpis = kpis.filter(
                (kpi) => !duplicateLabels.has(kpi.label)
              );

              return (
                <div className="space-y-6">
                  {/* Distinct Analytics KPI Cards */}
                  {distinctKpis.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {distinctKpis.map((kpi, i) => {
                        const kpiMeta = {
                          "Today's Defects": {
                            icon: AlertOctagon,
                            valueClass: "text-danger",
                            accent: "text-danger",
                          },
                          "Avg Confidence": {
                            icon: ShieldCheck,
                            valueClass: "text-accent",
                            accent: "text-accent",
                          },
                        }[kpi.label] || {
                          icon: Gauge,
                          valueClass: "text-accent",
                          accent: "text-accent",
                        };
                        return (
                          <AnalyticsMiniKpi
                            key={kpi.label}
                            {...kpi}
                            {...kpiMeta}
                            delay={0.05 + i * 0.05}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
                    {/* Donut Chart: Quality Yield Summary */}
                    <GlassCard
                      className="flex h-[340px] flex-col justify-between md:col-span-1 lg:col-span-4"
                      hoverLift={false}
                    >
                      <div className="flex items-center gap-2 border-b border-accent/5 pb-3 text-left">
                        <LucidePie className="h-4 w-4 text-success" />
                        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                          Quality Yield Summary
                        </span>
                      </div>

                      <div className="relative flex h-44 w-full items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={
                                qualitySummary.some((q) => (q.value || 0) > 0)
                                  ? qualitySummary
                                  : [
                                      {
                                        name: "No Data",
                                        value: 100,
                                        color: "rgba(255,255,255,0.06)",
                                      },
                                    ]
                              }
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={72}
                              paddingAngle={3}
                              dataKey="value"
                              isAnimationActive
                              animationBegin={150}
                              animationDuration={850}
                              animationEasing="ease-out"
                            >
                              {(qualitySummary.some((q) => (q.value || 0) > 0)
                                ? qualitySummary
                                : [
                                    {
                                      name: "No Data",
                                      value: 100,
                                      color: "rgba(255,255,255,0.06)",
                                    },
                                  ]
                              ).map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                />
                              ))}
                            </Pie>
                            {qualitySummary.some((q) => (q.value || 0) > 0) && (
                              <Tooltip
                                content={<AnalyticsTooltip suffix="%" />}
                                cursor={false}
                              />
                            )}
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center">
                          <span className="font-mono text-xl font-extrabold text-white">
                            {yieldRate != null ? yieldRate : "—"}
                            {yieldRate != null && (
                              <span className="text-success">%</span>
                            )}
                          </span>
                          <span className="font-display text-[8px] uppercase tracking-widest text-slate-500">
                            Yield Rate
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <div className="grid grid-cols-3 gap-2">
                          {donutStats.map((stat, idx) => (
                            <AnalyticsDonutStat
                              key={stat.label}
                              label={stat.label}
                              value={stat.value}
                              color={
                                idx === 0
                                  ? "text-accent"
                                  : idx === 1
                                    ? "text-slate-300"
                                    : "text-success"
                              }
                              up={stat.up}
                            />
                          ))}
                        </div>
                        <div className="flex justify-around gap-4 font-mono text-[9px]">
                          {qualitySummary.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span
                                className="h-2.5 w-2.5 rounded-sm"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-slate-400">
                                {entry.name}:{" "}
                                <strong className="text-white">
                                  {entry.value}%
                                </strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </GlassCard>

                    {/* Bar Chart: Anomalies Categories */}
                    <GlassCard
                      className="flex h-[340px] flex-col justify-between md:col-span-1 lg:col-span-8"
                      hoverLift={false}
                    >
                      <div className="flex items-center justify-between border-b border-accent/5 pb-3 text-left">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-warning" />
                          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                            Anomalies Categories
                          </span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                          Click a bar for details
                        </span>
                      </div>

                      <div className="mt-4 h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={defectChart}
                            margin={{ left: -14, right: 6, top: 20, bottom: 0 }}
                            barCategoryGap="30%"
                          >
                            <CartesianGrid
                              horizontal
                              vertical={false}
                              strokeDasharray="3 3"
                              stroke="rgba(148,163,184,0.08)"
                            />
                            <XAxis
                              dataKey="name"
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="Orbitron"
                              tickLine={false}
                              axisLine={{ stroke: "rgba(148,163,184,0.12)" }}
                              interval={0}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="JetBrains Mono"
                              tickLine={false}
                              axisLine={false}
                              domain={[0, (dataMax) => Math.ceil(dataMax * 1.2)]}
                              allowDecimals={false}
                            />
                            <Tooltip
                              content={<AnalyticsTooltip />}
                              cursor={false}
                            />
                            <Bar
                              dataKey="count"
                              radius={[4, 4, 0, 0]}
                              barSize={30}
                              maxBarSize={34}
                              isAnimationActive
                              animationBegin={150}
                              animationDuration={750}
                              animationEasing="ease-out"
                              activeBar={<AnalyticsActiveBar />}
                              onClick={(barData) => setSelectedDefect(barData)}
                            >
                              {defectChart.map((entry, idx) => (
                                <Cell
                                  key={`cell-${idx}`}
                                  fill={getAnalyticsBarColor(entry)}
                                />
                              ))}
                              <LabelList
                                dataKey="count"
                                position="top"
                                formatter={(v) => v}
                                style={{
                                  fontSize: 9,
                                  fontFamily: "JetBrains Mono",
                                  fontWeight: 700,
                                  fill: "#94A3B8",
                                }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </GlassCard>

                    {/* Area Chart: Hourly Throughput */}
                    <GlassCard
                      className="relative flex h-[350px] flex-col justify-between overflow-hidden md:col-span-2 lg:col-span-12"
                      hoverLift={false}
                    >
                      <div className="flex items-center justify-between border-b border-accent/5 pb-3 text-left">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-accent" />
                          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                            Shift Throughput Activity
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {!hourlyThroughput.some((h) => (h.inspected || 0) > 0) && (
                            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-accent">
                              0 Scans Completed Today
                            </span>
                          )}
                          <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                            Scans / Hour (24h)
                          </span>
                        </div>
                      </div>

                      <div className="relative mt-5 h-64 w-full">
                        {!hourlyThroughput.some((h) => (h.inspected || 0) > 0) && (
                          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-[#08140F]/50 backdrop-blur-[1px]">
                            <span className="font-mono text-xs font-semibold text-slate-300">
                              No inspection records completed today
                            </span>
                            <span className="mt-1 max-w-sm text-center font-mono text-[10px] text-slate-500">
                              Activity will populate across the 24-hour timeline as inspections are completed.
                            </span>
                          </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={hourlyThroughput}
                            margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                          >
                            <defs>
                              <linearGradient
                                id="dashColorInspected"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={ANALYTICS_C.info}
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={ANALYTICS_C.info}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                              <linearGradient
                                id="dashColorPass"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={ANALYTICS_C.pass}
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={ANALYTICS_C.pass}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(0,229,255,0.02)"
                            />
                            <XAxis
                              dataKey="hour"
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="JetBrains Mono"
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="JetBrains Mono"
                              tickLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip
                              content={<AnalyticsHourlyTooltip />}
                              cursor={<AnalyticsGlowCursor />}
                            />
                            <Legend
                              verticalAlign="top"
                              height={36}
                              iconType="plainline"
                              wrapperStyle={{
                                fontSize: "10px",
                                fontFamily: "Orbitron",
                                color: "#94A3B8",
                              }}
                            />
                            <Area
                              name="Total Inspected"
                              type="monotone"
                              dataKey="inspected"
                              stroke={ANALYTICS_C.info}
                              fillOpacity={1}
                              fill="url(#dashColorInspected)"
                              strokeWidth={2}
                              isAnimationActive
                              animationBegin={200}
                              animationDuration={900}
                              animationEasing="ease-out"
                              activeDot={{
                                r: 4,
                                fill: ANALYTICS_C.info,
                                stroke: "#08140F",
                                strokeWidth: 2,
                              }}
                            />
                            <Area
                              name="Passed Units"
                              type="monotone"
                              dataKey="pass"
                              stroke={ANALYTICS_C.pass}
                              fillOpacity={1}
                              fill="url(#dashColorPass)"
                              strokeWidth={1.5}
                              isAnimationActive
                              animationBegin={350}
                              animationDuration={900}
                              animationEasing="ease-out"
                              activeDot={{
                                r: 4,
                                fill: ANALYTICS_C.pass,
                                stroke: "#08140F",
                                strokeWidth: 2,
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </GlassCard>

                    {/* Line Chart: Weekly Pass Yield Trend */}
                    <GlassCard
                      className="relative flex h-[320px] flex-col justify-between overflow-hidden md:col-span-1 lg:col-span-6"
                      hoverLift={false}
                    >
                      <div className="flex items-center justify-between border-b border-accent/5 pb-3 text-left">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-accent" />
                          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                            Weekly Pass Yield Trend
                          </span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                          Latest 7 Days
                        </span>
                      </div>

                      <div className="relative mt-5 h-56 w-full">
                        {!trend7Days.some((d) => d.hasData && d.passRate != null) && (
                          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-[#08140F]/50 backdrop-blur-[1px]">
                            <span className="font-mono text-xs font-semibold text-slate-300">
                              No verified inspection data
                            </span>
                            <span className="mt-1 max-w-xs text-center font-mono text-[10px] text-slate-500">
                              Pass yield trend requires verified completed PASS/FAIL records.
                            </span>
                          </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={trend7Days}
                            margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(0,229,255,0.02)"
                            />
                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="Orbitron"
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="JetBrains Mono"
                              tickLine={false}
                              domain={[0, 100]}
                              ticks={[0, 25, 50, 75, 100]}
                            />
                            <Tooltip
                              content={<YieldTrendTooltip />}
                              cursor={<AnalyticsGlowCursor />}
                            />
                            <Line
                              name="Pass Yield"
                              type="monotone"
                              dataKey="passRate"
                              stroke={ANALYTICS_C.pass}
                              strokeWidth={2}
                              connectNulls={false}
                              isAnimationActive
                              animationBegin={200}
                              animationDuration={850}
                              animationEasing="ease-out"
                              activeDot={{
                                r: 4,
                                fill: ANALYTICS_C.pass,
                                stroke: "#08140F",
                                strokeWidth: 2,
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </GlassCard>

                    {/* Line Chart: Cycle Time Process Limit */}
                    <GlassCard
                      className="relative flex h-[320px] flex-col justify-between overflow-hidden md:col-span-1 lg:col-span-6"
                      hoverLift={false}
                    >
                      <div className="flex items-center justify-between border-b border-accent/5 pb-3 text-left">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-accent" />
                          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
                            Cycle Time Process Limit (7 Days)
                          </span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                          Latest 7 Days
                        </span>
                      </div>

                      <div className="relative mt-5 h-56 w-full">
                        {!trend7Days.some((d) => d.avgTime != null) && (
                          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-[#08140F]/50 backdrop-blur-[1px]">
                            <span className="font-mono text-xs font-semibold text-slate-300">
                              No duration records available
                            </span>
                            <span className="mt-1 max-w-xs text-center font-mono text-[10px] text-slate-500">
                              Cycle times are recorded from completed inspection runs.
                            </span>
                          </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={trend7Days}
                            margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(0,229,255,0.02)"
                            />
                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="Orbitron"
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={9}
                              fontFamily="JetBrains Mono"
                              tickLine={false}
                              domain={[0, "auto"]}
                            />
                            <Tooltip
                              content={<CycleTimeTooltip processLimit={analyticsData?.processLimit} />}
                              cursor={<AnalyticsGlowCursor />}
                            />
                            {analyticsData?.processLimit != null && (
                              <ReferenceLine
                                y={analyticsData.processLimit}
                                stroke="#ffb703"
                                strokeDasharray="4 4"
                                strokeWidth={1.5}
                                label={{
                                  value: `Limit (${analyticsData.processLimit}s)`,
                                  fill: "#ffb703",
                                  fontSize: 9,
                                  position: "top",
                                }}
                              />
                            )}
                            <Line
                              name="Avg Cycle Time"
                              type="monotone"
                              dataKey="avgTime"
                              stroke={ANALYTICS_C.info}
                              strokeWidth={2}
                              connectNulls={false}
                              isAnimationActive
                              animationBegin={200}
                              animationDuration={850}
                              animationEasing="ease-out"
                              activeDot={{
                                r: 4,
                                fill: ANALYTICS_C.info,
                                stroke: "#08140F",
                                strokeWidth: 2,
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              );
            })()
          )}
        </motion.div>
      </motion.main>

      {/* ── Defect Detail Floating Panel (when bar clicked in Anomalies Categories) ── */}
      <AnimatePresence>
        {selectedDefectInfo && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSelectedDefect(null)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 48 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="fixed right-5 top-20 z-50 w-[320px] rounded-2xl border border-accent/15 bg-[#08140F]/95 p-5 shadow-[0_0_40px_rgba(31,227,138,0.1)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-accent/10 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${severityStyles[selectedDefectInfo.severity].split(" ")[0]}`}
                    style={{
                      background:
                        selectedDefectInfo.severity === "Critical"
                          ? ANALYTICS_C.crit
                          : selectedDefectInfo.severity === "High"
                            ? ANALYTICS_C.warn
                            : ANALYTICS_C.info,
                    }}
                  />
                  <span className="font-display text-xs font-bold uppercase tracking-widest text-white">
                    {selectedDefectInfo.name}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDefect(null)}
                  className="text-slate-500 transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-accent/10 bg-[#0d1b17]/60 px-3 py-2.5 text-center">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-slate-500">
                    Today's Count
                  </p>
                  <p className="font-mono text-lg font-bold text-warning">
                    {selectedDefectInfo.count}
                  </p>
                </div>
                <div className="rounded-lg border border-accent/10 bg-[#0d1b17]/60 px-3 py-2.5 text-center">
                  <p className="font-mono text-[8px] uppercase tracking-widest text-slate-500">
                    Weekly Count
                  </p>
                  <p className="font-mono text-lg font-bold text-white">
                    {selectedDefectInfo.weekly}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 font-mono text-[8px] uppercase tracking-widest text-slate-500">
                  Affected Boards
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDefectInfo.boards.map((b) => (
                    <span
                      key={b}
                      className="rounded-md border border-accent/15 bg-accent/5 px-2 py-1 font-mono text-[9px] font-semibold text-accent"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <p className="font-mono text-[8px] uppercase tracking-widest text-slate-500">
                  Severity
                </p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold ${severityStyles[selectedDefectInfo.severity]}`}
                >
                  {selectedDefectInfo.severity}
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-accent/10 bg-[#0d1b17]/60 px-3 py-2.5">
                <p className="mb-1 font-mono text-[8px] uppercase tracking-widest text-slate-500">
                  Suggested Action
                </p>
                <p className="text-[10px] leading-relaxed text-slate-300">
                  {selectedDefectInfo.action}
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* User Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-accent/10 bg-card-bg p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-accent/10 pb-4">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-widest text-accent">
                  User Profile
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Account information
                </p>
              </div>

              <button
                onClick={() => setShowProfile(false)}
                className="text-slate-500 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-primary-bg">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  {user?.name || "User"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {user?.email || "user@pcbvision.xai"}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-accent/5 bg-white/[0.02] px-3 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Role
                </span>
                <span className="text-xs text-slate-300">Inspector</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-accent/5 bg-white/[0.02] px-3 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Status
                </span>
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Active
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowProfile(false)}
              className="mt-6 w-full rounded-lg border border-accent/15 bg-accent/5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-accent transition-colors hover:bg-accent/10"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Create New Template Modal (Preserved exactly) */}
      <Modal
        isOpen={showCreateTemplateModal}
        onClose={() => {
          if (anyActionInProgress) return;
          if (sessionId && capturedCount < templateImageCount) {
            handleCancelTemplateSession();
            return;
          }

          setShowCreateTemplateModal(false);
          setTemplateName("");
          setTemplateImageCount(4);
          setTemplateModalMessage("");
          resetTemplateSession();
        }}
        title="Create New Template"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-300">
            Create a PCB component template using the Raspberry Pi camera.
          </p>

          {/* TEMPLATE NAME */}
          <div className="space-y-2">
            <label
              htmlFor="template-name"
              className="block font-mono text-[10px] uppercase tracking-wider text-slate-400"
            >
              Template Name
            </label>

            <input
              id="template-name"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter template name"
              disabled={anyActionInProgress || !!sessionId}
              className="w-full rounded-lg border border-accent/20 bg-white/[0.02] px-4 py-2.5 text-white placeholder:text-slate-500 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 transition-all disabled:opacity-50"
            />
          </div>

          {/* REFERENCE IMAGE COUNT */}
          <div className="space-y-2">
            <label
              htmlFor="template-image-count"
              className="block font-mono text-[10px] uppercase tracking-wider text-slate-400"
            >
              Number of Reference Images
            </label>

            <input
              id="template-image-count"
              type="number"
              min="4"
              max="5"
              value={templateImageCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 4 && val <= 5) {
                  setTemplateImageCount(val);
                }
              }}
              disabled={anyActionInProgress || !!sessionId}
              className="w-full rounded-lg border border-accent/20 bg-white/[0.02] px-4 py-2.5 text-white placeholder:text-slate-500 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 transition-all disabled:opacity-50"
            />

            <p className="text-xs text-slate-400">
              The Raspberry Pi camera will capture{" "}
              <span className="font-semibold text-accent">
                {templateImageCount}
              </span>{" "}
              reference images — one at a time, only when you press Capture
              Image. Reposition the PCB between captures.
            </p>
          </div>

          {/* CAMERA INFORMATION */}
          <div className="rounded-lg border border-accent/10 bg-accent/[0.03] px-4 py-3">
            <div className="flex items-start gap-3">
              <Camera className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  Raspberry Pi Camera
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Press Start Capture to open a session, then press Capture
                  Image once per reference photo. Reposition the PCB between
                  captures. Finish when all images are captured.
                </p>
              </div>
            </div>
          </div>

          {/* PROGRESS */}
          {sessionId && (
            <div className="rounded-lg border border-accent/10 bg-accent/[0.03] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Capture Progress
                </span>
                <span className="font-mono text-[10px] font-bold text-white">
                  {capturedCount} of {templateImageCount} images captured
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent/10">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{
                    width: `${(capturedCount / templateImageCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* MESSAGE */}
          {templateModalMessage && (
            <p
              className={`text-sm font-mono ${
                templateModalMessage.toLowerCase().includes("failed") ||
                templateModalMessage.toLowerCase().includes("please") ||
                templateModalMessage.toLowerCase().includes("must")
                  ? "text-danger"
                  : "text-accent"
              }`}
            >
              {templateModalMessage}
            </p>
          )}

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-accent/10">
            <button
              onClick={() => {
                if (anyActionInProgress) return;
                if (sessionId && capturedCount < templateImageCount) {
                  handleCancelTemplateSession().then(() => {
                    setShowCreateTemplateModal(false);
                    setTemplateName("");
                    setTemplateImageCount(4);
                    setTemplateModalMessage("");
                    resetTemplateSession();
                  });
                  return;
                }

                setShowCreateTemplateModal(false);
                setTemplateName("");
                setTemplateImageCount(4);
                setTemplateModalMessage("");
                resetTemplateSession();
              }}
              disabled={anyActionInProgress}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/20 bg-white/[0.03] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/80 transition-all hover:border-accent/40 hover:bg-accent/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!sessionId
                ? "Cancel"
                : capturedCount < templateImageCount
                  ? "Cancel Session"
                  : "Close"}
            </button>

            {/* START CAPTURE */}
            {!sessionId && (
              <button
                onClick={handleStartCapture}
                disabled={startingCapture || anyActionInProgress}
                className="inline-flex items-center gap-2 rounded-lg bg-accent/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-accent border border-accent/30 transition-all hover:bg-accent/25 hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startingCapture ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Camera className="h-3.5 w-3.5" />
                    Start Capture
                  </>
                )}
              </button>
            )}

            {/* CAPTURE IMAGE */}
            {sessionId && capturedCount < templateImageCount && (
              <button
                onClick={handleCaptureImage}
                disabled={capturingImage || anyActionInProgress}
                className="inline-flex items-center gap-2 rounded-lg bg-accent/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-accent border border-accent/30 transition-all hover:bg-accent/25 hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {capturingImage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="h-3.5 w-3.5" />
                    Capture Image
                  </>
                )}
              </button>
            )}

            {/* FINISH TEMPLATE */}
            {sessionId && capturedCount >= templateImageCount && (
              <button
                onClick={handleFinishTemplate}
                disabled={finishingTemplate || anyActionInProgress}
                className="inline-flex items-center gap-2 rounded-lg bg-accent/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-accent border border-accent/30 transition-all hover:bg-accent/25 hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {finishingTemplate ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Finishing...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3.5 w-3.5" />
                    Finish Template
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
