import { useScanProgress } from "../../hooks/useInspection";

// Shared AOI scanning overlay. Rendered INSIDE the PCB frame container so the
// scan line always matches the exact displayed PCB bounds — works for any
// image size, aspect ratio or resolution (camera or uploaded).
//
// Purely visual and purely sequential:
//   phase = "horizontal" → single horizontal line sweeps TOP → BOTTOM
//   phase = "vertical"   → single vertical line sweeps LEFT → RIGHT
//
// Progress comes from the shared inspection store (0-50 during the horizontal
// pass, 50-100 during the vertical pass) and is normalized to the active
// phase so each line makes ONE complete pass across the PCB area.
//
// The scan timeline loops CONTINUOUSLY while the inspection is in progress.
// It never stops on its own: the animation only stops when the actual
// inspection result arrives (COMPLETED / ERROR) or the inspection is
// reset/cancelled. This guarantees the animation reflects the real backend
// lifecycle, not an arbitrary duration.
export default function ScanningOverlay({ phase }) {
  const progress = useScanProgress();

  const localProgress =
    phase === "horizontal"
      ? progress * 2
      : (progress - 50) * 2;

  const line = Math.min(100, Math.max(0, localProgress));

  return (
    <div
      data-scanning-overlay
      className="pointer-events-none absolute inset-0 z-[10]"
    >
      {/* Phase 1: horizontal scan line — TOP → BOTTOM. */}
      {phase === "horizontal" && (
        <div
          data-scan-axis="h"
          className="scan-axis-h z-[11]"
          style={{ transform: `translateY(calc(${line}% - 100%))` }}
        >
          <div data-scan-line="h" className="scan-line-h" />
        </div>
      )}

      {/* Phase 2: vertical scan line — LEFT → RIGHT. */}
      {phase === "vertical" && (
        <div
          data-scan-axis="v"
          className="scan-axis-v z-[11]"
          style={{ transform: `translateX(calc(${line}% - 100%))` }}
        >
          <div data-scan-line="v" className="scan-line-v" />
        </div>
      )}
    </div>
  );
}