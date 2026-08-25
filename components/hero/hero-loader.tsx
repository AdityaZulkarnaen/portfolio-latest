"use client";

import type { RefObject } from "react";
import { heroCopy } from "./hero-copy";

type HeroLoaderProps = {
  rootRef: RefObject<HTMLDivElement | null>;
  counterRef: RefObject<HTMLSpanElement | null>;
  barRef: RefObject<HTMLSpanElement | null>;
};

export default function HeroLoader({
  rootRef,
  counterRef,
  barRef,
}: HeroLoaderProps) {
  return (
    <div
      ref={rootRef}
      data-loader
      /* Absolute, not fixed — and it is `hero.tsx` that promotes it to fixed,
         once it knows the page actually opened here.

         The veil ships in the server HTML and is painted long before any of
         this hydrates. Fixed, that paint covers the viewport wherever the
         visitor happens to be, so reloading halfway down the page put a black
         screen over the chapter they were reading for the whole length of the
         download. Anchored to the top of the hero instead, it is simply not on
         screen when the page opens somewhere else, and at the top of the page
         the two are pixel-identical. */
      className="absolute inset-x-0 top-0 z-50 flex h-svh flex-col justify-end bg-void p-5 md:p-8"
    >
      <div className="flex items-end justify-between gap-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {heroCopy.loaderLabel}
        </span>
        <span
          ref={counterRef}
          className="font-display text-[clamp(3rem,11vw,8rem)] font-black leading-[0.8] tabular-nums text-ink"
        >
          000
        </span>
      </div>
      <span className="mt-5 block h-px w-full overflow-hidden bg-line">
        <span
          ref={barRef}
          className="block h-full w-full origin-left scale-x-0 bg-acid"
        />
      </span>
    </div>
  );
}
