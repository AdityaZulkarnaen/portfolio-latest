import type { Metadata } from "next";
import BackLink from "@/components/works/back-link";
import BlueprintGrid from "@/components/works/blueprint-grid";
import WorkCard from "@/components/works/work-card";
import { worksCopy } from "@/components/works/works-copy";
import { getWorks } from "@/lib/content/source";
import { META_TYPE_BASE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "All Works — Aditya Zulkarnaen",
  description:
    "The full index of projects — everything, not only the selection featured on the homepage.",
};

/**
 * The archive Chapter .04 is a selection from.
 *
 * Deliberately plain next to the homepage: no scroll rig, no curl, no pinning.
 * The tiles lie flat from the first paint because this is a place to scan a
 * list, and because it is a Server Component with no client bundle at all —
 * the whole page is the same `WorkCard` the chapter uses, minus the `peel`.
 */
export default async function WorkIndexPage() {
  const works = await getWorks();

  return (
    <main className="relative w-full overflow-hidden bg-void">
      <BlueprintGrid />

      <div className="relative mx-auto w-full max-w-[110rem] pb-28 pl-5 pr-5 pt-32 sm:pr-[var(--rail-gutter)] md:pb-40 md:pl-8 md:pt-40">
        {/* Above the heading rather than opposite it. Sat in the corner of a
            header this wide, the way out was the last thing on the page a
            thumb would find; the first line of the page is where someone looks
            for it. */}
        <BackLink href="/">{worksCopy.indexBack}</BackLink>

        <header className="mb-14 mt-10 space-y-4 md:mb-20 md:mt-14">
          <p className={`text-acid ${META_TYPE_BASE}`}>
            {worksCopy.indexEyebrow}
          </p>
          <h1 className="font-display text-[clamp(2.5rem,9vw,7rem)] font-black uppercase leading-[0.85] tracking-[-0.045em] text-ink">
            {worksCopy.indexHeading}
          </h1>
        </header>

        {/* Same wrapped row as Chapter .04 — see `featured-works.tsx`. */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-12 md:gap-x-10 md:gap-y-20">
          {works.map((work, i) => (
            <WorkCard key={work.slug} work={work} index={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
