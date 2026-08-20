"use client";

/* eslint-disable react-hooks/immutability --
 * Uniform values are GPU state, not React state: they are written every frame
 * from useFrame and never influence render output, so the rule's premise
 * ("mutation causes inconsistent behaviour on subsequent renders") does not
 * hold. In-place mutation is the documented R3F pattern, and routing a spring
 * integrator through React would re-render the tree sixty times a second.
 */

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { FieldQuality, HeroMotion } from "./hero-motion";
import { currentsVertexShader } from "./shaders/currents.vert";
import { currentsFragmentShader } from "./shaders/currents.frag";

/* The palette. Near-black ground so the field sits on the same void every other
   chapter does, deep violet overhead, lavender line. */
const VOID_COLOR = "#08080a";
const DEEP_COLOR = "#2c1155";
const LINE_LOW_COLOR = "#cba7f5";
const LINE_HIGH_COLOR = "#7d5cb8";

/* The streak, read along the flow. Crimson upstream, through magenta and
   orange, landing on the site's acid at the far end — the sleeve's own
   gradient already runs to yellow there, so the brand colour is a tenant
   rather than a graft. */
const ACCENT_A = "#e01b4c";
const ACCENT_B = "#ff2e88";
const ACCENT_C = "#ff7a18";
const ACCENT_D = "#e1ff00";

/** Base flow direction: down and to the right, at the sleeve's rake. */
const FLOW_ANGLE = -0.40;

/** Sphere radius, as a fraction of half the frame height. */
const BALL_RADIUS = 0.33;

/** Spring constants for the sphere. Underdamped on purpose — the overshoot is
 *  most of what makes it read as a heavy object in a fluid rather than a
 *  cursor with a delay. */
const SPRING_K = 46;
const SPRING_C = 9.5;

/** Ripple lifetime and how fast the ring travels, in field units per second. */
const PULSE_LIFE = 2.4;
const PULSE_SPEED = 1.5;
/* In stream-function units, where one line spacing is 1/uFreq — so this
   displaces the contours by roughly three of their neighbours at the crest. */
const PULSE_STRENGTH = 0.07;
const PULSE_SLOTS = 4;

type CurrentsUniforms = {
  uTime: { value: number };
  uAspect: { value: number };
  uFlowPhase: { value: number };
  uShedPhase: { value: number };
  uFlowDir: { value: THREE.Vector2 };
  uBall: { value: THREE.Vector2 };
  uBallVel: { value: THREE.Vector2 };
  uBallRadius: { value: number };
  uBallScale: { value: number };
  uFreq: { value: number };
  uGamma: { value: number };
  uWakeLength: { value: number };
  uStreakSpan: { value: number };
  uTurbulence: { value: number };
  uReveal: { value: number };
  uDispersion: { value: number };
  uOpacity: { value: number };
  uGrain: { value: number };
  uPulses: { value: THREE.Vector4[] };
  uVoid: { value: THREE.Color };
  uDeep: { value: THREE.Color };
  uLineLow: { value: THREE.Color };
  uLineHigh: { value: THREE.Color };
  uAccentA: { value: THREE.Color };
  uAccentB: { value: THREE.Color };
  uAccentC: { value: THREE.Color };
  uAccentD: { value: THREE.Color };
};

type Pulse = { x: number; y: number; age: number; alive: boolean };

type CurrentsFieldProps = {
  motionRef: RefObject<HeroMotion>;
  quality: FieldQuality;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  onReady?: () => void;
};

/** Where the sphere lives when nobody is touching it, in field units. */
function idleHome(aspect: number, t: number): [number, number] {
  return [
    aspect * (0.24 + Math.sin(t * 0.23) * 0.15),
    0.24 + Math.sin(t * 0.31 + 1.2) * 0.13,
  ];
}

export default function CurrentsField({
  motionRef,
  quality,
  pointerEnabled,
  reducedMotion,
  onReady,
}: CurrentsFieldProps) {
  const { size, viewport, invalidate } = useThree();
  const readyFired = useRef(false);

  /* Sphere state lives outside the uniforms because it is integrated, not
     sampled: position and velocity both carry over between frames. */
  const ball = useRef({ x: 0, y: 0.24, vx: 0, vy: 0 });
  const pulses = useRef<Pulse[]>(
    Array.from({ length: PULSE_SLOTS }, () => ({
      x: 0,
      y: 0,
      age: 0,
      alive: false,
    })),
  );
  const lastPulseSeq = useRef(0);
  const nextSlot = useRef(0);
  /* Damped copy of the raw 0/1 flag the DOM layer writes. Kept here rather
     than in the shared motion object so the DOM side stays a plain setter and
     only one loop ever integrates. */
  const grab = useRef(0);

  // Built imperatively rather than as <shaderMaterial uniforms={...} />: R3F
  // copies a `uniforms` prop onto the material, leaving the object we hold
  // orphaned, so every per-frame write would silently go nowhere. Constructing
  // the material ourselves guarantees `material.uniforms` IS this object.
  const material = useMemo(() => {
    const uniforms: CurrentsUniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uFlowPhase: { value: 0 },
      uShedPhase: { value: 0 },
      uFlowDir: {
        value: new THREE.Vector2(Math.cos(FLOW_ANGLE), Math.sin(FLOW_ANGLE)),
      },
      uBall: { value: new THREE.Vector2(0, 0.24) },
      uBallVel: { value: new THREE.Vector2(0, 0) },
      uBallRadius: { value: BALL_RADIUS },
      uBallScale: { value: 0 },
      uFreq: { value: quality.freq },
      uGamma: { value: 0.16 },
      uWakeLength: { value: 3.4 },
      uStreakSpan: { value: 2 },
      uTurbulence: { value: 1 },
      uReveal: { value: 0 },
      uDispersion: { value: 0 },
      uOpacity: { value: 1 },
      uGrain: { value: 0.075 },
      uPulses: {
        value: Array.from({ length: PULSE_SLOTS }, () => new THREE.Vector4()),
      },
      uVoid: { value: new THREE.Color(VOID_COLOR) },
      uDeep: { value: new THREE.Color(DEEP_COLOR) },
      uLineLow: { value: new THREE.Color(LINE_LOW_COLOR) },
      uLineHigh: { value: new THREE.Color(LINE_HIGH_COLOR) },
      uAccentA: { value: new THREE.Color(ACCENT_A) },
      uAccentB: { value: new THREE.Color(ACCENT_B) },
      uAccentC: { value: new THREE.Color(ACCENT_C) },
      uAccentD: { value: new THREE.Color(ACCENT_D) },
    };

    return new THREE.ShaderMaterial({
      vertexShader: currentsVertexShader,
      fragmentShader: currentsFragmentShader,
      // A `#define` rather than a uniform because GLSL loop bounds have to be
      // compile-time constants — which also means the vortex count can never
      // change without a recompile, hence `quality` being read once on mount.
      defines: { VORTEX_COUNT: quality.vortices },
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  }, [quality.vortices, quality.freq]);

  const uniforms = material.uniforms as CurrentsUniforms;

  // We own the material, so R3F will not dispose it for us.
  useEffect(() => () => material.dispose(), [material]);

  const aspect = size.width / Math.max(size.height, 1);

  useEffect(() => {
    uniforms.uAspect.value = aspect;
    // Narrow frames get a smaller sphere: the radius is measured against half
    // the height, and on a phone that is a much larger share of the width.
    uniforms.uBallRadius.value = aspect < 0.9 ? BALL_RADIUS * 0.82 : BALL_RADIUS;
    // The frame's half-extent projected onto the flow direction — how far the
    // fluid actually travels across this particular viewport.
    uniforms.uStreakSpan.value =
      aspect * Math.abs(Math.cos(FLOW_ANGLE)) + Math.abs(Math.sin(FLOW_ANGLE));
    invalidate();
  }, [aspect, uniforms, invalidate]);

  useFrame((_, delta) => {
    // Clamped: a backgrounded tab hands back one enormous delta, which would
    // fire the spring across the screen and shove the vortex street forward by
    // several seconds in a single frame.
    const dt = Math.min(delta, 0.05);
    const motion = motionRef.current;
    const b = ball.current;

    if (reducedMotion) {
      // One still frame, holding the composition the sleeve does: resolved
      // field, sphere parked off-centre, no clock running anywhere.
      uniforms.uReveal.value = 1;
      uniforms.uBallScale.value = 1;
      uniforms.uBall.value.set(aspect * 0.24, 0.24);
      uniforms.uBallVel.value.set(0, 0);
      uniforms.uOpacity.value = motion.opacity;
      if (!readyFired.current) {
        readyFired.current = true;
        onReady?.();
      }
      return;
    }

    uniforms.uTime.value += dt;
    uniforms.uReveal.value = motion.reveal;
    uniforms.uDispersion.value = motion.dispersion;
    uniforms.uOpacity.value = motion.opacity;

    // The sphere swells in behind the loader rather than being there from the
    // first frame, so the reveal has something to arrive at.
    uniforms.uBallScale.value = THREE.MathUtils.damp(
      uniforms.uBallScale.value,
      motion.reveal,
      4,
      dt,
    );

    // Lenis only reports velocity while the wheel is actually turning, so it
    // has to be decayed here — otherwise the flow would freeze at whatever
    // speed was last reported and stay there.
    motion.scrollVel *= Math.exp(-dt * 5);
    const scroll = THREE.MathUtils.clamp(motion.scrollVel / 40, -1, 1);

    // --- The sphere ---------------------------------------------------------
    const t = uniforms.uTime.value;
    const [homeX, homeY] = idleHome(aspect, t);

    // Blend rather than switch: the sphere hands itself back to its idle orbit
    // when the pointer leaves the page instead of snapping across to it.
    grab.current = THREE.MathUtils.damp(
      grab.current,
      pointerEnabled ? motion.pointerInside : 0,
      5,
      dt,
    );

    const targetX = THREE.MathUtils.lerp(
      homeX,
      motion.pointerX * aspect,
      grab.current,
    );
    const targetY = THREE.MathUtils.lerp(homeY, motion.pointerY, grab.current);

    const ax = (targetX - b.x) * SPRING_K - b.vx * SPRING_C;
    const ay = (targetY - b.y) * SPRING_K - b.vy * SPRING_C;
    b.vx += ax * dt;
    b.vy += ay * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    uniforms.uBall.value.set(b.x, b.y);

    // Clamped hard before it reaches the shader: the drag doublet is linear in
    // velocity, and an unclamped flick would swamp the stream function and
    // flatten the whole frame to one tone for a few frames.
    const speed = Math.hypot(b.vx, b.vy);
    const velScale = speed > 2 ? 2 / speed : 1;
    uniforms.uBallVel.value.set(
      THREE.MathUtils.damp(uniforms.uBallVel.value.x, b.vx * velScale, 14, dt),
      THREE.MathUtils.damp(uniforms.uBallVel.value.y, b.vy * velScale, 14, dt),
    );

    // --- Flow ---------------------------------------------------------------
    // Scrolling drives the fluid harder, and so does dragging the sphere: both
    // feed the same speed, so the wake tightens and sheds faster under either.
    const flowSpeed = 0.35 + Math.abs(scroll) * 1.4 + Math.min(speed, 2) * 0.25;
    uniforms.uFlowPhase.value += dt * flowSpeed;

    // Integrated, never `uTime * rate`: the rate changes constantly with the
    // sphere's speed, and multiplying would jump every vortex in the street
    // the moment it did.
    const shedRate = 0.24 + Math.min(speed, 2.5) * 0.16 + Math.abs(scroll) * 0.3;
    uniforms.uShedPhase.value += dt * shedRate;

    uniforms.uGamma.value = THREE.MathUtils.damp(
      uniforms.uGamma.value,
      0.15 + Math.min(speed, 2) * 0.07,
      5,
      dt,
    );
    uniforms.uTurbulence.value = THREE.MathUtils.damp(
      uniforms.uTurbulence.value,
      1 + Math.min(speed, 2) * 0.45 + Math.abs(scroll) * 0.6,
      5,
      dt,
    );

    // The whole field leans the way the sphere is being thrown. Small — a few
    // degrees — but it is what stops a fast drag looking like the ball is
    // sliding over the pattern instead of through it.
    const cross = Math.cos(FLOW_ANGLE) * b.vy - Math.sin(FLOW_ANGLE) * b.vx;
    const tilt = THREE.MathUtils.clamp(cross * 0.05, -0.16, 0.16);
    const dir = uniforms.uFlowDir.value;
    const angle = Math.atan2(dir.y, dir.x);
    const next = THREE.MathUtils.damp(angle, FLOW_ANGLE + tilt, 3, dt);
    dir.set(Math.cos(next), Math.sin(next));

    // --- Ripples ------------------------------------------------------------
    if (motion.pulseSeq !== lastPulseSeq.current) {
      lastPulseSeq.current = motion.pulseSeq;
      const slot = pulses.current[nextSlot.current];
      slot.x = motion.pulseX * aspect;
      slot.y = motion.pulseY;
      slot.age = 0;
      slot.alive = true;
      nextSlot.current = (nextSlot.current + 1) % PULSE_SLOTS;
    }

    for (let i = 0; i < PULSE_SLOTS; i++) {
      const pulse = pulses.current[i];
      const out = uniforms.uPulses.value[i];
      if (!pulse.alive) {
        out.set(0, 0, 0, 0);
        continue;
      }
      pulse.age += dt;
      if (pulse.age > PULSE_LIFE) {
        pulse.alive = false;
        out.set(0, 0, 0, 0);
        continue;
      }
      // Fades from both ends: in over the first beat so the ring does not
      // appear at full strength on top of the pointer, out over the rest.
      const life = pulse.age / PULSE_LIFE;
      const env = Math.sin(Math.min(life * 6, 1) * Math.PI * 0.5) * (1 - life) ** 1.6;
      out.set(pulse.x, pulse.y, pulse.age * PULSE_SPEED, env * PULSE_STRENGTH);
    }

    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  });

  return (
    <mesh material={material} scale={[viewport.width, viewport.height, 1]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
