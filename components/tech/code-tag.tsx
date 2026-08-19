"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildTagGeometries } from "./tag-geometry";
import type { TechMotion } from "./tech-motion";

const INK = "#f2f2f0";
const ACID = "#e1ff00";

/** Where each half sits when the tag is sealed shut. */
const OPEN_BASE_X = -0.5;
const CLOSE_BASE_X = 0.58;
/** Nudges the whole tag back to optical centre — `< />` is not symmetric. */
const LAYOUT_X = -0.16;
/** Extra separation the halves travel as the aperture opens. */
const SPLIT = 1.15;
/**
 * Held-shut depth, and the depth the halves finally reach. The camera sits at
 * z = 3.2, so PAST_Z is past the lens: the halves are near-clipped away rather
 * than faded out.
 */
const NEAR_Z = -1.6;
const PAST_Z = 4.9;

/** Reduced motion still gets a tag — just a held one, cracked slightly open. */
const STATIC_APERTURE = 0.12;

type CodeTagProps = {
  motionRef: RefObject<TechMotion>;
  reducedMotion: boolean;
};

/**
 * The `< />` that opens and closes the chapter.
 *
 * It lives in the same scene as the tunnel rather than as a DOM overlay, which
 * is the whole point: because the tunnel keeps `depthTest` on, logos genuinely
 * pass behind the tag's body and are occluded by it. That occlusion is what
 * makes the tag read as an aperture the viewer flies through, instead of two
 * pieces of type fading over a video.
 */
export default function CodeTag({ motionRef, reducedMotion }: CodeTagProps) {
  const rootRef = useRef<THREE.Group>(null);
  const openRef = useRef<THREE.Group>(null);
  const closeRef = useRef<THREE.Group>(null);

  const geometries = useMemo(() => buildTagGeometries(), []);

  const materials = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: INK,
      metalness: 0.35,
      roughness: 0.28,
    });
    // The closing chevron carries the brand accent. Emissive rather than a flat
    // colour so it still reads once the tag is edge-on to the key light.
    const accent = new THREE.MeshStandardMaterial({
      color: INK,
      metalness: 0.4,
      roughness: 0.22,
      emissive: new THREE.Color(ACID),
      emissiveIntensity: 0.55,
    });
    return { body, accent };
  }, []);

  useEffect(
    () => () => {
      geometries.open.dispose();
      geometries.slash.dispose();
      geometries.close.dispose();
      materials.body.dispose();
      materials.accent.dispose();
    },
    [geometries, materials],
  );

  useFrame((state, delta) => {
    const root = rootRef.current;
    const open = openRef.current;
    const close = closeRef.current;
    if (!root || !open || !close) return;

    const dt = Math.min(delta, 0.05);
    const a = reducedMotion ? STATIC_APERTURE : motionRef.current.aperture;

    // Ease in: the tag holds still for the first part of the beat, then
    // accelerates past the lens. A linear dolly reads as a lift, not a launch.
    const dolly = a * a;
    root.position.z = THREE.MathUtils.lerp(NEAR_Z, PAST_Z, dolly);
    root.scale.setScalar(THREE.MathUtils.lerp(0.95, 3.4, a));

    // The split happens inside the scaled group, so the separation compounds
    // with the dolly — the halves leave the frame rather than merely parting.
    open.position.x = OPEN_BASE_X - SPLIT * a;
    close.position.x = CLOSE_BASE_X + SPLIT * a;

    if (reducedMotion) {
      root.rotation.set(0, 0.32, 0);
      return;
    }

    const t = state.clock.elapsedTime;
    // The idle wobble is what proves the extrusion — the bevels catch and lose
    // the key light as it turns. It settles as the tag opens, so the sweep past
    // the camera stays square to the frame.
    const settle = 1 - a;
    const targetY = THREE.MathUtils.lerp(0.42, 0, a) + Math.sin(t * 0.6) * 0.2 * settle;
    const targetX = Math.sin(t * 0.45) * 0.09 * settle;

    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, targetY, 6, dt);
    root.rotation.x = THREE.MathUtils.damp(root.rotation.x, targetX, 6, dt);
  });

  return (
    <group ref={rootRef} position={[LAYOUT_X, 0, NEAR_Z]}>
      <group ref={openRef} position={[OPEN_BASE_X, 0, 0]}>
        <mesh geometry={geometries.open} material={materials.body} />
      </group>

      {/* `/` and `>` travel together — they are one half of the bracket. */}
      <group ref={closeRef} position={[CLOSE_BASE_X, 0, 0]}>
        <mesh
          geometry={geometries.slash}
          material={materials.body}
          position={[-0.28, 0, 0]}
        />
        <mesh
          geometry={geometries.close}
          material={materials.accent}
          position={[0.26, 0, 0]}
        />
      </group>
    </group>
  );
}
