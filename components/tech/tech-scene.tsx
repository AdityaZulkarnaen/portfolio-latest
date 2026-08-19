"use client";

import { useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import type { LogoAtlas } from "@/lib/build-logo-atlas";
import CodeTag from "./code-tag";
import LogoTunnel from "./logo-tunnel";
import type { TechMotion } from "./tech-motion";

export type TechSceneProps = {
  atlas: LogoAtlas;
  motionRef: RefObject<TechMotion>;
  count: number;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  /** false once the section leaves the viewport — stops the render loop. */
  active: boolean;
  onReady?: () => void;
};

export default function TechScene({
  atlas,
  motionRef,
  count,
  pointerEnabled,
  reducedMotion,
  active,
  onReady,
}: TechSceneProps) {
  const [maxDpr, setMaxDpr] = useState(1.75);

  return (
    <Canvas
      aria-hidden
      dpr={[1, maxDpr]}
      // `flat` = NoToneMapping, for the same reason as the hero: R3F defaults
      // to ACESFilmic, which desaturates #E1FF00 into olive.
      flat
      gl={{
        antialias: true,
        alpha: true,
        // Unlike the hero, this scene needs a real depth buffer — the tag has
        // to occlude the logos travelling behind it.
        depth: true,
        stencil: false,
        powerPreference: "high-performance",
      }}
      camera={{ fov: 45, position: [0, 0, 3.2], near: 0.1, far: 60 }}
      frameloop={reducedMotion ? "demand" : active ? "always" : "never"}
    >
      <PerformanceMonitor onDecline={() => setMaxDpr(1)} />

      {/* Lit rather than flat-shaded: the bevels on the tag are the only thing
          that proves it is extruded, and they need a key light to catch. */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 5]} intensity={2.4} />
      <directionalLight position={[-4, -2, 3]} intensity={1.1} color="#e1ff00" />

      <LogoTunnel
        atlas={atlas}
        motionRef={motionRef}
        count={count}
        pointerEnabled={pointerEnabled}
        reducedMotion={reducedMotion}
        onReady={onReady}
      />
      <CodeTag motionRef={motionRef} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
