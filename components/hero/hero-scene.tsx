"use client";

import { useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import type { TextSample } from "@/lib/sample-text-to-points";
import type { HeroMotion } from "./hero-motion";
import ParticleField from "./particle-field";
import StarField from "./star-field";

export type HeroSceneProps = {
  sample: TextSample;
  motionRef: RefObject<HeroMotion>;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  /** false once the hero leaves the viewport — stops the render loop entirely. */
  active: boolean;
  onReady?: () => void;
};

export default function HeroScene({
  sample,
  motionRef,
  pointerEnabled,
  reducedMotion,
  active,
  onReady,
}: HeroSceneProps) {
  const [maxDpr, setMaxDpr] = useState(1.75);

  return (
    <Canvas
      aria-hidden
      dpr={[1, maxDpr]}
      // `flat` = NoToneMapping. Load-bearing: R3F defaults to ACESFilmic, which
      // desaturates #E1FF00 into olive. MSAA does nothing for alpha-edged
      // gl.POINTS, and depth/stencil are unused since depthTest is off.
      flat
      gl={{
        antialias: false,
        alpha: true,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      }}
      camera={{ fov: 45, position: [0, 0, 3.2], near: 0.1, far: 50 }}
      frameloop={reducedMotion ? "demand" : active ? "always" : "never"}
    >
      <PerformanceMonitor onDecline={() => setMaxDpr(1)} />
      {/* Drawn first (renderOrder -1) so it sits behind the wordmark. */}
      <StarField
        motionRef={motionRef}
        pointerEnabled={pointerEnabled}
        reducedMotion={reducedMotion}
      />
      <ParticleField
        sample={sample}
        motionRef={motionRef}
        pointerEnabled={pointerEnabled}
        reducedMotion={reducedMotion}
        onReady={onReady}
      />
    </Canvas>
  );
}
