"use client";

/* eslint-disable react-hooks/immutability --
 * Uniform values are GPU state, not React state: they are written every frame
 * from useFrame and never influence render output, so the rule's premise
 * ("mutation causes inconsistent behaviour on subsequent renders") does not
 * hold. In-place mutation is the documented R3F pattern and is precisely what
 * keeps this hero at 60fps — routing 80k particles' worth of uniforms through
 * React would re-render the tree every frame.
 */

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/rng";
import type { TextSample } from "@/lib/sample-text-to-points";
import type { HeroMotion } from "./hero-motion";
import { particlesVertexShader } from "./shaders/particles.vert";
import { particlesFragmentShader } from "./shaders/particles.frag";

const BASE_COLOR = "#f2f2f0";
const ACCENT_COLOR = "#e1ff00";

type ParticleUniforms = {
  uTime: { value: number };
  uProgress: { value: number };
  uDispersion: { value: number };
  uScrollVel: { value: number };
  uSize: { value: number };
  uPixelRatio: { value: number };
  uPointer: { value: THREE.Vector3 };
  uPointerRadius: { value: number };
  uPointerStrength: { value: number };
  uPointerActive: { value: number };
  uColorBase: { value: THREE.Color };
  uColorAccent: { value: THREE.Color };
  uOpacity: { value: number };
};

type ParticleFieldProps = {
  sample: TextSample;
  motionRef: RefObject<HeroMotion>;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  onReady?: () => void;
  /** Roughly the on-screen diameter of a particle, in CSS pixels. Tuning knob. */
  pointSize?: number;
};

export default function ParticleField({
  sample,
  motionRef,
  pointerEnabled,
  reducedMotion,
  onReady,
  pointSize = 1.5,
}: ParticleFieldProps) {
  const { viewport, invalidate, camera } = useThree();
  const readyFired = useRef(false);
  const count = sample.positions.length / 3;

  // Built imperatively rather than as <shaderMaterial uniforms={...} />, because
  // R3F copies a `uniforms` prop onto the material — leaving the object we hold
  // orphaned, so every per-frame write would silently go nowhere. Constructing
  // the material ourselves guarantees `material.uniforms` IS this object.
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const rand = mulberry32(0xa11ce);

    const start = new Float32Array(count * 3);
    const random = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    const halfWidth = sample.aspect * 0.95;

    for (let i = 0; i < count; i++) {
      start[i * 3] = (rand() * 2 - 1) * halfWidth;
      start[i * 3 + 1] = (rand() * 2 - 1) * 1.25;
      start[i * 3 + 2] = (rand() * 2 - 1) * 0.9;
      random[i * 3] = rand();
      random[i * 3 + 1] = rand() * 2 - 1;
      random[i * 3 + 2] = rand();
      delay[i] = rand();
    }

    geo.setAttribute("position", new THREE.BufferAttribute(start, 3));
    geo.setAttribute("aTarget", new THREE.BufferAttribute(sample.positions, 3));
    geo.setAttribute("aRandom", new THREE.BufferAttribute(random, 3));
    geo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));

    const uniforms: ParticleUniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uDispersion: { value: 0 },
      uScrollVel: { value: 0 },
      uSize: { value: 14 },
      uPixelRatio: { value: 1 },
      uPointer: { value: new THREE.Vector3(99, 99, 0) },
      uPointerRadius: { value: 0.4 },
      uPointerStrength: { value: 0.16 },
      uPointerActive: { value: 0 },
      uColorBase: { value: new THREE.Color(BASE_COLOR) },
      uColorAccent: { value: new THREE.Color(ACCENT_COLOR) },
      uOpacity: { value: 1 },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: particlesVertexShader,
      fragmentShader: particlesFragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Normal, not additive: the glyph bodies are dense, and additive would
      // stack to white exactly there — killing the acid accent where it shows.
      blending: THREE.NormalBlending,
    });

    return { geometry: geo, material: mat };
  }, [count, sample]);

  const uniforms = material.uniforms as ParticleUniforms;

  // We own these objects, so R3F will not dispose them for us.
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // The sample is normalised (height = 1 unit), so a resize only changes this
  // scale — the expensive pixel sampling never has to run again.
  const scale = useMemo(() => {
    const fill = viewport.width < 3 ? 0.92 : 0.82;
    return (viewport.width * fill) / sample.aspect;
  }, [viewport.width, sample.aspect]);

  // gl_PointSize divides by view-space depth, so cancelling the camera distance
  // here makes `pointSize` land as an actual on-screen pixel diameter.
  useEffect(() => {
    uniforms.uSize.value = pointSize * Math.abs(camera.position.z);
    invalidate();
  }, [pointSize, camera, uniforms, invalidate]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);

    uniforms.uPixelRatio.value = state.gl.getPixelRatio();

    if (reducedMotion) {
      uniforms.uProgress.value = 1;
    } else {
      const motion = motionRef.current;
      uniforms.uTime.value += dt;
      uniforms.uProgress.value = motion.progress;
      uniforms.uDispersion.value = motion.dispersion;
      uniforms.uOpacity.value = motion.opacity;

      // Lenis only reports velocity while scrolling, so decay it here —
      // otherwise the turbulence would freeze at the last reported speed.
      motion.scrollVel *= Math.exp(-dt * 5);
      const target = THREE.MathUtils.clamp(motion.scrollVel / 40, -1, 1);
      uniforms.uScrollVel.value = THREE.MathUtils.damp(
        uniforms.uScrollVel.value,
        target,
        6,
        dt,
      );

      if (pointerEnabled) {
        const pointer = uniforms.uPointer.value;
        pointer.x = THREE.MathUtils.damp(
          pointer.x,
          (motion.pointerX * viewport.width) / 2 / scale,
          12,
          dt,
        );
        pointer.y = THREE.MathUtils.damp(
          pointer.y,
          (motion.pointerY * viewport.height) / 2 / scale,
          12,
          dt,
        );
        uniforms.uPointerActive.value = THREE.MathUtils.damp(
          uniforms.uPointerActive.value,
          motion.pointerInside,
          8,
          dt,
        );
      }
    }

    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  });

  return (
    <points
      geometry={geometry}
      material={material}
      scale={scale}
      frustumCulled={false}
    />
  );
}
