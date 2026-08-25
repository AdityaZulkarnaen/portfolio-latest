import { createClient } from "next-sanity";

import { apiVersion, dataset, studioProjectId } from "./env";

/**
 * The read client. `useCdn` is on because every query this site makes is
 * published content served through ISR — the freshness comes from
 * `revalidateTag`, not from bypassing Sanity's edge cache.
 *
 * `stega` stays off. Visual editing is not wired up, and stega injects
 * invisible characters into every string it returns; they would end up inside
 * `String(...).padStart()` counts, `slice(0, 32)` React keys and the WebGL
 * text sampling, all of which measure the strings they are given.
 */
export const client = createClient({
  projectId: studioProjectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
  stega: false,
});
