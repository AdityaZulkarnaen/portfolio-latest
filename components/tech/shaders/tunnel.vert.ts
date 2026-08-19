export const tunnelVertexShader = /* glsl */ `
uniform float uTime;
uniform vec2  uExtent;      // half-size of the frame at z = 0, in world units
uniform vec2  uParallax;    // damped pointer offset, world units
uniform float uCamZ;        // camera distance, for the near clip of the tunnel
uniform float uTravel;      // scroll-driven advance along the tunnel
uniform float uIdle;        // constant drift, so the tunnel lives while scroll is still
uniform float uSpread;      // tunnel radius as a multiple of uExtent
uniform float uLogoScale;
uniform float uScrollVel;
uniform float uReveal;      // master fade for the whole layer
uniform float uMotion;      // 0 disables all animation (reduced motion)
uniform vec2  uAtlasGrid;   // [columns, rows]

attribute vec2  aOffset;    // position on the tunnel cross-section, normalised
attribute float aDepth;     // 0 = far, 1 = at the lens
attribute float aSeed;
attribute float aTile;      // index into the atlas

varying vec2  vUv;
varying float vAlpha;
varying float vNear;

const float FAR_Z = -26.0;

vec2 rotate2d(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  // fract() recycles the field: a tile that reaches the lens reappears at the
  // far plane. Same trick as the hero starfield, but advanced by scroll rather
  // than by time alone.
  float d = fract(aDepth + uTravel + uTime * uIdle * uMotion);
  float z = mix(FAR_Z, uCamZ - 0.45, d);

  // The cross-section is normalised, so a resize is two floats on uExtent —
  // never a buffer rebuild.
  vec2 world = aOffset * uExtent * uSpread;
  world += uParallax * mix(0.15, 1.4, d);

  vec4 mv = modelViewMatrix * vec4(world, z, 1.0);

  // Billboard: the quad's own vertices are added in view space, so every tile
  // faces the camera no matter where it sits in the tunnel.
  float size = uLogoScale * mix(0.30, 1.9, d);
  size *= 0.75 + aSeed * 0.5;

  float spin = (aSeed - 0.5) * 0.5 + uTime * 0.12 * (aSeed - 0.5) * uMotion;
  vec2 quad = rotate2d(position.xy, spin);

  // Motion stretch. The camera has no rotation, so view-space XY is world XY
  // and the radial direction is simply the tile's own offset from the axis.
  // Smearing the quad along it is what turns a fast scroll into the radial
  // streaks of the reference — no second layer, no extra draw call.
  vec2 radial = normalize(world + vec2(1e-4));
  float stretch = abs(uScrollVel) * 3.0 * d * uMotion;
  quad += radial * dot(quad, radial) * stretch;

  mv.xy += quad * size;
  gl_Position = projectionMatrix * mv;

  // Atlas cells are drawn top-down while UV runs bottom-up, so V is flipped
  // before the cell offset is applied.
  vec2 cell = vec2(mod(aTile, uAtlasGrid.x), floor(aTile / uAtlasGrid.x));
  vUv = (vec2(uv.x, 1.0 - uv.y) + cell) / uAtlasGrid;

  // Fade in from the far plane and out at the lens, or tiles pop in and out at
  // the recycle seam.
  vAlpha = smoothstep(0.0, 0.10, d) * (1.0 - smoothstep(0.84, 1.0, d)) * uReveal;
  vNear = d;
}
`;
