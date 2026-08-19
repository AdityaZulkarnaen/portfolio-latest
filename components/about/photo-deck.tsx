"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-media-query";
import { aboutCopy } from "./about-copy";

/** How long a photo holds the front of the deck, in ms. */
const DWELL = 4200;

const photos = aboutCopy.photos;

/**
 * Geometry per stack position. Index 0 is the front card; the last entry is the
 * card that has just left, which sits *at the back* of the stack and is
 * invisible — so the cycle only ever moves forward and nothing flies backwards
 * across the frame when the deck wraps around.
 */
function cardStyle(offset: number, depth: number) {
  const last = depth - 1;
  if (offset === last) {
    return {
      transform: "translate3d(9%, 12%, 0) rotate(7deg) scale(0.86)",
      opacity: 0,
      zIndex: 0,
    };
  }
  const back = Math.min(offset, 2);
  return {
    transform: `translate3d(${back * 4.5}%, ${back * 3.5}%, 0) rotate(${
      offset === 0 ? -1.4 : back * 2.6
    }deg) scale(${1 - back * 0.06})`,
    opacity: offset > 2 ? 0 : 1,
    zIndex: depth - offset,
  };
}

/**
 * The portrait deck. Photos cycle on their own while the section is on screen,
 * and clicking (or Enter/Space on the deck) flicks to the next one — the HUD
 * underneath borrows the hero's readout so the two chapters share a language.
 */
export default function PhotoDeck() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const reducedMotion = useReducedMotion();
  const depth = photos.length;

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % depth);
  }, [depth]);

  // Only cycle while the deck is actually visible: an off-screen timer would
  // burn frames and desync the dwell bar from what the visitor sees.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setRunning(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running || reducedMotion || depth < 2) return;
    const id = window.setInterval(advance, DWELL);
    return () => window.clearInterval(id);
  }, [running, reducedMotion, depth, advance]);

  const active = photos[index];

  return (
    // Height-driven, not width-driven: the parent hands the deck a slice of
    // viewport and the cards derive their width from it, so the aside can never
    // grow past one screen no matter how wide the column is.
    <div
      ref={rootRef}
      className="flex w-full flex-col md:h-full md:min-h-0"
    >
      {/* Two sizing regimes on one box. Stacked (<md) the deck is width-driven
          and capped, the way a photo behaves in a column of text. Pinned (md+)
          it is height-driven — the parent hands it a slice of viewport and the
          cards derive their width from it — so the aside can never grow past
          one screen no matter how wide the column gets. */}
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[20rem] self-center sm:max-w-[24rem] md:mx-0 md:w-auto md:max-w-full md:min-h-0 md:flex-1 md:self-end">
        {/* Registration frame — the deck is printed slightly off its plate. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-[10px] border border-acid/70"
        />

        {/* A div, not a button: the cards are `figure`s, which a button may not
            contain. Clicking here is a shortcut — the real control lives in the
            HUD below, where it is focusable and labelled. */}
        <div
          onClick={advance}
          className="group absolute inset-0 cursor-pointer"
        >
          {photos.map((photo, i) => {
            const offset = (i - index + depth) % depth;
            const style = cardStyle(offset, depth);
            return (
              <figure
                key={photo.alt}
                aria-hidden={offset !== 0}
                style={style}
                className="absolute inset-0 overflow-hidden rounded-[10px] bg-slab-deep ring-1 ring-void/25 shadow-[0_24px_60px_-24px_rgba(8,8,10,0.75)] transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              >
                {photo.src ? (
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(min-width: 768px) 34vw, (min-width: 640px) 24rem, 20rem"
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <Placeholder n={i + 1} />
                )}

                {/* Same scanline treatment as the panel, one stop stronger. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(8,8,10,0.16)_0px,rgba(8,8,10,0.16)_1px,transparent_1px,transparent_4px)] mix-blend-multiply"
                />
              </figure>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-void sm:gap-3 sm:text-[11px] sm:tracking-[0.18em]">
        <span className="tabular-nums">
          {aboutCopy.deckLabel} {String(index + 1).padStart(2, "0")}/
          {String(depth).padStart(2, "0")}
        </span>
        <span className="relative block h-px flex-1 overflow-hidden bg-void/30">
          <span
            key={index}
            className="absolute inset-0 origin-left scale-x-0 bg-void [animation:deck-dwell_var(--deck-dwell)_linear_forwards] motion-reduce:scale-x-100 motion-reduce:[animation:none]"
            style={{ "--deck-dwell": `${DWELL}ms` } as React.CSSProperties}
          />
        </span>
        {/* First thing to go when the column is narrow: the label and the
            counter still say everything the caption does. */}
        <span className="hidden text-void/60 sm:inline">{active.caption}</span>
        <button
          type="button"
          onClick={advance}
          aria-label={`Next photo — ${photos[(index + 1) % depth].alt}`}
          className="cursor-pointer text-void/60 transition-colors hover:text-void focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-void"
        >
          NEXT &gt;
        </button>
      </div>

      <p className="mt-2 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-void/45">
        {aboutCopy.deckHint}
      </p>
    </div>
  );
}

/** Stand-in until the real shots land in `public/photos/`. */
function Placeholder({ n }: { n: number }) {
  return (
    <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#a3a39b,#84847d)]">
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(8,8,10,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,8,10,0.12)_1px,transparent_1px)] bg-[size:28px_28px]"
      />
      <span className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-void/55">
        IMG {String(n).padStart(2, "0")} — AWAITING FILE
      </span>
    </span>
  );
}
