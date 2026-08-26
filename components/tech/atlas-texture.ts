import * as THREE from "three";
import type { LogoSheet } from "@/lib/build-logo-atlas";

/**
 * The sprite sheet once it is on the GPU.
 *
 * This module exists to keep `import * as THREE` out of `tech-stack.tsx`.
 * `tech-stack` is a plain client component that renders on the homepage, so
 * every module it reaches is eager — and it used to reach three through
 * `build-logo-atlas.ts`, which put the whole library in a `<script async>` on
 * first load and quietly defeated both `ssr: false` boundaries. The rasterising
 * stays in `lib/`, where it is pure Canvas 2D; the twelve lines that need three
 * live here, inside the scene subtree that is already lazy.
 */
export type LogoAtlas = {
  texture: THREE.CanvasTexture;
  /** [columns, rows] — the shader needs both to turn a tile index into a UV. */
  grid: [number, number];
  count: number;
};

/** Uploads a finished sheet. The caller owns the result and must dispose it. */
export function toAtlasTexture(sheet: LogoSheet): LogoAtlas {
  const texture = new THREE.CanvasTexture(sheet.canvas);
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

  return { texture, grid: sheet.grid, count: sheet.count };
}
