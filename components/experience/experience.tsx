"use client";

import { useEffect, useRef } from "react";
import { gsap, killScrollTriggersIn, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";
import { META_TYPE_BASE } from "@/lib/site-config";
import { experienceCopy, experiences } from "./experience-copy";

/** Slabs the chapter reaches up with, matching Chapter .02's takeover. */
const SLATS = 3;

/**
 * Chapter .05 — the record, open, then shut.
 *
 * Every entry arrives already open: the cards are plain siblings in flow, so
 * the first thing the chapter shows is the whole record at once. Scrolling
 * closes it. Each card is `sticky` at its own offset — the roof, plus one bar
 * height per card above it — so a card that reaches its line stops there while
 * the next one keeps climbing, slides over its body, and leaves only its bar
 * showing. By the foot of the chapter every entry has been shut but the last,
 * which is the current one.
 *
 * There is no timeline here and nothing scrubbed, which is deliberate. A
 * scrubbed accordion has to know each card's natural body height, re-measure
 * it on every resize and font swap, and drive a height whose flow it does not
 * control; sticky offsets do the same job in the layout engine, cost nothing
 * per frame, and behave identically on a trackpad fling, a keyboard PageDown
 * and with JS disabled. Same reasoning as the hero's sticky frame and Chapter
 * .03's — this chapter just applies it per card instead of per screen.
 *
 * The one thing JS is needed for is `--exp-head`: the offsets are measured off
 * the real roof, which is clamp-sized and wraps differently on every viewport.
 * Same measure-don't-guess as `--about-head`.
 */
export default function Experience() {
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const head = headRef.current;
    const root = rootRef.current;
    if (!head || !root) return;

    const sync = () =>
      root.style.setProperty("--exp-roof", `${head.offsetHeight}px`);
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(head);
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      const rises = gsap.utils.toArray<HTMLElement>("[data-exp-rise]");

      if (reducedMotion) {
        killScrollTriggersIn(rootRef.current);
        gsap.set(rises, { yPercent: 0, opacity: 1 });
        gsap.set("[data-exp-slat]", { scaleY: 1 });
        return;
      }

      // The takeover. Same mechanism as Chapters .02 and .03: slabs pinned to
      // the outside of the top edge, travelling with the section, so the void
      // above is taken over rather than cut to. This is the biggest ground
      // flip on the page — void to acid — so it is the one seam that would
      // read worst as a hard cut.
      gsap.fromTo(
        "[data-exp-slat]",
        { scaleY: 0 },
        {
          // Past 1 so neighbouring slabs overlap by a hair; at 1 exactly,
          // sub-pixel rounding leaves seams of the void showing through.
          scaleY: 1.02,
          ease: "none",
          duration: 1.6,
          stagger: { each: 1, from: "end" },
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top bottom",
            end: "top 25%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );

      gsap.fromTo(
        rises,
        { yPercent: 105, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 72%" },
        },
      );
    },
    { scope: rootRef, dependencies: [reducedMotion] },
  );

  return (
    <section
      ref={rootRef}
      id="experience"
      data-chapter=".05"
      data-chapter-name="Experience"
      // Read by `site-ground.tsx`, which flips the nav, the chapter rail and
      // the pointer trail to void for as long as this ground is under them.
      // `from` is the takeover's end below: until the slats have finished
      // sealing the frame, the top of the screen is still the void above.
      data-ground="acid"
      data-ground-from="25%"
      // Above Chapter .04 (z-[35]) but below the fixed nav (z-40).
      //
      // No `overflow-hidden` anywhere on the way down to the cards — it would
      // silently kill every `sticky` below, and the chapter would degrade into
      // a plain list with nothing to say why.
      //
      // `--exp-row` is the height of one closed bar and therefore the pitch of
      // the whole stack: the cards' sticky offsets are multiples of it, so the
      // bar and the offset have to read the same number or the stack develops
      // gaps. Two lines' worth below `md`, where the role and the org sit
      // stacked rather than side by side.
      //
      // `--exp-head` is where the stack parks, and the two breakpoints answer
      // it differently. From `md` up it is the roof: the heading stays on
      // screen and the bars gather under it. Below `md` it is only the nav's
      // clearance, and the roof scrolls away — measured, a phone cannot afford
      // both. The roof costs ~206px there, and the budget for the whole
      // chapter (roof + every bar + the longest body) has to fit one small
      // viewport or the foot of the open card is never reachable: it is parked,
      // so it cannot be scrolled up to, and the lid closes over it where it
      // stands. Dropping the roof buys back exactly that 206px.
      //
      // `--exp-roof` is what the ResizeObserver writes. `--exp-head` reads it
      // only at `md`, so the measurement never reaches the phone layout, and
      // the value here is the fallback for the frame before JS runs.
      className="relative z-[36] w-full bg-acid text-void [--exp-head:4.5rem] [--exp-roof:15rem] [--exp-row:4.5rem] md:[--exp-head:var(--exp-roof)] md:[--exp-row:clamp(4.75rem,6.4vw,6.5rem)]"
    >
      {/* Sits directly on the outside of the chapter's top edge and moves with
          it — this section's own reach into the void above. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full flex h-[30svh] flex-col md:h-[55svh]"
      >
        {Array.from({ length: SLATS }, (_, i) => (
          <span
            key={i}
            data-exp-slat
            className="w-full flex-1 origin-bottom scale-y-0 bg-acid will-change-transform"
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-[110rem] pl-5 pr-5 sm:pr-[var(--rail-gutter)] md:pl-8">
        {/* The roof. From `md` up it is sticky at the very top, so the heading
            is still there when the last card lands, and z-10 so the cards pass
            behind it rather than over it once the stack peels away at the foot
            of the chapter. The top padding is the fixed nav's clearance, and it
            is inside the measured box on purpose — the cards stack under the
            whole band.

            Below `md` it is neither: it scrolls away like an ordinary heading
            and the bars pass over it, which is why the z-index is gated too. A
            phone has no room to keep a roof and still land the last card whole,
            and a heading that has already been read is the cheaper thing to
            spend. */}
        <div
          ref={headRef}
          className="bg-acid pb-5 pt-[5.5rem] md:sticky md:top-0 md:z-10 md:pb-8 md:pt-[8.5rem]"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
            <div className="overflow-hidden">
              <h2
                data-exp-rise
                className="max-w-[20ch] font-display text-[clamp(1.6rem,4.6vw,3.5rem)] font-black leading-[1.02] tracking-[-0.035em]"
              >
                {experienceCopy.heading}
              </h2>
            </div>

            <div className="overflow-hidden">
              <p
                data-exp-rise
                className={`italic md:text-right ${META_TYPE_BASE} text-void/55`}
              >
                {experienceCopy.eyebrow}
                <br />
                {experienceCopy.chapter}
              </p>
            </div>
          </div>
        </div>

        {/* The stack. The padding is the hold: the sticky cards stay pinned for
            as long as this box still has room under them, so it is what buys
            the finished composition a beat on screen before the whole stack
            peels away upward. Shorten it and the last card arrives and leaves
            in the same gesture. */}
        <ul aria-label={experienceCopy.listLabel} className="relative pb-[30svh]">
          {experiences.map((item, i) => (
            <li
              key={item.slug}
              // The pitch is the bar plus its own rule, not the bar alone.
              // `border-t-2` is 2px of extra box above every bar, so stacking
              // on `--exp-row` would park each card 2px high and shave that
              // much off the bar below it — invisible on one card, 2px of
              // creeping misalignment by the fourth.
              style={{
                top: `calc(var(--exp-head) + ${i} * (var(--exp-row) + 2px))`,
              }}
              // Opaque, and that is the whole mechanism: a card closes the one
              // before it by covering it. Later siblings paint over earlier
              // ones at the same z, so DOM order alone gets the shutter right.
              // The rule on top is the leading edge of that shutter.
              className="sticky border-t-2 border-void bg-acid"
            >
              {/* Fixed height, matching `--exp-row` exactly. `overflow-hidden`
                  is the guard: a long org name on a narrow screen would
                  otherwise push the bar taller than the pitch the offsets are
                  built from, and every card below it would sit wrong. */}
              <div className="flex h-[var(--exp-row)] flex-col justify-center gap-0.5 overflow-hidden md:flex-row md:items-baseline md:gap-4">
                <h3 className="font-display text-[clamp(1.35rem,5.4vw,3rem)] font-black leading-[1.04] tracking-[-0.035em]">
                  {item.role}
                </h3>
                <p className="font-display text-[clamp(0.8rem,3.2vw,1.5rem)] font-semibold leading-[1.1] tracking-[-0.01em] text-void/70">
                  {item.org}
                </p>
              </div>

              <div className="grid gap-3 pb-6 md:grid-cols-12 md:gap-8 md:pb-14">
                <p className="max-w-[62ch] font-mono text-[11px] font-medium leading-[1.55] md:col-span-8 md:text-[13px]">
                  {item.summary}
                </p>
                <p
                  className={`self-end md:col-span-4 md:text-right ${META_TYPE_BASE} text-void/55`}
                >
                  {item.period}
                </p>
              </div>
            </li>
          ))}

          {/* The lid. One more bar in the stack carrying nothing, whose only
              job is to close the last entry the way every entry before it was
              closed — by climbing over it. Without it the chapter ends with one
              card still hanging open, which reads as the stack having run out
              rather than having been shut.

              It parks one pitch below the last card, so it seals exactly the
              body it is covering, and it is tall enough to run off the bottom
              of any screen — that empty acid below the rules is the chapter's
              own full stop.

              The seal survives the exit for free. Cards release in order of
              `top + height`, so the lid — the largest of both — lifts first,
              and by the time the card underneath releases the lid has travelled
              exactly the height of that card's body. It closes the gap it opens
              at precisely the rate it opens it, so the body is never uncovered.

              `aria-hidden` because there is no fifth experience: this is the
              mechanism showing, not an entry. */}
          <li
            aria-hidden
            style={{
              top: `calc(var(--exp-head) + ${experiences.length} * (var(--exp-row) + 2px))`,
            }}
            className="sticky min-h-[62svh] border-t-2 border-void bg-acid"
          />
        </ul>

        <footer
          className={`flex flex-wrap justify-between gap-4 border-t-2 border-void py-6 text-void/55 md:py-8 ${META_TYPE_BASE}`}
        >
          <span>{experienceCopy.seamLeft}</span>
          <span>{experienceCopy.hint}</span>
        </footer>
      </div>
    </section>
  );
}
