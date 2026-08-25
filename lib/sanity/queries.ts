import { defineQuery } from "next-sanity";

/**
 * Cache tags. The webhook at `app/api/revalidate/route.ts` calls
 * `revalidateTag` with the `_type` of whatever document changed, so these two
 * strings have to stay identical to the schema type names.
 */
export const WORK_TAG = "work";
export const EXPERIENCE_TAG = "experience";

/**
 * The cover is projected rather than dereferenced to a URL.
 *
 * `coverSrc()` needs the raw image value — asset, hotspot and crop — because
 * the same photograph is cut to three different tile ratios and a 16/9 lead,
 * and only the builder can apply the editor's hotspot per crop. `lqip` is the
 * one thing that does have to be dereferenced, since it lives on the asset.
 *
 * `select()` with a single clause and no fallback yields null, which is exactly
 * what `Work.cover` means by "show the calibration frame".
 */
const COVER = /* groq */ `
  "cover": select(defined(cover.asset) => {
    "image": cover{_type, asset, hotspot, crop},
    "alt": coalesce(cover.alt, ""),
    "lqip": cover.asset->metadata.lqip
  })
`;

/**
 * Ordered by `position`, not by year. Chapter .04's grid is a composition —
 * `span`, `spanSm` and `ratio` only tile correctly in one order — so the
 * sequence is an editorial field the Studio exposes, not a derived sort. `year`
 * breaks ties so a forgotten `position` degrades to something sensible.
 */
export const worksQuery = defineQuery(`
  *[_type == "work" && defined(slug.current)] | order(position asc, year desc) {
    "slug": slug.current,
    name,
    year,
    kind,
    role,
    summary,
    body,
    "stack": coalesce(stack, []),
    span,
    spanSm,
    ratio,
    "featured": coalesce(featured, false),
    live,
    repo,
    ${COVER}
  }
`);

/**
 * Ordered oldest first, and that ordering is load-bearing: `experience.tsx`
 * closes each card under the next one, so the last entry is the one left open
 * at the end of the chapter. Put the current role last in the Studio or the
 * section ends on something already finished.
 */
export const experiencesQuery = defineQuery(`
  *[_type == "experience" && defined(slug.current)] | order(position asc) {
    "slug": slug.current,
    role,
    org,
    summary,
    period
  }
`);
