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

// --- The garden -----------------------------------------------------------
// Four hedges at four depths. Per layer:
//   A = (cell scale, bush spacing px, bush size, baseline px)
//   B = (lift at left edge px, lift at right edge px, left falloff, right falloff)
//   C = (brightness, bare fraction, parallax px, hanging 0/1)
uniform vec4  uLayerA[LAYER_COUNT];
uniform vec4  uLayerB[LAYER_COUNT];
uniform vec4  uLayerC[LAYER_COUNT];
uniform vec2  uParallax;     // smoothed pointer, -1..1
uniform float uGrowFrom;     // screen x (0..1) the garden grows outward from
uniform float uHover;        // 0..1, pointer present (parts leaves, calls fireflies)
uniform vec3  uVoid;         // the page ground: what a bush paints over what is behind it
uniform vec3  uLeafDark;
uniform vec3  uLeafLight;
uniform vec3  uFarTint;
uniform vec3  uLilac;
uniform vec3  uPink;

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

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/* ---------------------------------------------------------------------------
   The garden: hedges of bushes at four depths.

   Depth is sold three ways at once, because any one alone reads as a flat
   sticker: each layer has its own glyph size (far = small type, near = big),
   its own brightness with the far ones washed toward a cool tint, and its own
   parallax against the pointer. Two layers sit behind the portrait, one in
   front of it, and one hangs from the top corners — so the garden frames the
   frame instead of lining the bottom of it.

   A bush is three overlapping lobes with a noise-chewed edge, sat on a
   baseline that lifts toward the screen edges; below the baseline is the
   hedge mass itself, darkening with depth. Shading is a top light on the lobe
   normal, broken into leaf clumps by a second noise.
   --------------------------------------------------------------------------- */

float baseline(float xn, vec4 A, vec4 B) {
  return A.w
    + B.x * exp(-pow(xn / max(B.z, 0.001), 2.0))
    + B.y * exp(-pow((1.0 - xn) / max(B.w, 0.001), 2.0));
}

/* > 0 inside the hedge (1 at a lobe's heart). Writes the lit shade. */
float hedge(vec2 p, int li, float hanging, out float shade, out float lit) {
  vec4 A = uLayerA[li];
  vec4 B = uLayerB[li];
  vec4 C = uLayerC[li];
  float lf = float(li);
  float spacing = A.y;
  // Hanging hedges are evaluated upside down, so the same vector lights their
  // lower edge — the side that is actually on screen — as if from the
  // fireflies below.
  vec2 light = normalize(vec2(-0.35, 0.94));

  float base = baseline(p.x / uResolution.x, A, B);
  float best = -1.0;
  shade = 0.0;
  lit = 0.0;

  // The mass under the bushes: solid, and darker the deeper it goes.
  // Sits a little below the baseline so the crowns stand clear of it.
  float under = (base - spacing * 0.35 - p.y) / (spacing * 0.6);
  if (under > 0.0) {
    best = min(under, 1.0);
    shade = mix(0.3, 0.06, clamp(under, 0.0, 1.0));
    lit = 0.25;
  }

  float j0 = floor(p.x / spacing);
  for (int k = -1; k <= 1; k++) {
    float j = j0 + float(k);
    float s = hash12(vec2(j, 100.0 + lf * 13.0));
    if (s < C.y) continue;
    float cx = (j + 0.5 + (s - 0.5) * 0.7) * spacing;
    float by = baseline(cx / uResolution.x, A, B);
    float r = spacing * A.z * (0.7 + 0.5 * hash12(vec2(j, 101.0 + lf * 13.0)));
    // Grows out from under the face during the intro, sinks on the way out.
    float grow = smoothstep(0.0, 0.5, uReveal * 1.3 - abs(cx / uResolution.x - uGrowFrom) * 0.5 - s * 0.1);
    float sink = 1.0 - smoothstep(0.0, 0.7, uDispersion * 1.3 - s * 0.25);
    r *= grow * sink;
    if (r < 2.0) continue;

    // The crown sways; the root does not.
    float sway = sin(uTime * 0.9 + s * 6.283) * 0.06 * r * clamp((p.y - by) / r, 0.0, 1.5);
    vec2 q = p - vec2(sway, 0.0);

    for (int l = 0; l < 3; l++) {
      // A dome: the crown lobe high, two shoulders lower and wider apart.
      vec2 c = l == 0 ? vec2(cx, by + r * 0.45)
             : l == 1 ? vec2(cx - r * 0.66, by + r * 0.05)
             :          vec2(cx + r * 0.62, by);
      float rl = l == 0 ? r : l == 1 ? r * 0.72 : r * 0.66;
      vec2 dv = (q - c) / rl;
      float d = length(dv) + (vnoise(q / (rl * 0.22) + s * 17.0 + float(l) * 3.1) - 0.5) * 0.3;
      float inside = 1.0 - d;
      if (inside > best) {
        best = inside;
        lit = clamp(dot(normalize(dv + 1e-4), light) * 0.5 + 0.5, 0.0, 1.0);
        // Lit skin, shadowed heart — exaggerated, so each lobe reads as a
        // ball and not as a patch of texture.
        shade = mix(0.1, 1.0, lit * lit) * mix(0.3, 1.0, smoothstep(0.1, 0.8, d));
      }
    }
  }
  return best;
}

/* One hedge layer, on its own grid. Returns (colour, ink). */
vec4 foliage(int li, vec2 frag, vec2 fdx, vec2 fdy, vec2 cellSize, out float cover) {
  cover = 0.0;
  vec4 A = uLayerA[li];
  vec4 C = uLayerC[li];
  float lf = float(li);
  float hanging = C.w;

  vec2 cs = cellSize * A.x;
  vec2 f = frag + uParallax * C.z;
  // The pointer pushes leaves aside.
  vec2 away = f - uPointer;
  float dp = length(away);
  f += away / max(dp, 1.0) * 20.0 * A.x * exp(-dp / 95.0) * uHover;

  vec2 gp = f / cs;
  vec2 cell = floor(gp);
  vec2 local = fract(gp);
  vec2 ctr = (cell + 0.5) * cs;
  vec2 probe = hanging > 0.5 ? vec2(ctr.x, uResolution.y - ctr.y) : ctr;

  float shade, lit;
  float inside = hedge(probe, li, hanging, shade, lit);
  if (inside <= 0.0) return vec4(0.0);

  float cseed = hash12(cell + lf * 311.0);
  // A ragged, leafy outline rather than a clean one.
  if (inside < 0.06 && cseed > inside / 0.06) return vec4(0.0);

  // From here on the cell is bush: it hides whatever is behind it. Without
  // this every layer showed through every other and the garden read as one
  // grey texture with no shapes in it.
  cover = 1.0;

  // Leaf clusters: darker seams between clumps give the surface its lumps.
  float clumps = vnoise(ctr / (cs.y * 2.6) + lf * 5.0);
  float dens = shade * mix(0.45, 1.15, smoothstep(0.25, 0.7, clumps));

  // The silhouette, drawn: a bright rim where the light catches the edge,
  // a dim one round the shadow side, so every bush is a closed shape.
  float rim = 1.0 - smoothstep(0.0, 0.14, inside);
  float rimBright = rim * smoothstep(0.35, 0.8, lit);
  dens = max(dens, rim * mix(0.32, 0.95, lit));
  dens = clamp(dens, 0.0, 1.0);

  // Rustle: always a little, a lot under the pointer.
  float stir = exp(-length(ctr - uPointer) / 110.0) * uHover;
  float tick = floor(uTime * (2.0 + stir * 10.0) + cseed * 13.0);
  float roll = hash13(vec3(cell, tick + lf * 7.0));
  if (roll < 0.05 + stir * 0.6) dens = clamp(dens + (roll < 0.025 + stir * 0.3 ? 0.18 : -0.18), 0.0, 1.0);
  if (dens < 0.1) return vec4(0.0);

  float gi = float(FOL_START) + floor(dens * float(FOL_COUNT - 1) + 0.5);
  float bright = C.x;
  vec3 col = mix(uLeafDark, uLeafLight, pow(max(shade, rimBright), 1.1)) * (0.8 + 0.35 * stir);
  // Atmosphere: the dimmer the layer, the further away, the cooler it reads.
  col = mix(col, uFarTint, (1.0 - bright) * 0.75) * bright;

  // Blossoms on the sunlit skin of the nearer hedges.
  if (bright > 0.6 && shade > 0.55 && hash12(cell + 977.0 + lf) > 0.955) {
    float kind = hash12(cell + 31.0 + lf);
    float tw = 0.75 + 0.25 * sin(uTime * 2.4 + cseed * 30.0);
    gi = kind < 0.4 ? float(G_AT) : kind < 0.75 ? float(G_STAR) : float(G_O);
    col = (kind < 0.33 ? uLilac : kind < 0.66 ? uPink : uAcid) * tw;
  }
  // Now and then a leaf catches the light.
  if (hash13(vec3(cell, floor(uTime * 1.3 + cseed * 9.0) + lf)) < 0.012 * bright) col = uAcid;

  vec2 gx = fdx / cs / vec2(GLYPHS, 1.0);
  vec2 gy = fdy / cs / vec2(GLYPHS, 1.0);
  float ink = glyph(gi, local, gx, gy);
  return vec4(col, ink);
}

void over(inout vec4 acc, vec3 c, float a) {
  acc.rgb = c * a + acc.rgb * (1.0 - a);
  acc.a = a + acc.a * (1.0 - a);
}

/* Fireflies: drift up out of the hedges, wander, wink out near the top.
   Each one is a glyph in whichever cell it is over, plus a soft halo drawn
   per pixel so the light spills past the grid. Returns the halo; writes the
   glyph when this cell holds one. */
float fireflies(vec2 frag, vec2 cell, vec2 cellSize, out float g, out vec3 col) {
  g = 0.0;
  col = vec3(0.0);
  float halo = 0.0;
  float appear = smoothstep(0.55, 1.0, uReveal) * (1.0 - smoothstep(0.1, 0.6, uDispersion));
  if (appear <= 0.0) return 0.0;

  for (int i = 0; i < FIREFLY_COUNT; i++) {
    float fi = float(i);
    float h1 = hash12(vec2(fi, 3.1));
    float h2 = hash12(vec2(fi, 7.7));
    float h3 = hash12(vec2(fi, 13.3));
    float life = fract(uTime * (0.018 + 0.026 * h3) + h1);
    vec2 p = vec2(
      h2 * uResolution.x + sin(uTime * (0.35 + h1 * 0.4) + fi * 2.1) * 46.0,
      mix(uResolution.y * 0.06, uResolution.y * 0.95, pow(life, 1.15)) + sin(uTime * 0.9 + fi * 1.7) * 16.0
    );
    // Drawn toward the pointer, a little.
    vec2 toP = uPointer - p;
    p += toP * 0.3 * exp(-length(toP) / 220.0) * uHover;

    float blink = 0.55 + 0.45 * sin(uTime * (1.6 + h3 * 2.0) + fi * 5.0);
    float fade = sin(life * 3.14159) * blink * appear;
    vec3 tint = h2 > 0.72 ? uLilac : uAcid;

    // Near ones are bigger and brighter: the halo carries depth too.
    float rad = mix(12.0, 36.0, h3);
    float d = distance(frag, p);
    halo += fade * exp(-d * d / (rad * rad)) * mix(0.25, 0.5, h3);

    if (floor(p.x / cellSize.x) == cell.x && floor(p.y / cellSize.y) == cell.y && fade > 0.15) {
      g = blink > 0.75 ? float(G_STAR) : float(G_PLUS);
      col = tint * (0.6 + 0.4 * fade);
    }
  }
  return halo;
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
  vec2 fdx = dFdx(frag);
  vec2 fdy = dFdy(frag);

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
  float fade = 1.0 - melt * 0.6;

  // --- Compositing, back to front --------------------------------------------
  // Hedges 0 and 1 are behind the portrait, so they are skipped wherever the
  // silhouette is: two grids of glyphs interleaving would turn the face to mush.
  // Each hedge first lays down ground over its own silhouette (cover), then
  // its glyphs: nearer bushes hide farther ones, which is what makes them
  // read as separate objects at separate depths.
  vec4 acc = vec4(0.0);
  float cov;
  if (body < 0.5) {
    vec4 l0 = foliage(0, frag, fdx, fdy, cellSize, cov);
    over(acc, uVoid, cov);
    over(acc, l0.rgb, l0.a);
    vec4 l1 = foliage(1, frag, fdx, fdy, cellSize, cov);
    over(acc, uVoid, cov);
    over(acc, l1.rgb, l1.a);
  }
  float pInk = g > 0.5 ? glyph(g, local, gradX, gradY) * fade : 0.0;
  over(acc, col, pInk);
  vec4 l2 = foliage(2, frag, fdx, fdy, cellSize, cov);
  over(acc, uVoid, cov);
  over(acc, l2.rgb, l2.a);
  vec4 l3 = foliage(3, frag, fdx, fdy, cellSize, cov);
  over(acc, uVoid, cov);
  over(acc, l3.rgb, l3.a);

  float fg; vec3 fcol;
  float halo = min(fireflies(frag, cell, cellSize, fg, fcol), 0.6);
  vec3 haloCol = mix(uAcid, vec3(1.0, 0.95, 0.7), 0.25);
  over(acc, haloCol, halo * 0.85);
  if (fg > 0.5) over(acc, fcol, glyph(fg, local, gradX, gradY));

  if (acc.a < 0.004) discard;
  gl_FragColor = vec4(acc.rgb / acc.a, acc.a * uOpacity);
}
`;
