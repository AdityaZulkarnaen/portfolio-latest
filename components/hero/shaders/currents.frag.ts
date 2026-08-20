import { noiseChunk } from "./noise";

/**
 * Chapter .01 — the flow field.
 *
 * The whole frame is one fragment program: no geometry, no particles, no post
 * pass. What is drawn is the *stream function* of a two-dimensional fluid, and
 * every line on screen is one of its contours. That is the trick behind the
 * reference sleeve, and the reason this reads as a fluid rather than as a sine
 * wave with a bulge in it — contours of a stream function cannot cross, cannot
 * end, and bend around the sphere exactly the way ink in water does, because
 * they are solving the same equation.
 *
 *   psi(p) = uniform stream past a cylinder   the laminar field + the ball
 *          + a shed vortex street             the turbulent wake
 *          + advected noise                   the grain of a real fluid
 *          + click ripples                    the interaction
 *
 * Contours are then extracted with `fwidth`-based antialiasing, which doubles
 * as level of detail: where the field is compressed hard enough that the lines
 * could no longer be resolved, the derivative blows up and they dissolve into
 * flat tone instead of shimmering. Nothing else in here has to know about
 * resolution, density or device.
 */
export const currentsFragmentShader = /* glsl */ `
#ifndef VORTEX_COUNT
  #define VORTEX_COUNT 9
#endif
#define PULSE_COUNT 4

/* Where in the triangle wave a contour starts. Above 0.5 the light line is
   narrower than the black gap it sits in, which is what keeps a field this
   dense reading as ink on black rather than as flat lavender. */
#define DUTY 0.60

uniform float uTime;
uniform float uAspect;

/* Advected-noise clock. Integrated on the CPU so the speed can change without
   the pattern jumping — a bare uTime * speed teleports the field on every
   edit to the speed. Same story for the shedding cycle. */
uniform float uFlowPhase;
uniform float uShedPhase;

uniform vec2  uFlowDir;     // unit vector the fluid travels along
uniform vec2  uBall;        // sphere centre, in the aspect-corrected space below
uniform vec2  uBallVel;     // sphere velocity, clamped; drives the drag doublet
uniform float uBallRadius;
uniform float uBallScale;   // 0..1, the sphere swelling into frame on intro

uniform float uFreq;        // contours per unit of stream function
uniform float uGamma;       // vortex strength
uniform float uWakeLength;
/* Half-extent of the frame measured along the flow, so the streak's colour
   ramp is spent over exactly the distance it has to travel. */
uniform float uStreakSpan;
uniform float uTurbulence;

uniform float uReveal;      // 0 = pure chaos, 1 = resolved laminar flow
uniform float uDispersion;  // 0 = held, 1 = torn apart again on scroll-out
uniform float uOpacity;
uniform float uGrain;

/* xy = centre, z = radius now, w = strength now. w <= 0 means the slot is free. */
uniform vec4 uPulses[PULSE_COUNT];

uniform vec3 uVoid;
uniform vec3 uDeep;
uniform vec3 uLineLow;
uniform vec3 uLineHigh;
uniform vec3 uAccentA;
uniform vec3 uAccentB;
uniform vec3 uAccentC;
uniform vec3 uAccentD;

varying vec2 vUv;

${noiseChunk}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/** The stream function. Everything visible is a contour of this one scalar. */
float stream(vec2 p) {
  vec2 f = uFlowDir;
  vec2 n = vec2(-f.y, f.x);

  vec2  q  = p - uBall;
  float r2 = max(dot(q, q), 1e-4);

  /* The obstacle grows with the sphere that is drawn, not ahead of it —
     otherwise the intro shows a full-sized hole in the field with a small ball
     sitting in the middle of it. Floored rather than allowed to reach zero: the
     vortex cores below are scaled by this and divide by it. */
  float R  = uBallRadius * max(uBallScale, 0.15);
  float R2 = R * R;

  float along  = dot(q, f);
  float across = dot(q, n);

  /* Potential flow past a cylinder.
     psi = across * (1 - R^2/r^2). Far from the ball the doublet term vanishes
     and this collapses to plain \`across\`: dead-straight, perfectly parallel
     lines. Near it, the exact streamlines of an ideal fluid slipping around a
     circle — the shoulder squeeze and the pinch behind it come for free. */
  float psi = across * (1.0 - R2 / r2);

  /* A cylinder that is also *moving* drags the fluid along with it. This is the
     translating-cylinder doublet, and it is what makes flinging the sphere
     across the frame feel like stirring rather than like moving a cursor. */
  psi += (uBallVel.y * q.x - uBallVel.x * q.y) * (R2 / max(r2, R2 * 0.6)) * 0.14;

  /* Inside the disc the 1/r^2 term runs away. The sphere is painted over it,
     but an unbounded value still poisons fwidth in the ring of pixels
     straddling the rim and eats the outline, so cap it here. */
  psi = clamp(psi, -8.0, 8.0);

  /* Karman vortex street. Real flow past a bluff body does not stay attached;
     it sheds alternating vortices downstream, and those are the closed
     teardrop loops that fill the lower half of the sleeve.

     A textbook point vortex has stream function log(r), which never stops
     falling off — ten of them summed put a slow bend across every pixel on
     screen, and the laminar half of the frame drowns in it. A Gaussian core
     is compactly supported instead: closed contours where the vortex is, and
     exactly nothing where it is not. */
  for (int i = 0; i < VORTEX_COUNT; i++) {
    float fi   = float(i);
    float life = fract(uShedPhase - fi / float(VORTEX_COUNT));
    float side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;

    vec2 c = uBall
           + f * (R * 1.1 + life * uWakeLength)
           + n * side * R * (0.8 + life * 2.2);

    /* Born hard at the shoulder of the ball, spread thin and spent by the time
       it leaves frame — otherwise vortices pop in and out at the wrap seam. */
    float env  = smoothstep(0.0, 0.07, life) * (1.0 - smoothstep(0.25, 1.0, life));
    float core = R * (0.34 + life * 1.15);
    vec2  rel  = p - c;

    psi += side * uGamma * env * exp(-dot(rel, rel) / (2.0 * core * core));
  }

  /* Turbulence, confined to the wake: a cone opening downstream of the ball,
     so the upstream half of the frame stays glassy and the contrast between
     the two halves is the whole composition. */
  float width = R * (1.0 + max(along, 0.0) * 1.4);
  float wake  = smoothstep(-0.2, 0.55, along)
              * exp(-(across * across) / (width * width));

  /* A trace of ambient roll everywhere, so the laminar half reads as calm
     rather than as mechanically dead. */
  psi += snoise(vec3(p * 0.8, uTime * 0.05)) * 0.014;

  /* Amplitudes are worth reading as multiples of one line spacing, which is
     1/uFreq — about 0.048. So the coarse term below displaces a line by not
     quite two of its neighbours at full strength. Anything near 0.2 and the
     contours cross each other so often the wake stops reading as flow and
     starts reading as interference. */
  vec2 drift = f * uFlowPhase;
  psi += snoise(vec3(p * 1.9 - drift * 0.9, uTime * 0.10)) * 0.130 * wake * uTurbulence;
  psi += snoise(vec3(p * 4.4 - drift * 1.4, uTime * 0.17)) * 0.050 * wake * uTurbulence;

  /* Order, and its loss. The intro runs this backwards: at reveal 0 the field
     is nothing but large-scale chaos and it settles into laminar flow as the
     counter fills. Scroll-out spends the same budget in the other direction. */
  float chaos = (1.0 - uReveal) + uDispersion * 1.2;
  if (chaos > 0.001) {
    psi += snoise(vec3(p * 1.05, uTime * 0.11 + 17.0)) * chaos * 0.55;
    psi += snoise(vec3(p * 2.60, uTime * 0.19 -  6.0)) * chaos * 0.20;
  }

  /* Ripples. A radially symmetric bump in psi is a closed loop in the
     contours, which is precisely a ring spreading across the surface. */
  for (int i = 0; i < PULSE_COUNT; i++) {
    vec4 pulse = uPulses[i];
    if (pulse.w <= 0.001) continue;
    float d    = length(p - pulse.xy);
    float ring = exp(-pow((d - pulse.z) * 4.5, 2.0));
    psi += ring * pulse.w;
  }

  return psi;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uAspect;

  float psi   = stream(p);
  float phase = psi * uFreq;

  /* Contour extraction. \`tri\` is a triangle wave peaking on every integer
     contour; the smoothstep width is the on-screen size of one phase unit, so
     lines hold the same visual weight however hard the field is being
     squeezed, and fade to tone rather than alias where it is squeezed past
     what the pixel grid can carry. */
  float w    = fwidth(phase);
  float tri  = abs(fract(phase) - 0.5) * 2.0;
  float aa   = clamp(w, 0.004, 0.5);
  float line = smoothstep(DUTY - aa, DUTY + aa, tri);

  /* Level of detail. Widening the smoothstep alone is not enough: once a line
     pair falls inside a pixel, \`tri\` is sampling a phase that has already
     wrapped, so the result is per-pixel hash rather than a soft edge — the
     lower right of the frame turns to static. Past that point the contours
     have to be given up on deliberately and replaced with the tone they
     average out to. */
  line = mix(line, 1.0 - DUTY, smoothstep(0.30, 0.85, w));

  float up = vUv.y;

  /* The sleeve's vertical logic: near-black at the base with hard lavender
     lines standing off it, dissolving upward into flat violet where the lines
     sink into the ground rather than sitting on it. */
  vec3  ground   = mix(uVoid, uDeep, smoothstep(0.55, 1.0, up));
  vec3  stroke   = mix(uLineLow, uLineHigh, smoothstep(0.15, 0.95, up));
  float contrast = mix(1.0, 0.30, smoothstep(0.62, 1.0, up));

  /* The accent streak: one streamline, painted. It rides the *stagnation*
     contour — psi = 0, the single line that runs dead into the sphere and
     splits around it — which is why it tapers to a point as it arrives and
     opens back up on the far side without any of that being drawn by hand. */
  float along = dot(p - uBall, uFlowDir);
  float halfW = 0.045 + 0.18 * smoothstep(0.0, 2.3, abs(along));
  float band  = 1.0 - smoothstep(halfW * 0.72, halfW, abs(psi));

  /* Scaled by the frame rather than fixed: on a portrait phone the flow only
     crosses about a third of the distance it does on a desktop, and a constant
     ramp there leaves the streak stuck on crimson with the orange and the acid
     end never arriving. */
  float g = smoothstep(-1.2 * uStreakSpan, 1.3 * uStreakSpan, along);
  vec3 accent = mix(uAccentA, uAccentB, smoothstep(0.00, 0.50, g));
  accent = mix(accent, uAccentC, smoothstep(0.45, 0.82, g));
  accent = mix(accent, uAccentD, smoothstep(0.84, 1.00, g));

  /* The streak lives in the *gaps*: the lavender lines keep running straight
     over the top of it, exactly as they do on the sleeve. */
  float streak = band * (1.0 - uDispersion * 0.7);
  ground = mix(ground, accent, streak);
  stroke = mix(stroke, mix(stroke, vec3(1.0), 0.4), streak * 0.7);

  vec3 col = mix(ground, stroke, line * contrast);

  /* The sphere. */
  float R  = uBallRadius * uBallScale;
  vec2  bq = p - uBall;
  float bd = length(bq) / max(R, 1e-4);

  /* The field pulls away into a dark moat. Without it the sphere reads as a
     sticker laid on the pattern rather than an object displacing it. */
  col *= mix(1.0, 0.16, smoothstep(1.24, 1.0, bd));

  float fw   = fwidth(bd);
  float mask = 1.0 - smoothstep(1.0 - fw * 1.5, 1.0 + fw * 1.5, bd);

  if (mask > 0.001) {
    vec2  sn  = bq / max(R, 1e-4);
    float z   = sqrt(max(1.0 - dot(sn, sn), 0.0));
    vec3  nrm = vec3(sn, z);

    vec3 key  = normalize(vec3(-0.46,  0.54, 0.70));
    vec3 fill = normalize(vec3( 0.64, -0.38, 0.52));
    vec3 hot  = normalize(vec3(-0.17,  0.31, 0.94));

    float d1   = max(dot(nrm, key), 0.0);
    float d2   = max(dot(nrm, fill), 0.0);
    float spec = pow(d1, 18.0);
    float pin  = pow(max(dot(nrm, hot), 0.0), 190.0);
    float fres = pow(1.0 - z, 3.0);

    vec3 ball = mix(vec3(0.012), vec3(0.34), pow(d1, 1.15));
    ball += vec3(0.19, 0.15, 0.26) * d2 * 0.55;  // cool bounce off the field
    ball += vec3(1.0) * spec * 0.34;
    ball += vec3(1.0) * pin * 0.9;
    ball  = mix(ball, uDeep * 1.8, fres * 0.55); // violet rim, from the ground

    // Grained on the same pass as the print, so it sits in the paper.
    ball += (hash21(gl_FragCoord.xy * 0.73) - 0.5) * 0.06;

    col = mix(col, ball, mask);
  }

  /* Print. Mostly static (paper tooth), a little animated (film). All animated
     reads as video noise; all static reads as a dirty screen. */
  float g1 = hash21(gl_FragCoord.xy);
  float g2 = hash21(gl_FragCoord.xy + fract(uTime) * 91.7);
  col += (mix(g1, g2, 0.5) - 0.5) * uGrain;

  vec2 v = p * vec2(0.58, 0.72);
  col *= clamp(1.0 - 0.34 * dot(v, v), 0.0, 1.0);

  gl_FragColor = vec4(max(col, 0.0), uOpacity);

  /* ShaderMaterial opts out of three's automatic output conversion, and
     THREE.Color has already taken our hex values into the linear working
     space — so without this every colour above renders visibly wrong. */
  #include <colorspace_fragment>
}
`;
