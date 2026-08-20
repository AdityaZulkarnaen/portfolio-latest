import * as THREE from "three";

export type AtlasTile = {
  /** Drawn into the cell when there is no `src`, or when the artwork fails to load. */
  label: string;
  /** Points at real artwork under `public/`. */
  src?: string;
  /** Paints the placeholder in acid rather than bone. */
  accent?: boolean;
  /**
   * Repaints the mark in this colour, keeping its alpha exactly.
   *
   * For the single-colour marks that ship black-on-transparent — GitHub,
   * Next.js, Expo, Solidity. They are drawn onto a near-black tunnel, where
   * black artwork is not dim but genuinely absent, and half the stack would
   * simply not be there. Recolouring by alpha rather than inverting the pixels
   * is what keeps the knockouts intact: GitHub's octocat is a hole in a disc,
   * so the disc turns bone and the cat stays void, which is the official
   * reversed mark rather than a photographic negative of it.
   */
  mono?: string;
};

export type LogoAtlas = {
  texture: THREE.CanvasTexture;
  /** [columns, rows] — the shader needs both to turn a tile index into a UV. */
  grid: [number, number];
  count: number;
};

const BONE = "#cfd2c8";
const ACID = "#e1ff00";

/**
 * Optical size of a square mark, as a fraction of the cell — and the hard
 * bound nothing may cross.
 *
 * `LIMIT` is not styling. Cells are addressed by UV offset into one sheet and
 * the texture is mipmapped, so at the far end of the tunnel a cell is only a
 * few pixels wide and a mark touching its edge bleeds into the neighbouring
 * logo. The margin is what keeps that from happening.
 */
const TARGET = 0.66;
const LIMIT = 0.88;

/** Edge of the scratch canvas the content box is measured on. */
const PROBE = 96;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * The mark's actual bounding box in source pixels, ignoring transparent margin.
 *
 * Necessary because the artwork is a pile of files from twenty different
 * sources: some are cropped tight, some carry a third of their canvas as air.
 * Fitting each file's *frame* into the cell would make those marks land at
 * wildly different optical sizes for no reason a viewer could see.
 *
 * Measured on a small scratch canvas — a bounding box needs resolution in
 * percent, not pixels, and some of these files are 3840px square, which is 60MB
 * of image data to read back for four numbers.
 */
function contentBox(
  image: HTMLImageElement,
  probe: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Box {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const full: Box = { x: 0, y: 0, w: iw, h: ih };
  if (!iw || !ih) return full;

  const scale = Math.min(PROBE / iw, PROBE / ih, 1);
  const pw = Math.max(1, Math.round(iw * scale));
  const ph = Math.max(1, Math.round(ih * scale));

  probe.width = pw;
  probe.height = ph;
  ctx.clearRect(0, 0, pw, ph);
  ctx.drawImage(image, 0, 0, pw, ph);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, pw, ph).data;
  } catch {
    // A tainted canvas. Every asset is same-origin under `public/`, so this
    // should not happen — but a failed read must cost a trim, not the logo.
    return full;
  }

  let minX = pw;
  let minY = ph;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (data[(y * pw + x) * 4 + 3] <= 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Fully transparent, or close enough that there is nothing to centre on.
  if (maxX < minX || maxY < minY) return full;

  // One probe pixel of slack on every side, so a soft antialiased edge is not
  // sliced off by the threshold above.
  const inv = 1 / scale;
  const x = Math.max(0, (minX - 1) * inv);
  const y = Math.max(0, (minY - 1) * inv);
  return {
    x,
    y,
    w: Math.min(iw - x, (maxX - minX + 3) * inv),
    h: Math.min(ih - y, (maxY - minY + 3) * inv),
  };
}

/**
 * Draws the calibration mark that stands in for a real logo: a bracketed frame
 * with the stack's initials in it. Still here, and still reached — it is what
 * a tile falls back to if its artwork 404s or decodes badly, so one broken file
 * costs one legible placeholder rather than a hole in the tunnel.
 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  tile: AtlasTile,
  fontFamily: string,
  size: number,
) {
  const color = tile.accent ? ACID : BONE;
  const pad = size * 0.14;
  const inner = size - pad * 2;
  const stroke = Math.max(2, size * 0.022);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = stroke;

  // Bracket corners rather than a closed box: at depth a full outline reads as
  // a solid tile, while four corners keep reading as a frame.
  const arm = inner * 0.28;
  const corners: [number, number, number, number][] = [
    [pad, pad, 1, 1],
    [size - pad, pad, -1, 1],
    [pad, size - pad, 1, -1],
    [size - pad, size - pad, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + sx * arm, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * arm);
    ctx.stroke();
  }

  // Fit the label to the frame. Initials range from two to five characters, so
  // measuring is the only way to keep the optical weight even across tiles.
  const maxWidth = inner * 0.82;
  let fontSize = size * 0.3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 6; i++) {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    const width = ctx.measureText(tile.label).width;
    if (width <= maxWidth) break;
    fontSize *= maxWidth / width;
  }
  ctx.fillText(tile.label, size / 2, size / 2);
}

/**
 * Rasterises the stack into one sprite sheet, following the same offscreen
 * canvas discipline as `sample-text-to-points.ts`.
 *
 * One texture and one draw call for the whole tunnel: per-instance the shader
 * only needs a tile index, which it turns into a UV offset.
 *
 * `fontFamily` must be read off a live node rather than imported, so any
 * placeholder is drawn with exactly the face the browser resolved — and
 * `waitForFont` must have resolved first, or Canvas 2D silently falls back to a
 * system face.
 *
 * `tileSize` is the edge of one cell. It is the whole texture budget: the sheet
 * is `ceil(sqrt(n))` cells wide, so 20 marks at 384 is 1920x1536 — around 16MB
 * once mipmapped, which is why the caller picks it per device rather than
 * having it fixed here.
 */
export async function buildLogoAtlas(
  tiles: readonly AtlasTile[],
  fontFamily: string,
  tileSize = 256,
): Promise<LogoAtlas | null> {
  const count = tiles.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const TILE = tileSize;

  const canvas = document.createElement("canvas");
  canvas.width = cols * TILE;
  canvas.height = rows * TILE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Load every real asset up front so the cells are drawn in one pass and the
  // texture is only ever uploaded once.
  const images = await Promise.all(
    tiles.map((tile) => (tile.src ? loadImage(tile.src) : Promise.resolve(null))),
  );

  const probe = document.createElement("canvas");
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });

  // `source-in` applies to a whole canvas, so a recoloured mark cannot be
  // composited straight onto the sheet — it would wipe every cell already
  // drawn. One scratch tile, reused.
  const scratch = document.createElement("canvas");
  scratch.width = TILE;
  scratch.height = TILE;
  const scratchCtx = scratch.getContext("2d");

  for (let i = 0; i < count; i++) {
    const tile = tiles[i];
    const image = images[i];

    ctx.save();
    // Cells are laid out top-down; the shader flips V to match.
    ctx.translate((i % cols) * TILE, Math.floor(i / cols) * TILE);

    if (image) {
      const box =
        probeCtx && image.naturalWidth
          ? contentBox(image, probe, probeCtx)
          : { x: 0, y: 0, w: image.width, h: image.height };

      // Normalised by optical area, not by bounding box. `contain` makes a wide
      // mark tiny — PHP is 1.85:1, so contained in a square its height lands at
      // barely half of React's, and the tunnel reads as if some logos are
      // further away than others. Matching the geometric mean instead gives
      // every mark the same visual weight, with the bounding box only stepping
      // in as the clamp that keeps it inside the cell.
      const geo = Math.sqrt(box.w * box.h);
      const scale = Math.min(
        (TILE * TARGET) / geo,
        (TILE * LIMIT) / box.w,
        (TILE * LIMIT) / box.h,
      );
      const w = box.w * scale;
      const h = box.h * scale;
      const dx = (TILE - w) / 2;
      const dy = (TILE - h) / 2;

      if (tile.mono && scratchCtx) {
        scratchCtx.clearRect(0, 0, TILE, TILE);
        scratchCtx.globalCompositeOperation = "source-over";
        scratchCtx.drawImage(image, box.x, box.y, box.w, box.h, dx, dy, w, h);
        scratchCtx.globalCompositeOperation = "source-in";
        scratchCtx.fillStyle = tile.mono;
        scratchCtx.fillRect(0, 0, TILE, TILE);
        scratchCtx.globalCompositeOperation = "source-over";
        ctx.drawImage(scratch, 0, 0);
      } else {
        ctx.drawImage(image, box.x, box.y, box.w, box.h, dx, dy, w, h);
      }
    } else {
      drawPlaceholder(ctx, tile, fontFamily, TILE);
    }

    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Without mipmaps plus anisotropy the far end of the tunnel is a field of
  // aliasing sparkle — the tiles are minified to a few pixels down there.
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // Cells are addressed by UV offset, so bleeding across an edge would sample
  // the neighbouring logo. Clamp, and keep a transparent margin in each cell.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Load-bearing. Three flips canvas textures on upload by default, which puts
  // row 0 of the sheet at the bottom of UV space — the labels come out upside
  // down and every tile index picks the wrong row. The shader does the
  // top-down cell mapping itself, so the upload must not touch it.
  texture.flipY = false;
  texture.needsUpdate = true;

  return { texture, grid: [cols, rows], count };
}
