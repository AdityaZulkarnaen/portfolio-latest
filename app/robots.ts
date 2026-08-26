import type { MetadataRoute } from "next";

import { isIndexable, siteUrl } from "@/lib/seo";

/**
 * Served at /robots.txt.
 *
 * Two jobs, and the second is the one people forget: it says what not to crawl,
 * and it says where the sitemap is. A sitemap nothing points at is a sitemap
 * only found by being submitted by hand, which is fine until the day someone
 * forgets to.
 *
 * What is disallowed, and why each one:
 *
 *  - `/studio` is the CMS. It renders behind auth and is already `noindex`
 *    through `next-sanity`'s own metadata, but a crawler still has to fetch a
 *    page to learn that. Blocking the path saves it the trip and keeps the
 *    admin surface out of crawl logs.
 *  - `/api` has one route on it, the Sanity revalidation webhook. It answers
 *    POST only and there is nothing to index.
 *
 * Note what is *not* here: a `Disallow` on anything is a crawl instruction, not
 * an indexing one. A page blocked in robots.txt can still be indexed from
 * links elsewhere — with no snippet, because the crawler was never allowed to
 * read it. When a page must stay out of the index, `noindex` on the page is the
 * mechanism; this file is only about where the crawler spends its budget.
 *
 * On a preview deployment the whole thing flips to a blanket disallow. A
 * crawlable preview is a second copy of the site competing with the real one
 * for the same queries, and Google is under no obligation to prefer the one you
 * meant.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/studio", "/studio/", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
