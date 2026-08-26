"use client";

import { useEffect, useRef } from "react";
import { gsap, killScrollTriggersIn, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";

/**
 * The echoes standing on the crisp word's shoulders — **farthest first**.
 *
 * The order is paint order, and paint order is the effect: each layer carries
 * an opaque acid band, so a layer printed later cuts into the one printed
 * before it. Listing the farthest echo first means the stack occludes downward-
 * to-upward, the way a pile of paper does, and the crisp word at the end is the
 * only copy nothing crosses.
 *
 * `scaleY` is what each copy is squashed to; `yPercent` is where it lands once
 * the footer is fully in view. Both are read off the same line box — every
 * layer is one line of `leading-[0.78]`, so the spans are all exactly 0.78em
 * tall and `yPercent` is a common unit across them regardless of the clamp.
 *
 * The offsets are cumulative, each echo cleared over the visual height of the
 * one below it times 0.85: the shortfall is the overlap, and the overlap is the
 * point — the copies interlock rather than sit in a neat column, so the stack
 * still reads as one word being pulled apart instead of four words listed.
 */
const ECHOES = [
  { scaleY: 1, yPercent: -95 },
  { scaleY: 1, yPercent: -65 },
  { scaleY: 1, yPercent: -35 },
];

/** Font-size multiples the block reserves, so nothing reflows as it opens. */
const RESERVE = "1.62em";

/**
 * Below Tailwind's `md`, matched to the breakpoint the footer's own grid uses.
 *
 * Not an arbitrary phone width: it is precisely where `site-footer.tsx` drops
 * `md:grid-cols-12` and the tagline and link columns stop sharing a row. That
 * is the change that makes the footer tall enough for the scrub's range to be
 * worth re-cutting, so the two have to agree.
 */
const COMPACT = "(max-width: 767px)";

/**
 * The band behind each copy, sized off the height of its own `u`.
 *
 * Taken off the glyph rather than guessed: in BlurWeb the `u` runs from
 * −0.014em to 0.514em about the baseline (unitsPerEm 1000, yMin −14, yMax 514),
 * so the letter is 0.528em tall. The band is 0.6em — the `u` plus a little air
 * over it — because a band cut exactly to the x-height reads as a mistake at
 * this size, as though the type had been trimmed rather than banded. All of the
 * extra goes on the top edge: the bottom stays pinned 0.014em under the
 * baseline so the round overshoot is still inside it, and so the cut this band
 * takes out of the copy above moves without the copy itself moving.
 *
 * An empty inline-block takes its baseline from its bottom margin edge, which
 * is what aligns the band to the text: `vertical-align` then drops it by the
 * overshoot. That is exact whichever set of vertical metrics the browser
 * decides to honour for this face, which an absolutely-positioned rectangle
 * computed from ascent and descent would not be.
 *
 * `margin-right: -100%` cancels the full-width advance so the word still starts
 * at the left edge of the same line, and being earlier in the line it is
 * painted under its own text.
 */
const BAND = {
  height: "0.6em",
  verticalAlign: "-0.014em",
  marginRight: "-100%",
} as const;

/**
 * `isolate` is load-bearing. The band is an in-flow inline-block and the word
 * is plain inline text beside it, so without a stacking context of its own the
 * layer paints the band *over* its own letters and the whole block goes flat
 * acid. Isolating each layer scopes the two z-indexes below to it: the band
 * sits under its word, and the layer as a whole still paints over every layer
 * before it in the tree — which is what takes the bite out of the copy above.
 */
/**
 * `whitespace-nowrap` is load-bearing twice over, so it is not a tidy-up.
 *
 * It is what keeps the fit's measurement honest — see the note on `fit()` — and
 * it is also what keeps the fit's *result* stable. A fitted line is exactly as
 * wide as the column by construction, so it sits on the wrap boundary: a
 * sub-pixel rounding the wrong way is enough to break it onto a second line,
 * which then defeats the very measurement that would correct it.
 */
const LAYER_TYPE =
  "absolute inset-x-0 bottom-0 isolate block whitespace-nowrap font-blur text-[1em] font-medium tracking-[-0.02em] text-void";

/**
 * The footer wordmark: one name, said once, printed four times.
 *
 * At rest every copy sits on the same baseline at the same scale, so they
 * coincide pixel for pixel and the block reads as a single word. Scrolling the
 * footer into view scrubs them apart — each echo squashes to its own `scaleY`
 * and climbs to its own offset — until, with the page at its stop, the name is
 * a stack of itself flattening upward. The name still settling, which is what
 * the static version was reaching for with one echo and could not move.
 *
 * Each copy is printed on a band of the ground it stands on, exactly as tall as
 * its own `u` (see `BAND`). On the acid footer the band is invisible where it
 * has nothing under it; where it crosses the copy above, it takes a straight
 * horizontal bite out of it. So the glyphs come apart along hard edges as the
 * stack opens, and the band squashes with its layer — every copy is cut to the
 * measure of its own letters, not to one shared rule.
 *
 * The block reserves its open height up front (`RESERVE`) and hangs the layers
 * off the bottom edge. Growing the container instead would push the tagline,
 * the link columns and the colophon down a little on every frame of the scrub —
 * a full-footer relayout per frame, for a wordmark.
 *
 * Only the crisp copy is in the accessibility tree: the echoes are the same
 * string, and a screen reader should hear the surname once.
 */
export default function FooterWordmark({ word }: { word: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  // Fit the name to the column. A clamp can only ever be tuned for one string
  // at one set of metrics, and it lands short on most widths — the wordmark is
  // supposed to be the full measure of the footer, not nearly it. Everything
  // about this block is in `em`, so a linear correction from the word's
  // rendered width to the column's is exact.
  //
  // The whole method rests on the probe being one unbroken line, which is why
  // the layers are `whitespace-nowrap` and why that class is not cosmetic. Let
  // the word wrap and `getBoundingClientRect()` stops reporting the word: an
  // inline element spanning two lines returns the union of its line boxes,
  // which is the column. `natural` then equals `target`, the correction
  // degenerates to a no-op, and the block is stuck at whatever size wrapped it.
  //
  // That was a real failure and not a hypothetical one. The display face is
  // `display: "block"`, so the first pass measures the fallback; next/font's
  // size-adjusted fallback is close but not exact, so the first correction
  // could land a little over. BlurWeb then swapped in, the word wrapped, and
  // every later pass — including the one `fonts.ready` fires — measured the
  // wrap and changed nothing. A two-line layer is `2 × 0.78em` tall and hangs
  // off `bottom-0`, so with the echo offsets on top of it the stack stood
  // 2.3em above the container's floor inside a box reserving 1.62em: the extra
  // line, bands and all, printed acid over the section above the footer. The
  // same oversized `em` is what sent the echoes travelling too far.
  useEffect(() => {
    const root = rootRef.current;
    const probe = probeRef.current;
    if (!root || !probe) return;

    let frame = 0;
    let fitted = 0;

    const fit = () => {
      const target = root.clientWidth;
      if (target <= 0) return;

      // Twice, not once. One correction is exact only if the face measured is
      // the face that ends up drawn, and during the block period it is not.
      // The second pass costs one forced layout and settles whatever the first
      // one got wrong — including the case where the real face arrives between
      // the two.
      for (let pass = 0; pass < 2; pass += 1) {
        const natural = probe.getBoundingClientRect().width;
        if (natural <= 0) return;
        if (Math.abs(natural - target) < 0.5) break;
        const size = parseFloat(getComputedStyle(root).fontSize);
        root.style.fontSize = `${(size * target) / natural}px`;
      }

      fitted = root.clientWidth;
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    schedule();

    // Width only. Fitting changes the block's height, and a ResizeObserver that
    // acted on that would re-fit its own result forever.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - fitted) < 0.5) return;
      fitted = width;
      schedule();
    });
    observer.observe(root);

    // The display face is `display: "block"`, so the first measurement can land
    // on nothing at all. Re-fit once the real metrics arrive.
    document.fonts?.ready.then(schedule).catch(() => {});

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [word]);

  useGSAP(
    () => {
      const echoes = gsap.utils.toArray<HTMLElement>("[data-fw-echo]");
      if (echoes.length === 0) return;

      // The squash is set here rather than in a class because GSAP owns the
      // whole `transform` on these nodes once it starts writing `yPercent` — a
      // Tailwind `scale-y-*` would be overwritten on the first scrub frame.
      gsap.set(echoes, {
        transformOrigin: "50% 100%",
        scaleY: (i: number) => ECHOES[i].scaleY,
      });

      if (reducedMotion) {
        killScrollTriggersIn(rootRef.current);
        gsap.set(echoes, { yPercent: (i: number) => ECHOES[i].yPercent });
        return;
      }

      gsap.fromTo(
        echoes,
        { yPercent: 0 },
        {
          yPercent: (i: number) => ECHOES[i].yPercent,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            // Opens across the last screen of the page: nothing has moved when
            // the footer's top edge first appears.
            start: "top bottom",
            /**
             * Where it finishes, and why the answer is different on a phone.
             *
             * `bottom bottom` ends the scrub when this block's own bottom edge
             * reaches the viewport floor, which makes the scroll range exactly
             * the height of the wordmark — `RESERVE`, so 1.62em of whatever the
             * fit settled on. On a wide column that font-size is around 200px
             * and the range is a comfortable ~320px. On a phone the fit lands
             * near 60px, so the whole stack pulls apart inside about 100px of
             * scroll: one flick and it is over. Worse, the footer below it is
             * far taller there — the tagline and the two link columns stack
             * instead of sharing a 12-column grid — so several hundred more
             * pixels go by with the wordmark already at its end state.
             *
             * `max` is the document's own end, so the scrub is spread across
             * everything left to scroll and lands shut exactly as the page
             * does. That is what the block was always described as doing; below
             * `md` it is now also what it does.
             *
             * A function rather than a `useMediaQuery` dependency on purpose.
             * ScrollTrigger re-evaluates functional bounds on every refresh,
             * which a resize already triggers, so crossing the breakpoint is
             * handled without rebuilding the tween — and rebuilding is the
             * thing to avoid here, because a ScrollTrigger outlives the
             * `useGSAP` revert that would drop its tween (see `lib/gsap.ts`)
             * and would carry on writing `yPercent` alongside its replacement.
             */
            end: () =>
              window.matchMedia(COMPACT).matches ? "max" : "bottom bottom",
            scrub: true,
          },
        },
      );
    },
    { scope: rootRef, dependencies: [reducedMotion] },
  );

  const band = (
    <span
      aria-hidden
      className="relative z-0 inline-block w-full bg-acid"
      style={BAND}
    />
  );

  return (
    <div
      ref={rootRef}
      // The clamp is only what the block is set at before the fit runs.
      //
      // `overflow-hidden` never fires in correct operation and is there for
      // when something is not: the open stack stands 1.379em above this box's
      // floor — 0.741em of echo offset, one 0.78em line box, and the band
      // reaching 0.638em over its own baseline — inside the 1.62em reserved
      // here. What it buys is the failure mode. Every layer carries an opaque
      // full-width acid band, so a layer that ends up taller than its line box
      // does not merely look wrong, it prints the footer's ground over the
      // section above it. Clipped, the worst case is a wordmark with its top
      // cut off, which is a bug someone reports rather than one that looks
      // like a broken page.
      className="relative select-none overflow-hidden text-[clamp(3rem,17vw,15rem)] leading-[0.78]"
      style={{ height: RESERVE }}
    >
      {ECHOES.map((_, i) => (
        <span key={i} aria-hidden data-fw-echo className={LAYER_TYPE}>
          {band}
          <span className="relative z-10">{word}</span>
        </span>
      ))}
      <span className={LAYER_TYPE}>
        {band}
        <span ref={probeRef} className="relative z-10">
          {word}
        </span>
      </span>
    </div>
  );
}
