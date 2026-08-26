/**
 * Generates `public/textures/currents-weave.svg` — the site's paper texture.
 *
 * Chapter .01 draws contours of a stream function on the GPU. This is the same
 * idea spent on a page-wide texture instead of a hero: every line here is a
 * level set of one scalar field, which is why they drift, crowd and relax
 * without ever crossing or ending. A hand-drawn set of sine paths cannot do
 * that — stack two of them and they intersect, and the eye reads the result as
 * decoration rather than as flow.
 *
 * The field is deliberately *finite Fourier*, not noise:
 *
 *   psi(x, y) = y * G  +  SUM a_i * sin(2pi * (n_i x/W + m_i y/H) + phase_i)
 *
 * with every n_i and m_i an integer. That buys exact tiling in both axes:
 *
 *   psi(x + W, y) = psi(x, y)          -> horizontal seam is invisible
 *   psi(x, y + H) = psi(x, y) + N      -> vertical seam is invisible too,
 *
 * because the contour family is the integers: shifting every level by a whole
 * number N maps the family onto itself. G = N/H is chosen for exactly that.
 * This is why the texture can be a repeating CSS mask at all, and why the tile
 * can be regenerated at any size without hunting for a seam by eye.
 *
 * Because the perturbation is bounded well under the base gradient (see
 * FOLD_BUDGET below), psi is strictly increasing in y — so a contour is a
 * single-valued curve y(x) and can be solved column by column with bisection.
 * No marching squares, no stitching, no degenerate cells.
 *
 * Run: node scripts/gen-wave-texture.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "public/textures/currents-weave.svg");

/** Tile size in CSS pixels. Also what `--texture-tile` in globals.css must say. */
const W = 1000;
const H = 800;

/** Contours crossing one tile height. H/N is the line spacing: ~33px. */
const N = 24;

/** Base gradient, fixed by the tiling identity above. Do not tune this alone. */
const G = N / H;

/**
 * The swell. `a` is in units of one line spacing, so a = 2 displaces a line
 * across two of its neighbours' worth of ground — the same reading the hero's
 * shader asks for, and the same trap: push these until the field folds and the
 * texture stops being lines and becomes moire.
 *
 * `m = 0` is a pure horizontal roll: it costs nothing against the fold budget
 * (it does not vary in y at all) so it carries most of the amplitude, and it is
 * what makes the lines read as a long slow wave rather than as ripple.
 */
const WAVES = [
  { a: 2.20, n: 1, m: 0, phase: 0.00 },
  { a: 1.05, n: 2, m: 1, phase: 1.87 },
  { a: 0.55, n: 3, m: -1, phase: 4.12 },
  { a: 0.30, n: 5, m: 2, phase: 2.55 },
  { a: 0.16, n: 7, m: -3, phase: 5.61 },
];

/**
 * A contour folds back on itself the moment d(psi)/dy can reach zero, i.e. when
 * the perturbation's steepest y-slope beats the base gradient. In tile units
 * that is SUM 2pi * a_i * |m_i| vs N. Asserted rather than commented, because
 * the failure is silent: bisection still returns *a* root, just the wrong one,
 * and the output looks like tangled hair.
 */
const FOLD_BUDGET = WAVES.reduce((sum, w) => sum + 2 * Math.PI * w.a * Math.abs(w.m), 0);
if (FOLD_BUDGET >= N * 0.85) {
  throw new Error(
    `wave amplitudes fold the field: budget ${FOLD_BUDGET.toFixed(2)} of ${N}`,
  );
}

/** Total swing of the perturbation, for deciding which levels touch the tile. */
const AMP = WAVES.reduce((sum, w) => sum + w.a, 0);

function psi(x, y) {
  let v = y * G;
  for (const { a, n, m, phase } of WAVES) {
    v += a * Math.sin(2 * Math.PI * ((n * x) / W + (m * y) / H) + phase);
  }
  return v;
}

/** The y at which the contour of `level` crosses this column. */
function solveY(x, level) {
  let lo = (level - AMP) / G - 1;
  let hi = (level + AMP) / G + 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (psi(x, mid) < level) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Line weight and ink, keyed on the level's position *within* the tile so the
 * pattern survives the vertical wrap. Every third line is drawn heavier: a
 * field of identical hairlines reads as a screen door, a field with a beat in
 * it reads as printed.
 */
function inkFor(level) {
  const k = ((level % N) + N) % N;
  const heavy = k % 3 === 0;
  return {
    width: heavy ? 1.25 : 0.85,
    // Slow swell down the tile, wrapping cleanly because it is a full period.
    opacity: (heavy ? 0.95 : 0.62) * (0.72 + 0.28 * Math.sin((2 * Math.PI * k) / N)),
  };
}

/**
 * Columns per tile — 8px steps. The field's highest term is n = 7, i.e. a
 * period of ~143px, so this is ~18 samples per wave: far inside what a hairline
 * can show a corner in. Coordinates are emitted at one decimal for the same
 * reason; the file is served as-is and every digit is repeated 35 times.
 */
const STEPS = 125;

const paths = [];
// Levels whose contour can enter the tile at all: psi spans [-AMP, N + AMP].
for (let level = Math.floor(-AMP); level <= Math.ceil(N + AMP); level++) {
  const pts = [];
  let visible = false;
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * W;
    const y = solveY(x, level);
    if (y > -2 && y < H + 2) visible = true;
    pts.push(`${+x.toFixed(1)},${+y.toFixed(1)}`);
  }
  // A level can sit wholly above or below the tile at every column; the
  // viewBox would clip it away, so do not ship it.
  if (!visible) continue;

  const { width, opacity } = inkFor(level);
  paths.push(
    `<polyline points="${pts.join(" ")}" stroke-width="${width}" ` +
      `stroke-opacity="${opacity.toFixed(2)}"/>`,
  );
}

/**
 * White on transparent, because this ships as a CSS `mask-image`: the stylesheet
 * paints `currentColor` through it, which is what lets one file serve as acid
 * ink on the void and as void ink on Chapter .05's acid without a second asset.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<g fill="none" stroke="#fff" stroke-linecap="round">
${paths.join("\n")}
</g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`wrote ${OUT} — ${paths.length} contours, ${(svg.length / 1024).toFixed(1)}kB`);
