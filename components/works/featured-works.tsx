"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap, killScrollTriggersIn, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";
import { META_TYPE_BASE } from "@/lib/site-config";
import type { Work } from "@/lib/content/types";
import BlueprintGrid from "./blueprint-grid";
import WorkCard from "./work-card";
import SiteTexture from "@/components/site-texture";
import { worksCopy } from "./works-copy";

/** The line a tile lies flat on, as a fraction of viewport height. */
const SETTLE = 0.5;
/** How far below that line the curl reaches full, in viewport heights. */
const REACH = 0.55;

type FeaturedWorksProps = {
  /** Only the featured projects. The grid renders exactly what it is given. */
  works: Work[];
  /**
   * How many projects exist in total, featured or not. Shown beside the "ALL
   * WORKS" door, which would otherwise promise the same six tiles it sits next
   * to — the count is what makes the door worth opening.
   */
  total: number;
};

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
 *
 * The projects arrive as props rather than as an import. This component runs on
 * the client — it measures rects every frame — so it cannot read Sanity itself;
 * `app/(site)/page.tsx` does the fetching and hands the result down.
 */
export default function FeaturedWorks({ works, total }: FeaturedWorksProps) {
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

      /**
       * One read pass, then one write pass. The split is the whole point.
       *
       * Reading `getBoundingClientRect` forces the browser to flush layout;
       * writing `--peel` invalidates it again. Interleaved — read tile, write
       * tile, read tile, write tile — that is one forced synchronous layout
       * *per tile, per frame*, which is what a profiler reports as a long
       * forced reflow. Separating the phases means layout is computed once for
       * the whole grid and then nothing reads it again until the next frame, so
       * the cost stops scaling with the number of tiles.
       *
       * The arithmetic below is unchanged, and so is the reason for it: the
       * curl comes from where a tile actually is, not from a scrubbed range,
       * because the last row cannot reach the centre of a short viewport.
       */
      const peels = new Float64Array(cards.length);

      const apply = () => {
        const vh = window.innerHeight;

        for (let i = 0; i < cards.length; i++) {
          const rect = cards[i].getBoundingClientRect();
          const middle = rect.top + rect.height / 2;
          const peel = (middle - vh * SETTLE) / (vh * REACH);
          // Clamped at both ends: above the settle line a tile is simply flat,
          // and stays flat, rather than curling the other way as it leaves.
          peels[i] = Math.min(1, Math.max(0, peel));
        }

        for (let i = 0; i < cards.length; i++) {
          cards[i].style.setProperty("--peel", String(peels[i]));
        }
      };

      ScrollTrigger.create({
        // The grid, not each tile. N triggers firing N read/write pairs in one
        // batch was the thrash; one trigger driving one batched pass is the
        // same coverage — the range below is the union of every tile's — for a
        // single layout flush.
        trigger: rootRef.current,
        // The widest range the grid is on screen for. The curl itself is not
        // derived from this range — it only decides when to stop asking.
        start: "top bottom",
        end: "bottom top",
        onUpdate: apply,
        onRefresh: apply,
      });

      // A tile already past the settle line on load must start flat, and a tile
      // below the fold must start curled; neither gets an onUpdate until the
      // next scroll.
      apply();

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
      <SiteTexture className="text-acid opacity-[0.14]" />

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
                ({String(total).padStart(2, "0")})
              </span>
              <span
                aria-hidden
                className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
              />
            </Link>
          </div>
        </header>

        {/* Wrapped, not gridded. A twelve-column grid asks the editor to solve
            a packing problem every time a project is added — the widths only
            add up in one sequence, and one wrong number leaves a hole. Here the
            tiles simply take what they ask for and the line breaks where it
            runs out, so `position` is the only thing anyone has to decide.

            `items-start` keeps the ragged bottom: a phone tile stands taller
            than the desktop tile beside it, and nothing stretches to hide it. */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-12 md:gap-x-10 md:gap-y-20">
          {works.map((work, i) => (
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
