/**
 * Chapter .01 — Signal Lock. The portrait, drawn as a grid of glyphs.
 *
 * Everything is decided per cell, never per pixel: the cell's centre samples
 * the baked field (tone / silhouette / acid, see `scripts/gen-ascii-portrait.mjs`),
 * that picks a glyph, and the pixel only asks the atlas how much ink that glyph
 * has at its position inside the cell. So the image can only ever change one
 * whole character at a time — which is the entire look.
 *
 * Atlas layout, one row: RAMP_LEN ramp glyphs (sparse → dense, index 0 is a
 * space), then NOISE_LEN glyphs used only for scramble, then whatever the
 * x-ray copy needs that neither of those already holds.
 *
 * Coordinates are CSS pixels with the origin bottom-left (gl_FragCoord / dpr),
 * so the grid, the x-ray and the portrait rect all share one space and the
 * cell size reads in the same units as the rest of the layout.
 */
export const asciiFragmentShader = /* glsl */ `
uniform sampler2D uField;
uniform sampler2D uAtlas;
uniform sampler2D uText;     // 1 x TEXT_LEN, R = atlas index of each char

uniform vec2  uResolution;   // css px
uniform float uDpr;
uniform float uCell;         // css px, cell height
uniform float uCharW;        // cell width / cell height
uniform vec4  uRect;         // portrait rect: x0, y0, w, h (css px, y up)
uniform vec2  uFocus;        // where the lock starts, in portrait uv

uniform float uTime;
uniform float uReveal;       // 0 noise → 1 locked
uniform float uDispersion;   // 0 held → 1 dissolved
uniform float uOpacity;
uniform float uScan;         // scanline height 0..1 (screen), < 0 when off

uniform vec2  uPointer;      // css px
uniform float uDecode;       // 0..1, how far the x-ray is open
uniform float uDecodeRadius; // css px
uniform vec4  uPulses[PULSE_SLOTS]; // x, y, radius (css px), strength

uniform vec3 uInk;
uniform vec3 uAcid;

const float RAMP_LEN  = float(RAMP_COUNT);
const float NOISE_LEN = float(NOISE_COUNT);
const float GLYPHS    = float(GLYPH_COUNT);
const float TEXT_N    = float(TEXT_LEN);

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

/* Ink coverage of glyph g at position local (0..1) inside its cell.
   textureGrad with gradients taken from the continuous coordinate, not from
   the per-cell fract: fract jumps at every cell border, and the derivative of
   that jump would drop the sampler to its smallest mip and draw a faint
   seam around every single cell. */
float glyph(float g, vec2 local, vec2 gradX, vec2 gradY) {
  vec2 uv = vec2((g + local.x) / GLYPHS, local.y);
  return textureGrad(uAtlas, uv, gradX, gradY).r;
}

void main() {
  vec2 frag = gl_FragCoord.xy / uDpr;

  // --- Grid ---------------------------------------------------------------
  float cellH = uCell;
  vec2 cellSize = vec2(cellH * uCharW, cellH);

  vec2 gridPos = frag / cellSize;
  vec2 cell = floor(gridPos);
  vec2 local = fract(gridPos);
  vec2 centre = (cell + 0.5) * cellSize;
  vec2 cellKey = cell;
  float cellSeed = hash12(cellKey);
  // Taken here, before any discard: derivatives are only defined while every
  // pixel of the quad is still running.
  vec2 gradX = dFdx(gridPos) / vec2(GLYPHS, 1.0);
  vec2 gradY = dFdy(gridPos) / vec2(GLYPHS, 1.0);

  vec2 sampleAt = centre;

  // --- Field --------------------------------------------------------------
  vec2 puv = (sampleAt - uRect.xy) / uRect.zw;
  float inRect = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
  vec3 field = texture(uField, clamp(puv, 0.0, 1.0)).rgb * inRect;
  float tone = field.r;
  // Where the photo's own bottom edge is on screen (portrait layouts, where
  // the bust no longer runs off the frame), the hem frays out over its last
  // fifth instead of ending on a ruled line.
  float hem = uRect.y > 0.5 ? smoothstep(0.0, 0.24, puv.y) : 1.0;
  float body = step(0.5, field.g) * step(cellSeed, hem * 1.04);
  tone *= mix(0.55, 1.0, hem);
  float acid = step(0.5, field.b) * body;

  float idx = body * clamp(floor(tone * (RAMP_LEN - 1.0) + 0.5), 1.0, RAMP_LEN - 1.0);
  float bright = mix(0.34, 1.0, tone);

  // --- Idle: the portrait breathes ----------------------------------------
  // Each cell rolls on its own clock; ~3% of them sit one step up or down the
  // ramp at any moment. The shape never moves, the surface never stops.
  float tick = floor(uTime * 2.6 + cellSeed * 17.0);
  float roll = hash13(vec3(cellKey, tick));
  if (body > 0.5 && roll < 0.032) {
    idx = clamp(idx + (roll < 0.016 ? 1.0 : -1.0), 1.0, RAMP_LEN - 1.0);
  }

  // --- Disturbances: scanline + click rings --------------------------------
  float scramble = 0.0;
  if (uScan >= 0.0) {
    float rowV = centre.y / uResolution.y;
    scramble = max(scramble, 1.0 - smoothstep(0.0, cellH * 1.6 / uResolution.y, abs(rowV - uScan)));
  }
  for (int i = 0; i < PULSE_SLOTS; i++) {
    vec4 p = uPulses[i];
    if (p.w <= 0.0) continue;
    float ring = abs(distance(centre, p.xy) - p.z);
    scramble = max(scramble, p.w * (1.0 - smoothstep(0.0, uCell * 2.2, ring)));
  }

  // --- Reveal: noise locks onto the face, from the eyes outward -----------
  vec2 focus = uRect.xy + uFocus * uRect.zw;
  float reach = distance(centre, focus) / max(uRect.w, 1.0);
  // The acid piping locks last, so the colour lands as the closing beat.
  float lockAt = reach * 0.72 + cellSeed * 0.22 + acid * 0.18;
  float progress = uReveal * 1.32;
  float locked = step(lockAt, progress);
  float sinceLock = progress - lockAt;
  float flash = locked * (1.0 - smoothstep(0.0, 0.07, sinceLock)) * step(uReveal, 0.999);

  // Background cells carry noise only while the field is still unresolved,
  // thinning out as the portrait takes over.
  float bgNoise = (1.0 - body) * step(hash12(cellKey + 31.0), 0.42 * (1.0 - smoothstep(0.0, 0.55, uReveal)));
  float noisy = max(1.0 - locked, 0.0) * max(body, bgNoise);

  // --- Dispersion: dissolve from the bottom row up ------------------------
  float rowFromBottom = centre.y / uResolution.y;
  float melt = clamp(uDispersion * 1.9 - rowFromBottom * 0.85 - cellSeed * 0.3, 0.0, 1.0);
  idx = floor(idx * (1.0 - melt) + 0.001);
  // Cells halfway gone stutter through noise on their way out.
  float meltNoise = step(0.25, melt) * step(melt, 0.55) * step(roll, 0.22) * body;

  // --- X-ray: the portrait decodes into the text it is made of -----------
  // Inside the pointer's radius the density ramp is swapped for real copy —
  // name, role, stack — running along each row like a ticker. Brightness
  // still comes from the photo, so the face stays legible in the text.
  // The edge is dithered per cell, and cells right on it flicker through
  // noise: the boundary reads as decoding, not as a hard circle.
  float reachX = distance(centre, uPointer) / max(uDecodeRadius * uDecode, 1.0);
  float edge = smoothstep(0.45, 1.0, reachX);
  float decoded = uDecode > 0.01 ? step(edge, cellSeed) * locked * step(melt, 0.15) : 0.0;
  float decoding = decoded * step(cellSeed - edge, 0.07) * step(0.001, edge);

  float march = floor(uTime * 5.0);
  float ti = mod(cell.x + march + cell.y * 23.0, TEXT_N);
  float textG = floor(texture(uText, vec2((ti + 0.5) / TEXT_N, 0.5)).r * 255.0 + 0.5);

  // --- Glyph choice ---------------------------------------------------------
  float useNoise = max(max(max(noisy, step(0.5, scramble) * body), meltNoise), decoding);
  float noiseTick = floor(uTime * 16.0 + cellSeed * 5.0);
  float noiseG = RAMP_LEN + floor(hash13(vec3(cellKey, noiseTick + 3.0)) * NOISE_LEN);
  float useText = decoded * (1.0 - useNoise);
  float g = useNoise > 0.5 ? noiseG : (useText > 0.5 ? textG : idx);
  if (g < 0.5) discard;

  float ink = glyph(g, local, gradX, gradY);
  if (ink < 0.004) discard;

  // --- Colour ---------------------------------------------------------------
  vec3 col = uInk * bright;
  col = mix(col, uAcid * mix(0.78, 1.0, tone), acid);
  if (useNoise > 0.5) {
    float spark = hash13(vec3(cellKey, noiseTick));
    col = uInk * mix(0.22, 0.6, spark);
    if (spark > 0.93) col = uAcid * 0.8;
  }
  if (useText > 0.5) {
    // Off the body the text still runs, barely: enough to show the x-ray's
    // extent against the void without competing with the face.
    col = body > 0.5
      ? mix(uInk * mix(0.3, 1.08, tone), uAcid * mix(0.8, 1.0, tone), acid)
      : uInk * 0.11;
  }
  col = mix(col, uAcid, flash);

  float alpha = ink * uOpacity * (1.0 - melt * 0.6);
  gl_FragColor = vec4(col, alpha);
}
`;
