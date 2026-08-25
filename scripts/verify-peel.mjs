/**
 * Checks that Chapter .04's curl still fits inside its own gutters.
 *
 *     node scripts/verify-peel.mjs
 *
 * The peel is a real bend, not a rigid tilt: the note stays flat where it is
 * glued and then rolls through seven bands. Perspective magnifies whatever
 * leans toward the viewer, so the bottom of the curl reaches sideways past the
 * tile's own box — and two tiles sharing a line have only half the column gap
 * to spend on that before they visibly collide.
 *
 * Run this after ANY of these change, because all of them move the answer:
 * the band profile in `work-card.tsx`, the perspective or shrink in
 * `globals.css`, the column gap, or the set of tile widths a project may take.
 * The numbers in those files are a solved fit, not taste — this is the solver.
 *
 * It found a real bug once already: the rigid-tilt numbers it replaced were fitted
 * to a twelve-column grid, and after the grid became a wrapped row with
 * full-width tiles in it, a tile reached 250px past its own edge.
 */

const rad = (d) => (d * Math.PI) / 180;

/** Must match `work-card.tsx`. */
export const HEAD = 0.55;
export const BAND_DEG = [6.0, 7.79, 8.64, 9.25, 9.72, 10.13, 10.47];
/** Must match `[data-peel]` in `globals.css`. */
const PERSPECTIVE = 2200;
const SHRINK = 0.9;
const TILT = 0.4;
const LIFT = 6.4;

/**
 * Where the tile's corners actually land, in px relative to its own box.
 *
 * The note is a chain of quads hinged along their top edges. Each one is
 * carried by the ones above it, so its position is the running sum of the
 * chain — which is the whole reason this cannot be reasoned about by eye.
 */
function outline(W, H) {
  const h = (H * (1 - HEAD)) / BAND_DEG.length;
  let angle = 0;
  let y = H * HEAD;
  let z = 0;
  const hinges = [{ y: 0, z: 0 }, { y, z }];

  for (const step of BAND_DEG) {
    angle += step;
    y += h * Math.cos(rad(angle));
    z += h * Math.sin(rad(angle));
    hinges.push({ y, z });
  }

  const t = rad(TILT);
  let side = -Infinity;
  let below = -Infinity;

  for (const { y: py, z: pz } of hinges) {
    const s = PERSPECTIVE / (PERSPECTIVE - pz);
    for (const sx of [-1, 1]) {
      const x = (sx * W) / 2;
      // The alternating rotateZ, then the projection, then the shrink.
      const xr = x * Math.cos(t) - py * Math.sin(t);
      const yr = x * Math.sin(t) + py * Math.cos(t);
      side = Math.max(side, Math.abs(xr * s * SHRINK) - W / 2);
      below = Math.max(below, (yr * s + LIFT) * SHRINK - H);
    }
  }
  return { side, below, angle };
}

/**
 * Every shape a tile can actually take, at the two viewport widths where the
 * container's own max width starts and stops binding.
 *
 * The budget is what the tile may reach into before it hits something: half of
 * `md:gap-x-10` where another tile shares the line, and the container's 32px
 * left padding for a tile that has the line to itself. Vertically it is the
 * 20px of `mt-5` above the caption.
 */
const phone = Math.min(0.7 * 800, 576) * (9 / 19.5);
const CONTENT_1440 = 1440 - 32 - 120;
const CONTENT_1920 = 1760 - 32 - 120;
const GAP = 40;

const TILES = [
  ["half @1440", (CONTENT_1440 - GAP) / 2, 10 / 16, GAP / 2],
  ["half @1920", (CONTENT_1920 - GAP) / 2, 10 / 16, GAP / 2],
  ["row beside phone", CONTENT_1440 - GAP - phone, 10 / 16, GAP / 2],
  ["row alone @1920", CONTENT_1920, 10 / 16, 32],
  ["phone", phone, 19.5 / 9, GAP / 2],
];

let worst = Infinity;
console.log(
  `curl: flat to ${(HEAD * 100).toFixed(0)}%, then ${BAND_DEG.length} bands to ` +
    `${BAND_DEG.reduce((a, b) => a + b, 0).toFixed(1)}deg  ` +
    `(perspective ${PERSPECTIVE}px, shrink ${((1 - SHRINK) * 100).toFixed(0)}%)\n`,
);

for (const [name, W, ratio, budget] of TILES) {
  const H = W * ratio;
  const { side, below } = outline(W, H);
  const slack = Math.min(budget - side, 20 - below);
  worst = Math.min(worst, slack);
  console.log(
    `  ${slack >= 0 ? "ok  " : "OVER"} ${name.padEnd(18)}` +
      ` ${W.toFixed(0).padStart(4)}x${H.toFixed(0).padStart(4)}` +
      `  side ${side.toFixed(1).padStart(6)} / ${String(budget).padStart(2)}` +
      `  below ${below.toFixed(1).padStart(6)} / 20`,
  );
}

console.log(`\n${worst >= 0 ? "fits" : "DOES NOT FIT"} — ${worst.toFixed(1)}px in hand`);
process.exit(worst >= 0 ? 0 : 1);
