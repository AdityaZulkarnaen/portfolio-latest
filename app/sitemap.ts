import type { MetadataRoute } from "next";

import { getWorks } from "@/lib/content/source";
import { absolute } from "@/lib/seo";

/**
 * Served at /sitemap.xml, built from the same content the pages are.
 *
 * Not a hand-written list, and that is the whole point: a project added in the
 * Studio appears here on the next revalidation without anyone remembering to
 * add it. A sitemap that has to be maintained by hand is a sitemap that is
 * wrong within a month, and a sitemap listing URLs that 404 is worse than none
 * — it is the first thing Search Console complains about.
 *
 * `lastModified` comes from each document's own `_updatedAt`, never from the
 * build clock. Build time would mark every page as changed on every deploy;
 * a crawler that is told everything changed and finds nothing did learns to
 * ignore the field, and then it is worth nothing on the day something really
 * did change. The two static pages have no document behind them, so they carry
 * the newest project's date — the honest answer to "when did this last
 * change", since both are indexes of exactly that content.
 *
 * `priority` is deliberately sparse. Google has said for years that it ignores
 * the field; it is here only as a relative hint for the crawlers that still
 * read it, and it is not worth tuning.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const works = await getWorks();

  const stamps = works
    .map((work) => work.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const newest = stamps.length ? new Date(stamps[stamps.length - 1]) : new Date();

  return [
    {
      url: absolute("/"),
      lastModified: newest,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: absolute("/work"),
      lastModified: newest,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...works.map((work) => ({
      url: absolute(`/work/${work.slug}`),
      lastModified: work.updatedAt ? new Date(work.updatedAt) : newest,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
