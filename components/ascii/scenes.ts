/**
 * The motifs. One per chapter, all from the same garden as Chapter .01 but
 * none of them the hero's hedge again — the brief was one theme, not one
 * picture repeated.
 *
 *   ivy         .02  climbs the moss panel's edges as it scrolls in, fireflies about
 *   river       .02  a stream winding down the panel, under the copy
 *   seeds       .03  dandelion seeds drifting through the tunnel's void
 *   blooms      .04  flowers that open in the gaps between the tiles
 *   butterflies .05  void-ink butterflies over the acid ground
 *   hedge       .06  low bushes and fireflies under the form
 *   sprouts     foot tufts and mushrooms along the footer's ground
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
};

export type Put = (col: number, row: number, ch: string, color: string, alpha?: number) => void;
export type Glow = (x: number, y: number, radius: number, color: string, alpha: number) => void;

export type Scene = {
  setup(grid: Grid): void;
  draw(put: Put, glow: Glow, frame: Frame): void;
};

export type SceneName = "ivy" | "river" | "seeds" | "blooms" | "butterflies" | "hedge" | "sprouts";

/* The site palette, as written in globals.css. */
const VOID = "#08080a";
const INK = "#f2f2f0";
const ACID = "#e1ff00";
const LILAC = "#cba7f5";
const PINK = "#ff5fa2";
const LEAF = "#7fc24e";
const LEAF_LIGHT = "#b9ec62";
const LEAF_DARK = "#2e6b3c";
const FAR = "#3c4570";

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

/* ---------------------------------------------------------------- ivy --- */

type Vine = {
  /** Column of the stem at each row (index = row). */
  x: number[];
  leaves: { row: number; side: number; glyph: string; flower: string | null }[];
};

type Mote = { x: number; y: number; phase: number; drift: number; speed: number; lilac: boolean };

/**
 * Ivy up the slab's edges. A stem is a slow double sine with a little noise,
 * drawn with the glyph its slope asks for; leaves alternate sides every few
 * rows, and one in a dozen is an acid flower. It climbs with the scroll — the
 * tip reaches the top as the slab finishes arriving — so the plant reads as
 * growing over the panel rather than printed on it.
 */
function ivy(): Scene {
  let grid: Grid;
  let vines: Vine[] = [];
  let motes: Mote[] = [];

  return {
    setup(g) {
      grid = g;
      const rnd = mulberry(11);
      const bases: number[] = [];
      // Right edge always (the rail gutter is free there on desktop); left
      // edge only where the measure is wide enough not to crowd the copy.
      bases.push(g.cols - 3);
      if (g.cols > 110) bases.push(g.cols - 8);
      if (g.cols > 90) bases.push(2);
      vines = bases.map((base, i) => {
        const p1 = rnd() * 6.28;
        const p2 = rnd() * 6.28;
        const x: number[] = [];
        for (let r = 0; r < g.rows; r++) {
          x.push(Math.round(base + Math.sin(r * 0.11 + p1) * 1.6 + Math.sin(r * 0.037 + p2) * 1.2));
        }
        const leaves: Vine["leaves"] = [];
        let side = i % 2 ? 1 : -1;
        for (let r = g.rows - 3; r > 0; r -= 1 + Math.floor(rnd() * 3)) {
          const bloom = rnd();
          const flower = bloom < 0.04 ? ACID : bloom < 0.08 ? PINK : bloom < 0.12 ? LILAC : null;
          leaves.push({
            row: r,
            side,
            glyph: flower ? "@" : rnd() < 0.55 ? "&" : rnd() < 0.5 ? "%" : "o",
            flower,
          });
          side = -side;
        }
        return { x, leaves };
      });
      // A few fireflies in the panel's air — fewer than the hero's; the
      // panel is for reading.
      const mr = mulberry(17);
      motes = Array.from({ length: Math.max(4, Math.round(g.height / 260)) }, () => ({
        x: mr() * g.width,
        y: mr() * g.height,
        phase: mr() * 6.28,
        drift: 30 + mr() * 50,
        speed: 0.15 + mr() * 0.2,
        lilac: mr() < 0.3,
      }));
    },
    draw(put, glow, f) {
      const grown = smooth(0.08, 0.6, f.progress) * grid.rows;
      const tipRow = grid.rows - grown;
      const tick = Math.floor(f.t * 2.5);
      for (const v of vines) {
        for (let r = Math.max(0, f.rowStart); r < Math.min(grid.rows, f.rowEnd); r++) {
          if (r < tipRow) continue;
          const dx = (v.x[r - 1] ?? v.x[r]) - v.x[r];
          const ch = r < tipRow + 1 ? "~" : dx > 0 ? "/" : dx < 0 ? "\\" : "|";
          put(v.x[r], r, ch, r < tipRow + 1 ? LEAF_LIGHT : LEAF_DARK, r < tipRow + 1 ? 0.95 : 0.85);
        }
        for (const l of v.leaves) {
          if (l.row < tipRow + 1 || l.row < f.rowStart || l.row > f.rowEnd) continue;
          const col = v.x[l.row] + l.side;
          // Leaves stir — always a little, a lot under the pointer.
          const near =
            f.pointer &&
            Math.abs(f.pointer.x - (col + 0.5) * grid.cellW) < 60 &&
            Math.abs(f.pointer.y - (l.row + 0.5) * grid.cellH) < 60;
          const stir = hash(l.row, col, near ? Math.floor(f.t * 12) : tick) < (near ? 0.6 : 0.06);
          const glyph = l.flower ? (stir ? "*" : "@") : stir ? (l.glyph === "&" ? "%" : "&") : l.glyph;
          // Leaves shade by hash so the vine is not one flat green.
          const leafInk = hash(l.row, col, 3) > 0.5 ? LEAF : LEAF_LIGHT;
          put(col, l.row, glyph, l.flower ?? leafInk, l.flower ? 1 : 0.8);
          // A petal either side makes the flowers read as blooms, not dots.
          if (l.flower) put(col + l.side, l.row, l.side > 0 ? ")" : "(", l.flower === ACID ? LILAC : l.flower, 0.75);
        }
      }
      for (const m of motes) {
        const x = m.x + Math.sin(f.t * m.speed + m.phase) * m.drift;
        const y = m.y + Math.cos(f.t * m.speed * 0.8 + m.phase) * m.drift * 0.6;
        const fade = (0.55 + 0.45 * Math.sin(f.t * 1.8 + m.phase * 3)) * smooth(0.05, 0.4, f.progress);
        glow(x, y, 22, m.lilac ? "rgba(203,167,245,0.45)" : "rgba(225,255,0,0.5)", fade * 0.65);
        put(x / grid.cellW - 0.5, y / grid.cellH - 0.5, fade > 0.7 ? "*" : "+", m.lilac ? LILAC : ACID, fade);
      }
    },
  };
}

/* -------------------------------------------------------------- river --- */

const WATER_DEEP = "#2f6f8f";
const WATER = "#6cc4d6";
const WATER_LIGHT = "#bff3ee";

type Pad = { row: number; off: number; flower: string | null };
type Reed = { row: number; side: number; glyph: string; tall: boolean };

/**
 * A stream winding down the panel — the forest's river. Its course is a slow
 * double sine down the section; the water is a moving interference of two
 * waves read through a ramp (`~ - . `), travelling downstream, so it reads as
 * current rather than as a striped band. The surface glints acid now and then.
 * Reeds and stones line the banks, lily pads drift on it with the odd bloom.
 *
 * Under the copy, so it is kept low: dim water, sparse glyphs, no white.
 */
function river(): Scene {
  let grid: Grid;
  let pads: Pad[] = [];
  let reeds: Reed[] = [];
  let p1 = 0;
  let p2 = 0;

  /** Centre of the stream at row r, in columns, and its half-width. */
  const course = (r: number) => {
    const { cols, rows } = grid;
    const v = r / Math.max(rows, 1);
    // Wide screens: the stream runs down the gutter between the bio and the
    // photo, swinging either side of it. Narrow: down the middle.
    const home = cols > 100 ? 0.56 : 0.5;
    const swing = cols > 100 ? 0.16 : 0.3;
    const x = cols * (home + swing * Math.sin(v * Math.PI * 2.4 + p1) + 0.05 * Math.sin(r * 0.05 + p2));
    const half = Math.max(4, cols * (cols > 100 ? 0.05 : 0.09)) * (1 + 0.35 * Math.sin(r * 0.031 + p2 * 2));
    return { x, half };
  };

  return {
    setup(g) {
      grid = g;
      const rnd = mulberry(97);
      p1 = rnd() * 6.28;
      p2 = rnd() * 6.28;
      pads = [];
      reeds = [];
      for (let r = 2; r < g.rows; r += 5 + Math.floor(rnd() * 9)) {
        const b = rnd();
        pads.push({
          row: r,
          off: rnd() * 1.4 - 0.7,
          flower: b < 0.3 ? PINK : b < 0.45 ? LILAC : b < 0.55 ? ACID : null,
        });
      }
      for (let r = 0; r < g.rows; r += 1 + Math.floor(rnd() * 3)) {
        const side = rnd() < 0.5 ? -1 : 1;
        const k = rnd();
        reeds.push({ row: r, side, glyph: k < 0.35 ? "|" : k < 0.55 ? "," : k < 0.7 ? "'" : k < 0.82 ? "Y" : k < 0.92 ? "(" : "o", tall: k >= 0.7 && k < 0.82 });
      }
    },
    draw(put, _glow, f) {
      const grown = smooth(0.02, 0.35, f.progress);
      if (grown <= 0) return;
      const r0 = Math.max(0, f.rowStart);
      const r1 = Math.min(grid.rows, f.rowEnd);

      // Water.
      for (let r = r0; r < r1; r++) {
        const { x, half } = course(r);
        const c0 = Math.floor(x - half);
        const c1 = Math.ceil(x + half);
        for (let c = c0; c <= c1; c++) {
          const across = (c - x) / half; // -1 bank .. 1 bank
          if (Math.abs(across) > 1) continue;
          // Two waves sliding downstream at different speeds, bent by the bank.
          const a = Math.sin(r * 0.55 - f.t * 2.6 + c * 0.35 + Math.sin(c * 0.4 + f.t * 0.7) * 1.2);
          const b = Math.sin(r * 0.23 - f.t * 1.4 - c * 0.5);
          const v = a * 0.6 + b * 0.4;
          const edge = 1 - Math.abs(across);
          let ch = v > 0.35 ? "~" : v > -0.05 ? "-" : v > -0.45 ? "." : "";
          if (!ch) continue;
          let color = edge < 0.25 ? WATER_DEEP : v > 0.35 ? WATER : WATER_DEEP;
          let alpha = (0.5 + 0.4 * edge) * grown;
          // A glint, now and then, on the crest of a wave.
          if (v > 0.6 && hash(c, r, Math.floor(f.t * 3)) < 0.04) {
            ch = "*";
            color = hash(c, r, 9) < 0.5 ? ACID : WATER_LIGHT;
            alpha = 0.9 * grown;
          }
          put(c, r, ch, color, alpha);
        }
      }

      // Banks: reeds, cattails, stones.
      for (const rd of reeds) {
        if (rd.row < r0 || rd.row >= r1) continue;
        const { x, half } = course(rd.row);
        const col = x + rd.side * (half + 1.2);
        const sway = Math.sin(f.t * 1.4 + rd.row * 0.7) > 0.6 ? (rd.side > 0 ? "/" : "\\") : null;
        const isStone = rd.glyph === "(" || rd.glyph === "o";
        const glyph = rd.glyph === "|" && sway ? sway : rd.glyph;
        // A stone is two glyphs wide.
        if (glyph === "(") {
          put(col, rd.row, "(", "#6b7a6e", 0.6 * grown);
          put(col + 1, rd.row, ")", "#6b7a6e", 0.6 * grown);
          continue;
        }
        put(col, rd.row, glyph, isStone ? "#6b7a6e" : rd.tall ? "#c9a46a" : LEAF, (isStone ? 0.6 : 0.75) * grown);
        if (rd.tall) put(col, rd.row + 1, "|", LEAF, 0.7 * grown);
      }

      // Lily pads, drifting a little on the current.
      for (const pd of pads) {
        if (pd.row < r0 || pd.row >= r1) continue;
        const { x, half } = course(pd.row);
        const col = x + pd.off * half + Math.sin(f.t * 0.6 + pd.row) * 0.6;
        put(col, pd.row, "@", LEAF, 0.8 * grown);
        put(col + 1, pd.row, ")", LEAF_DARK, 0.7 * grown);
        if (pd.flower) {
          const tw = 0.8 + 0.2 * Math.sin(f.t * 2 + pd.row);
          put(col, pd.row - 1, "*", pd.flower, tw * grown);
        }
      }
    },
  };
}

/* -------------------------------------------------------------- seeds --- */

type Seed = { x: number; y: number; vx: number; vy: number; px: number; py: number; phase: number; acid: boolean; size: number };

/**
 * Dandelion seeds on the void around the tunnel. They rise and drift with
 * the wind, each trailing its pappus as a dot behind it, and scatter from
 * the pointer like seeds from a breath. Kept faint: the tunnel is the
 * subject here and the seeds are air.
 */
function seeds(): Scene {
  let grid: Grid;
  let list: Seed[] = [];
  return {
    setup(g) {
      grid = g;
      const rnd = mulberry(23);
      const n = Math.round(Math.min(48, (g.width * g.height) / 26000));
      list = Array.from({ length: n }, () => ({
        x: rnd() * g.width,
        y: rnd() * g.height,
        vx: 10 + rnd() * 18,
        vy: -(6 + rnd() * 14),
        px: 0,
        py: 0,
        phase: rnd() * 6.28,
        acid: rnd() < 0.18,
        size: rnd(),
      }));
    },
    draw(put, _glow, f) {
      const { width: W, height: H, cellW, cellH } = grid;
      for (const s of list) {
        // A breath pushes, then the push decays.
        if (f.pointer) {
          const dx = s.x - f.pointer.x;
          const dy = s.y - f.pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < 140 && d > 0.01) {
            const k = (1 - d / 140) * 260 * f.dt;
            s.px += (dx / d) * k;
            s.py += (dy / d) * k;
          }
        }
        s.px *= Math.exp(-f.dt * 1.6);
        s.py *= Math.exp(-f.dt * 1.6);
        s.x += (s.vx + Math.sin(f.t * 0.7 + s.phase) * 10 + s.px) * f.dt;
        s.y += (s.vy + Math.cos(f.t * 0.9 + s.phase) * 6 + s.py) * f.dt;
        if (s.x > W + 20) s.x = -20;
        if (s.x < -20) s.x = W + 20;
        if (s.y < -20) s.y = H + 20;
        if (s.y > H + 20) s.y = -20;

        const col = s.x / cellW - 0.5;
        const row = s.y / cellH - 0.5;
        const tw = 0.55 + 0.45 * Math.sin(f.t * 2 + s.phase * 3);
        const color = s.acid ? ACID : INK;
        const a = (s.acid ? 0.75 : 0.42) * (0.6 + 0.4 * tw) * f.enter;
        put(col, row, s.size > 0.7 ? "*" : "+", color, a);
        // The pappus trails the seed, opposite its drift.
        put(col - 0.9, row + 0.7, ".", color, a * 0.6);
        if (s.size > 0.7) put(col - 1.7, row + 1.3, ".", color, a * 0.3);
      }
    },
  };
}

/* ------------------------------------------------------------- blooms --- */

type Bloom = { col: number; row: number; kind: number; phase: number; stem: number; color: string };

/**
 * Flowers in the gaps of the works board. Scattered over the whole section,
 * so the tiles hide most of them and only the gaps bloom — no layout needs
 * to be known. Each opens as it rises through the lower part of the screen:
 * bud, then head, then petals, its stem growing under it.
 */
function blooms(): Scene {
  let grid: Grid;
  let list: Bloom[] = [];
  const colors = [LILAC, PINK, ACID, INK];
  return {
    setup(g) {
      grid = g;
      const rnd = mulberry(37);
      const n = Math.round((g.cols * g.rows) / 260);
      list = Array.from({ length: n }, () => ({
        col: Math.floor(rnd() * g.cols),
        row: 3 + Math.floor(rnd() * (g.rows - 4)),
        kind: Math.floor(rnd() * 3),
        phase: rnd() * 6.28,
        stem: 2 + Math.floor(rnd() * 3),
        color: colors[Math.floor(rnd() * colors.length)],
      }));
    },
    draw(put, _glow, f) {
      const { cellH } = grid;
      for (const b of list) {
        if (b.row < f.rowStart || b.row - 3 > f.rowEnd) continue;
        const screenY = b.row * cellH - f.viewTop;
        const open = smooth(f.viewport * 0.98, f.viewport * 0.55, screenY);
        if (open <= 0.02) continue;
        const sway = Math.sin(f.t * 1.3 + b.phase) * 0.35 * open;
        // Stem first, from the ground up.
        const stem = Math.ceil(b.stem * Math.min(1, open * 1.6));
        for (let i = 0; i < stem; i++) {
          const lean = sway * (i / b.stem);
          put(b.col + lean, b.row - i, i === 1 && b.stem > 2 ? (b.phase > 3 ? "/" : "\\") : "|", LEAF, 0.5);
        }
        const hx = b.col + sway;
        const hy = b.row - stem;
        if (open < 0.45) {
          put(hx, hy, open < 0.25 ? "." : "o", LEAF_LIGHT, 0.7);
          continue;
        }
        const tw = 0.8 + 0.2 * Math.sin(f.t * 2.2 + b.phase);
        if (b.kind === 0) {
          put(hx, hy, "@", ACID, tw);
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
      }
    },
  };
}

/* -------------------------------------------------------- butterflies --- */

type Fly = { ax: number; ay: number; bx: number; by: number; phase: number; speed: number; ox: number; oy: number };

/**
 * Void-ink butterflies over the acid. They live in viewport space — wherever
 * the reader is in this tall chapter, a few are in view — on slow Lissajous
 * loops, flapping through four frames and leaving a dotted wake. They flee
 * the pointer.
 */
function butterflies(): Scene {
  let grid: Grid;
  let list: Fly[] = [];
  const FRAMES = ["{@}", "(@)", " | ", "(@)"];
  return {
    setup(g) {
      grid = g;
      const rnd = mulberry(53);
      const n = g.width < 640 ? 4 : 7;
      list = Array.from({ length: n }, () => ({
        ax: 0.6 + rnd() * 0.9,
        ay: 0.5 + rnd() * 0.8,
        bx: rnd() * 6.28,
        by: rnd() * 6.28,
        phase: rnd() * 6.28,
        speed: 0.08 + rnd() * 0.08,
        ox: 0,
        oy: 0,
      }));
    },
    draw(put, _glow, f) {
      const { width: W, cellW, cellH } = grid;
      const pos = (b: Fly, t: number) => {
        const s = t * b.speed;
        return {
          x: W * (0.5 + 0.44 * Math.sin(s * b.ax * 6.28 + b.bx)) + b.ox,
          y: f.viewTop + f.viewport * (0.5 + 0.4 * Math.sin(s * b.ay * 6.28 + b.by)) + b.oy,
        };
      };
      for (const b of list) {
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

        // The wake: where it was a moment ago.
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

/* -------------------------------------------------------------- hedge --- */

type Leaf = { col: number; row: number; dens: number; shade: number; far: boolean; seed: number; blossom: string | null };
type Firefly = { x: number; y: number; phase: number; speed: number; drift: number; lilac: boolean };

/**
 * The hero's garden, echoed small at the bottom of the contact chapter: two
 * low hedges (a dim far one, a lit near one in front of it) and fireflies
 * rising out of them. The bushes are computed once per layout — only their
 * rustle and the fireflies move — so this costs a list walk per frame.
 */
function hedge(): Scene {
  let grid: Grid;
  let leaves: Leaf[] = [];
  let flies: Firefly[] = [];
  const RAMP = ".:;*o&%@";

  const bushAt = (x: number, y: number, spacing: number, baseY: number, salt: number) => {
    // Distance-ish "inside" of a row of three-lobed bushes; > 0 inside.
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
          // Light from above and a little left; y grows downward here.
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
      // Tall enough that the highest crown is never clipped by the band's top.
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
          // Never quite empty inside, or the shadowed hearts read as holes.
          const dens = Math.min(1, Math.max(shade * (0.5 + 0.7 * hash(Math.floor(c / 3), Math.floor(r / 2), 5)), rim * (0.32 + 0.63 * pick.lit), 0.16));
          if (dens < 0.1) continue;
          const bl = !pick.far && shade > 0.55 && seed > 0.955 ? (seed > 0.985 ? ACID : seed > 0.97 ? PINK : LILAC) : null;
          leaves.push({ col: c, row: r, dens, shade: Math.max(shade, rim * pick.lit), far: pick.far, seed, blossom: bl });
        }
      }
      const rnd = mulberry(71);
      flies = Array.from({ length: g.width < 640 ? 8 : 14 }, () => ({
        x: rnd() * g.width,
        y: rnd(),
        phase: rnd() * 6.28,
        speed: 0.03 + rnd() * 0.04,
        drift: 20 + rnd() * 40,
        lilac: rnd() < 0.25,
      }));
    },
    draw(put, glow, f) {
      const { width: W, height: H, rows } = grid;
      const grown = smooth(0.1, 0.75, f.enter);
      const tick = Math.floor(f.t * 2);
      for (const l of leaves) {
        if (l.row < f.rowStart || l.row > f.rowEnd) continue;
        // Bushes rise out of the ground as the chapter arrives.
        if (rows - l.row > grown * 60 + 2) continue;
        let dens = l.dens;
        const near = f.pointer && Math.hypot(f.pointer.x - (l.col + 0.5) * grid.cellW, f.pointer.y - (l.row + 0.5) * grid.cellH) < 90;
        const roll = hash(l.col, l.row, near ? Math.floor(f.t * 12) : tick);
        if (roll < (near ? 0.5 : 0.04)) dens = Math.min(1, Math.max(0.1, dens + (roll < (near ? 0.25 : 0.02) ? 0.18 : -0.18)));
        if (l.blossom) {
          put(l.col, l.row, l.seed > 0.975 ? "@" : "*", l.blossom, 0.85 + 0.15 * Math.sin(f.t * 2.4 + l.seed * 30));
          continue;
        }
        const ch = RAMP[Math.round(dens * (RAMP.length - 1))];
        const color = l.far ? FAR : l.shade > 0.6 ? LEAF_LIGHT : l.shade > 0.3 ? LEAF : LEAF_DARK;
        put(l.col, l.row, ch, color, l.far ? 0.55 : 0.6 + 0.4 * l.shade);
      }
      for (const fl of flies) {
        const life = (f.t * fl.speed + fl.y) % 1;
        const x = fl.x + Math.sin(f.t * 0.5 + fl.phase) * fl.drift;
        const y = H - 30 - life * Math.min(H * 0.7, 520);
        const fade = Math.sin(life * Math.PI) * (0.55 + 0.45 * Math.sin(f.t * 2 + fl.phase * 3)) * grown;
        const color = fl.lilac ? LILAC : ACID;
        glow(x, y, 26, fl.lilac ? "rgba(203,167,245,0.5)" : "rgba(225,255,0,0.55)", fade * 0.7);
        put(x / grid.cellW - 0.5, y / grid.cellH - 0.5, fade > 0.6 ? "*" : "+", color, fade);
        if (x < -40 || x > W + 40) fl.x = (fl.x + W) % W;
      }
    },
  };
}

/* ------------------------------------------------------------ sprouts --- */

type Tuft = { col: number; lines: string[]; phase: number; alpha: number };

/**
 * The footer is ground: tufts of grass and the odd mushroom along its lower
 * edge, in void ink on the acid. The tops of the tufts toss in the wind;
 * everything grows up out of the edge as the footer comes into view.
 */
function sprouts(): Scene {
  let grid: Grid;
  let tufts: Tuft[] = [];
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
      const rnd = mulberry(89);
      tufts = [];
      for (let c = 1; c < g.cols - 2; ) {
        const mush = rnd() < 0.08;
        const lines = mush ? MUSHROOMS[Math.floor(rnd() * MUSHROOMS.length)] : GRASS[Math.floor(rnd() * GRASS.length)];
        tufts.push({ col: c, lines, phase: rnd() * 6.28, alpha: mush ? 0.75 : 0.35 + rnd() * 0.3 });
        c += lines[0].length + 1 + Math.floor(rnd() * 4);
      }
    },
    draw(put, _glow, f) {
      const { rows } = grid;
      const grown = smooth(0.15, 0.9, f.enter);
      if (grown <= 0) return;
      for (const t of tufts) {
        const h = t.lines.length;
        for (let i = 0; i < h; i++) {
          // Bottom line first: the tuft rises out of the edge.
          const fromBottom = h - 1 - i;
          if (fromBottom + 1 > Math.ceil(grown * h + 0.01)) continue;
          let line = t.lines[i];
          // The top line tosses with the wind.
          if (i === 0 && line.includes("|") && Math.sin(f.t * 1.6 + t.phase) > 0.55) line = line.replace("\\", "/");
          for (let k = 0; k < line.length; k++) {
            if (line[k] === " ") continue;
            put(t.col + k, rows - 1 - fromBottom - 0.2, line[k], VOID, t.alpha);
          }
        }
      }
    },
  };
}

/* ------------------------------------------------------------------------ */

export function createScene(name: SceneName): Scene {
  switch (name) {
    case "ivy":
      return ivy();
    case "river":
      return river();
    case "seeds":
      return seeds();
    case "blooms":
      return blooms();
    case "butterflies":
      return butterflies();
    case "hedge":
      return hedge();
    case "sprouts":
      return sprouts();
  }
}
