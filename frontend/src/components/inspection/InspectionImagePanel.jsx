import { useState, useRef, useEffect } from "react";
import { Search, Maximize, Minimize, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import GlassCard from "../cards/GlassCard";
import { formatConfidence, getBboxStyle } from "../../utils/formatters";
import { motion, AnimatePresence } from "framer-motion";

export default function InspectionImagePanel({
  inspection,
  pcbImage,
  uploadedImage,
  imageDims,
  scanPhase,
  scanning,
  selectedDetection,
  onDetectionClick,
  showAnnotations = true,
  className = "",
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  const currentImage = pcbImage || uploadedImage;
  const imageUrl = currentImage?.url;
  const imageName = currentImage?.name || "PCB Image";
  const hasInspection = !!inspection;
  const hasDetections = inspection?.detections?.length > 0;
  const isNotPcb = inspection?.isPcb === false || String(inspection?.status || "").toUpperCase() === "NOT_PCB";

  const handleWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.25, Math.min(5, prev + delta)));
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;

    const onMouseMove = (moveEvent) => {
      setPan({ x: moveEvent.clientX - startX, y: moveEvent.clientY - startY });
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const detections = inspection?.detections || [];
  const detectionImageUrl = inspection?.detection_image || inspection?.detectionImage;

  if (!imageUrl && !scanning && !hasInspection) {
    return (
      <GlassCard className={`flex flex-col h-full ${className}`} hoverLift={false}>
        <div className="flex items-center justify-between border-b border-accent/5 pb-2.5">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-accent" />
            <span className="font-display text-[10px] tracking-widest text-[#9ca3af] uppercase font-bold">
              PCB Capture / Inspection View
            </span>
          </div>
          <span className="rounded border border-accent/15 bg-[#050816] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-slate-500">
            Awaiting Image
          </span>
        </div>
        <div className="relative bg-black/60 rounded-lg overflow-hidden border border-accent/5 my-2.5 w-full flex-1 flex items-center justify-center min-h-[260px] md:min-h-[320px] aspect-[16/10]">
          <div className="flex flex-col items-center gap-2.5 text-center p-6">
            <Search className="w-8 h-8 text-slate-600" />
            <h3 className="font-display text-sm font-bold text-slate-300">Ready for Inspection</h3>
            <p className="font-mono text-[10px] text-slate-500">Capture a PCB image to begin</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const imageAspect = imageDims ? `${imageDims.width} / ${imageDims.height}` : "600 / 400";

  return (
    <GlassCard className={`flex flex-col h-full ${className}`} hoverLift={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-accent" />
          <span className="font-display text-[10px] tracking-widest text-[#9ca3af] uppercase font-bold">
            {hasInspection ? "Inspection View" : "PCB Capture"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasInspection && (
            <span className="rounded border border-accent/15 bg-[#050816] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-accent">
              Inspection Complete
            </span>
          )}
          <button
            onClick={resetView}
            disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
            className="p-1 rounded border border-accent/10 bg-[#050816] text-slate-400 hover:text-white hover:border-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
            disabled={zoom <= 0.25}
            className="p-1 rounded border border-accent/10 bg-[#050816] text-slate-400 hover:text-white hover:border-accent/30 transition-colors disabled:opacity-50"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(Math.min(5, zoom + 0.25))}
            disabled={zoom >= 5}
            className="p-1 rounded border border-accent/10 bg-[#050816] text-slate-400 hover:text-white hover:border-accent/30 transition-colors disabled:opacity-50"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded border border-accent/10 bg-[#050816] text-slate-400 hover:text-white hover:border-accent/30 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden border border-accent/5 my-2.5 w-full flex-1 flex items-center justify-center min-h-[260px] md:min-h-[320px] max-h-[440px] aspect-[16/10]" ref={containerRef} onWheel={handleWheel}>
        <div
          className="relative w-full max-h-full transition-transform duration-100"
          style={{
            aspectRatio: imageAspect,
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: "center center",
            cursor: zoom > 1 ? "grab" : "default",
          }}
          onMouseDown={handleMouseDown}
        >
          {imageUrl ? (
            <img
              ref={imageRef}
              crossOrigin="anonymous"
              src={imageUrl}
              alt={`PCB: ${imageName}`}
              className="block h-full w-full object-contain"
            />
          ) : (
            <svg className="block h-full w-full opacity-70" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="30" y="20" width="540" height="360" rx="12" stroke="#32d583" strokeWidth="1.5" opacity="0.5" />
              <circle cx="55" cy="45" r="6" stroke="#32d583" strokeWidth="1" opacity="0.4" />
              <circle cx="545" cy="45" r="6" stroke="#32d583" strokeWidth="1" opacity="0.4" />
              <circle cx="55" cy="355" r="6" stroke="#32d583" strokeWidth="1" opacity="0.4" />
              <circle cx="545" cy="355" r="6" stroke="#32d583" strokeWidth="1" opacity="0.4" />
              <rect x="220" y="120" width="160" height="160" rx="4" stroke="#32d583" strokeWidth="1.5" opacity="0.6" />
              <circle cx="300" cy="200" r="35" stroke="#32d583" strokeWidth="1" opacity="0.4" />
            </svg>
          )}

          {showAnnotations && hasInspection && hasDetections && !scanning && !isNotPcb && (
            <AnimatePresence>
              {detections.map((det, idx) => {
                const boxStyle = getBboxStyle(det.bbox, imageDims);
                const labelName = det.className || det.label || det.class_name || det.id || `Det ${idx + 1}`;
                const confText = formatConfidence(det.confidence);
                const isSelected = selectedDetection?.id === (det.id || idx);
                return (
                  <motion.div
                    key={det.id || idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`absolute border-2 rounded cursor-pointer z-10 font-mono text-[9px] font-bold ${
                      isSelected ? "border-accent bg-accent/20 shadow-[0_0_12px_rgba(50,213,131,0.4)]" : "border-accent bg-accent/10"
                    }`}
                    style={boxStyle}
                    onClick={() => onDetectionClick?.(det, idx)}
                  >
                    <span className="absolute -top-5 left-0 font-mono text-[8px] text-primary-bg font-bold bg-accent px-1 rounded whitespace-nowrap shadow">
                      {labelName} {confText !== "—" ? confText : ""}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {scanning && imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
              <div className="flex flex-col items-center gap-3 text-white">
                <div className="h-8 w-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span className="font-mono text-xs uppercase tracking-widest">Scanning PCB...</span>
              </div>
            </div>
          )}

          {!scanning && hasInspection && isNotPcb && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/60">
              <span className="font-mono text-[11px] tracking-[0.3em] text-danger uppercase font-bold">Not a PCB</span>
              <span className="max-w-[70%] text-center font-mono text-[9px] text-slate-400">Uploaded image could not be identified as a valid PCB.</span>
            </div>
          )}

          {!scanning && hasInspection && !hasDetections && !isNotPcb && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/40">
              <span className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase font-bold">No Detections</span>
              <span className="max-w-[70%] text-center font-mono text-[9px] text-slate-600">YOLO model returned no component detections.</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between gap-2 rounded-lg bg-black/80 border border-accent/15 px-3 py-1.5 font-mono text-[9px] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-slate-500">Board:</span>
            <span className="font-bold text-white">{inspection?.pcbId || inspection?.board_id || "—"}</span>
            {(inspection?.inspectionTime != null || inspection?.cycleTime != null) && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">Time: <span className="text-white">{inspection.inspectionTime ?? inspection.cycleTime}s</span></span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-bold uppercase tracking-wider ${inspection?.status === "PASS" ? "text-success" : inspection?.status === "FAIL" ? "text-danger" : "text-warning"}`}>
              {inspection?.status || "—"}
            </span>
            {inspection?.detections && (
              <span className="text-slate-500">Detections: <span className="text-white">{inspection.detections.length}</span></span>
            )}
            <span className="text-slate-500">Zoom: <span className="text-white">{(zoom * 100).toFixed(0)}%</span></span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-md border border-accent/10 bg-[#050816]/50">
        <span className="font-mono text-[10px] text-slate-400">PCB ID: <span className="text-white">{inspection?.board_id ?? inspection?.pcbId ?? "—"}</span></span>
        <span className="font-mono text-[10px] text-slate-400">Detections: <span className="text-white">{detections.length}</span></span>
        <span className="font-mono text-[10px] text-slate-400">Status: <span className={`text-white ${inspection?.status === "PASS" ? "text-success" : inspection?.status === "FAIL" ? "text-danger" : ""}`}>{inspection?.status ?? "Awaiting inspection"}</span></span>
      </div>
    </GlassCard>
  );
}