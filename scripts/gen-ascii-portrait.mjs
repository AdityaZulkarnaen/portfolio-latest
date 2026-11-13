/**
 * Bakes the hero portrait into the field the ASCII shader reads.
 *
 *   npm run portrait            # writes public/hero/portrait-field.png (+ fallback)
 *   npm run portrait -- --preview <out.png> [cols]
 *
 * The shader never sees the photo. It sees three numbers per texel, packed into
 * the RGB of an opaque PNG:
 *
 *   R  tone        0..1, already contrast-shaped — the glyph ramp index is just
 *                  `tone * (ramp - 1)`, so every tonal decision lives here
 *   G  silhouette  the cutout's alpha
 *   B  acid        how strongly the pixel reads as the uniform's yellow
 *
 * Opaque on purpose. Browsers premultiply PNG alpha on decode, so any data
 * stored in RGB under alpha 0 comes back as zero — the silhouette has to ride
 * in a colour channel, never in the alpha one.
 *
 * Why the tone is not just luminance: the hair is the darkest thing in the
 * photo, and on a near-black page plain luminance maps it to "no glyph" — the
 * silhouette loses its most recognisable part. So tone is levels-stretched
 * luminance plus a local-contrast term (luminance minus its blur), which is
 * what turns the curls into texture, plus a rim along the cutout edge so the
 * outline of the hair survives even where the curls themselves are flat black.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "assets/hero/portrait-source.png");
const OUT_DIR = path.join(ROOT, "public/hero");
const FIELD_OUT = path.join(OUT_DIR, "portrait-field.png");
const FALLBACK_OUT = path.join(OUT_DIR, "portrait.webp");

/** Field width in texels. The lens samples at twice the grid's density, and
 *  the densest grid is ~130 columns across the portrait, so ~2x that. */
const FIELD_W = 288;

/** Must match `RAMP` in the shader. Sparse to dense. */
const RAMP = " .:-=+*#%@";

/** Padding kept around the trimmed cutout, as a fraction of its height. */
const PAD_TOP = 0.02;

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      const add = Math.min(w - 1, x + r + 1);
      const sub = Math.max(0, x - r);
      acc += src[y * w + add] - src[y * w + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      const add = Math.min(h - 1, y + r + 1);
      const sub = Math.max(0, y - r);
      acc += tmp[add * w + x] - tmp[sub * w + x];
    }
  }
  return out;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

async function bake() {
  const src = sharp(SOURCE);
  const { width: SW, height: SH } = await src.metadata();
  const raw = await src.ensureAlpha().raw().toBuffer();

  // Trim to the cutout's bounding box, keeping a little air over the hair.
  let minX = SW, minY = SH, maxX = 0, maxY = 0;
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      if (raw[(y * SW + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = Math.round((maxY - minY) * PAD_TOP);
  const top = Math.max(0, minY - pad);
  const crop = { left: minX, top, width: maxX - minX + 1, height: maxY - top + 1 };

  const FIELD_H = Math.round((FIELD_W * crop.height) / crop.width);
  const px = await sharp(SOURCE)
    .extract(crop)
    .resize(FIELD_W, FIELD_H, { kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const n = FIELD_W * FIELD_H;
  const lum = new Float32Array(n);
  const alpha = new Float32Array(n);
  const acid = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255;
    const g = px[i * 4 + 1] / 255;
    const b = px[i * 4 + 2] / 255;
    const a = px[i * 4 + 3] / 255;
    alpha[i] = a;
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // The uniform's piping and emblem: warm, saturated, bright. Skin is warm
    // too but nowhere near as saturated in the blue-deficit sense, and the
    // white tee fails the saturation test outright.
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;
    const yellowish = r > b && g > b && Math.abs(r - g) < 0.28;
    acid[i] = yellowish ? smooth(0.5, 0.7, sat) * smooth(0.45, 0.62, max) * a : 0;
  }

  // Levels from the silhouette only — the transparent ground would drag the
  // low percentile to zero and stretch nothing.
  const inside = [];
  for (let i = 0; i < n; i++) if (alpha[i] > 0.5) inside.push(lum[i]);
  inside.sort((a, b) => a - b);
  const lo = inside[Math.floor(inside.length * 0.03)];
  const hi = inside[Math.floor(inside.length * 0.998)];

  const blurred = boxBlur(lum, FIELD_W, FIELD_H, 3);
  const alphaBlur = boxBlur(alpha, FIELD_W, FIELD_H, 3);

  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const level = Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo)));
    const shaped = Math.pow(level, 0.72) * 1.08;
    const detail = (lum[i] - blurred[i]) / (hi - lo);
    // Positive only where the cutout is fading out — just inside the edge.
    const rim = Math.max(0, alpha[i] - alphaBlur[i]) * 1.6;
    tone[i] = Math.min(1, Math.max(0, shaped + detail * 1.4 + rim)) * smooth(0.2, 0.6, alpha[i]);
  }

  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = Math.round(tone[i] * 255);
    out[i * 3 + 1] = Math.round(alpha[i] * 255);
    out[i * 3 + 2] = Math.round(acid[i] * 255);
  }

  return { out, FIELD_W, FIELD_H, crop, tone, alpha, acid };
}

async function writeField() {
  const { out, FIELD_W, FIELD_H, crop } = await bake();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(out, { raw: { width: FIELD_W, height: FIELD_H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(FIELD_OUT);

  // What a visitor without WebGL gets: the same crop, monochrome, small.
  await sharp(SOURCE)
    .extract(crop)
    .resize(720)
    .grayscale()
    .webp({ quality: 70, alphaQuality: 80 })
    .toFile(FALLBACK_OUT);

  const size = (f) => `${(fs.statSync(f).size / 1024).toFixed(1)} KB`;
  console.log(`field    ${FIELD_W}x${FIELD_H}  ${size(FIELD_OUT)}  -> ${path.relative(ROOT, FIELD_OUT)}`);
  console.log(`fallback ${size(FALLBACK_OUT)}  -> ${path.relative(ROOT, FALLBACK_OUT)}`);
  console.log(`aspect   ${(FIELD_W / FIELD_H).toFixed(4)} (w/h) — PORTRAIT_ASPECT in ascii-portrait.tsx`);
}

/**
 * Renders the locked, resting frame as text over the site's void, so the tone
 * mapping can be judged without a browser. Mirrors the shader's mapping; if
 * one changes, change the other.
 */
async function preview(file, cols) {
  const { FIELD_W, FIELD_H, tone, alpha, acid } = await bake();
  const CHAR_W = 0.6; // mono advance / cell height
  const rows = Math.round((cols * CHAR_W * FIELD_H) / FIELD_W);
  const cellH = 14;
  const cellW = cellH * CHAR_W;
  const W = Math.ceil(cols * cellW);
  const H = rows * cellH;

  const esc = (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#08080a"/>`;
  svg += `<g font-family="Consolas, 'DejaVu Sans Mono', monospace" font-size="${cellH}">`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fx = Math.min(FIELD_W - 1, Math.floor(((c + 0.5) / cols) * FIELD_W));
      const fy = Math.min(FIELD_H - 1, Math.floor(((r + 0.5) / rows) * FIELD_H));
      const i = fy * FIELD_W + fx;
      if (alpha[i] < 0.5) continue;
      const t = tone[i];
      const idx = Math.max(1, Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1))));
      const ch = RAMP[idx];
      if (ch === " ") continue;
      const isAcid = acid[i] > 0.5;
      const v = Math.round(255 * (0.38 + 0.62 * t));
      const fill = isAcid ? "#e1ff00" : `rgb(${Math.round(v * 0.95)},${Math.round(v * 0.95)},${Math.round(v * 0.94)})`;
      svg += `<text x="${(c * cellW).toFixed(1)}" y="${(r * cellH + cellH * 0.8).toFixed(1)}" fill="${fill}">${esc(ch)}</text>`;
    }
  }
  svg += "</g></svg>";
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log(`preview ${cols}x${rows} -> ${file}`);
}

const args = process.argv.slice(2);
const at = args.indexOf("--preview");
if (at >= 0) {
  await preview(args[at + 1], Number(args[at + 2] ?? 110));
} else {
  await writeField();
}
