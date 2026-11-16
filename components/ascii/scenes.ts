/**
 * The clock. The homepage is one night and the day after it, read top to
 * bottom, and every chapter is an hour of it. Its ASCII layer is the sky —
 * and the garden under it — at that hour:
 *
 *   21:00  .01 Hero        nightsky   the moon and stars over the hero's garden
 *   00:00  .02 About       moonriver  the river at midnight, the moon riding on it
 *   02:00  .03 Tech        stars      the deepest sky, streaming past the tunnel
 *   04:30  .04 Activity    predawn    last stars going out, violet behind the hills
 *   05:45  .05 Works       dawn       flowers opening, the sun up over the meadow
 *   09:00  .06 Experience  daylight   the day sky; the sun crosses it as you read
 *   18:30  .07 Contact     dusk       last light behind the hedges, fireflies out
 *   23:59  footer          night      moon, stars, the grass in silhouette
 *
 * Back to top lands on the hero's night again, so the page is a loop.
 *
 * One rule holds it together: **a chapter's foot is its horizon.** Activity,
 * Works and Contact all keep their light along the bottom edge, so scrolling
 * the page is watching the light change along one line — violet, then gold,
 * then the day, then the last of it going down behind the hedges.
 *
 * Scenes are plain objects in section coordinates (css px / cell units, y
 * down from the section's top). `ascii-layer.tsx` owns the canvas, the clock
 * and the scroll; a scene only says which glyph goes where.
 */

export type Grid = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  width: number;
  height: number;
};

export type Frame = {
  t: number;
  dt: number;
  /** 0 as the section's top enters the viewport → 1 as its bottom leaves. */
  progress: number;
  /** 0 as the section's top enters → 1 once it has climbed 60% of a screen. */
  enter: number;
  /** Section y currently at the top of the viewport. */
  viewTop: number;
  viewport: number;
  /** Rows worth drawing this frame (the canvas's slice). */
  rowStart: number;
  rowEnd: number;
  /** Pointer in section px, or null. */
  pointer: { x: number; y: number } | null;
  /** Reduced motion: one still frame, every scene at its most legible hour. */
  reduced: boolean;
};

export type Put = (col: number, row: number, ch: string, color: string, alpha?: number) => void;
export type Glow = (x: number, y: number, radius: number, color: string, alpha: number) => void;
/** A flat rect over cells [col0, col1) of one row. */
export type Fill = (col0: number, col1: number, row: number, color: string, alpha: number) => void;
/** A full-width vertical gradient between two section ys; stops are [at, #hex, alpha]. */
export type Band = (y0: number, y1: number, stops: [number, string, number][]) => void;

export type Brush = { put: Put; glow: Glow; fill: Fill; band: Band };

export type Scene = {
  setup(grid: Grid): void;
  draw(brush: Brush, frame: Frame): void;
};

export type SceneName = "nightsky" | "moonriver" | "stars" | "predawn" | "dawn" | "daylight" | "dusk" | "night";

/* The site palette, as written in globals.css, and the sky's own colours. */
const VOID = "#08080a";
const INK = "#f2f2f0";
const ACID = "#e1ff00";
const LILAC = "#cba7f5";
const PINK = "#ff5fa2";
const VIOLET = "#2c1155";
const LEAF = "#7fc24e";
const LEAF_LIGHT = "#b9ec62";
const LEAF_DARK = "#2e6b3c";
const MOON = "#e6ecf7";
const MOON_DIM = "#9fb0cc";
const STAR = "#dfe6ff";
const PEACH = "#ffb47a";
const SUN = "#ffd23f";
const SUN_HOT = "#fff1a8";
const SUN_RAY = "#ffb000";
const CLOUD = "#ffffff";

/* ------------------------------------------------------------------------ */

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash of a few numbers to 0..1 — for per-cell, per-tick choices. */
function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where the section's bottom edge — its horizon — is on screen, in px. */
const footOnScreen = (g: Grid, f: Frame) => g.height - f.viewTop;

/* ---------------------------------------------------- shared furniture --- */

type Star = { x: number; y: number; phase: number; size: number; tint: string };

function scatterStars(rnd: () => number, n: number, w: number, y0: number, y1: number): Star[] {
  return Array.from({ length: Math.max(0, Math.round(n)) }, () => {
    const k = rnd();
    return {
      x: rnd() * w,
      y: y0 + rnd() * (y1 - y0),
      phase: rnd() * 6.28,
      size: rnd(),
      tint: k < 0.12 ? LILAC : k < 0.15 ? ACID : STAR,
    };
  });
}

function drawStars(put: Put, g: Grid, f: Frame, stars: Star[], alpha: number) {
  if (alpha <= 0.01) return;
  for (const s of stars) {
    const row = s.y / g.cellH - 0.5;
    if (row < f.rowStart || row > f.rowEnd) continue;
    const tw = 0.5 + 0.5 * Math.sin(f.t * (0.9 + s.size * 1.6) + s.phase * 3);
    const ch = s.size > 0.93 ? "*" : s.size > 0.62 ? "+" : ".";
    put(s.x / g.cellW - 0.5, row, ch, s.tint, alpha * (0.3 + 0.7 * tw) * (0.45 + 0.55 * s.size));
  }
}

type Meteor = { x: number; y: number; vx: number; vy: number; life: number; wait: number };

/**
 * A shooting star: waits, then crosses a stretch of sky in under a second
 * and is gone. `spawn` says where it may start (section px).
 */
function stepMeteor(
  m: Meteor,
  rnd: () => number,
  { put, glow }: Brush,
  g: Grid,
  f: Frame,
  spawn: () => [number, number],
  gap: [number, number],
) {
  if (m.life <= 0) {
    m.wait -= f.dt;
    if (m.wait > 0 || f.dt === 0) return;
    const [x, y] = spawn();
    const speed = 520 + rnd() * 320;
    const ang = (rnd() < 0.5 ? 0.5 : Math.PI - 0.5) + (rnd() - 0.5) * 0.35;
    m.x = x;
    m.y = y;
    m.vx = Math.cos(ang) * speed;
    m.vy = Math.sin(ang) * speed;
    m.life = 0.7 + rnd() * 0.5;
    m.wait = gap[0] + rnd() * (gap[1] - gap[0]);
  }
  m.life -= f.dt;
  m.x += m.vx * f.dt;
  m.y += m.vy * f.dt;
  const fade = Math.min(1, m.life * 2.5);
  const len = Math.hypot(m.vx, m.vy) || 1;
  const ux = m.vx / len;
  const uy = m.vy / len;
  const ch = m.vx * m.vy > 0 ? "\\" : "/";
  for (let k = 1; k <= 9; k++) {
    const step = k * g.cellW * 1.15;
    put((m.x - ux * step) / g.cellW - 0.5, (m.y - uy * step) / g.cellH - 0.5, ch, STAR, fade * (1 - k / 10) * 0.75);
  }
  glow(m.x, m.y, 18, "rgba(223,230,255,0.6)", fade * 0.8);
  put(m.x / g.cellW - 0.5, m.y / g.cellH - 0.5, "*", INK, fade);
}

type Firefly = { x: number; y: number; phase: number; drift: number; speed: number; lilac: boolean };

function scatterFlies(rnd: () => number, n: number, w: number, y0: number, y1: number): Firefly[] {
  return Array.from({ length: n }, () => ({
    x: rnd() * w,
    y: y0 + rnd() * (y1 - y0),
    phase: rnd() * 6.28,
    drift: 24 + rnd() * 46,
    speed: 0.15 + rnd() * 0.2,
    lilac: rnd() < 0.25,
  }));
}

/** Fireflies loitering where they were scattered, each pulsing on its own beat. */
function drawFlies({ put, glow }: Brush, g: Grid, f: Frame, flies: Firefly[], alpha: number) {
  if (alpha <= 0.01) return;
  for (const m of flies) {
    const x = m.x + Math.sin(f.t * m.speed + m.phase) * m.drift;
    const y = m.y + Math.cos(f.t * m.speed * 0.8 + m.phase) * m.drift * 0.6;
    const fade = (0.55 + 0.45 * Math.sin(f.t * 1.8 + m.phase * 3)) * alpha;
    glow(x, y, 22, m.lilac ? "rgba(203,167,245,0.45)" : "rgba(225,255,0,0.5)", fade * 0.65);
    put(x / g.cellW - 0.5, y / g.cellH - 0.5, fade > 0.7 ? "*" : "+", m.lilac ? LILAC : ACID, fade);
  }
}

/**
 * A disc of glyphs centred on section px (x, y), `R` rows in radius. `shade`
 * gets the cell's offset normalised to the radius and returns what to print
 * there, or null. Cells whose centre is below `clipY` are skipped — the sun
 * rising behind a horizon.
 */
function disc(
  put: Put,
  g: Grid,
  x: number,
  y: number,
  R: number,
  shade: (dx: number, dy: number, d: number, c: number, r: number) => [string, string, number] | null,
  clipY = Infinity,
) {
  const cx = x / g.cellW - 0.5;
  const cy = y / g.cellH - 0.5;
  const Rc = (R * g.cellH) / g.cellW;
  for (let r = Math.floor(cy - R); r <= Math.ceil(cy + R); r++) {
    if ((r + 0.5) * g.cellH > clipY) continue;
    for (let c = Math.floor(cx - Rc); c <= Math.ceil(cx + Rc); c++) {
      const dx = (c - cx) / Rc;
      const dy = (r - cy) / R;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      const s = shade(dx, dy, d, c, r);
      if (s) put(c, r, s[0], s[1], s[2]);
    }
  }
}

/** The glyph a short stroke at angle `a` (screen space, y down) is drawn with. */
function strokeFor(a: number) {
  const cx = Math.cos(a);
  const sy = Math.sin(a);
  if (Math.abs(cx) > 0.92) return "-";
  if (Math.abs(sy) > 0.92) return "|";
  return cx * sy > 0 ? "\\" : "/";
}

/** Sun rays: `n` strokes turning slowly round (x, y), from `r0` to `r1` px. */
function rays(put: Put, g: Grid, f: Frame, x: number, y: number, r0: number, r1: number, n: number, color: string, alpha: number, clipY = Infinity) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + f.t * 0.12;
    const ch = strokeFor(a);
    const pulse = 0.6 + 0.4 * Math.sin(f.t * 1.4 + k * 1.7);
    for (let s = r0; s <= r1; s += g.cellH * 0.9) {
      const px = x + Math.cos(a) * s;
      const py = y + Math.sin(a) * s;
      if (py > clipY) continue;
      const fall = 1 - (s - r0) / (r1 - r0 + 1);
      put(px / g.cellW - 0.5, py / g.cellH - 0.5, ch, color, alpha * pulse * (0.35 + 0.65 * fall));
    }
  }
}

/* ----------------------------------------------------- 21:00 nightsky --- */

/**
 * The sky over the hero's garden. The garden and the portrait are the shader's;
 * this layer sits over it with `mix-blend-screen`, so it only ever adds light —
 * a star over a leaf brightens the leaf rather than punching a hole in it.
 *
 * A full moon in the open sky between the hanging canopy (top left) and the
 * portrait (right), shaded with limb darkening and three dark maria so it reads
 * as the moon and not a blob; stars across the upper half, thinning toward the
 * copy at the bottom; one falling now and then. The moon is the same one that
 * rides the river in Chapter .02.
 *
 * The layer lives in the hero's sticky screen, so its grid is the viewport.
 */
function nightsky(): Scene {
  let grid: Grid;
  let sky: Star[] = [];
  let rnd = mulberry(7);
  const met: Meteor = { x: 0, y: 0, vx: 0, vy: 0, life: 0, wait: 4 };
  const MARIA: [number, number, number][] = [
    [-0.28, -0.22, 0.3],
    [0.18, -0.05, 0.24],
    [-0.05, 0.32, 0.22],
  ];
  const RAMP = ".:-=+*#%@";
  return {
    setup(g) {
      grid = g;
      rnd = mulberry(7);
      sky = scatterStars(rnd, Math.min(150, (g.width * g.height) / 9000), g.width, 0, g.height * 0.62);
    },
    draw(brush, f) {
      const { put, glow } = brush;
      const { width: W, height: H, cellH } = grid;
      // Comes out as the loader lifts, not with it.
      const on = f.reduced ? 1 : smooth(0.6, 3, f.t);
      drawStars(put, grid, f, sky, 0.9 * on);

      const small = W < 640;
      const R = small ? 3 : Math.min(5, Math.max(3.5, H / 170));
      const mx = W * (small ? 0.2 : 0.4);
      const my = H * (small ? 0.17 : 0.22);
      glow(mx, my, R * cellH * 4.2, "rgba(230,236,247,0.22)", on);
      glow(mx, my, R * cellH * 1.8, "rgba(230,236,247,0.3)", on);
      disc(put, grid, mx, my, R, (dx, dy, d) => {
        let tone = 1 - 0.38 * d * d;
        for (const [ax, ay, ar] of MARIA) {
          tone -= 0.32 * (1 - smooth(0, ar, Math.hypot(dx - ax, dy - ay)));
        }
        tone = Math.min(1, Math.max(0.12, tone));
        return [RAMP[Math.round(tone * (RAMP.length - 1))], tone > 0.55 ? MOON : MOON_DIM, (0.55 + 0.45 * tone) * on];
      });

      stepMeteor(met, rnd, brush, grid, f, () => [W * (0.05 + rnd() * 0.6), H * (0.04 + rnd() * 0.25)], [7, 13]);
    },
  };
}

/* ---------------------------------------------------- 00:00 moonriver --- */

const WATER_BODY = "#0d3a4d";
const WATER_CORE = "#082636";
const WATER_DEEP = "#2f6f8f";
const WATER = "#6cc4d6";
const WATER_LIGHT = "#bff3ee";
const SAND = "#8c7b52";
const STONE = "#6b7a6e";
const SHADE = "#030605";
const CANOPY_BED = "#09170e";

type Pad = { row: number; off: number; flower: string | null };
type Reed = { row: number; side: number; glyph: string; tall: boolean };
type Drift = { y: number; off: number; speed: number; glyph: string; color: string };
type Canopy = { col: number; ch: string; color: string; alpha: number; seed: number };

/**
 * Midnight. A broad river seen from above, winding down the panel under the
 * copy, wooded on both banks — and the moon on it.
 *
 * The moon is never drawn, only its reflection, and the reflection is pinned
 * to the *screen*, not the page: it sits a little above the middle of the view
 * and slides along the water as you scroll, the way the moon follows you along
 * a riverbank. Its rows shear sideways on the ripples and break up into gaps,
 * and a glitter path trails off it up and down the current. Glints on the
 * water are moonlight now, not acid; a few fireflies are still out.
 *
 * Layers, bottom up: the water body (two flat tints), ripples travelling
 * downstream, sand and reeds, the moon, pads and leaves on the current, then
 * the trees — round canopies lit from the upper left, each throwing a shadow
 * down-right. Trees are baked once per layout into per-row buckets.
 */
function moonriver(): Scene {
  let grid: Grid;
  let pads: Pad[] = [];
  let reeds: Reed[] = [];
  let drifts: Drift[] = [];
  let shade: [number, number][][] = [];
  let trees: Canopy[][] = [];
  let beds: [number, number][][] = [];
  let flies: Firefly[] = [];
  let p1 = 0;
  let p2 = 0;
  let wide = false;

  /** Centre of the river at row r, in columns, and its half-width. */
  const course = (r: number) => {
    const { cols, cellH } = grid;
    const y = r * cellH;
    const home = wide ? 0.54 : 0.5;
    const swing = wide ? 0.17 : 0.14;
    const x =
      cols *
      (home +
        swing * Math.sin((y / 1500) * Math.PI * 2 + p1) +
        0.03 * Math.sin((y / 430) * Math.PI * 2 + p2));
    const half = cols * (wide ? 0.17 : 0.27) * (1 + 0.2 * Math.sin((y / 900) * Math.PI * 2 + p2 * 2));
    return { x, half };
  };

  const RAMP = ".:;*o&%@";

  const bakeTrees = (rnd: () => number) => {
    const { cols, rows } = grid;
    const canopy = new Map<number, Canopy & { row: number }>();
    const shadow = new Set<number>();
    const key = (c: number, r: number) => r * 4096 + c;

    const plant = (cx: number, cy: number, R: number, salt: number) => {
      const Rc = R / 0.6;
      const lobes = 4 + Math.floor(hash(salt, 1) * 3);
      const turn = hash(salt, 2) * 6.28;
      const sx = cx + Rc * 0.45;
      const sy = cy + R * 0.55;
      for (let r = Math.floor(sy - R - 1); r <= sy + R + 1; r++) {
        if (r < 0 || r >= rows) continue;
        for (let c = Math.floor(sx - Rc - 1); c <= sx + Rc + 1; c++) {
          if (c < 0 || c >= cols) continue;
          if (Math.hypot((c - sx) / Rc, (r - sy) / R) < 0.95) shadow.add(key(c, r));
        }
      }
      for (let r = Math.floor(cy - R - 1); r <= cy + R + 1; r++) {
        if (r < 0 || r >= rows) continue;
        for (let c = Math.floor(cx - Rc - 1); c <= cx + Rc + 1; c++) {
          if (c < 0 || c >= cols) continue;
          const dx = (c - cx) / Rc;
          const dy = (r - cy) / R;
          const ang = Math.atan2(dy, dx);
          const edge = 1 + 0.1 * Math.sin(ang * lobes + turn) + (hash(c, r, salt) - 0.5) * 0.16;
          const d = Math.hypot(dx, dy) / edge;
          if (d >= 1) continue;
          const seed = hash(c, r, salt + 5);
          if (d > 0.88 && seed > 0.6) continue;
          const h = Math.sqrt(Math.max(0, 1 - d * d));
          const lit = Math.max(0, -0.5 * dx - 0.62 * dy + 0.6 * h);
          const clump = hash(Math.floor(c / 3), Math.floor(r / 2), salt + 9);
          const tone = Math.min(1, lit * (0.7 + 0.5 * clump));
          const dens = Math.min(1, Math.max(0.18, 0.25 + 0.75 * tone));
          let ch = RAMP[Math.round(dens * (RAMP.length - 1))];
          let color = tone > 0.72 ? LEAF_LIGHT : tone > 0.38 ? LEAF : LEAF_DARK;
          let alpha = 0.4 + 0.4 * tone;
          if (tone > 0.55 && seed > 0.975) {
            ch = seed > 0.99 ? "@" : "*";
            color = seed > 0.9925 ? ACID : seed > 0.985 ? PINK : LILAC;
            alpha = 0.9;
          }
          canopy.set(key(c, r), { col: c, row: r, ch, color, alpha, seed });
        }
      }
    };

    let salt = 100;
    for (const side of [-1, 1]) {
      for (let r = Math.floor(rnd() * 8); r < rows; ) {
        const R = 3 + rnd() * (wide ? 4.5 : 3);
        const { x, half } = course(r);
        const Rc = R / 0.6;
        const out = rnd() < 0.35 ? -Rc * 0.35 : Rc * (0.15 + rnd() * 0.6);
        plant(x + side * (half + 1.5 + out), r, R, salt++);
        if (rnd() < 0.55) {
          const R2 = 2.5 + rnd() * 3.5;
          plant(x + side * (half + 1.5 + Rc * 1.4 + R2 / 0.6 + rnd() * 4), r + (rnd() - 0.5) * R * 1.6, R2, salt++);
        }
        r += Math.round(R * (1.1 + rnd() * 0.7));
      }
    }
    if (wide) {
      for (let r = 6; r < rows; r += 14 + Math.floor(rnd() * 22)) {
        const { x, half } = course(r);
        const side = rnd() < 0.5 ? -1 : 1;
        const col = x + side * (half + 18 + rnd() * cols * 0.2);
        if (col > 2 && col < cols - 2) plant(col, r, 2.5 + rnd() * 3, salt++);
      }
    }

    trees = Array.from({ length: rows }, () => []);
    for (const t of canopy.values()) trees[t.row].push(t);
    beds = trees.map((row) => {
      const runs: [number, number][] = [];
      for (const c of row.map((t) => t.col).sort((a, b) => a - b)) {
        const last = runs[runs.length - 1];
        if (last && last[1] === c) last[1] = c + 1;
        else runs.push([c, c + 1]);
      }
      return runs;
    });
    shade = Array.from({ length: rows }, () => []);
    const sorted = [...shadow].filter((k) => !canopy.has(k)).sort((a, b) => a - b);
    for (const k of sorted) {
      const r = Math.floor(k / 4096);
      const c = k % 4096;
      const runs = shade[r];
      const last = runs[runs.length - 1];
      if (last && last[1] === c) last[1] = c + 1;
      else runs.push([c, c + 1]);
    }
  };

  return {
    setup(g) {
      grid = g;
      wide = g.cols > 100;
      const rnd = mulberry(97);
      p1 = rnd() * 6.28;
      p2 = rnd() * 6.28;
      pads = [];
      reeds = [];
      for (let r = 2; r < g.rows; r += 3 + Math.floor(rnd() * 6)) {
        const b = rnd();
        pads.push({ row: r, off: rnd() * 1.6 - 0.8, flower: b < 0.3 ? PINK : b < 0.45 ? LILAC : b < 0.5 ? ACID : null });
      }
      for (let r = 0; r < g.rows; r += 1 + Math.floor(rnd() * 2)) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.35) continue;
          const k = rnd();
          reeds.push({ row: r, side, glyph: k < 0.35 ? "|" : k < 0.55 ? "," : k < 0.7 ? "'" : k < 0.82 ? "Y" : k < 0.92 ? "(" : "o", tall: k >= 0.7 && k < 0.82 });
        }
      }
      drifts = Array.from({ length: Math.max(6, Math.round(g.rows / 6)) }, () => {
        const k = rnd();
        return {
          y: rnd() * g.height,
          off: rnd() * 1.5 - 0.75,
          speed: 14 + rnd() * 22,
          glyph: k < 0.4 ? "," : k < 0.7 ? "'" : k < 0.85 ? "~" : "o",
          color: k < 0.7 ? (rnd() < 0.5 ? LEAF_LIGHT : "#c9a46a") : WATER_LIGHT,
        };
      });
      bakeTrees(rnd);
      flies = scatterFlies(mulberry(17), Math.max(4, Math.round(g.height / 320)), g.width, 0, g.height);
    },
    draw(brush, f) {
      const { put, glow, fill } = brush;
      const { cellW, cellH } = grid;
      const grown = smooth(0.02, 0.3, f.progress);
      if (grown <= 0) return;
      const r0 = Math.max(0, f.rowStart);
      const r1 = Math.min(grid.rows, f.rowEnd);

      // The moon's reflection: where it sits this frame (screen-locked).
      const my = f.viewTop + f.viewport * 0.42;
      const mRow = my / cellH - 0.5;
      const mCourse = course(Math.round(mRow));
      const mR = wide ? 4 : 3;
      const mRc = (mR / 0.6) * 0.95;
      const mCx = mCourse.x + mCourse.half * 0.15;
      const inMoon = (c: number, r: number) => Math.abs(r - mRow) < mR + 0.6 && Math.hypot((c - mCx) / (mRc + 1.5), (r - mRow) / (mR + 0.6)) < 1;

      for (let r = r0; r < r1; r++) {
        const { x, half } = course(r);
        fill(x - half, x + half, r, WATER_BODY, 0.62 * grown);
        fill(x - half * 0.55, x + half * 0.55, r, WATER_CORE, 0.45 * grown);
      }

      // Ripples, sliding downstream; moonlit glints on the crests.
      for (let r = r0; r < r1; r++) {
        const { x, half } = course(r);
        const c0 = Math.floor(x - half);
        const c1 = Math.ceil(x + half);
        for (let c = c0; c <= c1; c++) {
          const across = (c - x) / half;
          if (Math.abs(across) > 1 || inMoon(c, r)) continue;
          const a = Math.sin(r * 0.55 - f.t * 2.4 + c * 0.22 + Math.sin(c * 0.13 + f.t * 0.6) * 1.6);
          const b = Math.sin(r * 0.21 - f.t * 1.3 - c * 0.31);
          const v = a * 0.6 + b * 0.4;
          const edge = 1 - Math.abs(across);
          if (v < (edge > 0.5 ? 0.15 : -0.25)) continue;
          let ch = v > 0.5 ? "~" : v > 0.15 ? "-" : ".";
          let color = edge < 0.22 ? WATER : v > 0.5 ? WATER : WATER_DEEP;
          let alpha = (edge < 0.22 ? 0.55 : 0.4 + 0.25 * v) * grown;
          if (v > 0.7 && hash(c, r, Math.floor(f.t * 3)) < 0.035) {
            ch = "*";
            color = hash(c, r, 9) < 0.6 ? MOON : WATER_LIGHT;
            alpha = 0.95 * grown;
          }
          put(c, r, ch, color, alpha);
        }
        for (const side of [-1, 1]) {
          const bank = x + side * (half + 0.6);
          put(bank, r, hash(r, side, 3) < 0.5 ? ":" : ".", SAND, 0.6 * grown);
          if (hash(r, side, 4) < 0.45) put(bank + side, r, ".", SAND, 0.35 * grown);
        }
      }

      for (const rd of reeds) {
        if (rd.row < r0 || rd.row >= r1) continue;
        const { x, half } = course(rd.row);
        const col = x + rd.side * (half + 2.2);
        const sway = Math.sin(f.t * 1.4 + rd.row * 0.7) > 0.6 ? (rd.side > 0 ? "/" : "\\") : null;
        const isStone = rd.glyph === "(" || rd.glyph === "o";
        const glyph = rd.glyph === "|" && sway ? sway : rd.glyph;
        if (glyph === "(") {
          put(col, rd.row, "(", STONE, 0.6 * grown);
          put(col + 1, rd.row, ")", STONE, 0.6 * grown);
          continue;
        }
        put(col, rd.row, glyph, isStone ? STONE : rd.tall ? "#c9a46a" : LEAF, (isStone ? 0.6 : 0.75) * grown);
        if (rd.tall) put(col, rd.row + 1, "|", LEAF, 0.7 * grown);
      }

      // The moon on the water: a soft pool of light, then the disc itself,
      // each row sheared by the swell and broken where a trough passes.
      glow((mCx + 0.5) * cellW, my, mR * cellH * 3.6, "rgba(230,236,247,0.28)", grown);
      for (let r = Math.floor(mRow - mR - 1); r <= Math.ceil(mRow + mR + 1); r++) {
        if (r < r0 || r >= r1) continue;
        const { x, half } = course(r);
        const wob = Math.sin(r * 1.3 + f.t * 2.2) * 0.9;
        for (let c = Math.floor(mCx - mRc - 2); c <= Math.ceil(mCx + mRc + 2); c++) {
          if (Math.abs(c - x) > half - 0.5) continue;
          const d = Math.hypot((c - wob - mCx) / mRc, (r - mRow) / mR);
          if (d >= 1) continue;
          if (d > 0.3 && Math.sin(r * 2.3 - f.t * 2.8 + c * 0.35) < -0.55) continue;
          const ch = d < 0.5 ? "@" : d < 0.75 ? "=" : d < 0.9 ? "-" : ".";
          put(c, r, ch, MOON, (d < 0.5 ? 1 : d < 0.75 ? 0.85 : d < 0.9 ? 0.65 : 0.45) * grown);
        }
      }
      // Its glitter path, up and down the current, thinning with distance.
      for (let k = 1; k <= 14; k++) {
        for (const dir of [1, -1]) {
          if (dir < 0 && k > 8) continue;
          const r = Math.round(mRow + dir * (mR + k));
          if (r < r0 || r >= r1) continue;
          if (hash(r, k, Math.floor(f.t * 4)) > 0.6 - k * 0.028) continue;
          const c = mCx + Math.sin(r * 0.9 + f.t * 1.5) * 1.4 + (hash(r, 7) - 0.5) * 2;
          const { x, half } = course(r);
          if (Math.abs(c - x) > half - 0.5) continue;
          put(c, r, hash(r, k, 3) < 0.5 ? "-" : "~", MOON, (0.8 - k * 0.04) * grown);
        }
      }

      for (const pd of pads) {
        if (pd.row < r0 || pd.row >= r1) continue;
        const { x, half } = course(pd.row);
        const col = x + pd.off * half + Math.sin(f.t * 0.6 + pd.row) * 0.6;
        put(col, pd.row, "@", LEAF, 0.8 * grown);
        put(col + 1, pd.row, ")", LEAF_DARK, 0.7 * grown);
        if (pd.flower) put(col, pd.row - 1, "*", pd.flower, (0.8 + 0.2 * Math.sin(f.t * 2 + pd.row)) * grown);
      }

      for (const d of drifts) {
        const y = (d.y + f.t * d.speed * (1.3 - Math.abs(d.off) * 0.6)) % grid.height;
        const row = y / cellH;
        if (row < r0 || row >= r1) continue;
        const { x, half } = course(Math.floor(row));
        put(x + d.off * half + Math.sin(f.t * 0.8 + d.y) * 0.5, row - 0.5, d.glyph, d.color, 0.8 * grown);
      }

      for (let r = r0; r < r1; r++) {
        for (const [c0, c1] of shade[r]) fill(c0, c1, r, SHADE, 0.5 * grown);
      }
      const tick = Math.floor(f.t * 2);
      const pc = f.pointer ? f.pointer.x / cellW : -1e9;
      const pr = f.pointer ? f.pointer.y / cellH : -1e9;
      for (let r = r0; r < r1; r++) {
        const row = trees[r];
        if (!row.length) continue;
        for (const [c0, c1] of beds[r]) fill(c0, c1, r, CANOPY_BED, 0.8 * grown);
        for (const t of row) {
          const near = Math.abs(t.col - pc) < 9 && Math.abs(r - pr) < 6;
          const roll = hash(t.col, r, near ? Math.floor(f.t * 12) : tick);
          let ch = t.ch;
          if (roll < (near ? 0.45 : 0.03) && t.ch !== "*" && t.ch !== "@") {
            const i = RAMP.indexOf(ch);
            ch = RAMP[Math.max(0, Math.min(RAMP.length - 1, i + (roll < (near ? 0.22 : 0.015) ? 1 : -1)))];
          }
          put(t.col, r, ch, t.color, t.alpha * grown);
        }
      }

      drawFlies(brush, grid, f, flies, smooth(0.05, 0.4, f.progress));
    },
  };
}

/* -------------------------------------------------------- 02:00 stars --- */

type FlowStar = { a: number; r: number; z: number; phase: number; tint: string };

/**
 * The deepest hour: nothing but sky. The layer lives in the tunnel's sticky
 * frame, so its grid *is* the viewport; the stars come out of the vanishing
 * point the logos fly from and stream outward, slow near the centre and faster
 * at the edge, the nearest ones dragging a short trail. Now and then one falls.
 *
 * Point at the sky and the stars around the pointer join up into a
 * constellation — each to its nearest neighbour in the group.
 */
function stars(): Scene {
  let grid: Grid;
  let list: FlowStar[] = [];
  let rnd = mulberry(23);
  const met: Meteor = { x: 0, y: 0, vx: 0, vy: 0, life: 0, wait: 3 };
  return {
    setup(g) {
      grid = g;
      rnd = mulberry(23);
      const n = Math.round(Math.min(240, (g.width * g.height) / 5200));
      list = Array.from({ length: n }, () => {
        const k = rnd();
        return { a: rnd() * 6.28, r: rnd(), z: rnd(), phase: rnd() * 6.28, tint: k < 0.14 ? LILAC : k < 0.2 ? ACID : STAR };
      });
    },
    draw(brush, f) {
      const { put } = brush;
      const { width: W, height: H, cellW, cellH } = grid;
      const cx = W / 2;
      const cy = H / 2;
      const reach = Math.hypot(cx, cy);
      const pos = (s: FlowStar) => ({ x: cx + Math.cos(s.a) * s.r * reach, y: cy + Math.sin(s.a) * s.r * reach * 0.9 });
      const pts: { x: number; y: number; s: FlowStar }[] = [];
      for (const s of list) {
        s.r += f.dt * (0.006 + s.r * 0.05) * (0.4 + s.z);
        if (s.r > 1.05) {
          s.r = 0.03 + rnd() * 0.2;
          s.a = rnd() * 6.28;
        }
        const p = pos(s);
        // Faint out of the vanishing point, full by a third of the way out.
        const emerge = smooth(0.04, 0.35, s.r);
        const tw = 0.5 + 0.5 * Math.sin(f.t * (1 + s.z * 1.5) + s.phase * 3);
        const a = emerge * (0.4 + 0.6 * tw) * (0.5 + 0.5 * s.z) * f.enter;
        const ch = s.z > 0.86 ? "*" : s.z > 0.5 ? "+" : ".";
        if (s.z > 0.95) brush.glow(p.x, p.y, 12, "rgba(223,230,255,0.5)", a);
        put(p.x / cellW - 0.5, p.y / cellH - 0.5, ch, s.tint, a);
        if (s.z > 0.72 && s.r > 0.45) {
          const back = { ...s, r: s.r - 0.035 };
          const q = pos(back);
          put(q.x / cellW - 0.5, q.y / cellH - 0.5, ".", s.tint, a * 0.45);
        }
        pts.push({ ...p, s });
      }

      if (f.pointer) {
        const near = pts
          .map((p) => ({ ...p, d: Math.hypot(p.x - f.pointer!.x, p.y - f.pointer!.y) }))
          .filter((p) => p.d < 180 && smooth(0.04, 0.35, p.s.r) > 0.5)
          .sort((a, b) => a.d - b.d)
          .slice(0, 7);
        for (const p of near) {
          let best: (typeof near)[number] | null = null;
          let bd = Infinity;
          for (const q of near) {
            if (q === p) continue;
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bd) {
              bd = d;
              best = q;
            }
          }
          const fade = (1 - p.d / 180) * f.enter;
          if (best) {
            const steps = Math.floor(bd / (cellW * 1.3));
            for (let i = 1; i < steps; i++) {
              const t = i / steps;
              put((p.x + (best.x - p.x) * t) / cellW - 0.5, (p.y + (best.y - p.y) * t) / cellH - 0.5, ".", LILAC, 0.8 * fade);
            }
          }
          put(p.x / cellW - 0.5, p.y / cellH - 0.5, "*", ACID, 0.95 * fade);
        }
      }

      stepMeteor(met, rnd, brush, grid, f, () => [W * (0.1 + rnd() * 0.8), H * (0.05 + rnd() * 0.3)], [5, 10]);
    },
  };
}

/* ------------------------------------------------------ 04:30 predawn --- */

/**
 * The hour before dawn, behind the commit graph. The stars are going out —
 * they thin as the chapter is read — except one: the morning star, low and
 * steady over the hills. Along the foot of the chapter the first light is a
 * violet line behind two ridges of hills, the near one wooded, both cut out
 * of the glow as solid silhouettes with a lilac rim where the light catches
 * them. The glow brightens as the foot comes up the screen.
 */
function predawn(): Scene {
  let grid: Grid;
  let sky: Star[] = [];
  let farRuns: [number, number][][] = [];
  let nearRuns: [number, number][][] = [];
  let farTop: number[] = [];
  let nearTop: number[] = [];
  let pines: { col: number; top: number }[] = [];
  let venus = { x: 0, y: 0 };
  let glowH = 0;

  const runs = (rows: number, top: (c: number) => number, cols: number) => {
    const out: [number, number][][] = Array.from({ length: rows }, () => []);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r < top(c)) continue;
        const list = out[r];
        const last = list[list.length - 1];
        if (last && last[1] === c) last[1] = c + 1;
        else list.push([c, c + 1]);
      }
    }
    return out;
  };

  return {
    setup(g) {
      grid = g;
      const rnd = mulberry(31);
      const p1 = rnd() * 6.28;
      const p2 = rnd() * 6.28;
      const scale = 12 / g.cellH; // ridges in px, not rows
      const ridge = (c: number, base: number, amp: number, k: number) =>
        base + amp * (0.55 * Math.sin(c * 0.035 * k + p1 * k) + 0.3 * Math.sin(c * 0.11 * k + p2) + 0.15 * Math.sin(c * 0.31 + k));
      farTop = Array.from({ length: g.cols }, (_, c) => g.rows - Math.round(ridge(c, 8, 3, 1) * scale));
      nearTop = Array.from({ length: g.cols }, (_, c) => g.rows - Math.round(ridge(c, 3.6, 1.8, 1.7) * scale));
      // Pines on the near ridge: little stacked triangles of cells.
      pines = [];
      const treeTop = [...nearTop];
      for (let c = 1; c < g.cols - 1; c++) {
        if (rnd() > 0.16) continue;
        const h = 2 + Math.floor(rnd() * 3);
        pines.push({ col: c, top: nearTop[c] - h });
        for (let i = 0; i < h; i++) {
          const w = Math.floor(i * 0.7);
          for (let dc = -w; dc <= w; dc++) {
            const cc = c + dc;
            if (cc >= 0 && cc < g.cols) treeTop[cc] = Math.min(treeTop[cc], nearTop[c] - h + i);
          }
        }
      }
      farRuns = runs(g.rows, (c) => farTop[c], g.cols);
      nearRuns = runs(g.rows, (c) => treeTop[c], g.cols);
      glowH = Math.min(g.height * 0.6, 560);
      sky = scatterStars(rnd, (g.cols * g.rows) / 300, g.width, 0, g.height - glowH * 0.6);
      venus = { x: g.width * (g.width < 640 ? 0.74 : 0.8), y: g.height - glowH * 0.42 };
    },
    draw({ put, glow, fill, band }, f) {
      const { height: H, cellW, cellH, rows } = grid;
      // Light comes up with the horizon: dim when the foot is below the
      // screen, full once it is well up it.
      const light = f.reduced ? 1 : 0.35 + 0.65 * smooth(f.viewport * 1.2, f.viewport * 0.35, footOnScreen(grid, f));

      drawStars(put, grid, f, sky, (1 - 0.75 * smooth(0.25, 0.85, f.progress)) * f.enter);

      band(H - glowH, H, [
        [0, VIOLET, 0],
        [0.5, VIOLET, 0.32 * light],
        [0.82, LILAC, 0.04 + 0.12 * light],
        [1, PINK, 0.16 * light],
      ]);

      const tw = 0.85 + 0.15 * Math.sin(f.t * 1.3);
      glow(venus.x, venus.y, 22, "rgba(242,242,240,0.4)", tw * f.enter);
      put(venus.x / cellW - 0.5, venus.y / cellH - 0.5, "*", INK, tw * f.enter);

      const r0 = Math.max(0, f.rowStart);
      const r1 = Math.min(rows, f.rowEnd);
      for (let r = r0; r < r1; r++) for (const [c0, c1] of farRuns[r]) fill(c0, c1, r, "#120b22", 1);
      for (let c = 0; c < grid.cols; c++) {
        const r = farTop[c];
        if (r < r0 || r >= r1) continue;
        const ch = farTop[c + 1] < r ? "/" : (farTop[c - 1] ?? r) < r ? "\\" : "_";
        put(c, r - 0.4, ch, LILAC, 0.28 * light);
      }
      for (let r = r0; r < r1; r++) for (const [c0, c1] of nearRuns[r]) fill(c0, c1, r, VOID, 1);
      for (const p of pines) {
        if (p.top < r0 || p.top >= r1) continue;
        put(p.col, p.top - 0.3, "^", "#6b4fa0", 0.55 * light);
      }
    },
  };
}

/* --------------------------------------------------------- 05:45 dawn --- */

type Bloom = { col: number; row: number; kind: number; phase: number; stem: number; color: string };

/**
 * Dawn, over the works. Flowers are scattered over the whole section and the
 * tiles hide most of them, so only the gaps bloom; each opens as it rises
 * through the lower part of the screen — bud, head, petals — with dew on it.
 *
 * The last of the violet hangs along the top, carried over from the hills of
 * Chapter .04, and at the foot the sun comes up: a disc of glyphs rising out
 * of a meadow as the chapter's bottom edge climbs the screen, rays turning
 * slowly, the sky going pink to peach to gold behind it.
 */
function dawn(): Scene {
  let grid: Grid;
  let list: Bloom[] = [];
  let grass: { col: number; ch: string; tall: boolean }[] = [];
  const colors = [LILAC, PINK, PEACH, INK];
  return {
    setup(g) {
      grid = g;
      const rnd = mulberry(37);
      const n = Math.round((g.cols * g.rows) / 260);
      list = Array.from({ length: n }, () => ({
        col: Math.floor(rnd() * g.cols),
        row: 3 + Math.floor(rnd() * (g.rows - 8)),
        kind: Math.floor(rnd() * 3),
        phase: rnd() * 6.28,
        stem: 2 + Math.floor(rnd() * 3),
        color: colors[Math.floor(rnd() * colors.length)],
      }));
      grass = [];
      for (let c = 0; c < g.cols; c += 1 + Math.floor(rnd() * 2)) {
        const k = rnd();
        grass.push({ col: c, ch: k < 0.3 ? "," : k < 0.55 ? "|" : k < 0.75 ? "/" : k < 0.9 ? "\\" : "'", tall: rnd() < 0.3 });
      }
    },
    draw({ put, glow, band }, f) {
      const { width: W, height: H, cellH, rows } = grid;
      const foot = footOnScreen(grid, f);
      const rise = f.reduced ? 0.8 : smooth(f.viewport * 1.05, f.viewport * 0.3, foot);
      const light = f.reduced ? 1 : smooth(f.viewport * 1.3, f.viewport * 0.4, foot);

      band(0, Math.min(H * 0.25, 520), [
        [0, VIOLET, 0.24],
        [1, VIOLET, 0],
      ]);
      const gh = Math.min(H * 0.5, 640);
      band(H - gh, H, [
        [0, VIOLET, 0],
        [0.4, PINK, 0.1 * light],
        [0.78, PEACH, 0.24 * light],
        [1, SUN, 0.34 * light],
      ]);

      // The sun, behind the meadow line.
      const horizon = H - cellH * 1.4;
      const R = (W < 640 ? 85 : Math.min(W * 0.1, 150)) / cellH;
      const sx = W * (W < 640 ? 0.5 : 0.66);
      const sy = horizon + R * cellH * (0.95 - 1.35 * rise);
      if (rise > 0.01) {
        glow(sx, sy, R * cellH * 2.6, "rgba(255,210,63,0.4)", rise);
        rays(put, grid, f, sx, sy, R * cellH * 1.3, R * cellH * 2.1, 14, SUN_RAY, 0.5 * rise, horizon);
        disc(put, grid, sx, sy, R, (_dx, _dy, d, c, r) => {
          const n = (hash(c, r, Math.floor(f.t * 3)) - 0.5) * 0.08;
          if (d + n < 0.55) return ["@", SUN_HOT, rise];
          if (d + n < 0.82) return ["#", SUN, 0.95 * rise];
          return [d < 0.94 ? "*" : "+", PEACH, 0.85 * rise];
        }, horizon);
      }

      for (const gr of grass) {
        put(gr.col, rows - 1, gr.ch, LEAF_DARK, 0.85);
        if (gr.tall) put(gr.col, rows - 2, Math.sin(f.t * 1.3 + gr.col) > 0.5 ? "/" : "|", LEAF_DARK, 0.7);
      }

      for (const b of list) {
        if (b.row < f.rowStart || b.row - 3 > f.rowEnd) continue;
        const screenY = b.row * cellH - f.viewTop;
        const open = f.reduced ? 1 : smooth(f.viewport * 0.98, f.viewport * 0.55, screenY);
        if (open <= 0.02) continue;
        const sway = Math.sin(f.t * 1.3 + b.phase) * 0.35 * open;
        const stem = Math.ceil(b.stem * Math.min(1, open * 1.6));
        for (let i = 0; i < stem; i++) {
          put(b.col + sway * (i / b.stem), b.row - i, i === 1 && b.stem > 2 ? (b.phase > 3 ? "/" : "\\") : "|", LEAF, 0.5);
        }
        const hx = b.col + sway;
        const hy = b.row - stem;
        if (open < 0.45) {
          put(hx, hy, open < 0.25 ? "." : "o", LEAF_LIGHT, 0.7);
          continue;
        }
        const tw = 0.8 + 0.2 * Math.sin(f.t * 2.2 + b.phase);
        if (b.kind === 0) {
          put(hx, hy, "@", SUN, tw);
          put(hx - 1, hy, "(", b.color, 0.85 * tw);
          put(hx + 1, hy, ")", b.color, 0.85 * tw);
        } else if (b.kind === 1) {
          put(hx, hy, "*", b.color, tw);
          put(hx - 1, hy, "-", INK, 0.6);
          put(hx + 1, hy, "-", INK, 0.6);
          put(hx, hy - 1, ".", INK, 0.5);
        } else {
          put(hx, hy, "V", PINK, tw);
          put(hx - 1, hy - 1, "\\", PINK, 0.7);
          put(hx + 1, hy - 1, "/", PINK, 0.7);
        }
        // Dew: a bead on the petal that catches the light now and then.
        if (open > 0.9 && hash(b.col, b.row, Math.floor(f.t * 1.5 + b.phase)) < 0.12) {
          put(hx + 1, hy - 1, "'", SUN_HOT, 0.9);
        }
      }
    },
  };
}

/* ----------------------------------------------------- 09:00 daylight --- */

type Fly = { ax: number; ay: number; bx: number; by: number; phase: number; speed: number; ox: number; oy: number };
type Cloud = { cells: { dc: number; dr: number; ch: string }[]; runs: [number, number, number][]; w: number; x0: number; yf: number; speed: number };
type Flock = { x: number; y: number; dir: number; speed: number; n: number; wait: number; active: boolean };

/**
 * The day, over the record. The ground is the sky now, and the record is read
 * under it the way a working day is lived: the sun comes up on the left as the
 * chapter opens, is overhead halfway through, and is low on the right by the
 * last entry. Clouds drift across, birds go over in a V now and then, and the
 * butterflies are out — they flee the pointer.
 *
 * Everything here lives in viewport space: the chapter is many screens tall,
 * and wherever the reader is in it the sky is above them.
 */
function daylight(): Scene {
  let grid: Grid;
  let flies: Fly[] = [];
  let clouds: Cloud[] = [];
  let rnd = mulberry(53);
  const flock: Flock = { x: 0, y: 0, dir: 1, speed: 90, n: 5, wait: 0, active: true };
  const FRAMES = ["{@}", "(@)", " | ", "(@)"];

  const makeCloud = (w: number, h: number): Cloud => {
    const lobes: [number, number, number, number][] = [[w / 2, h * 0.62, w / 2, h * 0.42]];
    const bumps = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < bumps; i++) {
      const lx = w * (0.25 + 0.5 * (i / Math.max(1, bumps - 1))) + (rnd() - 0.5) * 2;
      lobes.push([lx, h * 0.42, w * (0.16 + rnd() * 0.08), h * (0.38 + rnd() * 0.18)]);
    }
    const base = Math.round(h * 0.95);
    const inside = (c: number, r: number) =>
      r <= base && r >= 0 && lobes.some(([lx, ly, rx, ry]) => Math.hypot((c + 0.5 - lx) / rx, (r + 0.5 - ly) / ry) < 1);
    const cells: Cloud["cells"] = [];
    const runs: Cloud["runs"] = [];
    for (let r = -1; r <= base + 1; r++) {
      let start = -1;
      for (let c = -1; c <= w + 1; c++) {
        const inn = inside(c, r);
        if (inn && start < 0) start = c;
        if (!inn && start >= 0) {
          runs.push([start, c, r]);
          start = -1;
        }
        if (!inn) continue;
        const up = !inside(c, r - 1);
        const dn = !inside(c, r + 1);
        const lf = !inside(c - 1, r);
        const rt = !inside(c + 1, r);
        let ch = "";
        if (up && lf) ch = "/";
        else if (up && rt) ch = "\\";
        else if (dn && lf) ch = "\\";
        else if (dn && rt) ch = "/";
        else if (up) ch = hash(c, r, 5) < 0.3 ? "." : "-";
        else if (dn) ch = "_";
        else if (lf) ch = "(";
        else if (rt) ch = ")";
        if (ch) cells.push({ dc: c, dr: r, ch });
      }
    }
    return { cells, runs, w, x0: 0, yf: 0, speed: 0 };
  };

  return {
    setup(g) {
      grid = g;
      rnd = mulberry(53);
      flies = Array.from({ length: g.width < 640 ? 4 : 7 }, () => ({
        ax: 0.6 + rnd() * 0.9,
        ay: 0.5 + rnd() * 0.8,
        bx: rnd() * 6.28,
        by: rnd() * 6.28,
        phase: rnd() * 6.28,
        speed: 0.08 + rnd() * 0.08,
        ox: 0,
        oy: 0,
      }));
      const small = g.width < 640;
      clouds = Array.from({ length: small ? 2 : 4 }, (_, i) => {
        const w = small ? 9 + Math.floor(rnd() * 6) : 12 + Math.floor(rnd() * 12);
        const cl = makeCloud(w, 3 + Math.floor(rnd() * 2));
        cl.x0 = rnd() * g.width;
        cl.yf = 0.12 + (i / Math.max(1, (small ? 2 : 4) - 1)) * 0.5 + (rnd() - 0.5) * 0.08;
        cl.speed = 6 + rnd() * 8;
        return cl;
      });
      Object.assign(flock, { x: g.width * 0.3, y: 0.22, dir: 1, speed: 90, n: 5, wait: 0, active: true });
    },
    draw({ put, glow, fill }, f) {
      const { width: W, cellW, cellH } = grid;
      const vh = f.viewport;
      const top = f.viewTop;

      // The sun, crossing the day as the record is read.
      const day = f.reduced ? 0.5 : smooth(0.12, 0.9, f.progress);
      const R = W < 640 ? 2 : 2.6;
      const sx = W * (0.1 + 0.8 * day);
      const sy = top + vh * (0.6 - 0.44 * Math.sin(Math.PI * day));
      glow(sx, sy, R * cellH * 3.2, "rgba(255,247,214,0.75)", f.enter);
      rays(put, grid, f, sx, sy, R * cellH * 1.35, R * cellH * 2, 12, SUN_RAY, 0.8 * f.enter);
      disc(put, grid, sx, sy, R, (_dx, _dy, d) =>
        d < 0.55 ? ["@", SUN, f.enter] : d < 0.85 ? ["O", SUN, 0.95 * f.enter] : ["o", SUN_RAY, 0.85 * f.enter],
      );

      for (const cl of clouds) {
        const span = W + cl.w * cellW * 2;
        const x = ((((cl.x0 + f.t * cl.speed) % span) + span) % span) - cl.w * cellW;
        const c0 = x / cellW;
        const r0 = (top + vh * cl.yf) / cellH;
        for (const [a, b, r] of cl.runs) fill(c0 + a, c0 + b, r0 + r, CLOUD, 0.2 * f.enter);
        for (const cell of cl.cells) put(c0 + cell.dc, r0 + cell.dr, cell.ch, CLOUD, 0.9 * f.enter);
      }

      // A V of birds, now and then, from one side to the other.
      if (!flock.active) {
        flock.wait -= f.dt;
        if (flock.wait <= 0 && f.dt > 0) {
          flock.dir = rnd() < 0.5 ? 1 : -1;
          flock.x = flock.dir > 0 ? -80 : W + 80;
          flock.y = 0.12 + rnd() * 0.28;
          flock.speed = 70 + rnd() * 45;
          flock.n = 3 + Math.floor(rnd() * 4);
          flock.active = true;
        }
      } else {
        flock.x += flock.dir * flock.speed * f.dt;
        if (flock.x < -200 || flock.x > W + 200) {
          flock.active = false;
          flock.wait = 6 + rnd() * 8;
        }
        for (let i = 0; i < flock.n; i++) {
          const rank = Math.ceil(i / 2);
          const side = i % 2 ? 1 : -1;
          const bx = flock.x - flock.dir * rank * cellW * 2.4;
          const by = top + vh * flock.y + side * rank * cellH * 0.55 + Math.sin(f.t * 1.7 + i) * 3;
          const ch = Math.sin(f.t * 9 + i * 1.3) > -0.2 ? "v" : "-";
          put(bx / cellW - 0.5, by / cellH - 0.5, ch, VOID, 0.8 * f.enter);
        }
      }

      const pos = (b: Fly, t: number) => {
        const s = t * b.speed;
        return {
          x: W * (0.5 + 0.44 * Math.sin(s * b.ax * 6.28 + b.bx)) + b.ox,
          y: top + vh * (0.5 + 0.4 * Math.sin(s * b.ay * 6.28 + b.by)) + b.oy,
        };
      };
      for (const b of flies) {
        const p = pos(b, f.t);
        if (f.pointer) {
          const dx = p.x - f.pointer.x;
          const dy = p.y - f.pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < 150 && d > 0.01) {
            const k = (1 - d / 150) * 420 * f.dt;
            b.ox += (dx / d) * k;
            b.oy += (dy / d) * k;
          }
        }
        b.ox *= Math.exp(-f.dt * 0.8);
        b.oy *= Math.exp(-f.dt * 0.8);
        for (let k = 1; k <= 4; k++) {
          const q = pos(b, f.t - k * 0.35);
          put(q.x / cellW - 0.5, q.y / cellH - 0.5, ".", VOID, 0.7 - k * 0.14);
        }
        const frame = FRAMES[Math.floor(f.t * 9 + b.phase) % FRAMES.length];
        const col = p.x / cellW - 0.5;
        const row = p.y / cellH - 0.5;
        for (let i = 0; i < 3; i++) if (frame[i] !== " ") put(col - 1 + i, row, frame[i], VOID, 0.9 * f.enter);
      }
    },
  };
}

/* --------------------------------------------------------- 18:30 dusk --- */

type Leaf = { col: number; row: number; dens: number; shade: number; rim: number; far: boolean; seed: number; blossom: string | null };
type Riser = { x: number; y: number; phase: number; speed: number; drift: number; lilac: boolean };

/**
 * Dusk, under the contact form, read as the sky darkening downward: the top
 * of the chapter carries the last of the day from Chapter .06 — a thin peach
 * edge, then pink, then violet — and it deepens through the void to the
 * footer's own night indigo at the foot, so the two grounds meet without a
 * seam. The first stars show in the violet; the hedges along the bottom are
 * silhouettes with a faint lilac rim from what light is left, and the
 * fireflies come out of them as the foot of the chapter comes up the screen.
 * This is the exception to "the foot is the horizon": here the page itself is
 * the sky going dark, and the footer below is the night it goes into.
 */
function dusk(): Scene {
  let grid: Grid;
  let leaves: Leaf[] = [];
  let risers: Riser[] = [];
  let evening: Star[] = [];
  const RAMP = ".:;*o&%@";

  const bushAt = (x: number, y: number, spacing: number, baseY: number, salt: number) => {
    let best = -1;
    let lit = 0;
    const j0 = Math.floor(x / spacing);
    for (let k = -1; k <= 1; k++) {
      const j = j0 + k;
      const s = hash(j, salt);
      if (s < 0.15) continue;
      const cx = (j + 0.5 + (s - 0.5) * 0.7) * spacing;
      const r = spacing * (0.4 + 0.25 * hash(j, salt, 7));
      const lobes: [number, number, number][] = [
        [cx, baseY - r * 0.45, r],
        [cx - r * 0.66, baseY - r * 0.05, r * 0.72],
        [cx + r * 0.62, baseY, r * 0.66],
      ];
      for (const [lx, ly, lr] of lobes) {
        const dx = (x - lx) / lr;
        const dy = (y - ly) / lr;
        const d = Math.hypot(dx, dy) + (hash(Math.floor(x / 9), Math.floor(y / 9), salt) - 0.5) * 0.18;
        if (1 - d > best) {
          best = 1 - d;
          const n = Math.hypot(dx, dy) || 1;
          lit = Math.min(1, Math.max(0, ((dx / n) * -0.35 + (dy / n) * -0.94) * 0.5 + 0.5));
        }
      }
    }
    if (y > baseY + spacing * 0.2) best = Math.max(best, 0.3);
    return { inside: best, lit };
  };

  return {
    setup(g) {
      grid = g;
      leaves = [];
      const band = Math.min(g.height * 0.5, 320);
      const top = Math.max(0, Math.floor((g.height - band) / g.cellH));
      for (let r = top; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const x = (c + 0.5) * g.cellW;
          const y = (r + 0.5) * g.cellH;
          const near = bushAt(x, y, g.width < 640 ? 150 : 210, g.height - band * 0.15, 3);
          const far = bushAt(x, y, g.width < 640 ? 90 : 120, g.height - band * 0.45, 9);
          const pick = near.inside > 0 ? { ...near, far: false } : far.inside > 0 ? { ...far, far: true } : null;
          if (!pick) continue;
          const seed = hash(c, r, 41);
          if (pick.inside < 0.06 && seed > pick.inside / 0.06) continue;
          const rim = 1 - smooth(0, 0.14, pick.inside);
          const shade = (0.1 + 0.9 * pick.lit * pick.lit) * (0.3 + 0.7 * smooth(0.1, 0.8, 1 - pick.inside));
          const dens = Math.min(1, Math.max(shade * (0.5 + 0.7 * hash(Math.floor(c / 3), Math.floor(r / 2), 5)), rim * (0.32 + 0.63 * pick.lit), 0.16));
          if (dens < 0.1) continue;
          const bl = !pick.far && shade > 0.6 && seed > 0.975 ? (seed > 0.99 ? ACID : seed > 0.983 ? PINK : LILAC) : null;
          leaves.push({ col: c, row: r, dens, shade, rim: rim * pick.lit, far: pick.far, seed, blossom: bl });
        }
      }
      const rnd = mulberry(71);
      risers = Array.from({ length: g.width < 640 ? 8 : 14 }, () => ({
        x: rnd() * g.width,
        y: rnd(),
        phase: rnd() * 6.28,
        speed: 0.03 + rnd() * 0.04,
        drift: 20 + rnd() * 40,
        lilac: rnd() < 0.25,
      }));
      evening = scatterStars(rnd, (g.cols * g.rows) / 700, g.width, g.cellH * 3, Math.min(g.height * 0.45, 600));
    },
    draw({ put, glow }, f) {
      const { width: W, height: H, rows } = grid;
      const foot = footOnScreen(grid, f);
      // 1 → 0 as the foot climbs the screen: the light going.
      const night = f.reduced ? 0.6 : smooth(f.viewport * 1.1, f.viewport * 0.3, foot);
      const grown = smooth(0.1, 0.75, f.enter);

      // The sky itself (magenta → violet → void → night) is the section's CSS
      // background, with the slats above it — see `contact.tsx`.
      drawStars(put, grid, f, evening, 0.45 + 0.4 * night);

      const tick = Math.floor(f.t * 2);
      for (const l of leaves) {
        if (l.row < f.rowStart || l.row > f.rowEnd) continue;
        if (rows - l.row > grown * 60 + 2) continue;
        let dens = l.dens;
        const near = f.pointer && Math.hypot(f.pointer.x - (l.col + 0.5) * grid.cellW, f.pointer.y - (l.row + 0.5) * grid.cellH) < 90;
        const roll = hash(l.col, l.row, near ? Math.floor(f.t * 12) : tick);
        if (roll < (near ? 0.5 : 0.04)) dens = Math.min(1, Math.max(0.1, dens + (roll < (near ? 0.25 : 0.02) ? 0.18 : -0.18)));
        if (l.blossom) {
          put(l.col, l.row, l.seed > 0.993 ? "@" : "*", l.blossom, 0.7 + 0.15 * Math.sin(f.t * 2.4 + l.seed * 30));
          continue;
        }
        const ch = RAMP[Math.round(dens * (RAMP.length - 1))];
        // Silhouettes: only the crowns' rims catch what light is left.
        if (!l.far && l.rim > 0.42) {
          put(l.col, l.row, ch, LILAC, 0.25 + 0.3 * l.rim * (1 - 0.5 * night));
          continue;
        }
        const color = l.far ? "#3a3266" : l.shade > 0.6 ? LEAF : LEAF_DARK;
        put(l.col, l.row, ch, color, l.far ? 0.55 : 0.45 + 0.3 * l.shade);
      }

      for (const fl of risers) {
        const life = (f.t * fl.speed + fl.y) % 1;
        const x = fl.x + Math.sin(f.t * 0.5 + fl.phase) * fl.drift;
        const y = H - 30 - life * Math.min(H * 0.7, 520);
        const fade = Math.sin(life * Math.PI) * (0.55 + 0.45 * Math.sin(f.t * 2 + fl.phase * 3)) * grown * (0.3 + 0.7 * night);
        glow(x, y, 26, fl.lilac ? "rgba(203,167,245,0.5)" : "rgba(225,255,0,0.55)", fade * 0.7);
        put(x / grid.cellW - 0.5, y / grid.cellH - 0.5, fade > 0.6 ? "*" : "+", fl.lilac ? LILAC : ACID, fade);
        if (x < -40 || x > W + 40) fl.x = (fl.x + W) % W;
      }
    },
  };
}

/* -------------------------------------------------------- 23:59 night --- */

type Tuft = { col: number; lines: string[]; phase: number; alpha: number; mush: boolean };

const CRESCENT = ["  .--''", " / .'", "|  |", " \\ '.", "  '--.."];
const CRESCENT_SMALL = [" .-'", "/ /", "\\ \\", " '-."];

/**
 * The night the page ends in — the same night the hero opens on. A crescent
 * moon in the top corner, clear of the wordmark, with the faint earthshine of
 * the rest of its disc; stars over the whole footer and the odd one falling;
 * along the bottom edge the garden's grass and mushrooms in silhouette,
 * growing up out of the edge as the footer comes in, a few fireflies over it.
 */
function night(): Scene {
  let grid: Grid;
  let tufts: Tuft[] = [];
  let sky: Star[] = [];
  let flies: Firefly[] = [];
  let rnd = mulberry(89);
  const met: Meteor = { x: 0, y: 0, vx: 0, vy: 0, life: 0, wait: 6 };
  const GRASS = [
    ["\\|/", ",|,"],
    ["\\/", "||"],
    ["|/", ",|"],
    ["v", "|"],
    ["\\|", "|,"],
  ];
  const MUSHROOMS = [["/^\\", " | "], ["(_)", " | "], [".-.", "|_|"]];
  return {
    setup(g) {
      grid = g;
      rnd = mulberry(89);
      tufts = [];
      for (let c = 1; c < g.cols - 2; ) {
        const mush = rnd() < 0.08;
        const lines = mush ? MUSHROOMS[Math.floor(rnd() * MUSHROOMS.length)] : GRASS[Math.floor(rnd() * GRASS.length)];
        tufts.push({ col: c, lines, phase: rnd() * 6.28, alpha: mush ? 0.75 : 0.45 + rnd() * 0.35, mush });
        c += lines[0].length + 1 + Math.floor(rnd() * 4);
      }
      sky = scatterStars(rnd, Math.min(160, (g.cols * g.rows) / 220), g.width, 0, g.height - g.cellH * 3);
      flies = scatterFlies(rnd, g.width < 640 ? 3 : 5, g.width, g.height - g.cellH * 6, g.height - g.cellH * 2);
    },
    draw(brush, f) {
      const { put, glow } = brush;
      const { width: W, rows, cellW, cellH } = grid;
      const grown = smooth(0.15, 0.9, f.enter);

      drawStars(put, grid, f, sky, 0.85 * f.enter);
      stepMeteor(met, rnd, brush, grid, f, () => [W * (0.15 + rnd() * 0.7), cellH * (2 + rnd() * 10)], [9, 16]);

      // The crescent, drawn rather than computed — at this size a shaded
      // disc reads as a smudge, a drawn limb reads as a moon. In the footer's
      // top padding at the right, clear of the wordmark.
      const small = W < 640;
      const art = small ? CRESCENT_SMALL : CRESCENT;
      const mc = Math.floor(grid.cols - (small ? 7 : 16));
      const mr = small ? 0 : 0.2;
      glow((mc + 3) * cellW, (mr + art.length / 2) * cellH, art.length * cellH * 1.6, "rgba(230,236,247,0.22)", f.enter);
      art.forEach((line, i) => {
        for (let k = 0; k < line.length; k++) {
          if (line[k] !== " ") put(mc + k, mr + i, line[k], MOON, 0.95 * f.enter);
        }
      });

      for (const t of tufts) {
        const h = t.lines.length;
        for (let i = 0; i < h; i++) {
          const fromBottom = h - 1 - i;
          if (fromBottom + 1 > Math.ceil(grown * h + 0.01)) continue;
          let line = t.lines[i];
          if (i === 0 && line.includes("|") && Math.sin(f.t * 1.6 + t.phase) > 0.55) line = line.replace("\\", "/");
          for (let k = 0; k < line.length; k++) {
            if (line[k] === " ") continue;
            const color = t.mush ? (i === 0 ? LILAC : MOON_DIM) : hash(t.col, k, i) < 0.5 ? LEAF_DARK : LEAF;
            put(t.col + k, rows - 1 - fromBottom - 0.2, line[k], color, t.alpha);
          }
        }
      }

      drawFlies(brush, grid, f, flies, grown * 0.9);
    },
  };
}

/* ------------------------------------------------------------------------ */

export function createScene(name: SceneName): Scene {
  switch (name) {
    case "nightsky":
      return nightsky();
    case "moonriver":
      return moonriver();
    case "stars":
      return stars();
    case "predawn":
      return predawn();
    case "dawn":
      return dawn();
    case "daylight":
      return daylight();
    case "dusk":
      return dusk();
    case "night":
      return night();
  }
}
