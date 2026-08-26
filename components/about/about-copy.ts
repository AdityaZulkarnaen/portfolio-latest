/**
 * Chapter .02's *chrome*, mirroring `hero-copy`.
 *
 * The facts moved out. The name, the marquee roles, the bio and the photographs
 * are content and live in Sanity now — one `about` document, read through
 * `getAbout()` in `lib/content/source.ts`, with `lib/content/seed.json` as the
 * fallback before a project is configured. What is left here is what the
 * chapter is *made of* rather than what it says: the chapter number, the seam,
 * the button's wording and the counter's label all change when the design does,
 * not when the copy does.
 */
export const aboutCopy = {
  eyebrow: "--- Chapter .02",
  chapter: "About Me",
  resume: "See My Resume",
  /** Where the button goes when the document leaves `resumeUrl` empty. */
  resumeHref: "/resume.pdf",
  /** Left of the seam that closes over the hero. */
  seamLeft: "‎",
  seamRight: "",
  /** Counter under the photo frame — "IMG 02/04". */
  deckLabel: "IMG",
  deckHint: "CLICK TO ADVANCE",
} as const;
