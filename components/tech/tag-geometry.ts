import * as THREE from "three";

/**
 * The `< />` glyphs, extruded.
 *
 * Built from hand-made `THREE.Shape` outlines rather than drei's `<Text3D>`,
 * which needs a typeface JSON this project does not ship (`public/font/` only
 * has the BlurWeb TTF, and converting Archivo is a separate toolchain step).
 * Three straight-edged glyphs are cheap to describe exactly, and describing
 * them exactly is what makes the aperture controllable: the gap between the
 * halves is a number here, not whatever the font happened to draw.
 *
 * To move to a real face later, swap this module for `<Text3D font=... />` and
 * keep the group layout in `code-tag.tsx` untouched.
 */

/** Half-height of a glyph, in local units. Everything else scales off this. */
const H = 0.5;
/** Horizontal reach of a chevron arm. */
const W = 0.44;
/** Stroke thickness, measured perpendicular to the arm. */
const T = 0.135;

const EXTRUDE: THREE.ExtrudeGeometryOptions = {
  depth: 0.22,
  bevelEnabled: true,
  bevelThickness: 0.03,
  bevelSize: 0.025,
  bevelSegments: 3,
  curveSegments: 2,
};

/**
 * A chevron pointing along `dir` (-1 for `<`, +1 for `>`).
 *
 * The outline is walked as outer arm, tip, outer arm, then back along the
 * inner arms. The inner edge is the outer edge offset perpendicular by `T`,
 * which puts the vertical end cut at `H - T / cos(phi)` and the inner tip at
 * `(H - T / cos(phi)) / tan(phi)` back from the axis — worked out rather than
 * eyeballed, so the stroke weight stays constant through the corner.
 */
function chevronShape(dir: number): THREE.Shape {
  const phi = Math.atan2(H, W);
  const endInset = T / Math.cos(phi);
  const innerY = H - endInset;
  const innerX = innerY / Math.tan(phi);

  const shape = new THREE.Shape();
  shape.moveTo(0, H);
  shape.lineTo(dir * W, 0);
  shape.lineTo(0, -H);
  shape.lineTo(0, -innerY);
  shape.lineTo(dir * innerX, 0);
  shape.lineTo(0, innerY);
  shape.closePath();
  return shape;
}

/** The slash: a parallelogram leaning right, with vertical end cuts. */
function slashShape(): THREE.Shape {
  const lean = 0.2;
  const width = T * 1.05;

  const shape = new THREE.Shape();
  shape.moveTo(-lean - width, -H);
  shape.lineTo(-lean + width, -H);
  shape.lineTo(lean + width, H);
  shape.lineTo(lean - width, H);
  shape.closePath();
  return shape;
}

/** Extrudes and re-centres, so each glyph rotates about its own middle. */
function build(shape: THREE.Shape): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, EXTRUDE);
  geo.center();
  return geo;
}

export type TagGeometries = {
  open: THREE.BufferGeometry;
  slash: THREE.BufferGeometry;
  close: THREE.BufferGeometry;
};

export function buildTagGeometries(): TagGeometries {
  return {
    open: build(chevronShape(-1)),
    slash: build(slashShape()),
    close: build(chevronShape(1)),
  };
}
