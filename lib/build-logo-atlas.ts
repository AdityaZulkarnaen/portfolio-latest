import * as THREE from "three";

export type AtlasTile = {
  /** Drawn into the cell when there is no `src`. */
  label: string;
  /** Point this at real artwork under `public/` to replace the placeholder. */
  src?: string;
  /** Paints the placeholder in acid rather than bone. */
  accent?: boolean;
};

export type LogoAtlas = {
  texture: THREE.CanvasTexture;
  /** [columns, rows] — the shader needs both to turn a tile index into a UV. */
  grid: [number, number];
  count: number;
};

/** Edge of one cell, in pixels. 256 survives a logo filling half the screen. */
const TILE = 256;
const BONE = "#cfd2c8";
const ACID = "#e1ff00";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Draws the calibration mark that stands in for a real logo: a bracketed frame
 * with the stack's initials in it. Deliberately drawn rather than shipped as an
 * asset — the section is presentable before any artwork exists, and swapping in
 * the real marks later touches nothing but this function's `src` branch.
 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  tile: AtlasTile,
  fontFamily: string,
) {
  const color = tile.accent ? ACID : BONE;
  const pad = TILE * 0.14;
  const inner = TILE - pad * 2;
  const stroke = Math.max(2, TILE * 0.022);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = stroke;

  // Bracket corners rather than a closed box: at depth a full outline reads as
  // a solid tile, while four corners keep reading as a frame.
  const arm = inner * 0.28;
  const corners: [number, number, number, number][] = [
    [pad, pad, 1, 1],
    [TILE - pad, pad, -1, 1],
    [pad, TILE - pad, 1, -1],
    [TILE - pad, TILE - pad, -1, -1],
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
  let size = TILE * 0.3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 6; i++) {
    ctx.font = `700 ${size}px ${fontFamily}`;
    const width = ctx.measureText(tile.label).width;
    if (width <= maxWidth) break;
    size *= maxWidth / width;
  }
  ctx.fillText(tile.label, TILE / 2, TILE / 2);
}

/**
 * Rasterises the stack into one sprite sheet, following the same offscreen
 * canvas discipline as `sample-text-to-points.ts`.
 *
 * One texture and one draw call for the whole tunnel: per-instance the shader
 * only needs a tile index, which it turns into a UV offset.
 *
 * `fontFamily` must be read off a live node rather than imported, so the label
 * is drawn with exactly the face the browser resolved — and `waitForFont` must
 * have resolved first, or Canvas 2D silently falls back to a system face.
 */
export async function buildLogoAtlas(
  tiles: readonly AtlasTile[],
  fontFamily: string,
): Promise<LogoAtlas | null> {
  const count = tiles.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

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

  for (let i = 0; i < count; i++) {
    const tile = tiles[i];
    const image = images[i];

    ctx.save();
    // Cells are laid out top-down; the shader flips V to match.
    ctx.translate((i % cols) * TILE, Math.floor(i / cols) * TILE);

    if (image) {
      // Contain, not cover: logos have wildly different aspects and cropping
      // one is worse than leaving air around it.
      const scale = Math.min(TILE / image.width, TILE / image.height) * 0.72;
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (TILE - w) / 2, (TILE - h) / 2, w, h);
    } else {
      drawPlaceholder(ctx, tile, fontFamily);
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
