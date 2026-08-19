"use client";

import type { RefObject } from "react";
import { heroCopy } from "./hero-copy";

type HeroHudProps = {
  labelRef: RefObject<HTMLSpanElement | null>;
  barRef: RefObject<HTMLSpanElement | null>;
  valueRef: RefObject<HTMLSpanElement | null>;
};

/**
 * The readout that turns the particle effect into a story: it narrates noise
 * resolving into signal while the assembly runs. Values are written straight to
 * the DOM from the GSAP timeline — never through React state.
 */
export default function HeroHud({ labelRef, barRef, valueRef }: HeroHudProps) {
  return (
    <div className="flex items-center gap-3">
      <span ref={labelRef} className="text-acid">
        {heroCopy.signalLabel}
      </span>
      <span className="relative block h-px w-16 overflow-hidden bg-ink sm:w-24">
        <span
          ref={barRef}
          className="absolute inset-0 origin-left scale-x-0 bg-acid"
        />
      </span>
      <span ref={valueRef} className="tabular-nums">
        000%
      </span>
    </div>
  );
}
