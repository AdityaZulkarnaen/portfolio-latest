/**
 * Every user-facing string in Chapter .05 — and nothing else.
 *
 * The entries themselves used to live here. They are content, so they now come
 * from Sanity through `lib/content/source.ts` as `Experience` values; their
 * running order is the `position` field, and it is load-bearing — see the note
 * on the schema in `sanity/schema/experience.ts`.
 */

export const experienceCopy = {
  eyebrow: "--- Chapter .05",
  chapter: "Experiences",
  /** The one heading, set in sentence case exactly as drawn. */
  heading: "My past work and organization experience.",
  /** Screen-reader name for the list, which is otherwise headed by nothing. */
  listLabel: "Work and organization experience",
  seamLeft: "CHAPTER .05 // EXPERIENCE",
  hint: "SCROLL TO CLOSE THE STACK",
} as const;
