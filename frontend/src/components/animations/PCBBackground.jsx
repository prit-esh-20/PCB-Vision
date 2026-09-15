import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Global animated "premium motherboard" background.
// One fixed canvas behind every route. Static artwork (traces, vias, pads,
// IC outlines, chip silhouettes) is pre-rendered into offscreen layers once
// per resize; each frame only composites layers with parallax offsets and
// draws the lightweight dynamic elements: data packets riding the copper,
// signal waves, neural node activations, and floating micro particles.
// ---------------------------------------------------------------------------

const EMERALD = "#32D583";
const BG = "#07110F";

const GRID = 60; // routing pitch for traces
const BLEED = 48; // oversize margin so parallax never reveals layer edges

// --- geometry helpers -------------------------------------------------------

function buildPath(width, height, rng, startX) {
  // Orthogonal + 45° routed polyline, like autorouted copper.
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const points = [
    {
      x: Math.round((startX ?? rng() * width) / GRID) * GRID,
      y: Math.round((rng() * height) / GRID) * GRID,
    },
  ];
  let dir = dirs[Math.floor(rng() * 4)]; // start orthogonal
  const segments = 3 + Math.floor(rng() * 4);

  for (let i = 0; i < segments; i += 1) {
    const len = (1 + Math.floor(rng() * 4)) * GRID;
    const last = points[points.length - 1];
    const next = { x: last.x + dir[0] * len, y: last.y + dir[1] * len };
    if (
      next.x < -BLEED ||
      next.x > width + BLEED ||
      next.y < -BLEED ||
      next.y > height + BLEED
    )
      break;
    points.push(next);
    // turn 45° or 90°, never reverse
    const candidates = dirs.filter(
      (d) => !(d[0] === -dir[0] && d[1] === -dir[1]) && d !== dir,
    );
    dir = candidates[Math.floor(rng() * candidates.length)];
  }
  return points.length > 1 ? points : null;
}

function measure(points) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const len = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
    lens.push(len);
    total += len;
  }
  return { lens, total };
}

function posAt(points, lens, dist) {
  let run = 0;
  for (let i = 0; i < lens.length; i += 1) {
    if (dist <= run + lens[i]) {
      const t = (dist - run) / lens[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    run += lens[i];
  }
  return points[points.length - 1];
}

function speedFactorAt(path, dist) {
  // Packets slow slightly into corners and accelerate through straights.
  let nearest = dist; // distance to path start counts as a "corner"
  let run = 0;
  for (let i = 0; i < path.lens.length; i += 1) {
    run += path.lens[i];
    const d = Math.abs(dist - run);
    if (d < nearest) nearest = d;
  }
  return 0.55 + 0.6 * Math.min(nearest / 48, 1); // 0.55 at corners → 1.15 mid-straight
}

function edgeBiasedX(width, rng) {
  // ~70% of traces originate in the outer thirds so the periphery reads
  // dense and alive while the center stays calmer behind the hero copy.
  const u = rng();
  if (u < 0.7) {
    const off = rng() * 0.34 * width;
    return rng() < 0.5 ? off : width - off;
  }
  return rng() * width;
}

function makeTraces(width, height) {
  const rng = Math.random;
  const count = Math.max(
    18,
    Math.min(40, Math.round((width * height) / 60000)),
  );
  const traces = [];

  for (let i = 0; i < count; i += 1) {
    const points = buildPath(width, height, rng, edgeBiasedX(width, rng));
    if (!points) continue;
    const { lens, total } = measure(points);

    // Branches leaving from interior vertices — pulses split here.
    const branches = [];
    for (let v = 1; v < points.length - 1 && branches.length < 2; v += 1) {
      if (rng() > 0.45) continue;
      const sub = [points[v]];
      let bx = points[v].x;
      let by = points[v].y;
      const bdirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
      ];
      const steps = 1 + Math.floor(rng() * 2);
      for (let s = 0; s < steps; s += 1) {
        const d = bdirs[Math.floor(rng() * bdirs.length)];
        bx += d[0] * (1 + Math.floor(rng() * 3)) * GRID;
        by += d[1] * (1 + Math.floor(rng() * 3)) * GRID;
        sub.push({ x: bx, y: by });
      }
      let atLen = 0;
      for (let k = 0; k < v; k += 1) atLen += lens[k];
      const m = measure(sub);
      branches.push({ atLen, points: sub, lens: m.lens, total: m.total });
    }

    traces.push({ points, lens, total, branches, wide: rng() > 0.7 });
  }
  return traces;
}

// --- static layer painters ---------------------------------------------------

function paintChipSilhouettes(ctx, width, height) {
  // Large, very faint microchip silhouettes deep in the distance.
  const count = Math.max(3, Math.round(width / 550));
  for (let i = 0; i < count; i += 1) {
    const size = 130 + Math.random() * 170;
    const x = Math.random() * (width - size);
    const y = Math.random() * (height - size);

    ctx.strokeStyle = "rgba(124, 231, 172, 0.028)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x, y, size, size);
    // die outline + pin stubs
    ctx.strokeStyle = "rgba(50, 213, 131, 0.022)";
    ctx.strokeRect(x + size * 0.28, y + size * 0.28, size * 0.44, size * 0.44);
    const pins = 6;
    const step = size / (pins + 1);
    ctx.lineWidth = 2;
    for (let p = 1; p <= pins; p += 1) {
      ctx.beginPath();
      ctx.moveTo(x + step * p, y);
      ctx.lineTo(x + step * p, y - 8);
      ctx.moveTo(x + step * p, y + size);
      ctx.lineTo(x + step * p, y + size + 8);
      ctx.moveTo(x, y + step * p);
      ctx.lineTo(x - 8, y + step * p);
      ctx.moveTo(x + size, y + step * p);
      ctx.lineTo(x + size + 8, y + step * p);
      ctx.stroke();
    }
  }
}

function paintIC(ctx, x, y, w, h) {
  // Small IC outline with pins and a pin-1 dot.
  ctx.strokeStyle = "rgba(50, 213, 131, 0.09)";
  ctx.fillStyle = "rgba(13, 27, 23, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();

  const pins = Math.max(3, Math.floor(w / 12));
  const step = w / (pins + 1);
  ctx.strokeStyle = "rgba(124, 231, 172, 0.08)";
  for (let p = 1; p <= pins; p += 1) {
    ctx.beginPath();
    ctx.moveTo(x + step * p, y);
    ctx.lineTo(x + step * p, y - 5);
    ctx.moveTo(x + step * p, y + h);
    ctx.lineTo(x + step * p, y + h + 5);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(50, 213, 131, 0.12)";
  ctx.beginPath();
  ctx.arc(x + 6, y + 6, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function paintVia(ctx, x, y, r = 3) {
  ctx.strokeStyle = "rgba(124, 231, 172, 0.13)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(7, 17, 15, 0.9)";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function paintPad(ctx, x, y) {
  ctx.fillStyle = "rgba(50, 213, 131, 0.11)";
  ctx.fillRect(x - 2.4, y - 2.4, 4.8, 4.8);
}

function paintTraceLayer(ctx, traces) {
  traces.forEach((trace) => {
    // copper pathway underlay for the wider traces
    if (trace.wide) {
      ctx.beginPath();
      ctx.moveTo(trace.points[0].x, trace.points[0].y);
      trace.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = "rgba(124, 231, 172, 0.03)";
      ctx.lineWidth = 3.4;
      ctx.stroke();
    }

    const paths = [trace, ...trace.branches];
    paths.forEach((path) => {
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = "rgba(50, 213, 131, 0.055)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    });

    // terminals: pads / vias on endpoints, via rings on junctions
    const start = trace.points[0];
    const end = trace.points[trace.points.length - 1];
    if (Math.random() > 0.5) paintPad(ctx, start.x, start.y);
    else paintVia(ctx, start.x, start.y);
    paintVia(ctx, end.x, end.y, 2.4);
    trace.branches.forEach((b) => {
      paintVia(ctx, b.points[0].x, b.points[0].y, 2.2);
      paintPad(
        ctx,
        b.points[b.points.length - 1].x,
        b.points[b.points.length - 1].y,
      );
    });
  });
}

// Pattern tiles for the drifting engineering grids.
function makeSquareGridTile(dpr) {
  const size = 80;
  const tile = document.createElement("canvas");
  tile.width = size * dpr;
  tile.height = size * dpr;
  const ctx = tile.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = "rgba(124, 231, 172, 0.04)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0.4, 0);
  ctx.lineTo(0.4, size);
  ctx.moveTo(0, 0.4);
  ctx.lineTo(size, 0.4);
  ctx.stroke();
  return tile;
}

function makeHexGridTile(dpr) {
  // Flat-top hex tiling; period = 3s wide, sqrt(3)s tall.
  const s = 26;
  const w = 3 * s;
  const h = Math.sqrt(3) * s;
  const tile = document.createElement("canvas");
  tile.width = Math.round(w * dpr);
  tile.height = Math.round(h * dpr);
  const ctx = tile.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = "rgba(50, 213, 131, 0.035)";
  ctx.lineWidth = 0.7;
  const hex = (cx, cy) => {
    ctx.beginPath();
    for (let i = 0; i <= 6; i += 1) {
      const a = (Math.PI / 3) * i;
      const px = cx + s * Math.cos(a);
      const py = cy + s * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };
  // draw enough copies so the tile edges join seamlessly
  for (let row = -1; row <= 1; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      hex(col * 1.5 * s * 2, row * h + (col % 2 ? h / 2 : 0));
      hex(col * 1.5 * s * 2 + 1.5 * s, row * h + h / 2 + (col % 2 ? h / 2 : 0));
    }
  }
  return tile;
}

// ---------------------------------------------------------------------------

export default function PCBBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;

    // static layers + geometry
    let farLayer = null;
    let nearLayer = null;
    let squarePattern = null;
    let hexPattern = null;
    let traces = [];
    let anchorNodes = []; // via/pad positions particles can link to

    // dynamic state
    let pulses = [];
    let packets = [];
    let particles = [];
    let neuralNodes = [];
    let links = []; // in-flight neural propagations
    let gridDrift = 0;
    let packetTimer = 0;
    let nextPacketIn = 700;
    let nextBurst = 0;

    // parallax
    const mouse = { x: 0, y: 0 }; // normalized -0.5..0.5
    const eased = { x: 0, y: 0 };

    const makeLayer = () => {
      const layer = document.createElement("canvas");
      layer.width = (width + BLEED * 2) * dpr;
      layer.height = (height + BLEED * 2) * dpr;
      const lctx = layer.getContext("2d");
      lctx.scale(dpr, dpr);
      lctx.translate(BLEED, BLEED);
      return { layer, lctx };
    };

    const spawnPulse = (list, path, opts = {}) => {
      list.push({
        path,
        dist: opts.dist ?? 0,
        speed: 0.018 + Math.random() * 0.02, // px per ms — slow and elegant
        isBranch: opts.isBranch ?? false,
        spawned: new Set(),
      });
    };

    const spawnPacket = (path, opts = {}) => {
      packets.push({
        path,
        dist: opts.dist ?? 0,
        baseSpeed: 0.03 + Math.random() * 0.028,
        isBranch: opts.isBranch ?? false,
        square: Math.random() > 0.5,
        spawned: new Set(),
        trail: [], // recent head positions for the fading tail
      });
    };

    const fireNode = (idx, timeNow, energy) => {
      // Soft neural activation: glow 0.5–1s, occasionally excite neighbours.
      const node = neuralNodes[idx];
      node.actStart = timeNow;
      node.actDur = 550 + Math.random() * 450;
      if (energy <= 0 || !node.neighbors.length) return;
      const fanout = 1 + (Math.random() > 0.6 ? 1 : 0);
      for (let c = 0; c < fanout && links.length < 14; c += 1) {
        links.push({
          from: idx,
          to: node.neighbors[Math.floor(Math.random() * node.neighbors.length)],
          start: timeNow + 120 + Math.random() * 160,
          dur: 380 + Math.random() * 280,
          energy: energy - 1,
        });
      }
    };

    const build = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // FAR layer: base color, ambient emerald glows, chip silhouettes
      const far = makeLayer();
      far.lctx.fillStyle = BG;
      far.lctx.fillRect(-BLEED, -BLEED, width + BLEED * 2, height + BLEED * 2);
      const glow = far.lctx.createRadialGradient(
        width * 0.15,
        height * 0.1,
        0,
        width * 0.15,
        height * 0.1,
        width * 0.6,
      );
      glow.addColorStop(0, "rgba(50, 213, 131, 0.05)");
      glow.addColorStop(1, "rgba(50, 213, 131, 0)");
      far.lctx.fillStyle = glow;
      far.lctx.fillRect(-BLEED, -BLEED, width + BLEED * 2, height + BLEED * 2);
      const glow2 = far.lctx.createRadialGradient(
        width * 0.9,
        height * 0.95,
        0,
        width * 0.9,
        height * 0.95,
        width * 0.55,
      );
      glow2.addColorStop(0, "rgba(124, 231, 172, 0.04)");
      glow2.addColorStop(1, "rgba(124, 231, 172, 0)");
      far.lctx.fillStyle = glow2;
      far.lctx.fillRect(-BLEED, -BLEED, width + BLEED * 2, height + BLEED * 2);
      paintChipSilhouettes(far.lctx, width, height);
      farLayer = far.layer;

      // NEAR layer: routed traces, vias, pads, IC outlines
      traces = makeTraces(width, height);
      const near = makeLayer();
      paintTraceLayer(near.lctx, traces);
      const icCount = Math.max(2, Math.round(width / 640));
      for (let i = 0; i < icCount; i += 1) {
        paintIC(
          near.lctx,
          Math.random() * (width - 90),
          Math.random() * (height - 50),
          50 + Math.random() * 46,
          22 + Math.random() * 16,
        );
      }
      nearLayer = near.layer;

      // anchor nodes for particle link-ups
      anchorNodes = [];
      traces.forEach((t) => {
        anchorNodes.push(t.points[0], t.points[t.points.length - 1]);
        t.branches.forEach((b) => anchorNodes.push(b.points[0]));
      });

      // neural graph: every via/pad becomes a neuron linked to nearby nodes
      neuralNodes = anchorNodes.map((p) => ({
        x: p.x,
        y: p.y,
        neighbors: [],
        actStart: -1,
        actDur: 0,
        idlePhase: Math.random() * Math.PI * 2,
        idleSpeed: 0.0003 + Math.random() * 0.0005,
      }));
      for (let a = 0; a < neuralNodes.length; a += 1) {
        for (let b = a + 1; b < neuralNodes.length; b += 1) {
          const dx = neuralNodes[a].x - neuralNodes[b].x;
          const dy = neuralNodes[a].y - neuralNodes[b].y;
          if (dx * dx + dy * dy < 220 * 220) {
            neuralNodes[a].neighbors.push(b);
            neuralNodes[b].neighbors.push(a);
          }
        }
      }
      links = [];
      nextBurst = 1200;

      // grid patterns (tiles are dpr-scaled; counter-scale so cells stay in CSS px)
      const patternScale = new DOMMatrix().scale(1 / dpr);
      squarePattern = ctx.createPattern(makeSquareGridTile(dpr), "repeat");
      squarePattern.setTransform(patternScale);
      hexPattern = ctx.createPattern(makeHexGridTile(dpr), "repeat");
      hexPattern.setTransform(patternScale);

      // dynamic entities

      pulses = [];

      if (traces.length > 0) {
        const pulseCount = Math.max(
          6,
          Math.min(15, Math.round(traces.length * 0.4)),
        );

        for (let i = 0; i < pulseCount; i += 1) {
          const t = traces[Math.floor(Math.random() * traces.length)];

          if (t) {
            spawnPulse(pulses, t, {
              dist: Math.random() * t.total,
            });
          }
        }
      }

      packets = [];

      if (traces.length > 0) {
        const packetCount = Math.max(
          5,
          Math.min(13, Math.round(traces.length * 0.35)),
        );

        for (let i = 0; i < packetCount; i += 1) {
          const t = traces[Math.floor(Math.random() * traces.length)];

          if (t) {
            spawnPacket(t, {
              dist: Math.random() * t.total,
            });
          }
        }
      }

      packetTimer = 0;
      nextPacketIn = 500 + Math.random() * 1200;

      particles = [];
      const particleCount = Math.max(
        24,
        Math.min(50, Math.round((width * height) / 46000)),
      );
      for (let i = 0; i < particleCount; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.008,
          vy: -(0.004 + Math.random() * 0.011), // gentle upward drift
          r: 1 + Math.random() * 1.5, // 2–5px diameter
          baseAlpha: 0.05 + Math.random() * 0.12,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.0004 + Math.random() * 0.0008,
          depth: 0.35 + Math.random() * 0.65,
        });
      }
    };

    const drawStaticComposite = () => {
      // Single still frame for prefers-reduced-motion.
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        farLayer,
        -BLEED,
        -BLEED,
        width + BLEED * 2,
        height + BLEED * 2,
      );
      ctx.fillStyle = hexPattern;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = squarePattern;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(
        nearLayer,
        -BLEED,
        -BLEED,
        width + BLEED * 2,
        height + BLEED * 2,
      );
    };

    let last = performance.now();

    const frame = (now) => {
      const dt = Math.min(now - last, 50); // clamp to avoid jumps after tab switch
      last = now;

      // ease mouse parallax
      eased.x += (mouse.x - eased.x) * 0.035;
      eased.y += (mouse.y - eased.y) * 0.035;
      gridDrift += dt * 0.0018; // very slow constant drift

      ctx.clearRect(0, 0, width, height);

      // 1) far layer — smallest parallax shift
      ctx.drawImage(
        farLayer,
        -BLEED + eased.x * 6,
        -BLEED + eased.y * 6,
        width + BLEED * 2,
        height + BLEED * 2,
      );

      // 2) drifting engineering grids (pattern fills are cheap)
      ctx.save();
      ctx.translate(
        (gridDrift + eased.x * 10) % 78,
        (gridDrift * 0.6 + eased.y * 10) % 45,
      );
      ctx.fillStyle = hexPattern;
      ctx.fillRect(-90, -90, width + 180, height + 180);
      ctx.restore();
      ctx.save();
      ctx.translate(
        (-gridDrift * 0.5 + eased.x * 8) % 80,
        (gridDrift * 0.4 + eased.y * 8) % 80,
      );
      ctx.fillStyle = squarePattern;
      ctx.fillRect(-80, -80, width + 160, height + 160);
      ctx.restore();

      // 3) near layer — strongest parallax shift
      const nx = eased.x * 14;
      const ny = eased.y * 14;
      ctx.drawImage(
        nearLayer,
        -BLEED + nx,
        -BLEED + ny,
        width + BLEED * 2,
        height + BLEED * 2,
      );

      // 4) signal pulses travelling the copper (aligned with near layer)
      ctx.save();
      ctx.translate(nx, ny);
      ctx.lineCap = "round";
      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        const p = pulses[i];
        p.dist += p.speed * dt;

        // split: parent crossing a branch junction spawns a child pulse
        if (!p.isBranch && p.path.branches) {
          p.path.branches.forEach((b, bi) => {
            if (!p.spawned.has(bi) && p.dist >= b.atLen) {
              p.spawned.add(bi);
              if (pulses.length < 30) spawnPulse(pulses, b, { isBranch: true });
            }
          });
        }

        if (p.dist >= p.path.total) {
          if (p.isBranch) {
            pulses.splice(i, 1);
          } else {
            // recycle onto a fresh trace — animations never reset globally
            const t = traces[Math.floor(Math.random() * traces.length)];
            p.path = t;
            p.dist = 0;
            p.spawned.clear();
          }
          continue;
        }

        // fade in / out along the run, capped below 15%
        const lifeT = p.dist / p.path.total;
        const alpha = Math.sin(Math.PI * lifeT) * 0.13;
        if (alpha <= 0.004) continue;

        const head = posAt(p.path.points, p.path.lens, p.dist);
        const tail = posAt(
          p.path.points,
          p.path.lens,
          Math.max(0, p.dist - 46),
        );

        ctx.strokeStyle = `rgba(50, 213, 131, ${alpha})`;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();

        ctx.fillStyle = `rgba(124, 231, 172, ${alpha * 1.1})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 4b) AI data packets — discrete quanta riding the exact copper routes
      packetTimer += dt;
      if (packetTimer >= nextPacketIn && packets.length < 17) {
        packetTimer = 0;
        nextPacketIn = 550 + Math.random() * 1400; // random spawn cadence
        spawnPacket(traces[Math.floor(Math.random() * traces.length)]);
      }

      for (let i = packets.length - 1; i >= 0; i -= 1) {
        const pk = packets[i];
        // accelerate through straights, ease around corners
        pk.dist += pk.baseSpeed * speedFactorAt(pk.path, pk.dist) * dt;

        // split: a copy continues down the branch at the junction
        if (!pk.isBranch && pk.path.branches) {
          pk.path.branches.forEach((b, bi) => {
            if (!pk.spawned.has(bi) && pk.dist >= b.atLen) {
              pk.spawned.add(bi);
              if (packets.length < 19 && Math.random() > 0.35) {
                spawnPacket(b, { isBranch: true });
              }
            }
          });
        }

        // reached the endpoint — packet is consumed
        if (pk.dist >= pk.path.total) {
          packets.splice(i, 1);
          continue;
        }

        const lifeT = pk.dist / pk.path.total;
        const alpha = Math.min(1, Math.sin(Math.PI * lifeT) * 3) * 0.22; // fast ease in/out, ≤22%
        if (alpha <= 0.01) continue;

        const head = posAt(pk.path.points, pk.path.lens, pk.dist);
        pk.trail.push({ x: head.x, y: head.y });
        if (pk.trail.length > 9) pk.trail.shift();

        // tiny fading trail along the recent path
        for (let t = 0; t < pk.trail.length - 1; t += 1) {
          const tp = pk.trail[t];
          ctx.fillStyle = `rgba(50, 213, 131, ${alpha * 0.5 * (t / pk.trail.length)})`;
          ctx.fillRect(tp.x - 0.8, tp.y - 0.8, 1.6, 1.6);
        }

        ctx.shadowColor = EMERALD;
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(50, 213, 131, ${alpha})`;
        if (pk.square) {
          ctx.fillRect(head.x - 1.8, head.y - 1.8, 3.6, 3.6);
        } else {
          ctx.beginPath();
          ctx.arc(head.x, head.y, 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      // 4c) neural network — nodes idle-pulse, activate, and excite neighbours
      if (now >= nextBurst && neuralNodes.length) {
        nextBurst = now + 2600 + Math.random() * 3200; // every few seconds
        const seeds = 1 + Math.floor(Math.random() * 2);
        for (let s = 0; s < seeds; s += 1) {
          fireNode(Math.floor(Math.random() * neuralNodes.length), now, 2);
        }
      }

      // propagating links: a soft point of light glides between neurons
      for (let i = links.length - 1; i >= 0; i -= 1) {
        const link = links[i];
        const t = (now - link.start) / link.dur;
        if (t < 0) continue;
        if (t >= 1) {
          fireNode(link.to, now, link.energy);
          links.splice(i, 1);
          continue;
        }
        const from = neuralNodes[link.from];
        const to = neuralNodes[link.to];
        const fade = Math.sin(Math.PI * t);
        ctx.strokeStyle = `rgba(124, 231, 172, ${fade * 0.06})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(124, 231, 172, ${fade * 0.18})`;
        ctx.beginPath();
        ctx.arc(
          from.x + (to.x - from.x) * t,
          from.y + (to.y - from.y) * t,
          1.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      neuralNodes.forEach((node) => {
        // slow idle breathing, always desynchronized
        const idle =
          0.03 + 0.025 * Math.sin(now * node.idleSpeed + node.idlePhase);
        let glow = idle;
        let radius = 1.6;

        if (node.actStart >= 0) {
          const t = (now - node.actStart) / node.actDur;
          if (t >= 1) {
            node.actStart = -1;
          } else {
            const env = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75; // quick attack, slow decay
            glow = idle + env * 0.2; // peaks ≤ ~25%
            radius = 1.6 + env * 2.2;
          }
        }

        ctx.fillStyle = `rgba(50, 213, 131, ${glow})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        if (glow > 0.1) {
          // soft halo only while activated
          ctx.fillStyle = `rgba(50, 213, 131, ${(glow - 0.1) * 0.3})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.restore();

      // 5) floating particles with brief node link-ups
      particles.forEach((pt) => {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.x < -10) pt.x = width + 10;
        if (pt.x > width + 10) pt.x = -10;
        if (pt.y < -10) pt.y = height + 10;
        if (pt.y > height + 10) pt.y = -10;

        const px = pt.x + eased.x * 20 * pt.depth;
        const py = pt.y + eased.y * 20 * pt.depth;
        const alpha = Math.min(
          0.19,
          pt.baseAlpha *
            (0.65 + 0.35 * Math.sin(now * pt.pulseSpeed + pt.phase)),
        );

        // connect briefly with a nearby node
        for (let n = 0; n < anchorNodes.length; n += 1) {
          const node = anchorNodes[n];
          const dx = node.x + nx - px;
          const dy = node.y + ny - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < 4900) {
            const d = Math.sqrt(d2);
            ctx.strokeStyle = `rgba(124, 231, 172, ${(1 - d / 70) * 0.07})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(node.x + nx, node.y + ny);
            ctx.stroke();
            break;
          }
        }

        ctx.fillStyle = `rgba(124, 231, 172, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, pt.r, 0, Math.PI * 2);
        ctx.fill();
      });

      if (running) raf = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (reduceMotion.matches) {
        drawStaticComposite();
        return;
      }
      last = performance.now();
      running = true;
      raf = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      window.cancelAnimationFrame(raf);
    };

    build();
    start();

    const handleResize = () => {
      stop();
      build();
      start();
    };

    const handleMouse = (event) => {
      mouse.x = event.clientX / width - 0.5;
      mouse.y = event.clientY / height - 0.5;
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const handleMotionPref = () => {
      stop();
      start();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouse, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reduceMotion.addEventListener("change", handleMotionPref);

    return () => {
      stop();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouse);
      document.removeEventListener("visibilitychange", handleVisibility);
      reduceMotion.removeEventListener("change", handleMotionPref);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-primary-bg"
    />
  );
}
