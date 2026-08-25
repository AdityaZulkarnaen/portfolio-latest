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
import type { Experience, PortableTextBlock, Work } from "./types";

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
  span: work.span as Work["span"],
  spanSm: work.spanSm as Work["spanSm"],
  ratio: work.ratio as Work["ratio"],
  featured: work.featured,
}));

export const seedExperiences: Experience[] = raw.experiences.map((item) => ({
  slug: item.slug,
  role: item.role,
  org: item.org,
  summary: item.summary,
  period: item.period,
}));
