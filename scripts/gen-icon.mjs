/**
 * Draws the site's icon set from the same numbers as the Chapter .03 code tag.
 *
 *   npm run icon
 *
 * Writes `app/icon.svg`, `app/favicon.ico` and `app/apple-icon.png`.
 *
 * Generated rather than exported from a design tool, for the reason the OG card
 * gives: a binary in `public/` is a copy of the identity that stops being true
 * the moment the palette changes, and nobody re-exports it. The glyph outlines
 * here are ported from `components/tech/tag-geometry.ts`, so the favicon is
 * literally the same mark the tunnel is built out of.
 *
 * No dependencies on purpose — a rasteriser for three straight-edged polygons
 * is fifty lines, and this runs perhaps twice a year.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const APP = path.join(process.cwd(), "app");

const VOID = "#08080a";
const INK = "#f2f2f0";
const ACID = "#e1ff00";

/** Half-height of a glyph, in local units. Everything else scales off this. */
const H = 0.5;
/** Horizontal reach of a chevron arm. */
const W = 0.44;
/**
 * Stroke thickness, perpendicular to the arm.
 *
 * Heavier than the scene's 0.135. There the glyph is extruded and lit, so the
 * bevel holds the stroke together optically; flat and sixteen pixels wide it
 * has to carry itself, and the scene weight goes to mush.
 */
const T = 0.22;

/** Ported from `chevronShape` — see that function for the derivation. */
function chevron(dir) {
  const phi = Math.atan2(H, W);
  const endInset = T / Math.cos(phi);
  const innerY = H - endInset;
  const innerX = innerY / Math.tan(phi);
  return [
    [0, H],
    [dir * W, 0],
    [0, -H],
    [0, -innerY],
    [dir * innerX, 0],
    [0, innerY],
  ];
}

/** Ported from `slashShape`. */
function slash() {
  const lean = 0.24;
  // Narrower than the scene's `T * 1.05`: a leaning parallelogram with vertical
  // end cuts reads far fatter than its perpendicular width, and at icon sizes
  // the slash was swallowing both chevrons.
  const width = T * 0.6;
  return [
    [-lean - width, -H],
    [-lean + width, -H],
    [lean + width, H],
    [lean - width, H],
  ];
}

/** Design canvas. Everything below is in these units. */
const SIZE = 32;
const CY = 16;
/** Units to px. Tuned for padding at 16px, not to match the scene's spread. */
const S = 11.5;

const PARTS = [
  { pts: chevron(-1), cx: 8.7, fill: INK },
  { pts: slash(), cx: 16.0, fill: INK },
  // The closing chevron carries the brand accent, exactly as in `code-tag.tsx`.
  { pts: chevron(+1), cx: 23.3, fill: ACID },
];

// y is negated: the scene's local space is y-up, SVG's and a raster's are
// y-down. The chevrons are symmetric about the axis so they do not care, but
// the slash leans — without this it comes out as a backslash.
const place = (p) => p.pts.map(([x, y]) => [p.cx + x * S, CY - y * S]);

// --- SVG -------------------------------------------------------------------

const d = (poly) =>
  poly
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join("") + "Z";

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">\n` +
  `  <rect width="${SIZE}" height="${SIZE}" rx="7" fill="${VOID}"/>\n` +
  PARTS.map((p) => `  <path d="${d(place(p))}" fill="${p.fill}"/>`).join("\n") +
  `\n</svg>\n`;

// --- raster ----------------------------------------------------------------

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

/**
 * `rounded` is false for the Apple icon: iOS applies its own mask and squircle,
 * so a pre-rounded source shows as a rounded square inside a squircle.
 */
function render(px, { rounded = true, inset = 0 } = {}) {
  const SS = 4;
  const buf = Buffer.alloc(px * px * 4);
  const shapes = PARTS.map((p) => ({ poly: place(p), rgb: hex(p.fill) }));
  const bg = hex(VOID);
  const r = rounded ? (7 / SIZE) * px : 0;
  // Shrinks the mark within the canvas without moving the ground.
  const k = 1 - inset;

  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;

          if (r > 0) {
            const dx = Math.max(r - fx, fx - (px - r), 0);
            const dy = Math.max(r - fy, fy - (px - r), 0);
            if (Math.hypot(dx, dy) > r) continue;
          }

          // Into design units, with the mark scaled about the centre.
          const ux = (((fx / px) * SIZE - CY) / k) + CY;
          const uy = (((fy / px) * SIZE - CY) / k) + CY;

          let col = bg;
          for (const s of shapes) if (inside(s.poly, ux, uy)) col = s.rgb;
          rSum += col[0];
          gSum += col[1];
          bSum += col[2];
          aSum += 255;
        }
      }

      const o = (y * px + x) * 4;
      if (aSum === 0) continue;
      const cov = aSum / 255;
      buf[o] = Math.round(rSum / cov);
      buf[o + 1] = Math.round(gSum / cov);
      buf[o + 2] = Math.round(bSum / cov);
      buf[o + 3] = Math.round(aSum / (SS * SS));
    }
  }
  return buf;
}

let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function png(px, rgba) {
  const stride = px * 4 + 1;
  const raw = Buffer.alloc(px * stride);
  for (let y = 0; y < px; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * px * 4, (y + 1) * px * 4);
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO carrying PNG payloads — supported everywhere that is still shipping. */
function ico(sizes) {
  const images = sizes.map((px) => png(px, render(px)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((px, i) => {
    const e = Buffer.alloc(16);
    e[0] = px >= 256 ? 0 : px;
    e[1] = px >= 256 ? 0 : px;
    e[2] = 0; // palette
    e[3] = 0;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32BE(0, 8);
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...images]);
}

// --- write -----------------------------------------------------------------

fs.writeFileSync(path.join(APP, "icon.svg"), svg);
fs.writeFileSync(path.join(APP, "favicon.ico"), ico([16, 32, 48]));
// Square, and the mark pulled in: iOS masks the corners itself and crops
// tighter than the browser tab does.
fs.writeFileSync(
  path.join(APP, "apple-icon.png"),
  png(180, render(180, { rounded: false, inset: 0.12 })),
);

const all = PARTS.flatMap(place);
const xs = all.map((p) => p[0]);
console.log(
  `icon.svg  favicon.ico (16/32/48)  apple-icon.png (180)\n` +
    `mark spans x ${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)} of ${SIZE}`,
);
