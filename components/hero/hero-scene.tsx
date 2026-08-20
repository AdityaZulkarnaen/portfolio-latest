"use client";

import { useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import CurrentsField from "./currents-field";
import type { FieldQuality, HeroMotion } from "./hero-motion";

export type HeroSceneProps = {
  motionRef: RefObject<HeroMotion>;
  quality: FieldQuality;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  /** false once the hero leaves the viewport — stops the render loop entirely. */
  active: boolean;
  onReady?: () => void;
};

export default function HeroScene({
  motionRef,
  quality,
  pointerEnabled,
  reducedMotion,
  active,
  onReady,
}: HeroSceneProps) {
  const [maxDpr, setMaxDpr] = useState(quality.maxDpr);

  return (
    <Canvas
      aria-hidden
      dpr={[1, maxDpr]}
      // `flat` = NoToneMapping. Load-bearing: R3F defaults to ACESFilmic, which
      // washes the lavender out to grey and takes the acid end of the streak
      // with it. MSAA buys nothing — the contours are antialiased analytically
      // in the shader — and depth/stencil are unused for a single quad.
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
      {/* The field is one heavy fragment program over every pixel on screen, so
          resolution is the only lever that matters when a machine cannot keep
          up. Dropping it costs line crispness and nothing else. */}
      <PerformanceMonitor onDecline={() => setMaxDpr(1)} />
      <CurrentsField
        motionRef={motionRef}
        quality={quality}
        pointerEnabled={pointerEnabled}
        reducedMotion={reducedMotion}
        onReady={onReady}
      />
    </Canvas>
  );
}
