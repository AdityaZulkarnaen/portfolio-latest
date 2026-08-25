import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlueprintGrid from "@/components/works/blueprint-grid";
import CoverPlaceholder from "@/components/works/cover-placeholder";
import WorkBody from "@/components/works/work-body";
import { worksCopy } from "@/components/works/works-copy";
import { getWorks } from "@/lib/content/source";
import { coverSrc } from "@/lib/sanity/image";
import { META_TYPE_BASE } from "@/lib/site-config";

/**
 * Every project is known at build time, so every case page is prerendered.
 *
 * A project added in the Studio afterwards is not in this list, and the page
 * for it is rendered on first request and then cached — the revalidation
 * webhook in `app/api/revalidate/route.ts` is what keeps the existing ones from
 * going stale.
 */
export async function generateStaticParams() {
  const works = await getWorks();
  return works.map((work) => ({ slug: work.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const works = await getWorks();
  const work = works.find((item) => item.slug === slug);
  if (!work) return {};

  return {
    title: `${work.name} — Aditya Zulkarnaen`,
    description: work.summary,
  };
}

export default async function WorkDetailPage({
  params,
}: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  // Shares `generateMetadata`'s round trip: `getWorks` is memoized per request.
  const works = await getWorks();
  const index = works.findIndex((item) => item.slug === slug);
  // Also the empty-dataset case — with nothing published there is no index to
  // find, and every case URL is legitimately a 404.
  if (index === -1) notFound();

  const work = works[index];
  const isMobileApp = work.device === "mobile";
  // Wraps, so the last project leads back to the first rather than dead-ending.
  const next = works[(index + 1) % works.length];

  return (
    <main className="relative w-full overflow-hidden bg-void">
      <BlueprintGrid />

      <div className="relative mx-auto w-full max-w-[110rem] pb-28 pl-5 pr-5 pt-32 sm:pr-[var(--rail-gutter)] md:pb-40 md:pl-8 md:pt-40">
        <Link
          href="/work"
          className={`group inline-flex items-center gap-3 text-muted transition-colors hover:text-acid ${META_TYPE_BASE}`}
        >
          <span
            aria-hidden
            className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
          />
          {worksCopy.backLabel}
        </Link>

        <header className="mt-10 md:mt-14">
          <div className={`flex flex-wrap items-center gap-3 ${META_TYPE_BASE}`}>
            <span className="bg-acid px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-void">
              {work.kind}
            </span>
            <span className="tabular-nums text-muted">{work.year}</span>
          </div>

          <h1 className="mt-6 font-display text-[clamp(2.5rem,9vw,7rem)] font-black uppercase leading-[0.85] tracking-[-0.045em] text-ink">
            {work.name}
          </h1>

          <p className="mt-6 max-w-[46ch] font-sans text-lg leading-relaxed text-ink/75">
            {work.summary}
          </p>
        </header>

        {/* The lead keeps the same 16/9 stage whatever the project runs on, so
            the page's rhythm does not depend on the content. What changes is
            what stands on it: a desktop project fills the frame edge to edge, a
            mobile one stands its phone at the height of the stage and lets the
            ground show either side. Stretching a 9/19.5 screenshot across 16/9
            would crop away everything but a band across the middle of the app —
            and a full-width phone frame would be three thousand pixels tall. */}
        <figure
          className={`relative mt-12 aspect-[16/9] w-full overflow-hidden ring-1 ring-ink/[0.08] md:mt-16 ${
            isMobileApp
              ? "flex items-center justify-center bg-[#101014] px-5"
              : ""
          }`}
        >
          <div
            className={
              isMobileApp
                ? "relative h-[86%] max-w-full overflow-hidden rounded-[1.25rem] ring-1 ring-ink/[0.12] aspect-[9/19.5]"
                : "absolute inset-0"
            }
          >
            {work.cover ? (
              <Image
                // The same hotspot, cut to whichever frame it is going into.
                src={coverSrc(work.cover, isMobileApp ? "mobile" : "hero")}
                alt={work.cover.alt}
                fill
                sizes={
                  isMobileApp
                    ? "(min-width: 1024px) 22vw, 40vw"
                    : "(min-width: 1024px) 90vw, 100vw"
                }
                priority
                {...(work.cover.lqip
                  ? ({ placeholder: "blur", blurDataURL: work.cover.lqip } as const)
                  : {})}
                className="object-cover"
              />
            ) : (
              <CoverPlaceholder n={index + 1} />
            )}
          </div>
        </figure>

        <div className="mt-14 grid gap-12 md:mt-20 md:grid-cols-12 md:gap-8">
          <dl className={`space-y-8 md:col-span-4 ${META_TYPE_BASE}`}>
            <div>
              <dt className="text-muted">{worksCopy.yearLabel}</dt>
              <dd className="mt-2 tabular-nums text-ink">{work.year}</dd>
            </div>
            <div>
              <dt className="text-muted">{worksCopy.roleLabel}</dt>
              <dd className="mt-2 text-ink">{work.role}</dd>
            </div>
            <div>
              <dt className="text-muted">{worksCopy.stackLabel}</dt>
              <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-ink">
                {work.stack.map((item) => (
                  <span key={item} className="border border-ink/15 px-2 py-1">
                    {item}
                  </span>
                ))}
              </dd>
            </div>

            {work.live || work.repo ? (
              <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
                {work.live ? (
                  <a
                    href={work.live}
                    target="_blank"
                    rel="noreferrer"
                    className="text-acid transition-opacity hover:opacity-70"
                  >
                    {worksCopy.liveLabel} &#8599;
                  </a>
                ) : null}
                {work.repo ? (
                  <a
                    href={work.repo}
                    target="_blank"
                    rel="noreferrer"
                    className="text-acid transition-opacity hover:opacity-70"
                  >
                    {worksCopy.repoLabel} &#8599;
                  </a>
                ) : null}
              </div>
            ) : null}
          </dl>

          <div className="md:col-span-7 md:col-start-6">
            <WorkBody value={work.body} />
          </div>
        </div>

        <Link
          href={`/work/${next.slug}`}
          className="group mt-24 flex flex-wrap items-end justify-between gap-6 border-t border-ink/15 pt-8 md:mt-32"
        >
          <div>
            <p className={`text-muted ${META_TYPE_BASE}`}>
              {worksCopy.nextLabel}
            </p>
            <p className="mt-3 font-display text-[clamp(1.75rem,5vw,3.5rem)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink transition-colors group-hover:text-acid">
              {next.name}
            </p>
          </div>
          <span
            aria-hidden
            className="block h-px w-16 bg-ink transition-all duration-500 group-hover:w-24 group-hover:bg-acid"
          />
        </Link>
      </div>
    </main>
  );
}
