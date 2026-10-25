import { useScanProgress } from "../../hooks/useInspection";

// Shared AOI scanning overlay. Rendered INSIDE the PCB frame container so the
// scan line always matches the exact displayed PCB bounds — works for any
// image size, aspect ratio or resolution (camera or uploaded).
//
// Purely visual and purely sequential:
//   phase = "horizontal" → single horizontal line sweeps TOP → BOTTOM
//   phase = "vertical"   → single vertical line sweeps LEFT → RIGHT
//
// The scan timeline is now CSS-driven: a continuous @keyframes loop runs while
// the animation is enabled. Animation is started/stopped by toggling the
// `scan-running` CSS class on the overlay container, controlled from the
// inspection state. No requestAnimationFrame timers needed.
//
// The scan line clips to the image viewport and does not spill into surrounding UI.
// Uses neon-green glow effect consistent with PCBVisual brand colors.
export default function ScanningOverlay({ phase }) {
  const progress = useScanProgress();

  // Determine if animation should be running based on inspection state.
  // Animation runs while inspection is STARTING or INSPECTING.
  // It stops when result arrives (COMPLETED/ERROR) or inspection is reset.
  const isRunning =
    progress !== undefined &&
    (progress > 0 || phase !== "idle");

  const localProgress =
    phase === "horizontal"
      ? progress * 2
      : (progress - 50) * 2;

  const line = Math.min(100, Math.max(0, localProgress));

  const overlayClass = isRunning ? "scan-overlay running" : "scan-overlay paused";

  return (
    <div
      data-scanning-overlay
      className={`pointer-events-none absolute inset-0 z-[10] ${overlayClass}`}
    >
      {/* Phase 1: horizontal scan line — TOP → BOTTOM. */}
      {phase === "horizontal" && (
        <div
          data-scan-axis="h"
          className="scan-axis-h z-[11]"
        >
          <div data-scan-line="h" className="scan-line-h" />
        </div>
      )}

      {/* Phase 2: vertical scan line — LEFT → RIGHT. */}
      {phase === "vertical" && (
        <div
          data-scan-axis="v"
          className="scan-axis-v z-[11]"
        >
          <div data-scan-line="v" className="scan-line-v" />
        </div>
      )}
    </div>
  );
}