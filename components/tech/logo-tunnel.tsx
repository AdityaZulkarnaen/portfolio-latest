"use client";

/* eslint-disable react-hooks/immutability --
 * Same rationale as the hero's particle-field: uniforms are GPU state written
 * every frame, never React render input.
 */

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { LogoAtlas } from "./atlas-texture";
import { mulberry32 } from "@/lib/rng";
import { tunnelFragmentShader } from "./shaders/tunnel.frag";
import { tunnelVertexShader } from "./shaders/tunnel.vert";
import { TRAVEL_LOOPS, type TechMotion } from "./tech-motion";

/** Tunnel radius as a multiple of the frame half-size at z = 0. */
const SPREAD = 5.6;
/** Drift while the scroll is completely still. */
const IDLE_SPEED = 0.012;
/** Peak parallax shift, as a fraction of viewport width. */
const PARALLAX_AMOUNT = 0.04;
/**
 * Inner radius of the annulus, as a fraction of the outer. The hole is what
 * gives the field a vanishing point instead of a flat wall of sprites. Kept
 * small: the heading is a solid DOM layer in front, so tiles running near the
 * axis are occluded by the type and burst out from behind it, which is most of
 * what sells the tunnel.
 */
const INNER_RADIUS = 0.14;

type TunnelUniforms = {
  uTime: { value: number };
  uExtent: { value: THREE.Vector2 };
  uParallax: { value: THREE.Vector2 };
  uCamZ: { value: number };
  uTravel: { value: number };
  uIdle: { value: number };
  uSpread: { value: number };
  uLogoScale: { value: number };
  uScrollVel: { value: number };
  uReveal: { value: number };
  uMotion: { value: number };
  uAtlasGrid: { value: THREE.Vector2 };
  uAtlas: { value: THREE.Texture };
};

type LogoTunnelProps = {
  atlas: LogoAtlas;
  motionRef: RefObject<TechMotion>;
  count: number;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  onReady?: () => void;
};

/**
 * The tunnel.
 *
 * Instanced quads rather than `gl.POINTS`, which is what the hero starfield
 * uses. Three reasons the point path does not survive here: `gl_PointSize` is
 * capped by the driver (as low as 63 on some mobile GPUs) and the nearest logos
 * are meant to fill the frame; points are always axis-aligned squares, so they
 * cannot carry the slight rotation that sells depth; and `gl_PointCoord` makes
 * clean sub-UV atlas addressing awkward. A few hundred instances is still one
 * draw call.
 */
export default function LogoTunnel({
  atlas,
  motionRef,
  count,
  pointerEnabled,
  reducedMotion,
  onReady,
}: LogoTunnelProps) {
  const { viewport, camera, gl, invalidate } = useThree();
  const readyFired = useRef(false);

  const { geometry, material } = useMemo(() => {
    // One unit quad, reused by every instance. Its vertices are added in view
    // space by the shader, so it never needs to be transformed on the CPU.
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    geo.instanceCount = count;

    const rand = mulberry32(0x7ec45);

    const offset = new Float32Array(count * 2);
    const depth = new Float32Array(count);
    const seed = new Float32Array(count);
    const tile = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Annulus, not a box: sqrt() on the radius keeps the area density even,
      // so the field does not bunch up against the inner edge.
      const angle = rand() * Math.PI * 2;
      const radius = INNER_RADIUS + (1 - INNER_RADIUS) * Math.sqrt(rand());
      offset[i * 2] = Math.cos(angle) * radius;
      offset[i * 2 + 1] = Math.sin(angle) * radius;

      depth[i] = rand();
      seed[i] = rand();
      tile[i] = Math.floor(rand() * atlas.count);
    }

    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 2));
    geo.setAttribute("aDepth", new THREE.InstancedBufferAttribute(depth, 1));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    geo.setAttribute("aTile", new THREE.InstancedBufferAttribute(tile, 1));

    const uniforms: TunnelUniforms = {
      uTime: { value: 0 },
      uExtent: { value: new THREE.Vector2(1, 1) },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uCamZ: { value: 3.2 },
      uTravel: { value: 0 },
      uIdle: { value: IDLE_SPEED },
      uSpread: { value: SPREAD },
      uLogoScale: { value: 1 },
      uScrollVel: { value: 0 },
      uReveal: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : 1 },
      uAtlasGrid: { value: new THREE.Vector2(atlas.grid[0], atlas.grid[1]) },
      uAtlas: { value: atlas.texture },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: tunnelVertexShader,
      fragmentShader: tunnelFragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      // Unlike the starfield, depth testing stays on: the tag is a solid mesh
      // in the same space and has to genuinely occlude the logos behind it.
      // That occlusion is what makes the aperture read as physical rather than
      // as a crossfade.
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    return { geometry: geo, material: mat };
    // reducedMotion only seeds the initial value; useFrame keeps it in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, atlas]);

  const uniforms = material.uniforms as TunnelUniforms;

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useEffect(() => {
    uniforms.uAtlas.value.anisotropy = gl.capabilities.getMaxAnisotropy();
    uniforms.uAtlas.value.needsUpdate = true;
  }, [gl, uniforms]);

  // Resize is a handful of scalars — no reallocation, no re-seeding.
  useEffect(() => {
    uniforms.uExtent.value.set(viewport.width / 2, viewport.height / 2);
    uniforms.uCamZ.value = Math.abs(camera.position.z);
    // Tiles are sized in world units, so on a narrow frame they would eat the
    // whole screen. Track the short edge instead of a fixed scalar.
    uniforms.uLogoScale.value = Math.min(1.35, 0.42 + viewport.width * 0.13);
    invalidate();
  }, [viewport.width, viewport.height, camera, uniforms, invalidate]);

  // The scene is only revealed once a frame has actually been drawn, so the
  // section never swaps from fallback to a blank canvas.
  const fireReady = () => {
    if (readyFired.current) return;
    readyFired.current = true;
    onReady?.();
  };

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);
    const motion = motionRef.current;

    uniforms.uMotion.value = reducedMotion ? 0 : 1;

    if (reducedMotion) {
      // A single frozen slice of the tunnel: still a composition, just not a
      // moving one.
      uniforms.uTravel.value = 0.35;
      uniforms.uReveal.value = 1;
      fireReady();
      return;
    }

    uniforms.uTime.value += dt;
    uniforms.uTravel.value = motion.travel * TRAVEL_LOOPS;
    uniforms.uReveal.value = motion.reveal;

    // The scrub only reports velocity while the scroll is actually moving, so
    // it is decayed here. This is why a fling relaxes back to rest instead of
    // leaving the radial stretch stuck on.
    motion.scrollVel *= Math.exp(-dt * 5);
    const target = THREE.MathUtils.clamp(motion.scrollVel / 45, -1, 1);
    uniforms.uScrollVel.value = THREE.MathUtils.damp(
      uniforms.uScrollVel.value,
      target,
      6,
      dt,
    );

    if (pointerEnabled) {
      const reach = viewport.width * PARALLAX_AMOUNT;
      const parallax = uniforms.uParallax.value;
      parallax.x = THREE.MathUtils.damp(
        parallax.x,
        motion.pointerX * reach * motion.pointerInside,
        3,
        dt,
      );
      parallax.y = THREE.MathUtils.damp(
        parallax.y,
        motion.pointerY * reach * motion.pointerInside,
        3,
        dt,
      );
    }

    fireReady();
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
