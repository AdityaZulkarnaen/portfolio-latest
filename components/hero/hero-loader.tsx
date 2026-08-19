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
      className="fixed inset-0 z-50 flex flex-col justify-end bg-void p-5 md:p-8"
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
