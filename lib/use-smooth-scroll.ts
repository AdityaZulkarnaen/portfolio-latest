"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap";

/**
 * The instance currently driving the page, or null when smooth scroll is off.
 *
 * A module singleton because exactly one component owns it — `site-smooth-
 * scroll.tsx`, mounted in the root layout — while several unrelated things
 * need to reach it: the scroll rail, and anything that moves the page
 * programmatically. Threading a ref through the tree would mean giving the
 * layout state it has no other use for.
 *
 * Anything that moves the page has to go through this. Writing `scrollTop`
 * directly leaves Lenis animating toward its own stale target and the page
 * fights the pointer.
 */
export function getLenis(): Lenis | null {
  return current;
}

let current: Lenis | null = null;

/**
 * Velocity listeners, kept in a module-level set rather than passed into the
 * owner hook.
 *
 * This is what lets the hero read scroll velocity while the layout owns the
 * instance. It cannot be done by reaching for `getLenis()` in an effect:
 * effects run children-first, so the hero's effect fires *before* the layout
 * component that creates Lenis has run its own, and would always find null.
 * Subscribing to a registry has no such ordering problem — a subscriber
 * registered before Lenis exists simply starts receiving values once it does.
 */
const velocityListeners = new Set<(velocity: number) => void>();

/**
 * Reports Lenis scroll velocity to `onVelocity` for as long as the component
 * is mounted. Safe to call from anywhere, in any order, whether or not smooth
 * scroll is currently enabled.
 */
export function useScrollVelocity(onVelocity: (velocity: number) => void) {
  // Latest-callback ref, written in an effect so nothing mutates during render.
  const callback = useRef(onVelocity);
  useEffect(() => {
    callback.current = onVelocity;
  }, [onVelocity]);

  useEffect(() => {
    const listener = (velocity: number) => callback.current(velocity);
    velocityListeners.add(listener);
    return () => {
      velocityListeners.delete(listener);
    };
  }, []);
}

/**
 * Creates and owns the single Lenis instance for the whole document.
 *
 * Call this exactly once, from the root layout. It runs Lenis off GSAP's
 * ticker — one clock for the page instead of two competing rAF loops — and
 * keeps ScrollTrigger in sync with it.
 *
 * R3F drives its own rAF for `useFrame`, which is fine: nothing here touches
 * React state, it only broadcasts velocity to the listeners above.
 */
export function useSmoothScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    current = lenis;

    const onScroll = () => {
      for (const listener of velocityListeners) listener(lenis.velocity);
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
      current = null;
    };
  }, [enabled]);
}
