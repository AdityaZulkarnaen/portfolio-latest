/**
 * The single mutable object shared between the DOM layer (GSAP, pointer events)
 * and the WebGL layer (`useFrame`).
 *
 * Nothing here ever goes through React state — GSAP writes, `useFrame` reads,
 * and React only ever handles mount/unmount. That is what keeps the hero at
 * 60fps while a 2.4s timeline and a scroll scrub are both running.
 */
export type HeroMotion = {
  /** 0 = noise cloud, 1 = fully assembled wordmark. */
  progress: number;
  /** 0 = held, 1 = dissolved back into drifting dust. */
  dispersion: number;
  /** Raw Lenis scroll velocity; decayed toward 0 every frame. */
  scrollVel: number;
  /** Master fade for the particle layer. */
  opacity: number;
  /** Pointer in normalised device coords (-1..1), fed from the DOM layer. */
  pointerX: number;
  pointerY: number;
  /** 1 while the pointer is over the hero, 0 otherwise. */
  pointerInside: number;
};

export function createHeroMotion(): HeroMotion {
  return {
    progress: 0,
    dispersion: 0,
    scrollVel: 0,
    opacity: 1,
    pointerX: 0,
    pointerY: 0,
    pointerInside: 0,
  };
}

/**
 * Particle budget per device. Read once on mount — this must not change on
 * resize, because the attribute buffers are allocated against it.
 */
export function resolveParticleCount(): number {
  if (typeof window === "undefined") return 24_000;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (width < 640) return 24_000;
  if (width < 1024) return 45_000;
  return cores <= 4 ? 55_000 : 80_000;
}
