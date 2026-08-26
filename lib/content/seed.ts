/**
 * The content the site falls back to when Sanity is not configured, and the
 * content `scripts/seed-sanity.mjs` imports into a fresh dataset.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER CONTENT — same warning the copy files used to carry. Every
 *  project is a slot, and three of the four experience summaries are plausible
 *  shape with wrong facts. Once the dataset is seeded, edit them in the Studio;
 *  this file stops being the source of truth the moment `NEXT_PUBLIC_SANITY_
 *  PROJECT_ID` is set.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The facts live in `seed.json` rather than here so the seeding script — plain
 * ESM, run by `node` with no TypeScript in the loop — can read exactly the same
 * bytes this module types.
 */

import raw from "./seed.json";
import type {
  About,
  Experience,
  PortableTextBlock,
  Tool,
  Work,
} from "./types";

/**
 * Plain paragraphs to Portable Text.
 *
 * `_key` has to be unique within the array and stable across runs — Sanity uses
 * it to diff, and a random key would make every re-seed look like a rewrite.
 * Position is the only thing about a paragraph that is guaranteed unique, so
 * the index is the key.
 *
 * Mirrored in `scripts/seed-sanity.mjs`. Twelve duplicated lines beat wiring a
 * TypeScript loader into a script that runs once.
 */
function toBlocks(paragraphs: string[]): PortableTextBlock[] {
  return paragraphs.map((text, i) => ({
    _type: "block",
    _key: `p${i}`,
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: `p${i}s0`, text, marks: [] }],
  }));
}

export const seedWorks: Work[] = raw.works.map((work) => ({
  slug: work.slug,
  name: work.name,
  year: work.year,
  kind: work.kind,
  role: work.role,
  summary: work.summary,
  body: toBlocks(work.bodyParagraphs),
  stack: work.stack,
  // No asset to point at before the dataset exists, so every seeded tile shows
  // the calibration frame — the same bargain the old empty-string cover struck.
  cover: null,
  device: work.device as Work["device"],
  width: work.width as Work["width"],
  featured: work.featured,
}));

export const seedExperiences: Experience[] = raw.experiences.map((item) => ({
  slug: item.slug,
  role: item.role,
  org: item.org,
  summary: item.summary,
  period: item.period,
}));

/**
 * The tunnel's marks, pointing at the artwork in `public/logo`.
 *
 * Unlike the two above, this is not placeholder text — it is the real stack,
 * and the files it points at are the real logos. It stays the fallback anyway,
 * because `src` is just a URL: once the tools live in Sanity the same field
 * carries a CDN URL instead, and `tech-stack.tsx` cannot tell the difference.
 * `npm run sanity:seed` uploads these files as assets rather than importing the
 * paths, so a seeded dataset serves its own copies.
 */
export const seedTools: Tool[] = raw.tools.map((tool) => ({
  name: tool.name,
  label: tool.label,
  src: tool.src,
  reverse: tool.reverse,
}));

/**
 * Chapter .02 before the dataset exists.
 *
 * The photographs are the honest part of this one: there are no files yet, so
 * every entry carries a null image and the frame draws its calibration card
 * instead. The alt text and captions are still real, because they are what the
 * counter and the screen reader read either way.
 *
 * Unlike the three above, this is also the fallback for a *missing* document
 * rather than only for an unconfigured project — see `getAbout()`.
 */
export const seedAbout: About = {
  name: raw.about.name,
  roles: raw.about.roles,
  bio: raw.about.bio,
  resumeUrl: raw.about.resumeUrl,
  photos: raw.about.photos.map((photo) => ({
    image: null,
    alt: photo.alt,
    caption: photo.caption,
    lqip: null,
  })),
};
