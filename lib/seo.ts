import "server-only";

import type { Metadata } from "next";

import { footerConfig } from "@/lib/site-config";
import type { About, Work } from "@/lib/content/types";

/**
 * Everything that needs to know where this site actually lives.
 *
 * One absolute origin, resolved once. Canonical links, `metadataBase`, the
 * sitemap, the robots file and every JSON-LD `@id` all have to agree on it —
 * and they have to be *absolute*, because a canonical or an Open Graph image
 * given as a path is resolved against whatever host served the page. On a
 * preview deployment that quietly tells Google the preview is the canonical
 * copy of the site.
 *
 * `server-only` because of how the fallbacks below work: `VERCEL_PROJECT_
 * PRODUCTION_URL` is not a `NEXT_PUBLIC_` variable, so in a browser bundle it
 * is replaced with `undefined` and the origin silently collapses to localhost.
 * Nothing here is needed on the client — metadata, the sitemap, the robots file
 * and the JSON-LD blocks are all rendered on the server — so the import
 * boundary is what keeps that from ever happening.
 */

/**
 * The site's origin, without a trailing slash.
 *
 * Three sources, in the order they can be trusted:
 *
 *  1. `NEXT_PUBLIC_SITE_URL` — set this in production. It is the only one that
 *     survives a custom domain, and the only one that is right when the site is
 *     served from somewhere other than the platform's own hostname.
 *  2. Vercel's production hostname, so a deployment with nothing configured
 *     still emits correct absolute URLs rather than localhost ones.
 *  3. localhost, for `next dev` and for a build on a machine with neither.
 *
 * Note which Vercel variable this is *not*: `VERCEL_URL` is the per-deployment
 * hostname, different on every push, and using it would make the canonical URL
 * of a page change every time the site is deployed.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

/** An absolute URL for a root-relative path. */
export const absolute = (path: string) =>
  new URL(path, `${siteUrl}/`).toString();

/**
 * Whether this build should allow itself to be indexed at all.
 *
 * A preview deployment that is crawlable is a second copy of the site
 * competing with the real one for the same queries, and the usual outcome is
 * that Google keeps the wrong one. Vercel sets `VERCEL_ENV` to "preview" for
 * every non-production deployment, which is exactly the distinction wanted —
 * and on any other host, with the variable unset, the site indexes normally.
 */
export const isIndexable = process.env.VERCEL_ENV !== "preview";

export const siteName = "Aditya Zulkarnaen";
export const siteTitle = "Aditya Zulkarnaen — Creative Frontend Developer";
export const siteDescription =
  "Portfolio of Aditya Lucky Zulkarnaen, a full-stack web developer and mobile app engineer studying Software Engineering at Universitas Gadjah Mada — turning complex technical bottlenecks into seamless, scalable, production-ready systems.";

/**
 * The robots directives every indexable page carries.
 *
 * `max-image-preview: large` is the one worth spelling out: without it Google
 * may show a thumbnail or nothing beside the result, and for a portfolio the
 * image *is* the pitch. The other two lift default caps on the text snippet and
 * on video previews, neither of which there is a reason to limit here.
 */
const ROBOTS: Metadata["robots"] = {
  index: isIndexable,
  follow: isIndexable,
  googleBot: {
    index: isIndexable,
    follow: isIndexable,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

/**
 * Metadata shared by every page under `(site)`.
 *
 * The per-page exports below only add what is genuinely per-page — title,
 * description, canonical, and an image when the page has one of its own. Next
 * merges the rest down from the layout, so nothing here is repeated.
 */
export const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    // Sub-pages set a bare title and get the name appended, so a search result
    // and a browser tab both carry the site without every page restating it.
    template: `%s — ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: "Aditya Lucky Zulkarnaen", url: siteUrl }],
  creator: "Aditya Lucky Zulkarnaen",
  publisher: "Aditya Lucky Zulkarnaen",
  robots: ROBOTS,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName,
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  // Google's HTML-tag verification, for the case where DNS is not available.
  // Unset, the key is simply omitted — see README > Getting into Google.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  // `referrer` and `formatDetection` are small but not cosmetic: the second
  // stops iOS Safari turning the year in the footer and anything that looks
  // like a number into tappable links, which it styles itself.
  referrer: "origin-when-cross-origin",
  formatDetection: { telephone: false, address: false, email: false },
  category: "technology",
};

/**
 * A page's Open Graph block, with the site-wide parts carried in.
 *
 * Next merges metadata one key at a time, so a page that declares `openGraph`
 * *replaces* the layout's rather than adding to it — `og:site_name` and
 * `og:locale` silently disappear from every page that sets a title of its own.
 * That is easy to miss because the tags that page cared about are all present;
 * only the inherited ones are gone. Building the object through here is what
 * keeps the merge from being a subtraction.
 */
export function pageOpenGraph(page: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  images?: NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;
}): Metadata["openGraph"] {
  return {
    type: page.type ?? "website",
    siteName,
    locale: "en_US",
    title: page.title,
    description: page.description,
    url: page.path,
    ...(page.images ? { images: page.images } : {}),
  };
}

/**
 * The `Person` this whole site is about, as structured data.
 *
 * This is the block that has a chance of earning a knowledge panel, and the two
 * fields that do the work are `sameAs` and `@id`. `sameAs` is what lets Google
 * connect the site to the GitHub, LinkedIn and Instagram profiles that carry
 * the same name — an identity claim it can corroborate, rather than one page
 * asserting who someone is. `@id` gives that person a stable identifier the
 * other blocks can point at instead of describing them again.
 *
 * Built from live content rather than written out here, so the name and the
 * roles cannot drift from what the page actually says. A `Person` whose
 * `jobTitle` contradicts the heading is worse than no `Person` at all.
 */
export function personSchema(about: About) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/#person`,
    name: about.name,
    url: siteUrl,
    email: `mailto:${footerConfig.colophon}`,
    jobTitle: about.roles.map((role) =>
      role
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    ),
    // The asterisks are the bio's key-phrase markers; they are markup for the
    // scroll sweeps, not something a search engine should read.
    description: about.bio.join(" ").replace(/\*/g, "").trim(),
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Universitas Gadjah Mada",
      sameAs: "https://ugm.ac.id",
    },
    sameAs: footerConfig.social
      .filter((item) => item.href !== "")
      .map((item) => item.href),
  };
}

/** The site itself, so search results can carry a name rather than a hostname. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: siteName,
    description: siteDescription,
    inLanguage: "en",
    publisher: { "@id": `${siteUrl}/#person` },
  };
}

/**
 * One project, as structured data.
 *
 * `CreativeWork` rather than `Article`: a case page is a record of something
 * that was built, and claiming it is an article invites Google to check it
 * against expectations — an author byline, a publish date, news-shaped
 * content — that a portfolio page will fail.
 */
export function workSchema(work: Work, image: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": absolute(`/work/${work.slug}#work`),
    name: work.name,
    headline: work.name,
    description: work.summary,
    url: absolute(`/work/${work.slug}`),
    ...(image ? { image } : {}),
    creator: { "@id": `${siteUrl}/#person` },
    author: { "@id": `${siteUrl}/#person` },
    isPartOf: { "@id": `${siteUrl}/#website` },
    dateCreated: work.year,
    keywords: work.stack.join(", "),
    genre: work.kind,
  };
}

/**
 * The trail, which is what turns the grey URL line under a result into
 * `adityazulkarnaen.com › Work › Project`.
 *
 * `item` is omitted on the last entry on purpose: it is the page being looked
 * at, and pointing a breadcrumb at itself is the one thing the spec asks you
 * not to do.
 */
export function breadcrumbSchema(trail: { name: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      ...(step.path ? { item: absolute(step.path) } : {}),
    })),
  };
}
