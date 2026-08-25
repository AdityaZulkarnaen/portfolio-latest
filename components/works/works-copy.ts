/**
 * Every user-facing string in Chapter .04 — and nothing else.
 *
 * The projects themselves used to live here as a typed array. They are content,
 * not chrome, so they now come from Sanity through `lib/content/source.ts`; the
 * shape they arrive in is `Work` in `lib/content/types.ts`. What is left below
 * is the furniture: labels, headings and the two fixed strings in the seam. It
 * changes when the design changes, which is why it stays in the repo rather
 * than becoming four more fields an editor has to fill in.
 */

export const worksCopy = {
  eyebrow: "--- Chapter .04",
  chapter: "Selected Work",
  heading: "FEATURED",
  /** Right of the section head, linking to the full index. */
  allLabel: "ALL WORKS",
  allHref: "/work",
  seamLeft: "SELECTED // NOT THE ARCHIVE",
  /** Sits under the grid, in the reference's bottom-corner register. */
  hint: "CLICK A TILE TO OPEN THE CASE",

  /** The index at /work. */
  indexEyebrow: "INDEX // ALL WORKS",
  indexHeading: "ALL WORKS",
  indexBack: "BACK TO INDEX",

  /** The detail page. */
  backLabel: "BACK TO ALL WORKS",
  roleLabel: "ROLE",
  yearLabel: "YEAR",
  stackLabel: "STACK",
  liveLabel: "VISIT LIVE",
  repoLabel: "SOURCE",
  nextLabel: "NEXT PROJECT",
  /** Shown in place of a cover while the project has no image in Sanity. */
  awaiting: "AWAITING FILE",
} as const;
