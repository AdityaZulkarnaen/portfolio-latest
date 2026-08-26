import { mulberry32 } from "./rng";

export type TextSample = {
  /** `count * 3` floats in normalised model space: glyph box height is 1 unit, width is `aspect`. */
  positions: Float32Array;
  /** Glyph box width / height. */
  aspect: number;
  /** How many opaque pixels the raster actually yielded — useful when tuning. */
  sampledPixels: number;
  /** The rasterisation size that was finally used. */
  fontSize: number;
};

const DEFAULT_ALPHA_THRESHOLD = 128;

/**
 * Canvas 2D draws with a fallback face until the webfont is actually loaded,
 * which silently produces the wrong glyph shapes. Await this before sampling.
 */
export async function waitForFont(fontFamily: string, weight = 900): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const primary = fontFamily.split(",")[0]?.trim() ?? fontFamily;
  try {
    const faces = await document.fonts.load(`${weight} 200px ${primary}`);
    // Resolved the face we actually asked for, so stop here.
    //
    // `document.fonts.ready` used to be awaited unconditionally, and it is a
    // much bigger promise than it looks: it resolves when *every* font in the
    // document has settled. The hero's veil hangs off this call, so the
    // homepage was holding a full-screen black panel until BlurWeb — a 66KB
    // TTF, `display: "block"`, used by nothing above the fold — had finished
    // downloading, along with both Geist faces. The wordmark's own face is the
    // only one this function's callers care about; the rest are somebody
    // else's problem and must not be on this critical path.
    if (faces.length > 0) return;
  } catch {
    // A quirky family string shouldn't block the hero; fonts.ready still helps.
  }
  // Either the family did not resolve or the load threw. `ready` is the
  // fallback, and it is bounded — worst case it is the old behaviour.
  await document.fonts.ready;
}

type SampleOptions = {
  text: string;
  fontFamily: string;
  /** Exact number of particles to emit. The buffer is always this long. */
  count: number;
  seed?: number;
  /** Starting rasterisation size; grown automatically if ink is too sparse. */
  fontSize?: number;
  /** Pixel step while scanning. */
  stride?: number;
  alphaThreshold?: number;
  /** Canvas edge cap — mobile Safari's 2D area limit bites well before the texture cap. */
  maxEdge?: number;
};

type Raster = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
};

function drawText(
  text: string,
  fontFamily: string,
  fontSize: number,
): Raster | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const font = `900 ${fontSize}px ${fontFamily}`;
  ctx.font = font;

  const metrics = ctx.measureText(text);
  const padding = Math.ceil(fontSize * 0.05);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.72;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;

  canvas.width = Math.max(1, Math.ceil(metrics.width) + padding * 2);
  canvas.height = Math.max(1, Math.ceil(ascent + descent) + padding * 2);

  // Resizing the canvas resets every context property, so re-apply them here.
  ctx.font = font;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, canvas.width / 2, padding + ascent);

  return { ctx, width: canvas.width, height: canvas.height };
}

/** Flat pixel indices (y * width + x) of every sufficiently opaque pixel. */
function collectOpaque(raster: Raster, stride: number, threshold: number): Uint32Array {
  const { data } = raster.ctx.getImageData(0, 0, raster.width, raster.height);
  const found = new Uint32Array(Math.ceil((raster.width * raster.height) / (stride * stride)));
  let n = 0;
  for (let y = 0; y < raster.height; y += stride) {
    const row = y * raster.width;
    for (let x = 0; x < raster.width; x += stride) {
      if (data[(row + x) * 4 + 3] > threshold) found[n++] = row + x;
    }
  }
  return found.subarray(0, n);
}

/**
 * Rasterises `text` and turns its opaque pixels into particle positions.
 *
 * Output is normalised (glyph box height = 1 unit), so it is resolution
 * independent: a viewport resize only needs a new scale factor on the object,
 * never a re-sample.
 */
export function sampleTextToPoints({
  text,
  fontFamily,
  count,
  seed = 0x5eed,
  fontSize = 260,
  stride = 1,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
  maxEdge = 2048,
}: SampleOptions): TextSample {
  const positions = new Float32Array(count * 3);
  const rand = mulberry32(seed);

  let size = fontSize;
  let raster = drawText(text, fontFamily, size);
  if (!raster) return { positions, aspect: 1, sampledPixels: 0, fontSize: size };

  // Clamp to the canvas edge budget before doing any pixel work.
  const edge = Math.max(raster.width, raster.height);
  if (edge > maxEdge) {
    size = Math.max(24, Math.floor(size * (maxEdge / edge)));
    raster = drawText(text, fontFamily, size) ?? raster;
  }

  let opaque = collectOpaque(raster, stride, alphaThreshold);

  // Ink scales with area, so the correction factor is sqrt(wanted / actual).
  // Without this, a short word at a small raster yields fewer candidates than
  // particles and the field visibly clumps into duplicated positions.
  if (opaque.length > 0 && opaque.length < count * 1.25) {
    const grow = Math.sqrt((count * 1.6) / opaque.length);
    const ceiling = Math.floor(
      size * (maxEdge / Math.max(raster.width, raster.height)),
    );
    const next = Math.min(Math.floor(size * grow), ceiling);
    if (next > size) {
      size = next;
      const grown = drawText(text, fontFamily, size);
      if (grown) {
        raster = grown;
        opaque = collectOpaque(raster, stride, alphaThreshold);
      }
    }
  }

  const { width, height } = raster;
  const aspect = width / height;
  const total = opaque.length;

  if (total === 0) {
    return { positions, aspect, sampledPixels: 0, fontSize: size };
  }

  // Pick exactly `count` pixels. More ink than particles → partial Fisher–Yates
  // so the subset stays spatially even. Less ink → wrap, with jitter keeping
  // duplicates from landing on top of each other.
  const take = Math.min(count, total);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rand() * (total - i));
    const tmp = opaque[i];
    opaque[i] = opaque[j];
    opaque[j] = tmp;
  }

  // Jitter by one stride so the result reads as dust, not a dot-matrix grid.
  const jitter = stride / height;

  for (let i = 0; i < count; i++) {
    const flat = opaque[i % total];
    const px = flat % width;
    const py = (flat / width) | 0;

    positions[i * 3] =
      (px / width - 0.5) * aspect + (rand() - 0.5) * jitter * aspect;
    positions[i * 3 + 1] = -(py / height - 0.5) + (rand() - 0.5) * jitter;
    positions[i * 3 + 2] = (rand() - 0.5) * 0.04;
  }

  return { positions, aspect, sampledPixels: total, fontSize: size };
}
