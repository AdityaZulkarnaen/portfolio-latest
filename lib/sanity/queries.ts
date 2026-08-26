import { defineQuery } from "next-sanity";

/**
 * Cache tags. The webhook at `app/api/revalidate/route.ts` calls
 * `revalidateTag` with the `_type` of whatever document changed, so these
 * strings have to stay identical to the schema type names.
 */
export const WORK_TAG = "work";
export const EXPERIENCE_TAG = "experience";
export const TOOL_TAG = "tool";
export const ABOUT_TAG = "about";

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
 * Ordered by `position`, not by year. Chapter .04's grid is a wrapped row, so
 * `position` decides which tiles end up sharing a line — an editorial field the
 * Studio exposes, not a derived sort. `year` breaks ties so a forgotten
 * `position` degrades to something sensible.
 *
 * `device` and `width` are read through fallbacks for documents written before
 * the tile stopped being a free choice of rectangle. `ratio` was one of
 * wide/square/tall and `span` was twelfths; the mappings are the honest ones —
 * `tall` was only ever used for phone screenshots, and anything that used to
 * claim two thirds of the grid or more was asking for the rest of its row.
 * Both only fire on documents that still carry the old fields; delete them once
 * the last of those has been opened and saved.
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
    "device": coalesce(device, select(ratio == "tall" => "mobile", "desktop")),
    "width": coalesce(width, select(span >= 8 => "row", "half")),
    "featured": coalesce(featured, false),
    live,
    repo,
    "updatedAt": _updatedAt,
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

/**
 * Chapter .03's marks, rasterised into one sprite sheet on the client.
 *
 * `src` is finished here rather than in `lib/sanity/image.ts` because the
 * tunnel is not laying out an `<Image>`: `buildLogoAtlas` hands the URL to a
 * bare `new Image()` and draws it into a canvas, so what it needs is one string
 * that decodes, not a hotspot-aware builder. The transform params are the same
 * ones the URL builder would emit.
 *
 * The `select` has three arms and each is load-bearing:
 *
 *  - SVG is passed through untouched. Sanity's image pipeline does not
 *    rasterise SVGs; asking it for `?fm=png` yields the original file anyway,
 *    so the parameters would be a lie in the URL.
 *  - Everything else is capped at 512px and forced to PNG. A cell is at most
 *    384px, and `fm=png` rather than `auto=format` because alpha is not
 *    optional here — a mark composited onto the tunnel over a white box is
 *    worse than a missing mark.
 *  - No logo at all yields null, which `tech-stack.tsx` reads as "draw the
 *    calibration frame with `label` in it".
 *
 * `order(position asc)` does not decide what appears where — the tunnel deals
 * its cells at random — but it does fix the no-WebGL list and the screen
 * reader's reading order.
 */
export const toolsQuery = defineQuery(`
  *[_type == "tool" && defined(name)] | order(position asc, name asc) {
    name,
    label,
    "src": select(
      logo.asset->extension == "svg" => logo.asset->url,
      defined(logo.asset) => logo.asset->url + "?w=512&fm=png",
      null
    ),
    "reverse": coalesce(reverse, false)
  }
`);

/**
 * Chapter .02, the singleton.
 *
 * `[0]` rather than a list, and the Studio is configured so a second `about`
 * document cannot be created — otherwise "the first one" would be a coin toss.
 * A missing document yields null, which `getAbout()` reads as "fall back to the
 * seed": unlike the three lists above, an *empty* About is not a legitimate
 * editorial choice, it is a dataset that has not been filled in yet.
 *
 * Photos are projected the way the work cover is — raw image, hotspot and crop
 * intact, `lqip` dereferenced off the asset — because the frame crops them
 * itself. `coalesce` on the array is what keeps `photos.map` in the component
 * from meeting an undefined on a document saved before any shots were added.
 */
export const aboutQuery = defineQuery(`
  *[_type == "about"][0] {
    name,
    "roles": coalesce(roles, []),
    "bio": coalesce(bio, []),
    "resumeUrl": resumeUrl,
    "photos": coalesce(photos[]{
      "image": select(defined(asset) => {_type, asset, hotspot, crop}),
      "alt": coalesce(alt, ""),
      "caption": coalesce(caption, ""),
      "lqip": asset->metadata.lqip
    }, [])
  }
`);
