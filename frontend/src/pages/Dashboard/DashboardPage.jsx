import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "../../components/layout/AppLayout";
import GlassCard from "../../components/cards/GlassCard";
import StatusBadge from "../../components/common/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useDashboard } from "../../hooks/useDashboard";
import { useInspection, INSPECTION_STATE } from "../../hooks/useInspection";
import { useUpload } from "../../hooks/useUpload";
import ScanningOverlay from "../../components/animations/ScanningOverlay";
import XMCCVResultsPanel from "../../components/inspection/XMCCVResultsPanel";
import HeatmapPanel from "../../components/inspection/HeatmapPanel";
import ODCResultsPanel from "../../components/inspection/ODCResultsPanel";
import InspectionDecisionPanel from "../../components/inspection/InspectionDecisionPanel";
import XAIExplanationPanel from "../../components/inspection/XAIExplanationPanel";
import { useReport } from "../../hooks/useReport";
import { useExport } from "../../hooks/useExport";
import { useSnapshot } from "../../hooks/useSnapshot";
import { useXAI } from "../../hooks/useXAI";
import { useCameraStatus } from "../../hooks/useCameraStatus";
import { useRpiStatus } from "../../hooks/useRpiStatus";
import { useInspectionHistory } from "../../hooks/useInspectionHistory";
import { formatConfidence, getBboxStyle } from "../../utils/formatters";
import { TREND_7_DAYS } from "../../services/mock/mockData";
import NotificationHost from "../../components/common/NotificationHost";
import Modal from "../../components/common/Modal";
import { uploadApi } from "../../services/api/uploadApi";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import {
  Play,
  Camera,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Bell,
  Upload,
  FileText,
  Download,
  Image,
  Search,
  ChevronDown,
  Settings,
  LogOut,
  User,
  X,
  Scan,
  Layers,
  GitBranch,
  Info,
  Sparkles,
  Wrench,
  Plus,
  Wifi,
  Server,
  WifiOff,
  List,
  Brain,
  Shield,
  Thermometer,
  FileCheck,
  ExternalLink,
  History,
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

const sparklineData = TREND_7_DAYS.map((d) => ({ value: d.passRate }));

const notifications = [
  {
    id: 1,
    text: "Inspection Failed — PCB-2026-2583",
    time: "2m ago",
    type: "fail",
  },
  {
    id: 2,
    text: "New Report Generated — Q3 Summary",
    time: "15m ago",
    type: "info",
  },
  { id: 3, text: "Camera #1 Back Online", time: "1h ago", type: "success" },
  { id: 4, text: "Model Updated to v8.0.3-xai", time: "2h ago", type: "info" },
];

const inspectionTimeline = [
  { step: "Capture", icon: Camera, done: true },
  { step: "YOLO", icon: Scan, done: true },
  { step: "Grad-CAM", icon: Layers, done: true },
  { step: "X-MCCV", icon: GitBranch, done: true },
  { step: "Result", icon: CheckCircle, done: null },
];

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { stats } = useDashboard();
  const { items, notify, markAllAsRead } = useNotifications();

  const {
    pcbImage,
    inspection,
    state: inspectionState,
    errorMessage: inspectionError,
    scanPhase,
    setPcbImage,
    clearPcbImage,
    runInspection,
    refreshInspection,
    resetInspection,
  } = useInspection();

  const {
    uploadedImage,
    uploading: uploadLoading,
    uploadImage,
    clearUpload,
  } = useUpload();

  const { generating, generateReport } = useReport();

  const { exporting, exportCsv } = useExport();

  const { capturing, captureSnapshot } = useSnapshot();

  const { clear: clearXai } = useXAI();

  const { cameraStatus } = useCameraStatus();
  const { rpiStatus } = useRpiStatus();

  const { records: recentInspections, loading: historyLoading } = useInspectionHistory({
    page: 1,
    pageSize: 5,
    sortBy: "timestamp",
    order: "desc",
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [summaryView, setSummaryView] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [actionStatus, setActionStatus] = useState(null);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [templateImageCount, setTemplateImageCount] = useState(1);
  const [templateReferenceImages, setTemplateReferenceImages] = useState([]);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateModalMessage, setTemplateModalMessage] = useState("");
  const [templateName, setTemplateName] = useState("");
  const notifRef = useRef(null);
  const userRef = useRef(null);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const [imageDims, setImageDims] = useState(null);

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

  // Clear XAI data whenever the active inspection changes.
  useEffect(() => {
    clearXai();
  }, [inspection?.inspectionId, clearXai]);

  // Reset measured dimensions whenever a new image is uploaded.
  useEffect(() => {
    setImageDims(null);
  }, [uploadedImage?.url]);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      setImageDims({ width: naturalWidth, height: naturalHeight });
    }
  };

  const imageAspect = imageDims
    ? `${imageDims.width} / ${imageDims.height}`
    : "600 / 400";

  // Scan is active only during the two sequential AOI sweep phases; both the
  // Dashboard viewport and the PCB Inspection page share this same state.
  const scanning = scanPhase === "horizontal" || scanPhase === "vertical";

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

  const handleComponentClick = (detection) => {
    const detail = inspection?.componentDetails?.find((c) =>
      c.name.toLowerCase().startsWith(detection.id.toLowerCase()),
    );
    setSelectedComponent(
      detail
        ? { ...detail, id: detection.id }
        : { name: detection.label, id: detection.id },
    );
  };

  // ---- Action handlers ----------------------------------------------------
  const handleStartInspection = useCallback(async () => {
    if (
      scanning ||
      inspectionState === INSPECTION_STATE.STARTING ||
      inspectionState === INSPECTION_STATE.INSPECTING
    )
      return;

    const currentPcbImage =
      pcbImage ||
      (uploadedImage
        ? {
            url: uploadedImage.url,
            uploadId: uploadedImage.uploadId || null,
            name: uploadedImage.name || "Uploaded PCB",
          }
        : null);

    if (!currentPcbImage && !uploadedImage) {
      setActionStatus({
        type: "error",
        text: "Please upload or test with a PCB image before starting inspection.",
      });
      notify({
        type: "error",
        title: "No PCB Image Available",
        message: "Please upload a PCB image before starting an inspection.",
      });
      return;
    }

    if (uploadedImage && !pcbImage) {
      setPcbImage(currentPcbImage);
    }

    setActionStatus(null);
    const payload = uploadedImage?.uploadId
      ? { uploadId: uploadedImage.uploadId }
      : currentPcbImage?.uploadId
        ? { uploadId: currentPcbImage.uploadId }
        : undefined;
    const result = await runInspection(payload);
    if (!result.ok) {
      notify({
        type: "error",
        title: "Unable to start inspection.",
        message: result.message,
      });
      setActionStatus({ type: "error", text: result.message });
    }
  }, [
    scanning,
    inspectionState,
    uploadedImage,
    pcbImage,
    setPcbImage,
    runInspection,
    notify,
  ]);

  const handleFetchResult = useCallback(async () => {
    const result = await refreshInspection();
    if (!result.ok) {
      notify({
        type: "error",
        title: "Unable to load inspection result.",
        message: result.message,
      });
    }
  }, [refreshInspection, notify]);

  const handleFileSelected = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setActionStatus(null);
      const result = await uploadImage(file);
      if (result.ok) {
        // A new image means the previous result no longer applies — clear it
        // so no stale detections/status render on top of the new image, then
        // register the new PCB frame. Inspection stays idle until the user
        // explicitly presses START INSPECTION.
        resetInspection();
        setSelectedComponent(null);
        setPcbImage({
          url: result.result.imageUrl,
          uploadId: result.result.uploadId || null,
          name: file.name,
        });
      } else {
        notify({
          type: "error",
          title: "Unable to upload PCB image.",
          message: result.message,
        });
        setActionStatus({ type: "error", text: result.message });
      }
    },
    [uploadImage, resetInspection, setPcbImage, notify],
  );

  const handleDiscardImage = useCallback(() => {
    clearUpload();
    // Removes the PCB frame: cancels any running scan, resets inspection to
    // idle, and invalidates any in-flight run.
    clearPcbImage();
    setSelectedComponent(null);
    setActionStatus({ type: "success", text: "Uploaded image discarded." });
    notify({
      type: "success",
      title: "Image discarded.",
      message: "Uploaded PCB image removed. Viewport reset.",
    });
  }, [clearUpload, clearPcbImage, notify]);

  const handleGenerateReport = useCallback(async () => {
    if (!inspection) {
      notify({
        type: "error",
        title: "No inspection available.",
        message: "Complete a PCB inspection before generating a report.",
      });
      setActionStatus({
        type: "error",
        text: "Complete a PCB inspection before generating a report.",
      });
      return;
    }
    setActionStatus(null);
    const result = await generateReport(inspection, {
      imageUrl: uploadedImage?.url,
    });
    if (!result.ok) {
      notify({
        type: "error",
        title: "Unable to generate report.",
        message: result.message,
      });
      setActionStatus({ type: "error", text: result.message });
      return;
    }
    setActionStatus({
      type: "success",
      text: `Report ${result.result?.reportId || ""} generated — download started.`,
    });
    notify({
      type: "success",
      title: "Report Generated",
      message: "Inspection report generated successfully.",
    });
  }, [generateReport, inspection, uploadedImage, notify]);

  const handleExportCsv = useCallback(async () => {
    setActionStatus(null);
    const result = await exportCsv();
    if (!result.ok) {
      notify({
        type: "error",
        title: "Unable to export inspection data.",
        message: result.message,
      });
      setActionStatus({ type: "error", text: result.message });
      return;
    }
    setActionStatus({
      type: "success",
      text: `Exported ${result.rows} inspection record(s).`,
    });
  }, [exportCsv, notify]);

  const handleCaptureSnapshot = useCallback(async () => {
    setActionStatus(null);
    const result = await captureSnapshot({
      imageElement: imageRef.current,
      inspection,
    });
    if (!result.ok) {
      notify({
        type: "error",
        title: "Unable to capture snapshot.",
        message: result.message,
      });

      setActionStatus({
        type: "error",
        text: result.message,
      });

      return;
    }

    notify({
      type: "success",
      title: "Snapshot Captured",
      message: `${result.filename} downloaded successfully.`,
    });

    setActionStatus({
      type: "success",
      text: "Snapshot captured successfully.",
    });
  }, [captureSnapshot, inspection, notify]);

  // ---- Derived inspection metrics ------------------------------------------
  const presenceFailures =
    inspection?.verificationDetails?.presence?.filter(
      (p) => p.status === "FAIL",
    ).length || 0;
  const allChecksPass =
    inspection?.verificationDetails?.presence?.every(
      (p) => p.status === "PASS",
    ) &&
    inspection?.verificationDetails?.position?.every(
      (p) => p.status === "PASS",
    ) &&
    inspection?.verificationDetails?.orientation?.every(
      (p) => p.status === "PASS",
    );

  // Backend may report that the uploaded image is not a PCB at all.
  const isNotPcb =
    !!inspection &&
    (inspection.isPcb === false ||
      String(inspection.status || "").toUpperCase() === "NOT_PCB");

  // ---- XAI explanation content ---------------------------------------------
  // Structured XAI payload expected from the backend:
  //   {
  //     defect: "...",         → WHAT'S WRONG?
  //     location: "...",       → WHERE IS IT?
  //     explanation: "...",    → plain-language explanation / pass rationale
  //     recommendation: "...", → HOW TO FIX IT?
  //     visualization: "..."   → image URL for the highlighted region
  //   }
  // The frontend only presents backend-provided text — it never invents
  // defect-specific explanations.
  const xai = inspection?.xai ?? {};
  const isPass = inspection?.status === "PASS";
  const isInspected = inspection?.status === "INSPECTED";
  const isMlPending = inspection?.modelName === "Pending";

  const xaiWhatWrong = isNotPcb
    ? "The uploaded image could not be identified as a valid PCB."
    : isInspected
      ? "YOLO detection completed. X-MCCV verification and XAI analysis are pending."
      : xai.defect ||
        xai.explanation ||
        (typeof inspection?.xaiExplanation === "string"
          ? inspection.xaiExplanation
          : inspection?.xaiExplanation?.explanation ||
            inspection?.xaiExplanation?.class_name ||
            null) ||
        (isPass
          ? "No significant visual defect detected."
          : "The backend flagged this board as defective, but has not provided an explanation yet.");

  const xaiWhyPass = isMlPending
    ? "The ML inspection model has not been integrated yet. This PASS result is a temporary backend state."
    : isPass
      ? xai.explanation ||
        "The inspected component regions and PCB layout appear consistent with the expected visual pattern."
      : "";

  const xaiWhere =
    xai.location ||
    (isInspected
      ? "YOLO detected objects on the board. X-MCCV verification is pending."
      : isMlPending
        ? "Defect location will be available after ML inspection is integrated."
        : "The backend has not provided the affected region yet.");

  const xaiFix = isInspected
    ? "YOLO detection completed. X-MCCV verification and XAI analysis are pending."
    : isMlPending
      ? "No corrective action is available yet. ML-based defect detection will provide the actual recommendation."
      : xai.recommendation ||
        (isPass
          ? "No corrective action required. Board can proceed to the next stage."
          : "Corrective action details are not available from the backend yet. Inspect the highlighted region and rerun the inspection.");

  const xaiVisualUrl =
    inspection?.xai?.overlayUrl ||
    inspection?.xai?.visualization ||
    inspection?.xai?.heatmapUrl ||
    null;
  const cameraBadge = CAMERA_BADGE[cameraStatus.status] || CAMERA_BADGE.UNKNOWN;

  // Bottom status bar presentation per inspection lifecycle state.
  const hudStatus = {
    [INSPECTION_STATE.READY]: { text: "READY", cls: "text-slate-400" },
    [INSPECTION_STATE.STARTING]: { text: "INSPECTING", cls: "text-warning" },
    [INSPECTION_STATE.INSPECTING]: { text: "INSPECTING", cls: "text-warning" },
    [INSPECTION_STATE.ERROR]: { text: "INSPECTION ERROR", cls: "text-danger" },
  }[inspectionState];

  const inspectionButton = scanning
    ? { label: "Inspecting...", icon: RefreshCw, loading: true, disabled: true }
    : {
        [INSPECTION_STATE.READY]: {
          label: "Start Inspection",
          icon: Play,
          loading: false,
          disabled: false,
        },
        [INSPECTION_STATE.STARTING]: {
          label: "Starting...",
          icon: Loader2,
          loading: true,
          disabled: true,
        },
        [INSPECTION_STATE.INSPECTING]: {
          label: "Inspecting...",
          icon: RefreshCw,
          loading: false,
          disabled: false,
        },
        [INSPECTION_STATE.COMPLETED]: {
          label: "Start Inspection",
          icon: Play,
          loading: false,
          disabled: false,
        },
        [INSPECTION_STATE.ERROR]: {
          label: "Retry Inspection",
          icon: Play,
          loading: false,
          disabled: false,
        },
      }[inspectionState] || {
        label: "Start Inspection",
        icon: Play,
        loading: false,
        disabled: false,
      };

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
        {/* ---- HEADER ---- */}
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
              {/* Raspberry Pi connectivity status — separate from camera status */}
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
            {/* CREATE NEW TEMPLATE button — positioned on RHS below LIVE indicator */}
            <div className="lg:ml-auto">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setTemplateImageCount(1);
                  setTemplateModalMessage("");
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

        {/* ---- QUICK ACTIONS ---- */}
        <motion.div variants={itemVariants} className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {/* START INSPECTION */}
            <motion.button
              whileHover={
                inspectionButton.disabled ? undefined : { scale: 1.03, y: -2 }
              }
              whileTap={inspectionButton.disabled ? undefined : { scale: 0.97 }}
              onClick={
                inspectionState === INSPECTION_STATE.INSPECTING
                  ? handleFetchResult
                  : handleStartInspection
              }
              disabled={inspectionButton.disabled}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest shadow-lg transition-all duration-300 ${
                inspectionButton.disabled
                  ? "cursor-not-allowed bg-accent/40 text-primary-bg/70"
                  : "bg-accent text-primary-bg hover:shadow-[0_0_30px_rgba(50,213,131,0.25)]"
              }`}
            >
              <inspectionButton.icon
                className={`h-3.5 w-3.5 ${inspectionButton.loading ? "animate-spin" : ""}`}
              />
              {inspectionButton.label}
            </motion.button>

            {/* TEST WITH PCB IMAGE — secondary/testing path via the existing local upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelected}
            />
            <motion.button
              whileHover={uploadLoading ? undefined : { scale: 1.03, y: -2 }}
              whileTap={uploadLoading ? undefined : { scale: 0.97 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading}
              className={`group inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-sm transition-all duration-300 ${
                uploadLoading
                  ? "cursor-not-allowed border-accent/10 bg-white/[0.02] text-slate-600"
                  : "border-accent/20 bg-white/[0.03] text-white/80 hover:border-accent/40 hover:bg-accent/5 hover:text-white hover:shadow-[0_0_20px_rgba(50,213,131,0.1)]"
              }`}
            >
              {uploadLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              )}
              {uploadLoading ? "Uploading..." : "Test with PCB Image"}
            </motion.button>

            {/* DISCARD UPLOADED IMAGE */}
            {uploadedImage && (
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDiscardImage}
                className="group inline-flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/[0.06] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-danger/90 backdrop-blur-sm transition-all duration-300 hover:border-danger/50 hover:bg-danger/10 hover:text-danger hover:shadow-[0_0_20px_rgba(255,77,109,0.1)]"
              >
                <X className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
                Discard Image
              </motion.button>
            )}
          </div>

          {/* Secondary utility actions */}
          <div className="flex flex-wrap items-center gap-3 border-t border-accent/5 pt-3">
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-slate-600">
              <Wrench className="h-3 w-3" />
              Utilities
            </span>

            {/* GENERATE REPORT */}
            <motion.button
              whileHover={
                generating || !inspection ? undefined : { scale: 1.03, y: -2 }
              }
              whileTap={generating || !inspection ? undefined : { scale: 0.97 }}
              onClick={handleGenerateReport}
              disabled={generating}
              className={`group inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-sm transition-all duration-300 ${
                generating || !inspection
                  ? "cursor-not-allowed border-accent/10 bg-white/[0.02] text-slate-600"
                  : "border-accent/20 bg-white/[0.03] text-white/80 hover:border-accent/40 hover:bg-accent/5 hover:text-white hover:shadow-[0_0_20px_rgba(50,213,131,0.1)]"
              }`}
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              )}
              {generating ? "GENERATING REPORT..." : "Generate Report"}
            </motion.button>

            {/* EXPORT CSV */}
            <motion.button
              whileHover={exporting ? undefined : { scale: 1.03, y: -2 }}
              whileTap={exporting ? undefined : { scale: 0.97 }}
              onClick={handleExportCsv}
              disabled={exporting}
              className={`group inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-sm transition-all duration-300 ${
                exporting
                  ? "cursor-not-allowed border-accent/10 bg-white/[0.02] text-slate-600"
                  : "border-accent/20 bg-white/[0.03] text-white/80 hover:border-accent/40 hover:bg-accent/5 hover:text-white hover:shadow-[0_0_20px_rgba(50,213,131,0.1)]"
              }`}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              )}
              {exporting ? "Exporting..." : "Export CSV"}
            </motion.button>

            {/* CAPTURE SNAPSHOT */}
            <motion.button
              whileHover={capturing ? undefined : { scale: 1.03, y: -2 }}
              whileTap={capturing ? undefined : { scale: 0.97 }}
              onClick={handleCaptureSnapshot}
              disabled={capturing}
              className={`group inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-sm transition-all duration-300 ${
                capturing
                  ? "cursor-not-allowed border-accent/10 bg-white/[0.02] text-slate-600"
                  : "border-accent/20 bg-white/[0.03] text-white/80 hover:border-accent/40 hover:bg-accent/5 hover:text-white hover:shadow-[0_0_20px_rgba(50,213,131,0.1)]"
              }`}
            >
              {capturing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Image className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              )}
              {capturing ? "Capturing..." : "Capture Snapshot"}
            </motion.button>
          </div>

          {/* Action result / error line — reflects the real API response */}
          <AnimatePresence>
            {actionStatus && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`font-mono text-[10px] tracking-wide ${actionStatus.type === "error" ? "text-danger" : "text-accent"}`}
              >
                {actionStatus.text}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ---- KPI CARDS (backend-driven) ---- */}
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
                trend: "+1.8%",
                up: true,
                sparkColor: "#32d583",
              },
              {
                title: "Pass Rate",
                value: stats.today.passRate,
                suffix: "%",
                icon: CheckCircle,
                trend: "+2.1%",
                up: true,
                sparkColor: "#32d583",
              },
              {
                title: "Failed Boards",
                value: stats.today.fail,
                icon: AlertTriangle,
                trend: "-4.2%",
                up: false,
                sparkColor: "#ff4d6d",
              },
              {
                title: "Avg Inspection Time",
                value: stats.today.avgCycleTime,
                decimals: 2,
                suffix: "s",
                icon: Clock,
                trend: "-1.5%",
                up: true,
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
                        {card.decimals
                          ? card.value.toFixed(card.decimals)
                          : card.value}
                      </span>
                      {card.suffix && (
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
                  <span
                    className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${card.up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
                  >
                    {card.up ? "↑" : "↓"} {card.trend}
                  </span>
                  <div className="h-6 w-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklineData}>
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
        ) : (
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-[92px] rounded-xl" />
            ))}
          </motion.div>
        )}

        {/* ---- INSPECTION RESULTS OVERVIEW ---- */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between border-b border-accent/5 pb-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Recent Inspection Results
              </span>
            </div>
            <a href="/history" className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-accent hover:text-white transition-colors">
              <ExternalLink className="w-3 h-3" />
              View All
            </a>
          </div>
          {historyLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shimmer h-24 rounded-lg" />
              ))}
            </div>
          ) : recentInspections.length === 0 ? (
            <div className="py-8 text-center">
              <History className="w-10 h-10 mx-auto text-slate-600" />
              <p className="mt-2 font-mono text-[10px] text-slate-500 uppercase tracking-widest">No Inspection History</p>
              <p className="mt-1 font-mono text-[9px] text-slate-600">Complete an inspection to see results here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentInspections.map((record) => (
                <GlassCard key={record.id} hoverLift={false} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold text-white truncate">{record.pcbId || record.id}</p>
                      <p className="font-mono text-[8px] text-slate-500 mt-0.5">{new Date(record.scanDateTime).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[7px] font-mono font-bold uppercase tracking-wider ${
                        record.status === "PASS" ? "bg-success/15 text-success border border-success/30" :
                        record.status === "FAIL" ? "bg-danger/15 text-danger border border-danger/30" :
                        "bg-warning/15 text-warning border border-warning/30"
                      }`}>
                        {record.status || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] font-mono">
                    <span className="text-slate-400">Defect: <span className={`text-white ${record.defectClass && record.defectClass !== "None" ? "text-warning" : "text-success"}`}>{record.defectClass || "None"}</span></span>
                    <span className="text-slate-400">Conf: <span className="text-accent">{record.yoloConfidence ? `${record.yoloConfidence.toFixed(1)}%` : "—"}</span></span>
                    <span className="text-slate-400">Time: <span className="text-[#00E5FF]">{record.cycleTime ? `${record.cycleTime}s` : "—"}</span></span>
                  </div>
                  <button
                    onClick={() => navigate(`/history`)}
                    className="mt-2 w-full text-[9px] font-mono font-bold uppercase tracking-wider text-accent hover:text-white transition-colors"
                  >
                    View Details →
                  </button>
                </GlassCard>
              ))}
            </div>
          )}
        </motion.div>

        {/* ---- PRIMARY INSPECTION GRID: LIVE VIEWPORT + XAI ANALYSIS ---- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[61fr_39fr] items-start">
          {/* ---- LEFT: INSPECTION STATUS ---- */}
          <motion.div variants={itemVariants} className="space-y-4">
            <GlassCard className="flex flex-col" hoverLift={false}>
              {/* Camera header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/5 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-accent" />
                  <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Inspection Status
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Summary control — switches the panel between status view and summary */}
                  <button
                    onClick={() => setSummaryView(!summaryView)}
                    disabled={!inspection}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider transition-all ${
                      !inspection
                        ? "cursor-not-allowed text-slate-700"
                        : summaryView
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "border border-accent/10 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <Info className="h-3 w-3" />
                    {summaryView ? "Live View" : "Summary"}
                  </button>
                  {/* Camera status badge — status indicator, not a button */}
                  <div
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-display font-bold uppercase tracking-wider select-none ${cameraBadge.cls}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${cameraBadge.dot}`}
                    />
                    {cameraBadge.label}
                  </div>
                </div>
              </div>

              {/* Viewport (camera monitor) */}
              <div className="relative my-3 flex h-[360px] md:h-[400px] xl:h-[440px] w-full items-center justify-center overflow-hidden rounded-xl border border-accent/5 bg-black/95">
                {/* Grid */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(50,213,131,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(50,213,131,0.05) 1px, transparent 1px)",
                    backgroundSize: "30px 30px",
                  }}
                />

                {/* Camera HUD - Top left */}
                <div className="absolute left-3 top-3 z-20 flex items-center gap-3 rounded-lg bg-black/70 border border-accent/10 px-2.5 py-1.5 font-mono text-[9px] backdrop-blur-sm">
                  <span
                    className={`flex items-center gap-1.5 ${cameraStatus.connected ? "text-success" : "text-danger"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${cameraBadge.dot}`}
                    />
                    INSPECTION CAM
                  </span>
                  <span className="text-accent">
                    {cameraBadge.label.toUpperCase()}
                  </span>
                </div>

                {/* Summary view — switches the viewport content */}
                {summaryView ? (
                  inspection ? (
                    <div className="absolute inset-0 z-20 overflow-y-auto rounded-xl bg-black/95 p-4">
                      <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-accent">
                        Inspection Summary
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                        {[
                          {
                            label: "Components",
                            value: inspection.componentsCount,
                            color: "text-white",
                          },
                          {
                            label: "Detected",
                            value: inspection.detections.length,
                            color: "text-success",
                          },
                          {
                            label: "Missing",
                            value: presenceFailures,
                            color: presenceFailures
                              ? "text-danger"
                              : "text-success",
                          },
                          {
                            label: "Orient. Err.",
                            value:
                              inspection.verificationDetails.orientation.filter(
                                (o) => o.status === "FAIL",
                              ).length,
                            color: "text-success",
                          },
                          {
                            label: "X-MCCV",
                            value: allChecksPass ? "100%" : "0%",
                            color: "text-accent",
                          },
                          {
                            label: "Confidence",
                            value: formatConfidence(inspection.confidence),
                            color: "text-accent",
                          },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className="flex items-center justify-between border-b border-accent/[0.04] py-0.5"
                          >
                            <span className="text-[8px] font-mono text-slate-500">
                              {s.label}
                            </span>
                            <span
                              className={`font-mono text-[9px] font-bold ${s.color || "text-white"}`}
                            >
                              {s.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-accent/10 pt-2">
                        {inspectionTimeline.map((step) => {
                          const Icon = step.icon;
                          return (
                            <div
                              key={step.step}
                              className="flex flex-col items-center gap-0.5"
                            >
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.done === null ? "border-accent/30 bg-accent/10" : step.done ? "border-success/30 bg-success/10" : "border-slate-700 bg-slate-800"}`}
                              >
                                <Icon
                                  className={`h-2.5 w-2.5 ${step.done === null ? "text-accent" : step.done ? "text-success" : "text-slate-500"}`}
                                />
                              </div>
                              <span className="font-mono text-[6px] text-slate-500">
                                {step.step}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/95">
                      <span className="font-mono text-[10px] tracking-[0.3em] text-slate-500 uppercase font-bold">
                        No inspection result to summarize
                      </span>
                    </div>
                  )
                ) : (
                  <>
                    {/* Empty state — ready for inspection */}
                    {!scanning && !inspection && !uploadedImage && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
                        <span className="font-mono text-[11px] tracking-[0.3em] text-slate-400 uppercase font-bold">
                          Ready for inspection
                        </span>
                        <span className="font-mono text-[9px] text-slate-600">
                          Start an inspection to capture and analyze a PCB.
                        </span>
                      </div>
                    )}

                    {/* Uploaded image — image only, no overlay until a real inspection result exists */}
                    {!scanning && !inspection && uploadedImage && (
                      <div className="absolute inset-x-0 bottom-10 z-10 flex justify-center">
                        <span className="rounded-lg border border-accent/10 bg-black/70 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400 backdrop-blur-sm">
                          Awaiting inspection — press Start Inspection
                        </span>
                      </div>
                    )}

                    {/* Inspection error overlay — reflects the shared inspection store */}
                    {!scanning && inspectionError && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm">
                        <AlertTriangle className="h-6 w-6 text-danger" />
                        <span className="font-mono text-[10px] tracking-[0.3em] text-danger uppercase font-bold">
                          Inspection Error
                        </span>
                        <span className="max-w-[60%] text-center font-mono text-[9px] text-slate-400">
                          Press Start Inspection to retry local image analysis.
                        </span>
                      </div>
                    )}

                    {/* Image container — PCB frame + aligned overlay layers.
                          Rendered during the scan too so the scan line always
                          sweeps the visible PCB area. */}
                    {(uploadedImage || inspection || scanning) && (
                      <div className="relative z-[5] flex h-full w-full items-center justify-center">
                        <div
                          className="relative w-full max-h-full"
                          style={{ aspectRatio: imageAspect }}
                        >
                          {uploadedImage ? (
                            <img
                              ref={imageRef}
                              crossOrigin="anonymous"
                              src={uploadedImage.url}
                              alt={`Uploaded PCB: ${uploadedImage.name}`}
                              onLoad={handleImageLoad}
                              className="block h-full w-full object-contain"
                            />
                          ) : (
                            <svg
                              className="block h-full w-full opacity-70"
                              viewBox="0 0 600 400"
                              preserveAspectRatio="xMidYMid meet"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <rect
                                x="30"
                                y="20"
                                width="540"
                                height="360"
                                rx="12"
                                stroke="#32d583"
                                strokeWidth="1.5"
                                opacity="0.5"
                              />
                              <circle
                                cx="55"
                                cy="45"
                                r="6"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <circle
                                cx="545"
                                cy="45"
                                r="6"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <circle
                                cx="55"
                                cy="355"
                                r="6"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <circle
                                cx="545"
                                cy="355"
                                r="6"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <rect
                                x="220"
                                y="120"
                                width="160"
                                height="160"
                                rx="4"
                                stroke="#32d583"
                                strokeWidth="1.5"
                                opacity="0.6"
                              />
                              <circle
                                cx="300"
                                cy="200"
                                r="35"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <circle
                                cx="220"
                                cy="120"
                                r="3"
                                fill="#32d583"
                                opacity="0.6"
                              />
                              <path
                                d="M380 200h80M140 200h-40M300 120V80M300 320v40"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.3"
                              />
                              <path
                                d="M220 160H140M460 240h40"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.3"
                              />
                              <rect
                                x="70"
                                y="60"
                                width="35"
                                height="50"
                                rx="3"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.5"
                              />
                              <rect
                                x="70"
                                y="290"
                                width="35"
                                height="50"
                                rx="3"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.5"
                              />
                              <rect
                                x="495"
                                y="60"
                                width="35"
                                height="50"
                                rx="3"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.5"
                              />
                              <rect
                                x="120"
                                y="70"
                                width="20"
                                height="8"
                                rx="1"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <rect
                                x="120"
                                y="85"
                                width="20"
                                height="8"
                                rx="1"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <rect
                                x="460"
                                y="290"
                                width="20"
                                height="8"
                                rx="1"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.4"
                              />
                              <rect
                                x="200"
                                y="350"
                                width="200"
                                height="30"
                                rx="3"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.5"
                              />
                              <line
                                x1="220"
                                y1="365"
                                x2="220"
                                y2="380"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.3"
                              />
                              <line
                                x1="260"
                                y1="365"
                                x2="260"
                                y2="380"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.3"
                              />
                              <line
                                x1="300"
                                y1="365"
                                x2="300"
                                y2="380"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.3"
                              />
                              <line
                                x1="340"
                                y1="365"
                                x2="340"
                                y2="380"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.3"
                              />
                              <line
                                x1="380"
                                y1="365"
                                x2="380"
                                y2="380"
                                stroke="#32d583"
                                strokeWidth="1"
                                opacity="0.3"
                              />
                              <text
                                x="222"
                                y="115"
                                fill="#32d583"
                                fontSize="7"
                                fontFamily="monospace"
                                opacity="0.6"
                              >
                                U1
                              </text>
                              <text
                                x="72"
                                y="55"
                                fill="#32d583"
                                fontSize="6"
                                fontFamily="monospace"
                                opacity="0.5"
                              >
                                C12
                              </text>
                              <text
                                x="72"
                                y="285"
                                fill="#32d583"
                                fontSize="6"
                                fontFamily="monospace"
                                opacity="0.5"
                              >
                                C13
                              </text>
                              <text
                                x="122"
                                y="65"
                                fill="#32d583"
                                fontSize="5"
                                fontFamily="monospace"
                                opacity="0.4"
                              >
                                R8
                              </text>
                            </svg>
                          )}

                          {/* Non-PCB result — show the verdict after the
                                scan finishes, never fake detections */}
                          {!scanning && isNotPcb ? (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/40">
                              <span className="font-mono text-[11px] tracking-[0.3em] text-danger uppercase font-bold">
                                Not a PCB
                              </span>
                              <span className="max-w-[70%] text-center font-mono text-[9px] text-slate-400">
                                Uploaded image could not be identified as a
                                valid PCB.
                              </span>
                            </div>
                          ) : (
                            <>
                              {/* Grad-CAM overlay — deferred until the trained ML model
                                    and XAI pipeline are connected. Only real backend
                                    heatmap data will ever render here. */}

                              {/* YOLO detection boxes — only when the backend returned real detections */}
                              <AnimatePresence>
                                {inspection &&
                                  !summaryView &&
                                  inspection.detections?.length > 0 &&
                                  inspection.detections.map((det, idx) => {
                                    const boxStyle = getBboxStyle(
                                      det.bbox,
                                      imageDims,
                                    );
                                    const labelName =
                                      det.className ||
                                      det.label ||
                                      det.class_name ||
                                      det.id ||
                                      `Det ${idx + 1}`;
                                    const confText = formatConfidence(
                                      det.confidence,
                                    );
                                    return (
                                      <motion.div
                                        key={det.id || idx}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.4 }}
                                        className="absolute border-2 border-accent bg-accent/10 rounded cursor-pointer z-10 font-mono text-[9px] text-accent font-bold"
                                        style={boxStyle}
                                        onClick={() =>
                                          handleComponentClick(det)
                                        }
                                      >
                                        <span className="absolute -top-4 left-0 font-mono text-[8px] text-primary-bg font-bold bg-accent px-1 rounded whitespace-nowrap shadow">
                                          {labelName}{" "}
                                          {confText !== "—" ? confText : ""}
                                        </span>
                                      </motion.div>
                                    );
                                  })}
                              </AnimatePresence>
                            </>
                          )}

                          {/* Sequential AOI scan animation — same shared component and state as the
                                PCB Inspection page. Rendered only while a PCB
                                image exists AND a scan is actually running. */}
                          {scanning && pcbImage && (
                            <ScanningOverlay phase={scanPhase} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bottom HUD — state driven */}
                    <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between gap-2 rounded-lg bg-black/80 border border-accent/15 px-3 py-1.5 font-mono text-[9px] backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">Board:</span>
                        <span className="font-bold text-white">
                          {inspection?.pcbId || "—"}
                        </span>
                        {(inspection?.inspectionTime != null ||
                          inspection?.cycleTime != null) && (
                          <>
                            <span className="text-slate-600">|</span>
                            <span className="text-slate-500">
                              Time:{" "}
                              <span className="text-white">
                                {inspection.inspectionTime ??
                                  inspection.cycleTime}
                                s
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {hudStatus ? (
                          <span
                            className={`font-bold uppercase tracking-wider ${hudStatus.cls}`}
                          >
                            {hudStatus.text}
                          </span>
                        ) : (
                          <StatusBadge status={inspection?.status} />
                        )}
                        {inspection?.detections && (
                          <span className="text-slate-500">
                            Detections:{" "}
                            <span className="text-white">
                              {inspection.detections.length}
                            </span>
                          </span>
                        )}
                        <span className="text-slate-500">
                          Conf:{" "}
                          <span className="text-white">
                            {inspection?.confidence != null
                              ? formatConfidence(inspection.confidence)
                              : "—"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>

            {/* ---- COMPONENT DETAIL DRAWER ---- */}
            <AnimatePresence>
              {selectedComponent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <GlassCard hoverLift={false}>
                    <div className="flex items-center justify-between border-b border-accent/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-[9px] font-bold text-success">
                          {selectedComponent.name.charAt(0)}
                        </span>
                        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white">
                          {selectedComponent.name}
                        </span>
                        {selectedComponent.status && (
                          <StatusBadge status={selectedComponent.status} />
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedComponent(null)}
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {selectedComponent.confidence !== undefined &&
                    selectedComponent.reason !== undefined ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-slate-500">Confidence</span>
                            <span className="text-accent font-bold">
                              {selectedComponent.confidence}%
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-slate-500">Reason</span>
                            <span className="text-slate-300 text-right max-w-[140px]">
                              {selectedComponent.reason}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-accent/5 bg-[#050816]/40 p-2.5">
                          <p className="text-[8px] font-mono text-slate-500 mb-1.5">
                            X-MCCV Verification
                          </p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            {[
                              {
                                label: "Presence",
                                pass: selectedComponent.presence,
                              },
                              {
                                label: "Position",
                                pass: selectedComponent.position,
                              },
                              {
                                label: "Orientation",
                                pass: selectedComponent.orientation,
                              },
                              { label: "Count", pass: selectedComponent.count },
                            ].map((v) => (
                              <div
                                key={v.label}
                                className="flex items-center gap-1.5 font-mono text-[9px]"
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${v.pass ? "bg-success" : "bg-danger"}`}
                                />
                                <span className="text-slate-400">
                                  {v.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 font-mono text-[10px] text-slate-500">
                        No verification details available for this component.
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ---- RIGHT COLUMN: XAI ANALYSIS (Top) + MCCV / X-MCCV VERIFICATION (Beneath XAI) ---- */}
          <motion.div variants={itemVariants} className="space-y-4">
            {/* Top: XAI Inspection Analysis */}
            <XAIExplanationPanel
              inspection={inspection}
              xai={inspection?.xai}
              isPass={inspection?.status === "PASS"}
              isNotPcb={inspection?.isPcb === false || String(inspection?.status || "").toUpperCase() === "NOT_PCB"}
              isMlPending={inspection?.modelName === "Pending"}
              isInspected={inspection?.status === "INSPECTED"}
              xaiVisualUrl={inspection?.xai?.overlay_path || inspection?.xai?.heatmap_path || inspection?.xai?.visualization || null}
            />

            {/* Dedicated MCCV / X-MCCV Result Card beneath XAI */}
            <XMCCVResultsPanel
              inspection={inspection}
            />
          </motion.div>
        </div>

        {/* ---- FULL-WIDTH RESULTS ROW (4 Cards Side by Side) ---- */}
        <motion.div variants={itemVariants} className="space-y-3 mt-6">
          <div className="flex items-center justify-between border-b border-accent/5 pb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Inspection Verification & Detailed Findings
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 items-stretch">
            {/* 1. Heatmap Visualization */}
            <HeatmapPanel
              inspection={inspection}
            />

            {/* 2. XAI Explanation */}
            <XAIExplanationPanel
              inspection={inspection}
              xai={inspection?.xai}
              isPass={inspection?.status === "PASS"}
              isNotPcb={inspection?.isPcb === false || String(inspection?.status || "").toUpperCase() === "NOT_PCB"}
              isMlPending={inspection?.modelName === "Pending"}
              isInspected={inspection?.status === "INSPECTED"}
              xaiVisualUrl={inspection?.xai?.overlay_path || inspection?.xai?.heatmap_path || inspection?.xai?.visualization || null}
            />

            {/* 3. ODC Results */}
            <ODCResultsPanel
              inspection={inspection}
            />

            {/* 4. Final Inspection Decision */}
            <InspectionDecisionPanel
              inspection={inspection}
              onGenerateReport={handleGenerateReport}
              onExport={handleExportCsv}
            />
          </div>
        </motion.div>
      </motion.main>
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
      <Modal
        isOpen={showCreateTemplateModal}
        onClose={() => setShowCreateTemplateModal(false)}
        title="Create New Template"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-300">
            Capture reference images to create a PCB component template.
          </p>
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
              className="w-full rounded-lg border border-accent/20 bg-white/[0.02] px-4 py-2.5 text-white placeholder:text-slate-500 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </div>
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
              min="1"
              value={templateImageCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  setTemplateImageCount(val);
                }
              }}
              className="w-full rounded-lg border border-accent/20 bg-white/[0.02] px-4 py-2.5 text-white placeholder:text-slate-500 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="template-reference-images"
              className="block font-mono text-[10px] uppercase tracking-wider text-slate-400"
            >
              Select Reference Images
            </label>

            <input
              id="template-reference-images"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setTemplateReferenceImages(files);
                setTemplateImageCount(files.length || 1);
                e.target.value = "";
                setTemplateModalMessage("");
              }}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-accent/15 file:px-3 file:py-2 file:text-accent"
            />

            <p className="text-xs text-slate-400">
              Selected: {templateReferenceImages.length} image(s)
            </p>
          </div>

          {templateModalMessage && (
            <p className="text-sm text-accent font-mono">
              {templateModalMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-accent/10">
            <button
              onClick={() => {
                setShowCreateTemplateModal(false);
                setTemplateModalMessage("");
                setTemplateName("");
                setTemplateReferenceImages([]);
                setTemplateImageCount(1);
              }}
              disabled={isCreatingTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/20 bg-white/[0.03] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/80 transition-all hover:border-accent/40 hover:bg-accent/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!templateName.trim()) {
                  setTemplateModalMessage("Please enter a template name.");
                  return;
                }
                if (!templateReferenceImages.length) {
                  setTemplateModalMessage(
                    "Please select at least one reference image.",
                  );
                  return;
                }
                if (templateReferenceImages.length !== templateImageCount) {
                  setTemplateModalMessage(
                    `Image count mismatch: expected ${templateImageCount}, selected ${templateReferenceImages.length}.`,
                  );
                  return;
                }

                setIsCreatingTemplate(true);
                setTemplateModalMessage("");

                try {
                  const result = await uploadApi.createTemplate({
                    templateName,
                    expectedImages: templateImageCount,
                    referenceImages: templateReferenceImages,
                  });

                  setTemplateModalMessage(
                    `Template "${templateName}" created successfully! (ID: ${result.template_id})`,
                  );

                  // Clear form on success
                  setTemplateName("");
                  setTemplateReferenceImages([]);
                  setTemplateImageCount(1);

                  // Close modal after a short delay to show success message
                  setTimeout(() => {
                    setShowCreateTemplateModal(false);
                    setTemplateModalMessage("");
                  }, 2000);
                } catch (err) {
                  setTemplateModalMessage(
                    err.message ||
                      "Template creation failed. Please try again.",
                  );
                } finally {
                  setIsCreatingTemplate(false);
                }
              }}
              disabled={isCreatingTemplate}
              className="inline-flex items-center gap-2 rounded-lg bg-accent/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-accent border border-accent/30 transition-all hover:bg-accent/25 hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingTemplate ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
