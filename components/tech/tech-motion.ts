/**
 * The single mutable object shared between the DOM layer (GSAP, pointer events)
 * and the WebGL layer (`useFrame`), exactly as `hero-motion.ts` does it.
 *
 * Nothing here goes through React state. One scrubbed ScrollTrigger writes it,
 * two `useFrame` loops read it, and React only ever handles mount/unmount —
 * which is what keeps a 460svh scrub at 60fps.
 */
export type TechMotion = {
  /**
   * 0 = the tag is sealed shut in the centre of the frame.
   * 1 = both halves have swept past the camera and the tunnel is wide open.
   */
  aperture: number;
  /** Advance along the tunnel. Monotonic within a scroll direction. */
  travel: number;
  /** Master fade for the logo layer. */
  reveal: number;
  /** Scroll velocity, decayed every frame — drives the radial motion stretch. */
  scrollVel: number;
  /** Pointer in normalised device coords (-1..1), fed from the DOM layer. */
  pointerX: number;
  pointerY: number;
  /** 1 while the pointer is over the section, 0 otherwise. */
  pointerInside: number;
};

export function createTechMotion(): TechMotion {
  return {
    aperture: 0,
    travel: 0,
    reveal: 0,
    scrollVel: 0,
    pointerX: 0,
    pointerY: 0,
    pointerInside: 0,
  };
}

/**
 * Instance budget per device. Read once on mount — this must not change on
 * resize, because the instanced attribute buffers are allocated against it.
 *
 * Kept deliberately low. These are legible marks, not dust: past roughly 200
 * the field stops reading as a tunnel with depth and starts reading as noise
 * blowing across the frame.
 */
export function resolveLogoCount(): number {
  if (typeof window === "undefined") return 55;
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (width < 640) return 55;
  if (width < 1024) return 90;
  return cores <= 4 ? 110 : 150;
}

/**
 * Edge of one atlas cell, in pixels — the texture budget for the whole chapter.
 *
 * The sheet is `ceil(sqrt(n))` cells wide, so twenty marks at 384 is a
 * 1920x1536 texture: about 16MB of VRAM once mipmapped. Worth it on a desktop,
 * where a tile approaching the lens covers half the frame and a 256 cell is
 * visibly soft by then; not worth it on a phone, where it never gets that
 * close and the memory is scarcer.
 *
 * Read once on mount, alongside the instance count.
 */
export function resolveAtlasTile(): number {
  if (typeof window === "undefined") return 256;
  return window.innerWidth < 640 ? 256 : 384;
}

/**
 * Remaps a master 0..1 scroll progress onto one phase of the chapter.
 *
 * Every beat is derived from the same `self.progress` through this, so the tag,
 * the tunnel and the heading are mathematically incapable of drifting apart —
 * there is only ever one clock.
 */
export function phase(p: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (p - start) / (end - start)));
}

/** Scroll progress boundaries for the four beats of Chapter .03. */
export const BEAT = {
  /** Void slats reach up and seal the grey panel above. */
  sealEnd: 0.08,
  /** The tag scales up, splits, and sweeps past the camera. */
  openStart: 0.08,
  openEnd: 0.3,
  /** The long haul: logos rush the viewer. */
  travelStart: 0.3,
  travelEnd: 0.8,
  /** The tag returns from off-frame and closes the chapter. */
  closeStart: 0.8,
} as const;

/** How many times the tunnel recycles across the travel beat. */
export const TRAVEL_LOOPS = 3.5;
