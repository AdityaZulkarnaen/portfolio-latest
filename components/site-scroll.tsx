"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLenis } from "@/lib/use-smooth-scroll";
import { useReducedMotion } from "@/lib/use-media-query";
import { META_TYPE_BASE } from "@/lib/site-config";

/** Shortest the thumb is allowed to get on a very long page. */
const MIN_THUMB = 28;

type Chapter = {
  mark: string;
  name: string;
  /** Where the chapter starts, as a fraction of total scroll. */
  at: number;
};

/**
 * The scrollbar, rebuilt as the instrument the rest of the page already speaks
 * in: a rail with a tick for every chapter, the mark and name in mono beside
 * it, and an acid thumb showing where you are.
 *
 * Ticks are read from `[data-chapter]` in the DOM rather than from a list kept
 * here, so a new chapter gets its own tick the moment it is added to the page
 * and there is no second place to update.
 *
 * The native bar is hidden in `globals.css`, so this has to be a real control,
 * not a readout: press or drag anywhere along the rail to move the page. That
 * goes through Lenis rather than `scrollTop`, or the smooth-scroll loop would
 * keep animating toward its own stale target and fight the drag.
 */
export default function SiteScroll() {
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const maxScrollRef = useRef(1);

  // Measure on mount, on resize, and whenever the document grows — the
  // chapters are svh-sized, so a mobile URL bar collapsing changes every offset.
  useEffect(() => {
    const measure = () => {
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      maxScrollRef.current = max;

      const found = [...document.querySelectorAll<HTMLElement>("[data-chapter]")]
        .map((el) => ({
          mark: el.dataset.chapter ?? "",
          name: el.dataset.chapterName ?? "",
          at: Math.min(1, (el.getBoundingClientRect().top + window.scrollY) / max),
        }))
        .sort((a, b) => a.at - b.at);

      setChapters((prev) =>
        prev.length === found.length &&
        prev.every((c, i) => c.mark === found[i].mark && Math.abs(c.at - found[i].at) < 0.001)
          ? prev
          : found,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Position is written straight to the DOM. The rail updates on every frame of
  // a smooth scroll, and routing that through state would re-render the page
  // shell at 60fps for a 1px move.
  useEffect(() => {
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!rail || !thumb) return;

    const sync = () => {
      const max = maxScrollRef.current;
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      const railHeight = rail.clientHeight;
      const ratio = window.innerHeight / (max + window.innerHeight);
      const height = Math.max(MIN_THUMB, railHeight * ratio);

      thumb.style.height = `${height}px`;
      thumb.style.transform = `translateY(${progress * (railHeight - height)}px)`;

      // The chapter you are actually in is the last one you have passed.
      const ticks = rail.parentElement?.querySelectorAll<HTMLElement>("[data-tick]");
      if (!ticks) return;
      let active = 0;
      ticks.forEach((tick, i) => {
        if (Number(tick.dataset.at) <= progress + 0.001) active = i;
      });
      ticks.forEach((tick, i) => {
        tick.dataset.active = i === active ? "true" : "false";
      });
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [chapters]);

  const seek = useCallback((clientY: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const box = rail.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    const target = t * maxScrollRef.current;

    const lenis = getLenis();
    if (lenis) lenis.scrollTo(target, { immediate: true });
    else window.scrollTo(0, target);
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      seek(event.clientY);
    },
    [seek],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // buttons is a bitmask; 1 is "primary still held".
      if (event.buttons & 1) seek(event.clientY);
    },
    [seek],
  );

  if (chapters.length === 0) return null;

  return (
    <div
      aria-hidden
      className="fixed right-2 top-1/2 z-40 hidden h-[54svh] -translate-y-1/2 select-none sm:block md:right-4"
    >
      <div className="relative flex h-full items-stretch">
        {/* Chapter marks, hung off the rail. `difference` for the same reason
            the nav uses it: this furniture crosses both the void chapters and
            Chapter .02's light slab, and inverting against the backdrop beats
            swapping colours on a scroll listener. */}
        <div className="relative w-14 md:w-20">
          {chapters.map((chapter) => (
            <div
              key={chapter.mark}
              data-tick
              data-at={chapter.at}
              data-active="false"
              className={`group absolute right-0 flex -translate-y-1/2 items-center gap-2 mix-blend-difference transition-opacity duration-500 data-[active=false]:opacity-35 data-[active=true]:opacity-100 ${META_TYPE_BASE} text-ink`}
              style={{ top: `${chapter.at * 100}%` }}
            >
              <span className="hidden md:inline">{chapter.name}</span>
              <span>{chapter.mark}</span>
              {/* Grows on the chapter you are in — the rail reads as a dial. */}
              <span className="block h-px w-2 bg-ink transition-all duration-500 group-data-[active=true]:w-4" />
            </div>
          ))}
        </div>

        {/* The control. Padded wide enough to grab without the hairline itself
            having to be a big hit target. */}
        <div
          ref={railRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          className="relative w-4 cursor-pointer touch-none"
        >
          <span
            aria-hidden
            className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-ink/25 mix-blend-difference"
          />
          {/* Flat acid, no blend: it has to stay brilliant on the light slab
              too, and `difference` turns acid into muddy sage there. */}
          <span
            ref={thumbRef}
            className={`absolute left-1/2 top-0 w-[3px] -translate-x-1/2 rounded-full bg-acid ${
              reducedMotion ? "" : "will-change-transform"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
