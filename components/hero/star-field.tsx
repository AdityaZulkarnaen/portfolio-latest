"use client";

/* eslint-disable react-hooks/immutability --
 * Same rationale as particle-field.tsx: uniforms are GPU state written every
 * frame, never React render input.
 */

import { useEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/rng";
import type { HeroMotion } from "./hero-motion";
import { starsVertexShader } from "./shaders/stars.vert";
import { starsFragmentShader } from "./shaders/stars.frag";

const BASE_COLOR = "#cfd2c8";
const ACCENT_COLOR = "#e1ff00";
const ACCENT_RATIO = 0.06;

/** Peak parallax shift, as a fraction of viewport width. */
const PARALLAX_AMOUNT = 0.05;

type StarUniforms = {
  uTime: { value: number };
  uExtent: { value: THREE.Vector2 };
  uParallax: { value: THREE.Vector2 };
  uCamZ: { value: number };
  uScrollVel: { value: number };
  uDispersion: { value: number };
  uSize: { value: number };
  uPixelRatio: { value: number };
  uOpacity: { value: number };
  uMotion: { value: number };
  uColorBase: { value: THREE.Color };
  uColorAccent: { value: THREE.Color };
};

type StarFieldProps = {
  motionRef: RefObject<HeroMotion>;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  count?: number;
  /** Roughly the on-screen diameter of the nearest stars, in CSS pixels. */
  starSize?: number;
};

export default function StarField({
  motionRef,
  pointerEnabled,
  reducedMotion,
  count = 7000,
  starSize = 2.2,
}: StarFieldProps) {
  const { viewport, camera, invalidate } = useThree();

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const rand = mulberry32(0x57a45);

    // Normalised [-1, 1] box; the shader maps it to world space per depth
    // plane, so a resize is a uniform change rather than a rebuild.
    const position = new Float32Array(count * 3);
    const depth = new Float32Array(count);
    const seed = new Float32Array(count);
    const accent = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      position[i * 3] = rand() * 2 - 1;
      position[i * 3 + 1] = rand() * 2 - 1;
      position[i * 3 + 2] = 0;
      // Bias toward the far planes so the field reads as deep sky, not confetti.
      depth[i] = Math.pow(rand(), 1.6);
      seed[i] = rand();
      accent[i] = rand() < ACCENT_RATIO ? 1 : 0;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geo.setAttribute("aDepth", new THREE.BufferAttribute(depth, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aAccent", new THREE.BufferAttribute(accent, 1));

    const uniforms: StarUniforms = {
      uTime: { value: 0 },
      uExtent: { value: new THREE.Vector2(1, 1) },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uCamZ: { value: 3.2 },
      uScrollVel: { value: 0 },
      uDispersion: { value: 0 },
      uSize: { value: 7 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 1 },
      uMotion: { value: reducedMotion ? 0 : 1 },
      uColorBase: { value: new THREE.Color(BASE_COLOR) },
      uColorAccent: { value: new THREE.Color(ACCENT_COLOR) },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });

    return { geometry: geo, material: mat };
    // reducedMotion only seeds the initial value; useFrame keeps it in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const uniforms = material.uniforms as StarUniforms;

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // Resize is a two-float update — no reallocation, no re-seeding.
  useEffect(() => {
    const camZ = Math.abs(camera.position.z);
    // 1.15 gives the parallax somewhere to travel without exposing an edge.
    uniforms.uExtent.value.set(
      (viewport.width / 2) * 1.15,
      (viewport.height / 2) * 1.15,
    );
    uniforms.uCamZ.value = camZ;
    uniforms.uSize.value = starSize * camZ;
    invalidate();
  }, [viewport.width, viewport.height, camera, starSize, uniforms, invalidate]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const motion = motionRef.current;

    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uMotion.value = reducedMotion ? 0 : 1;

    if (reducedMotion) return;

    uniforms.uTime.value += dt;
    uniforms.uDispersion.value = motion.dispersion;
    uniforms.uScrollVel.value = THREE.MathUtils.clamp(motion.scrollVel / 40, -1, 1);

    // Parallax follows the pointer in the same direction it moves, eased so it
    // glides rather than snapping. pointerInside returns it to centre on leave.
    const reach = viewport.width * PARALLAX_AMOUNT;
    const active = pointerEnabled ? motion.pointerInside : 0;
    const parallax = uniforms.uParallax.value;
    parallax.x = THREE.MathUtils.damp(parallax.x, motion.pointerX * reach * active, 3, dt);
    parallax.y = THREE.MathUtils.damp(parallax.y, motion.pointerY * reach * active, 3, dt);
  });

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-1}
    />
  );
}
