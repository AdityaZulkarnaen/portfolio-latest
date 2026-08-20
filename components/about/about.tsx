"use client";

import { useEffect, useRef } from "react";
import { gsap, killScrollTriggersIn, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";
import { META_TYPE_BASE } from "@/lib/site-config";
import { aboutCopy } from "./about-copy";
import PhotoDeck from "./photo-deck";
import RoleMarquee from "./role-marquee";

/** Slabs the panel reaches up with. */
const SLATS = 3;

/** A token carries no visible glyph if it is only whitespace or format marks. */
const VISIBLE = /[^\s\p{Cf}]/u;

type BioToken = { word: string; hi: boolean; glue: boolean };

/**
 * Splits a bio paragraph into words, carrying the key-phrase flag through.
 *
 * `*` toggles: the odd segments of the split are the marked phrases. Splitting
 * on the marker first and on whitespace second is what lets a multi-word phrase
 * stay per-word — the scroll sweeps still animate one word at a time, they just
 * also know which words wear the swipe.
 *
 * `glue` is what keeps the marker invisible in the output. A marker can sit
 * between two characters that were never separated by a space, and splitting on
 * it would otherwise invent one: `*Gadjah Mada*,` comes back as `Mada` and `,`
 * as separate tokens, rendering "Mada ,".
 *
 * Whether a space belongs there has to be judged from both sides of the seam.
 * The whitespace in `at *Universitas` lives at the end of the segment before
 * the marker, not at the start of the marked one — so testing only the leading
 * edge welds those into "atUniversitas" instead. A boundary is real if either
 * side carries whitespace, which is why the trailing edge is carried forward.
 */
function splitBio(paragraph: string): BioToken[] {
  const tokens: BioToken[] = [];
  let spaceBefore = true;

  paragraph.split("*").forEach((segment, i) => {
    const words = segment.split(/\s+/).filter(Boolean);

    if (!words.length) {
      // A segment of pure whitespace still separates; an empty one does not.
      if (segment.length) spaceBefore = true;
      return;
    }

    if (tokens.length && !spaceBefore && !/^\s/.test(segment)) {
      tokens[tokens.length - 1].glue = true;
    }
    for (const word of words) {
      tokens.push({ word, hi: i % 2 === 1, glue: false });
    }
    spaceBefore = /\s$/.test(segment);
  });

  return tokens;
}

/**
 * Chapter .02 — the slab that closes over the hero.
 *
 * The transition is structural rather than animated: the hero is a sticky
 * frame inside a 200svh wrapper, so this panel — positioned, opaque and one
 * layer up — simply scrolls over the top of it and seals it shut. Nothing to
 * scrub, nothing to keep in sync, and it behaves identically on a trackpad
 * fling, a keyboard PageDown and with JS disabled.
 */
export default function About() {
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // The seam + marquee band is the only thing pinned above the aside, so its
  // real height decides where the aside starts and how tall it may be. Measure
  // it instead of guessing: the marquee is clamp-sized and wraps differently
  // on every viewport.
  useEffect(() => {
    const head = headRef.current;
    const root = rootRef.current;
    if (!head || !root) return;

    const sync = () =>
      root.style.setProperty("--about-head", `${head.offsetHeight}px`);
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(head);
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      const rises = gsap.utils.toArray<HTMLElement>("[data-rise]");
      const bios = gsap.utils.toArray<HTMLElement>("[data-bio]");

      if (reducedMotion) {
        killScrollTriggersIn(rootRef.current);
        gsap.set(rises, { yPercent: 0, opacity: 1 });
        gsap.set("[data-word], [data-word-ink]", { opacity: 1 });
        gsap.set("[data-slat]", { scaleY: 0 });
        return;
      }

      gsap.fromTo(
        rises,
        { yPercent: 105, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 68%" },
        },
      );

      // The takeover. The slabs are pinned to the outside of the panel's top
      // edge, so they travel with it: as the panel climbs into the hero's
      // frame it reaches up with stacked bands of its own ground colour,
      // filling from the bottom of the stack upward. The hero is never
      // "covered by a curtain" — the section simply takes the space, and the
      // slabs are what that looks like at the leading edge.
      const veil = document.querySelector<HTMLElement>("[data-hero-veil]");
      const takeover = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          // From the panel's top touching the foot of the screen to it sitting
          // near the head of it: the stack finishes while it is still on
          // screen, then scrolls away above the panel.
          start: "top bottom",
          end: "top 25%",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      takeover.fromTo(
        "[data-slat]",
        { scaleY: 0 },
        {
          // Past 1 so neighbouring slabs overlap by a hair — at 1 exactly,
          // sub-pixel rounding leaves the hero showing through as seams.
          scaleY: 1.02,
          ease: "none",
          // Only a little over the stagger step: with three slabs the overlap
          // has to be tight, or they read as one block moving rather than a
          // stack building.
          duration: 1.6,
          stagger: { each: 1, from: "end" },
        },
        0,
      );

      if (veil) {
        // Whatever hero is still visible between the slabs sinks back as the
        // gaps close, so the two chapters never sit at the same depth.
        takeover.fromTo(veil, { opacity: 0 }, { opacity: 0.35, ease: "none" }, 0);
      }

      // The bio is read, not performed: nothing slides in from off-screen.
      // Each word simply lifts out of the ground colour as the scroll passes
      // it, so the live edge is a soft transparent band travelling down the
      // block — and because it is scrubbed, scrolling back up puts the words
      // away again exactly as they came.
      //
      // Two sweeps, on two nested spans. They have to be separate elements:
      // one opacity cannot be driven by two scrubbed timelines at once, and
      // nesting lets the browser multiply them instead — a word can be half
      // arrived and half gone without either sweep knowing about the other.
      bios.forEach((bio) => {
        const words = bio.querySelectorAll("[data-word]");
        const ink = bio.querySelectorAll("[data-word-ink]");
        if (!ink.length) return;

        gsap.fromTo(
          ink,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "none",
            // Duration well past the stagger step, so ~6 words are mid-fade at
            // any moment: the edge is a gradient of words, not a hard cursor.
            duration: 6,
            stagger: { each: 1, from: "start" },
            scrollTrigger: {
              trigger: bio,
              start: "top 88%",
              end: "bottom 90%",
              scrub: 0.4,
            },
          },
        );

        // The way out. The range is the block travelling its own height past
        // one line, so each word fades roughly as it personally crosses that
        // line — the block dissolves from the first line down rather than
        // dimming as one slab.
        //
        // The line is the foot of the panel's own sticky head, not the top of
        // the viewport. Anchored to the viewport the dissolve is real but
        // invisible: the seam and marquee cover the top ~22% of a phone screen,
        // so every word had already slid under the band before it began to go.
        // Measured rather than guessed, because the marquee is clamp-sized and
        // wraps differently on every viewport — same reason `--about-head`
        // exists.
        const exitLine = () =>
          (headRef.current?.offsetHeight ?? 0) + window.innerHeight * 0.06;

        gsap.fromTo(
          words,
          { opacity: 1 },
          {
            opacity: 0,
            ease: "none",
            duration: 6,
            stagger: { each: 1, from: "start" },
            scrollTrigger: {
              trigger: bio,
              start: () => `top ${exitLine()}px`,
              end: () => `bottom ${exitLine()}px`,
              scrub: 0.4,
              invalidateOnRefresh: true,
            },
          },
        );
      });
    },
    { scope: rootRef, dependencies: [reducedMotion] },
  );

  return (
    <section
      ref={rootRef}
      id="about"
      data-chapter=".02"
      data-chapter-name="About"
      className="relative z-20 [--about-head:9rem] bg-[#71737D] text-void"
    >
      {/* Sits directly on the outside of the panel's top edge (`bottom-full`)
          and moves with it — the section's own reach into the space above. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full flex h-[55svh] flex-col"
      >
        {Array.from({ length: SLATS }, (_, i) => (
          <span
            key={i}
            data-slat
            className="w-full flex-1 origin-bottom scale-y-0 bg-[#71737D] will-change-transform"
          />
        ))}
      </div>

      {/* No `overflow-hidden` here — it would break the sticky children. */}
      <div className="relative">
        {/* Seam + marquee, pinned to the very top of the viewport. */}
        <div ref={headRef} className="sticky top-0 z-30 bg-[#71737D] pb-2">
          <div
            className={`flex items-center justify-between px-5 py-3 md:px-8 ${META_TYPE_BASE} text-void/55`}
          >
            <span>{aboutCopy.seamLeft}</span>
            <span className="flex items-center gap-2">
              {/* <span className="size-1.5 rounded-full bg-void/60" />
              {aboutCopy.seamRight} */}
            </span>
          </div>

          <RoleMarquee />
        </div>

        {/* The marquee is decorative; this is what a screen reader gets. */}
        <h2 className="sr-only">
          {aboutCopy.chapter} — {aboutCopy.roles.join(", ")}
        </h2>

        {/* The tall mobile bottom padding is the landing strip for Chapter
            .03's curtain: below `md` the aside flows after the bio instead of
            pinning, so without a tail the void slats reach up into the photo
            deck. Keep it at least as tall as that band.

            The right padding is the chapter rail's gutter. This is the one
            chapter whose content runs the full height of the right edge — the
            hero and Chapter .03 keep their furniture along the top and bottom,
            which the rail is centred to clear — so it is the only one that has
            to step aside for it. Left and right are set separately so the
            gutter is never overridden by a shorthand at a wider breakpoint. */}
        <div className="mx-auto w-full max-w-[110rem] pb-[38svh] pl-5 pr-5 pt-4 sm:pr-[var(--rail-gutter)] md:pb-20 md:pl-8 md:pt-20">
          <div className="grid gap-14 md:grid-cols-12 md:gap-10">
            {/* Left column: the only thing that actually travels. */}
            <div className="md:col-span-7 lg:col-span-6">
              {/* <div className="overflow-hidden">
                <h3
                  data-rise
                  className="whitespace-nowrap text-start font-display text-[min(6.4vw,2.4rem)] font-black leading-[1.05] tracking-[-0.03em] md:text-[min(3vw,3.4rem)]"
                >
                  {aboutCopy.name}
                </h3>
              </div> */}

              <div className="mt-0 space-y-5 md:mt-2">
                <div className="shrink-0 overflow-hidden block md:hidden">
                <p
                  data-rise
                  className={`${META_TYPE_BASE} text-void md:text-right`}
                >
                  {aboutCopy.eyebrow}
                  <br />
                  <span className="text-void/55">{aboutCopy.chapter}</span>
                </p>
              </div>
                {aboutCopy.bio.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 24)}
                    data-bio
                    className="max-w-[160ch] text-start font-mono font-semibold text-[32px] leading-[1] text-void md:text-[52px]"
                  >
                    {/* Split in the markup, not at runtime: the full sentence
                        still ships in the HTML, and the spans stay inline so
                        wrapping and word spacing are untouched.

                        Tokens carrying no visible glyph are emitted inert. The
                        first paragraph is indented with a run of U+200E marks,
                        and `split` turns those into a dozen zero-width "words":
                        wrapped, they spend the opening third of both sweeps
                        animating nothing, which pushes the live edge of the
                        exit dissolve up behind the sticky marquee where no one
                        can see it. */}
                    {splitBio(paragraph).map((token, i, all) => {
                      if (!VISIBLE.test(token.word)) {
                        return <span key={`mark-${i}`}>{token.word} </span>;
                      }
                      // When the next word continues the phrase, the space
                      // goes inside the swipe. Left outside, every word gets
                      // its own bar and the phrase reads as separate stripes
                      // instead of one stroke.
                      const joins = !token.glue && token.hi && all[i + 1]?.hi === true;
                      const space = token.glue ? "" : " ";
                      // Where this word sits in its phrase, so the chip is
                      // only inset at the two outer edges.
                      const opens = token.hi && !all[i - 1]?.hi;
                      const closes = token.hi && !all[i + 1]?.hi;
                      const place = !token.hi
                        ? undefined
                        : opens && closes
                          ? "only"
                          : opens
                            ? "start"
                            : closes
                              ? "end"
                              : "mid";
                      return (
                        <span key={`${token.word}-${i}`} data-word>
                          <span
                            data-word-ink
                            data-hi={place}
                            className="opacity-0"
                          >
                            {token.word}
                            {joins ? space : ""}
                          </span>
                          {joins ? "" : space}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            </div>

            {/*
              Right column: pinned directly under the marquee and boxed to
              exactly the leftover viewport height, so the aside itself never
              scrolls and the band above it can never push the pair past one
              screen. Everything inside sizes off that height.
            */}
            {/*
              Below `md` the column simply flows: the deck is width-driven and
              capped, because a pinned full-height aside in a stacked layout is
              just a screen of photo between two screens of text.
              From `md` up it pins under the marquee and is boxed to exactly the
              leftover viewport height, so the aside never scrolls and the band
              above it can never push the pair past one screen.
            */}
            <aside className="z-10 flex min-h-0 flex-col items-stretch gap-4 overflow-hidden pt-2 pr-3 pb-3 md:sticky md:top-[var(--about-head)] md:col-span-5 md:col-start-8 md:h-[calc(100svh-var(--about-head))] md:self-start">
              <div className="shrink-0 overflow-hidden hidden md:block">
                <p
                  data-rise
                  className={`${META_TYPE_BASE} text-void md:text-right`}
                >
                  {aboutCopy.eyebrow}
                  <br />
                  <span className="text-void/55">{aboutCopy.chapter}</span>
                </p>
              </div>

              <div className="w-full md:ml-auto md:min-h-0 md:flex-1">
                <PhotoDeck />
              </div>

              <a
                href={aboutCopy.resumeHref}
                className={`group relative inline-flex shrink-0 items-center gap-2 self-start overflow-hidden bg-acid px-4 py-2 md:self-end ${META_TYPE_BASE} text-void`}
              >
                {/* Fill sweep on hover — the acid stays, the ground inverts. */}
                <span
                  aria-hidden
                  className="absolute inset-0 origin-left scale-x-0 bg-void transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                />
                <span className="relative transition-colors duration-300 group-hover:text-acid">
                  {aboutCopy.resume} &gt;
                </span>
              </a>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
