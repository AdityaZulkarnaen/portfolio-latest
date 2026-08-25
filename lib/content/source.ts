import "server-only";

import { cache } from "react";

import { client } from "@/lib/sanity/client";
import { isSanityConfigured } from "@/lib/sanity/env";
import {
  EXPERIENCE_TAG,
  TOOL_TAG,
  WORK_TAG,
  experiencesQuery,
  toolsQuery,
  worksQuery,
} from "@/lib/sanity/queries";
import { seedExperiences, seedTools, seedWorks } from "./seed";
import type { Experience, Tool, Work } from "./types";

/**
 * The one door between the site and its content.
 *
 * Two things are worth being explicit about, because both are easy to get
 * wrong later:
 *
 *  1. The seed is a fallback for *absence*, not for failure. If Sanity is
 *     configured and the query throws, this module lets it throw. A caught
 *     error would quietly repaint a live site with PLACEHOLDER copy, which is
 *     far worse than a failed revalidation — on a failed revalidation Next
 *     keeps serving the last good page, which is exactly the behaviour wanted.
 *
 *  2. An empty dataset is respected. Deleting every project in the Studio
 *     empties the grid; it does not resurrect the placeholders.
 *
 * `server-only` is not decoration. `client` closes over the dataset name and
 * these functions are called from Server Components whose children are client
 * ones, so the import boundary is the only thing keeping the query text and
 * client config out of the browser bundle.
 */

/**
 * The safety net under the webhook, not the primary freshness mechanism.
 * `app/api/revalidate/route.ts` makes edits appear within seconds; this only
 * matters if the webhook is misconfigured or Sanity's delivery fails.
 */
const REVALIDATE_SECONDS = 1;

/**
 * `cache` memoizes per request, so the home page and `generateMetadata` on a
 * case page share one round trip instead of racing two.
 */
export const getWorks = cache(async (): Promise<Work[]> => {
  if (!isSanityConfigured) return seedWorks;

  return client.fetch<Work[]>(
    worksQuery,
    {},
    { next: { revalidate: REVALIDATE_SECONDS, tags: [WORK_TAG] } },
  );
});

export const getExperiences = cache(async (): Promise<Experience[]> => {
  if (!isSanityConfigured) return seedExperiences;

  return client.fetch<Experience[]>(
    experiencesQuery,
    {},
    { next: { revalidate: REVALIDATE_SECONDS, tags: [EXPERIENCE_TAG] } },
  );
});

/**
 * Chapter .03's tunnel. An empty result is respected here as everywhere else:
 * with no tools in the dataset the chapter still runs — the tag opens on an
 * empty tunnel rather than on the twenty marks in the seed.
 */
export const getTools = cache(async (): Promise<Tool[]> => {
  if (!isSanityConfigured) return seedTools;

  return client.fetch<Tool[]>(
    toolsQuery,
    {},
    { next: { revalidate: REVALIDATE_SECONDS, tags: [TOOL_TAG] } },
  );
});

/**
 * Chapter .04 is a selection, not the archive — that is the whole point of a
 * featured strip, and the reason `/work` exists to hold the rest.
 */
export async function getFeaturedWorks(): Promise<Work[]> {
  return (await getWorks()).filter((work) => work.featured);
}
