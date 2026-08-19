"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { useGSAP } from "@gsap/react";

// Registering once at module scope keeps plugin availability independent of the
// order in which component effects happen to run. The imports are all
// SSR-safe; the guard just avoids touching the DOM during the server pass.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, useGSAP);
}

/**
 * Kills every ScrollTrigger whose trigger element lives inside `root`.
 *
 * Call this at the top of a reduced-motion branch, before pinning the end
 * state. `useReducedMotion` reports `false` during hydration on purpose — the
 * motion build is the SSR-safe default — so by the time the real preference
 * arrives the full timeline has already been created. `useGSAP` reverts the
 * tweens when the dependency flips, but the ScrollTriggers they spawned outlive
 * that revert and carry on writing to the DOM on every scroll: the end state
 * gets set correctly, then quietly scrubbed away the moment the visitor moves.
 */
export function killScrollTriggersIn(root: Element | null | undefined) {
  if (!root) return;
  for (const trigger of ScrollTrigger.getAll()) {
    const el = trigger.trigger;
    if (el instanceof Element && root.contains(el)) trigger.kill();
  }
}

export { gsap, ScrambleTextPlugin, ScrollTrigger, useGSAP };
