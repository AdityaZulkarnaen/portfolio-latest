import { noiseChunk } from "./noise";

/**
 * Every particle position is a pure function of
 * (startPos, targetPos, seed, time, progress) — nothing carries over between
 * frames — so the whole morph fits in the vertex shader. No GPGPU ping-pong,
 * no render targets, no sync.
 */
export const particlesVertexShader = /* glsl */ `
uniform float uTime;
uniform float uProgress;      // 0 = noise cloud, 1 = assembled wordmark
uniform float uDispersion;    // 0 = held, 1 = dissolved back to dust
uniform float uScrollVel;     // normalised, damped scroll speed
uniform float uSize;
uniform float uPixelRatio;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uPointerActive;
uniform vec3  uPointer;       // in this object's model space

attribute vec3  aTarget;
attribute vec3  aRandom;
attribute float aDelay;

varying float vAccent;
varying float vAlpha;

${noiseChunk}

float easeOutCubic(float x) {
  return 1.0 - pow(1.0 - x, 3.0);
}

void main() {
  // Per-particle stagger: each one starts resolving at its own moment.
  float p = easeOutCubic(clamp((uProgress - aDelay * 0.35) / 0.65, 0.0, 1.0));

  vec3 chaos = position + noiseVec(position * 0.35 + uTime * 0.06) * 1.2;
  vec3 pos = mix(chaos, aTarget, p);

  // Low-frequency field: the idle "breathing" of assembled glyphs plus the
  // scroll-velocity turbulence.
  vec3 field = noiseVec(aTarget * 0.75 + uTime * 0.14);
  float residual = mix(1.0, 0.055, p);
  pos += field * (residual * 0.3 + abs(uScrollVel) * 0.45);

  // Repulsion fades out as the word dissolves — otherwise the cursor punches a
  // hard circular hole straight through the drifting dust.
  vec2 toPointer = pos.xy - uPointer.xy;
  float dist = length(toPointer);
  float influence = (1.0 - smoothstep(0.0, uPointerRadius, dist))
                  * uPointerActive * (1.0 - uDispersion);
  pos.xy += (dist > 0.0001 ? toPointer / dist : vec2(0.0)) * influence * uPointerStrength;

  // Dispersion gets its own, higher-frequency field. Reusing the low-frequency
  // one made the break-up read as broad vertical bands instead of grain.
  if (uDispersion > 0.001) {
    vec3 burst = noiseVec(aTarget * 2.6 - uTime * 0.22);
    pos += burst * uDispersion * 1.9;
    // Radial push so it reads as a break-up, not a smear.
    pos += normalize(pos + vec3(0.0001)) * uDispersion * 1.1 * (0.3 + aRandom.x);
    pos.y += uDispersion * (0.4 + aRandom.y * 2.4);
    pos.z -= uDispersion * (0.4 + aRandom.z * 2.0);
  }

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  gl_PointSize = clamp(
    uSize * uPixelRatio * (0.6 + aRandom.x * 0.9) * (1.0 - uDispersion * 0.45)
      / max(-mvPosition.z, 0.001),
    1.0,
    12.0 * uPixelRatio
  );

  // A brief flash as each particle snaps into the glyph, then it cools to base.
  float lockIn = smoothstep(0.55, 0.95, p) * (1.0 - smoothstep(0.95, 1.0, p));
  // ~3% stay accent permanently so the palette reads even with the cursor idle.
  float alwaysAccent = step(0.972, aRandom.z);

  vAccent = clamp(max(max(influence, lockIn * 0.9), alwaysAccent), 0.0, 1.0);
  vAlpha = mix(0.18, 1.0, p) * (1.0 - smoothstep(0.3, 1.0, uDispersion));
}
`;
