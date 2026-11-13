/**
 * Which scene Chapter .01 draws behind the wordmark.
 *
 * - "portrait" — Signal Lock: the ASCII portrait (`ascii-portrait.tsx`).
 * - "currents" — the Tame Impala flow field (`currents-field.tsx`).
 *
 * Currents is kept whole and switchable on purpose: both scenes read the same
 * `HeroMotion` object and report readiness the same way, so flipping this one
 * value is the entire change. Both live in the client-only `ssr: false`
 * chunk, so neither reaches the server bundle or the eager client one.
 */
export type HeroBackdrop = "portrait" | "currents";

export const HERO_BACKDROP: HeroBackdrop = "portrait";
