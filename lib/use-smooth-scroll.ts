"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap";

/**
 * Runs Lenis off GSAP's ticker — one clock for the whole page instead of two
 * competing rAF loops — and keeps ScrollTrigger in sync with it.
 *
 * R3F drives its own rAF for `useFrame`, which is fine: nothing here touches
 * React state, it only reports scroll velocity through `onVelocity`.
 */
/**
 * The instance currently driving the page, or null when smooth scroll is off.
 *
 * A module singleton because the hook runs exactly once, deep inside the hero,
 * and the scroll rail lives in the root layout: threading a ref up through the
 * tree would mean giving the layout state it has no other use for. Anything
 * that moves the page programmatically has to go through this — writing
 * `scrollTop` directly leaves Lenis animating toward its own stale target and
 * the page fights the pointer.
 */
export function getLenis(): Lenis | null {
  return current;
}

let current: Lenis | null = null;

export function useSmoothScroll(
  enabled: boolean,
  onVelocity?: (velocity: number) => void,
) {
  // Latest-callback ref, written in an effect so nothing mutates during render.
  const velocityCallback = useRef(onVelocity);
  useEffect(() => {
    velocityCallback.current = onVelocity;
  }, [onVelocity]);

  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenisRef.current = lenis;
    current = lenis;

    const onScroll = () => {
      velocityCallback.current?.(lenis.velocity);
      ScrollTrigger.update();
    };
    lenis.on("scroll", onScroll);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
      current = null;
    };
  }, [enabled]);

  return lenisRef;
}
