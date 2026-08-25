"use client";

import { useEffect, useRef } from "react";
import { gsap, killScrollTriggersIn, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";
import { META_TYPE_BASE } from "@/lib/site-config";
import type { Experience as ExperienceEntry } from "@/lib/content/types";
import { experienceCopy } from "./experience-copy";

/** Slabs the chapter reaches up with, matching Chapter .02's takeover. */
const SLATS = 4;

type ExperienceProps = {
  /**
   * Oldest first. The order is the mechanism, not a preference: each card is
   * closed under the next one, so the last entry is the one left open at the
   * end of the chapter. `position` in the Studio is what fixes it.
   */
  experiences: ExperienceEntry[];
};

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
 *
 * The entries arrive as props: this is a client component, so the fetch happens
 * in `app/(site)/page.tsx` and the result is handed down.
 */
export default function Experience({ experiences }: ExperienceProps) {
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

  // The budget, enforced.
  //
  // The stack's parking lines assume the deepest card still has a screen's
  // worth of room under it. Add entries, or give one a long summary, and that
  // assumption goes quietly: a parked card cannot be scrolled up to, it is
  // holding still by definition, so whatever sits past the fold when the lid
  // closes over it is never readable at all. It depends on the copy in the CMS,
  // so the only way to know is to measure.
  //
  // What has to give is the line the stack parks on, and it has to give *while
  // you scroll*. Sticky offsets alone cannot do this: a bar that has parked is
  // at its final position by definition, so no static arrangement of offsets
  // can let the bars above a deep card sit at full pitch early on and be gone
  // by the time that card arrives. Lifting only the overrunning card is what
  // the first attempt did, and it is wrong — the card climbs partway over the
  // bar above and stops mid-glyph.
  //
  // So the correction is one number, `--exp-lift`, subtracted from every
  // parking line at once, and scrubbed from 0 to its full value as the first
  // card that would overrun rises into view. The stack keeps its pitch and
  // travels up as a body; the earliest bars run off the top, which is the room
  // being made. Every card that parks before that window still parks on its
  // ideal line, so no bar is ever lifted out of sight while its own body is the
  // one being read.
  //
  // Each card asks for what it overruns by, capped at the distance to the first
  // card's line — nothing is ever lifted so far that its own bar goes behind
  // the pinned roof — and the largest request wins. On a viewport with room to
  // spare every request is zero, the trigger never fires, and the layout is the
  // sticky offsets untouched.
  //
  // Not gated on reduced motion, and it has no trigger element inside the
  // section so the reduced-motion branch below cannot sweep it up. This is not
  // decoration: it is scroll-linked layout, exactly like the sticky stack that
  // those visitors already get, and switching it off would only hand them the
  // truncated card.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const cards = Array.from(
      root.querySelectorAll<HTMLLIElement>("[data-exp-card]"),
    );
    if (cards.length === 0) return;

    let lift = 0;
    let from = 0;
    let to = 1;

    // Layout position, not painted position. `getBoundingClientRect` reports
    // where a sticky card has been shifted to, which is precisely the number
    // that must not be used here — half these cards are parked at any moment.
    // `offsetTop` up the chain is unaffected by sticky.
    const flowTop = (el: HTMLElement) => {
      let y = 0;
      let node: HTMLElement | null = el;
      while (node) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return y;
    };

    const measure = () => {
      const viewport = window.innerHeight;

      // Read the ideal lines with the correction switched off. They are
      // `--exp-head` and `--exp-row`, which four media queries have a say in
      // between them; a second copy of that arithmetic here is the sort of
      // thing that drifts from the stylesheet and is never noticed.
      root.style.setProperty("--exp-lift", "0px");
      const floor = parseFloat(getComputedStyle(cards[0]).top);
      lift = 0;
      if (!Number.isFinite(floor)) return;

      let first: HTMLElement | null = null;
      let firstLine = 0;

      for (const card of cards) {
        const line = parseFloat(getComputedStyle(card).top);
        // `offsetHeight` is the card wide open: sticky changes where a box is
        // painted, never how tall it is, so this holds whether the card is
        // parked, rising, or still below the fold.
        const overrun = line + card.offsetHeight - viewport;
        if (overrun <= 0) continue;
        lift = Math.max(lift, Math.min(overrun, line - floor));
        if (!first) {
          first = card;
          firstLine = line;
        }
      }

      lift = Math.max(0, Math.round(lift));
      if (!first) return;

      // The window: from the moment that card's bar clears the bottom edge to
      // the moment it reaches its own parking line. By the time it stops, the
      // room it needs has been made.
      const top = flowTop(first);
      from = top - viewport;
      to = Math.max(from + 1, top - firstLine);
    };

    const apply = (progress: number) =>
      root.style.setProperty("--exp-lift", `${lift * progress}px`);

    measure();

    // Re-measured on every refresh, which is what carries a resize, the `md`
    // reflow and the font swap — all three change a card's height or its line.
    ScrollTrigger.addEventListener("refreshInit", measure);
    const uplift = ScrollTrigger.create({
      // Deliberately outside the section: `killScrollTriggersIn` walks by
      // trigger element, and this one must survive it. The start and end are
      // absolute scroll positions, so the element is only a formality.
      trigger: document.documentElement,
      start: () => from,
      end: () => to,
      onUpdate: (self) => apply(self.progress),
      onRefresh: (self) => apply(self.progress),
    });
    apply(uplift.progress);

    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});

    return () => {
      ScrollTrigger.removeEventListener("refreshInit", measure);
      uplift.kill();
      root.style.removeProperty("--exp-lift");
    };
  }, [experiences]);

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
      // `--exp-head` is where the stack parks, and the chapter lives or dies
      // on one budget:
      //
      //     head + (n-1) * pitch + row + 2 + tallest body  <=  viewport height
      //
      // It is a hard constraint, not a preference. A parked card cannot be
      // scrolled up to — it is holding still by definition — and the lid closes
      // over it where it stands, so anything past the fold at that moment is
      // never readable at all. Measured against the real GDGoC summary the old
      // numbers overran a 1280x700 laptop by 135px.
      //
      // These values are the ideal, not the last word: the budget cannot be
      // satisfied by constants once `n` and the summaries come from the CMS, so
      // the uplift effect above measures it and scrubs the whole stack up by
      // whatever the deepest card overruns by. `--exp-lift` is that correction,
      // and it is 0px wherever these numbers already fit.
      //
      // Note which axis that is. The bar's layout is a width question and stays
      // on `md`; the budget is a height question and is gated on height. Those
      // are not the same breakpoint and treating them as one is what broke it:
      // a wide, short laptop got the tall layout.
      //
      // Above 780px of viewport the roof is affordable and the heading stays
      // pinned over the stack. Below it the roof is spent: the heading scrolls
      // away like any other heading and the bars park directly under the nav,
      // which buys back its whole height.
      //
      // `--exp-roof` is what the ResizeObserver writes; `--exp-head` only reads
      // it where the roof is pinned, and the value here is the fallback for the
      // frame before JS runs.
      className="relative z-[36] w-full bg-acid text-void [--exp-head:4.5rem] [--exp-roof:13rem] [--exp-row:4.5rem] md:[--exp-row:clamp(4.5rem,5.4vw,5.5rem)] [@media(min-height:780px)]:[--exp-head:var(--exp-roof)]"
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
        {/* The roof. On a viewport tall enough to afford it (see the budget on
            the section) it pins at the very top, so the heading is still there
            when the last card lands, and z-10 keeps the cards passing behind it
            rather than over it once the stack peels away at the foot of the
            chapter. The top padding is the fixed nav's clearance, and it is
            inside the measured box on purpose — the cards stack under the whole
            band, not under the heading alone.

            Under 780px it is neither pinned nor raised: it scrolls away like an
            ordinary heading and the bars pass over it. A heading that has
            already been read is the cheapest 200px on the screen, and the last
            card needs them. */}
        <div
          ref={headRef}
          className="bg-acid pb-5 pt-[5.5rem] [@media(min-height:780px)]:sticky [@media(min-height:780px)]:top-0 [@media(min-height:780px)]:z-10"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
            <div className="overflow-hidden">
              <h2
                data-exp-rise
                className="max-w-[20ch] font-display text-[clamp(1.5rem,4vw,3rem)] font-black leading-[1.02] tracking-[-0.035em]"
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
              data-exp-card
              // `--exp-lift` is inherited from the section and is the same
              // number for every card, so subtracting it moves the stack
              // without touching its pitch. 0px wherever the ideal lines
              // already leave the deepest body on screen.
              style={{
                top: `calc(var(--exp-head) + ${i} * (var(--exp-row) + 2px) - var(--exp-lift, 0px))`,
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

              <div className="grid gap-3 pb-6 md:grid-cols-12 md:gap-8 md:pb-10">
                {/* 62ch was costing eight lines of the longest summary on a
                    screen with room for four. 88ch is still inside the readable
                    band and takes two of them back — two lines here are worth
                    more than they look, because they come straight off the
                    budget the parked card is measured against. */}
                <p className="max-w-[88ch] font-mono text-[11px] font-medium leading-[1.55] md:col-span-8 md:text-[13px]">
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
              of any screen — that acid below the rule is the chapter's own full
              stop.

              It carries the chapter's seam, which used to be a strip of its own
              under the list. A bar whose only content is the fact that it is a
              bar reads as the stack having run out of entries; the same bar
              saying which chapter has just closed, and what closed it, reads as
              the chapter signing off. It is the same row, in the one place on
              the page where it is doing something.

              The seal survives the exit for free. Cards release in order of
              `top + height`, so the lid — the largest of both — lifts first,
              and by the time the card underneath releases the lid has travelled
              exactly the height of that card's body. It closes the gap it opens
              at precisely the rate it opens it, so the body is never uncovered.

              `aria-hidden` because nothing in here is an entry, the seam
              included. The chapter mark is already announced by the rail, and
              "scroll to close the stack" is an instruction about a movement
              that a screen reader has no stack to close. */}
          <li
            aria-hidden
            // Same `--exp-lift` as the cards, which is what keeps the seal
            // exact: the lid is defined as one pitch below the last card, and
            // moving both by the same number preserves that gap.
            style={{
              top: `calc(var(--exp-head) + ${experiences.length} * (var(--exp-row) + 2px) - var(--exp-lift, 0px))`,
            }}
            className="sticky min-h-[62svh] border-t-2 border-void bg-acid"
          >
            <div
              className={`flex flex-wrap justify-between gap-4 py-6 text-void/55 md:py-8 ${META_TYPE_BASE}`}
            >
              <span>{experienceCopy.seamLeft}</span>
              <span>{experienceCopy.hint}</span>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
