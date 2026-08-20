"use client";

import { useSyncExternalStore } from "react";

/**
 * The single mutable object shared between the DOM layer (GSAP, pointer events)
 * and the WebGL layer (`useFrame`).
 *
 * Nothing here ever goes through React state — GSAP writes, `useFrame` reads,
 * and React only ever handles mount/unmount. That is what keeps the hero at
 * 60fps while a 2.6s timeline, a scroll scrub and a pointer spring are all
 * running at once.
 */
export type HeroMotion = {
  /** 0 = the field is pure chaos, 1 = it has resolved into laminar flow. */
  reveal: number;
  /** 0 = held, 1 = torn apart again as the chapter scrolls away. */
  dispersion: number;
  /** Raw Lenis scroll velocity; decayed toward 0 every frame. */
  scrollVel: number;
  /** Master fade for the whole field. */
  opacity: number;
  /** Pointer in normalised device coords (-1..1), fed from the DOM layer. */
  pointerX: number;
  pointerY: number;
  /** 1 while the pointer is over the page, 0 otherwise — blends back to idle drift. */
  pointerInside: number;

  /**
   * Ripples are handed over as a counter rather than a queue.
   *
   * The DOM layer bumps `pulseSeq` and writes where it happened; the render
   * loop notices the number changed and spawns a ring. A plain integer is all
   * the synchronisation two loops on different clocks need — no array to
   * allocate, drain or lock, and a press that lands between two frames is
   * still picked up on the next one.
   */
  pulseSeq: number;
  pulseX: number;
  pulseY: number;
};

export function createHeroMotion(): HeroMotion {
  return {
    reveal: 0,
    dispersion: 0,
    scrollVel: 0,
    opacity: 1,
    pointerX: 0,
    pointerY: 0,
    pointerInside: 0,
    pulseSeq: 0,
    pulseX: 0,
    pulseY: 0,
  };
}

/**
 * How much field to draw. Every one of these lands in the fragment shader's
 * inner loops, so this is the whole performance budget in one place.
 *
 * Read once on mount: `vortices` becomes a `#define`, which means changing it
 * would mean recompiling the program, and none of the rest is worth a resize
 * listener.
 */
export type FieldQuality = {
  /** Vortices in the shed street. Each one costs a `log` per pixel. */
  vortices: number;
  /** Contours per unit of stream function — how dense the line field is. */
  freq: number;
  /** Upper bound on device pixel ratio. The lines are the detail, so this is
   *  the last thing to give up, but it is also the biggest single lever. */
  maxDpr: number;
};

/** What the server renders against. Never reaches a GPU — the canvas is
 *  client-only — but `useSyncExternalStore` needs a stable value for the pass. */
const SERVER_QUALITY: FieldQuality = { vortices: 9, freq: 52, maxDpr: 1.5 };

let cached: FieldQuality | undefined;

function resolveFieldQuality(): FieldQuality {
  // Memoised, and not only to save the measurement: this is a store snapshot,
  // and a fresh object every call is a re-render every commit, forever.
  if (cached) return cached;

  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency ?? 4;

  // Below `sm` the frame is narrow enough that a desktop line count reads as
  // moire rather than as stripes, so the cut in density is a visual decision
  // as much as a performance one.
  /* `freq` is solved for a constant on-screen line spacing of ~10px, not
     picked by eye. Contours across the frame are (psi range) * freq, and the
     psi range is 2 * (aspect * 0.389 + 0.921) — the frame measured along the
     flow normal — so a portrait phone needs a much lower number than a
     landscape desktop to draw lines the same distance apart.

     `vortices` and `maxDpr` are the performance levers and move separately:
     density is a compositional decision, and giving it up would not look
     like a lower-quality version of the same image. */
  cached =
    width < 640
      ? { vortices: 6, freq: 38, maxDpr: 1.5 }
      : width < 1024
        ? { vortices: 8, freq: 42, maxDpr: 1.5 }
        : cores <= 4
          ? { vortices: 8, freq: 52, maxDpr: 1.25 }
          : { vortices: 10, freq: 52, maxDpr: 1.75 };

  return cached;
}

// Nothing to subscribe to: the budget is fixed for the session. `vortices` is
// a `#define` and recompiling the program on every resize would cost more than
// any resolution it could win back, and the rest is not worth a listener either.
const subscribe = () => () => {};

/**
 * Same shape as `useWebGLSupport`: a defined server snapshot and a real one on
 * the client, resolved without a cascading render after mount.
 */
export function useFieldQuality(): FieldQuality {
  return useSyncExternalStore(
    subscribe,
    resolveFieldQuality,
    () => SERVER_QUALITY,
  );
}
