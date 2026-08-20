"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap, killScrollTriggersIn, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";
import { META_TYPE_BASE } from "@/lib/site-config";
import BlueprintGrid from "./blueprint-grid";
import WorkCard from "./work-card";
import { featuredWorks, worksCopy, works } from "./works-copy";

/** The line a tile lies flat on, as a fraction of viewport height. */
const SETTLE = 0.5;
/** How far below that line the curl reaches full, in viewport heights. */
const REACH = 0.55;

/**
 * Chapter .04 — the selected work.
 *
 * The tiles are notes stuck to the board: glued along the top edge, curling
 * away at the bottom, flattening into plain rectangles as the scroll brings
 * them level with the middle of the frame.
 *
 * Unlike the three chapters before it, nothing here is pinned or scrubbed
 * across a range. Each tile's curl is computed from where it actually is —
 * the distance from its own middle to the settle line — rather than from a
 * `start`/`end` pair. That is not a stylistic preference: a scrubbed range has
 * to be reachable, and the tiles in the last row cannot reach "centre centre"
 * on a short viewport, so they would hang half-curled forever with no way to
 * finish. Measuring the real position has no such failure mode, costs one
 * rect read per tile per frame, and behaves identically in both directions.
 */
export default function FeaturedWorks() {
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-peel]");
      const rises = gsap.utils.toArray<HTMLElement>("[data-works-rise]");

      if (reducedMotion) {
        killScrollTriggersIn(rootRef.current);
        cards.forEach((card) => card.style.setProperty("--peel", "0"));
        gsap.set(rises, { yPercent: 0, opacity: 1 });
        return;
      }

      const apply = (card: HTMLElement) => {
        const rect = card.getBoundingClientRect();
        const vh = window.innerHeight;
        const middle = rect.top + rect.height / 2;
        const peel = (middle - vh * SETTLE) / (vh * REACH);
        // Clamped at both ends: above the settle line a tile is simply flat,
        // and stays flat, rather than curling the other way as it leaves.
        card.style.setProperty("--peel", String(Math.min(1, Math.max(0, peel))));
      };

      cards.forEach((card) => {
        ScrollTrigger.create({
          trigger: card,
          // The widest range the tile is on screen for. The curl itself is not
          // derived from this range — it only decides when to stop asking.
          start: "top bottom",
          end: "bottom top",
          onUpdate: () => apply(card),
          onRefresh: () => apply(card),
        });
        // A tile already past the settle line on load must start flat, and a
        // tile below the fold must start curled; neither gets an onUpdate
        // until the next scroll.
        apply(card);
      });

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
      id="work"
      data-chapter=".04"
      data-chapter-name="Works"
      // Above Chapter .03's wrapper (z-30) but below the fixed nav (z-40), so
      // the chapter can never be painted under the tunnel it follows and can
      // never climb over the nav.
      className="relative z-[35] w-full overflow-hidden bg-void"
    >
      {/* <BlueprintGrid /> */}

      <div className="relative mx-auto w-full max-w-[110rem] pb-28 pl-5 pr-5 pt-24 sm:pr-[var(--rail-gutter)] md:pb-40 md:pl-8 md:pt-32">
        <header className="mb-14 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 md:mb-20">
          <div className="space-y-4">
            <div className="overflow-hidden">
              <p data-works-rise className={`text-acid ${META_TYPE_BASE}`}>
                {worksCopy.eyebrow}
              </p>
            </div>
            <div className="overflow-hidden">
              <h2
                data-works-rise
                className="font-display text-[clamp(2.5rem,9vw,7rem)] font-black uppercase leading-[0.85] tracking-[-0.045em] text-ink"
              >
                {worksCopy.heading}
              </h2>
            </div>
          </div>

          <div className="overflow-hidden">
            <Link
              data-works-rise
              href={worksCopy.allHref}
              className={`group flex items-center gap-3 text-ink transition-colors hover:text-acid ${META_TYPE_BASE}`}
            >
              {worksCopy.allLabel}
              <span className="tabular-nums text-muted">
                ({String(works.length).padStart(2, "0")})
              </span>
              <span
                aria-hidden
                className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
              />
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-x-4 gap-y-12 md:gap-x-10 md:gap-y-20">
          {featuredWorks.map((work, i) => (
            <WorkCard key={work.slug} work={work} index={i} peel />
          ))}
        </div>

        <footer
          className={`mt-16 flex flex-wrap justify-between gap-4 text-muted md:mt-24 ${META_TYPE_BASE}`}
        >
          <span>{worksCopy.seamLeft}</span>
          <span>{worksCopy.hint}</span>
        </footer>
      </div>
    </section>
  );
}
