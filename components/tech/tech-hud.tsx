"use client";

import type { RefObject } from "react";
import { META_TYPE_BASE } from "@/lib/site-config";
import { techCopy } from "./tech-copy";

type TechHudProps = {
  barRef: RefObject<HTMLSpanElement | null>;
  valueRef: RefObject<HTMLSpanElement | null>;
};

/**
 * The corner readout. It turns an abstract tunnel into an instrument panel:
 * the depth gauge is the only thing telling you how far through the chapter you
 * are. Values are written straight to the DOM from the scrub — never through
 * React state, or the gauge would re-render the section on every scroll frame.
 *
 * Everything sits along the foot of the frame, matching the hero. The top of
 * every screen belongs to the fixed nav, which is `mix-blend-difference` and
 * would tangle with anything placed under it.
 */
export default function TechHud({ barRef, valueRef }: TechHudProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-6 p-5 md:flex-row md:items-end md:justify-between md:p-8 ${META_TYPE_BASE} text-ink`}
    >
      <div className="space-y-3">
        <p data-tech-meta className="text-acid">
          {techCopy.eyebrow}
        </p>
        <p data-tech-meta className="text-ink/55">
          {techCopy.seamLeft}
        </p>
      </div>

      <div className="space-y-3 md:text-right">
        <p data-tech-meta className="flex items-center gap-3 md:justify-end">
          <span className="text-ink/55">{techCopy.depthLabel}</span>
          <span className="relative block h-px w-16 overflow-hidden bg-ink/30 sm:w-24">
            <span
              ref={barRef}
              className="absolute inset-0 origin-left scale-x-0 bg-acid"
            />
          </span>
          <span ref={valueRef} className="tabular-nums">
            000%
          </span>
        </p>
        <p data-tech-meta className="flex items-center gap-2 md:justify-end">
          <span className="size-1.5 rounded-full bg-acid" />
          {techCopy.seamRight}
        </p>
      </div>
    </div>
  );
}
