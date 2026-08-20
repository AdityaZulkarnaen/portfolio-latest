import type { Metadata } from "next";
import Link from "next/link";
import BlueprintGrid from "@/components/works/blueprint-grid";
import WorkCard from "@/components/works/work-card";
import { works, worksCopy } from "@/components/works/works-copy";
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
export default function WorkIndexPage() {
  return (
    <main className="relative w-full overflow-hidden bg-void">
      <BlueprintGrid />

      <div className="relative mx-auto w-full max-w-[110rem] pb-28 pl-5 pr-5 pt-32 sm:pr-[var(--rail-gutter)] md:pb-40 md:pl-8 md:pt-40">
        <header className="mb-14 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 md:mb-20">
          <div className="space-y-4">
            <p className={`text-acid ${META_TYPE_BASE}`}>
              {worksCopy.indexEyebrow}
            </p>
            <h1 className="font-display text-[clamp(2.5rem,9vw,7rem)] font-black uppercase leading-[0.85] tracking-[-0.045em] text-ink">
              {worksCopy.indexHeading}
            </h1>
          </div>

          <Link
            href="/"
            className={`group flex items-center gap-3 text-ink transition-colors hover:text-acid ${META_TYPE_BASE}`}
          >
            <span
              aria-hidden
              className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
            />
            {worksCopy.indexBack}
          </Link>
        </header>

        <div className="grid grid-cols-12 gap-x-4 gap-y-12 md:gap-x-10 md:gap-y-20">
          {works.map((work, i) => (
            <WorkCard key={work.slug} work={work} index={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
