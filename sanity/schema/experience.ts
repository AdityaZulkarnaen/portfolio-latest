import { defineField, defineType } from "sanity";

/**
 * One entry in Chapter .05's closing stack.
 *
 * `summary` is capped, and the cap is a layout constraint rather than an
 * editorial preference. Each card parks under the ones above it and the lid
 * closes over it where it stands, so anything past the fold at that moment is
 * never readable at all. The chapter's budget is
 *
 *     head + (n-1) * pitch + row + 2 + tallest body  <=  viewport height
 *
 * and a long summary is the only term an editor can blow. 520 characters is
 * roughly where the real GDGoC entry lands, which is the longest that fits.
 */
export const experience = defineType({
  name: "experience",
  title: "Experience",
  type: "document",
  fields: [
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      description: "The big line. Sentence case — this chapter is not shouting.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "org",
      title: "Organisation",
      type: "string",
      description: "Sits beside the role, smaller. The place, not the job.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      description:
        "Not a URL — this chapter has no pages. It is the React key, so it only has to be unique and stable.",
      options: { source: (doc) => `${doc.role} ${doc.org}`, maxLength: 64 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
      rows: 5,
      description:
        "Two or three sentences. The card is closed by the next one as you scroll, so anything longer than about 520 characters is written but never read on a laptop.",
      validation: (rule) => rule.required().max(520),
    }),
    defineField({
      name: "period",
      title: "Period",
      type: "string",
      description:
        'Free text, not dates — a role may run "December 2025 – July 2026".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "position",
      title: "Position",
      type: "number",
      description:
        "Oldest first. Load-bearing: each card is closed under the next one, so the highest position is the entry left open at the end of the chapter. Put the current role last.",
      validation: (rule) => rule.required().integer().positive(),
    }),
  ],

  orderings: [
    {
      name: "position",
      title: "Stack order",
      by: [{ field: "position", direction: "asc" }],
    },
  ],

  preview: {
    select: { title: "role", org: "org", period: "period" },
    prepare: ({ title, org, period }) => ({
      title,
      subtitle: [org, period].filter(Boolean).join("  ·  "),
    }),
  },
});
