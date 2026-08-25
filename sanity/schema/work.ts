import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A project, and the tile it occupies in Chapter .04's grid.
 *
 * The layout fields near the bottom are constrained lists rather than free
 * numbers on purpose. `span`, `spanSm` and `ratio` are the only three inputs to
 * a twelve-column composition that has to tile without gaps, and Tailwind can
 * only generate the column classes it can see as literal strings in
 * `work-card.tsx` — a span of 5 would produce no class at all and the tile
 * would silently go full width. The dropdown is the guard rail.
 */
export const work = defineType({
  name: "work",
  title: "Work",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "media", title: "Cover" },
    { name: "layout", title: "Layout" },
    { name: "links", title: "Links" },
  ],
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      group: "content",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "content",
      description:
        "The URL segment at /work/…. Changing it breaks any link already shared.",
      options: { source: "name", maxLength: 64 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "year",
      title: "Year",
      type: "string",
      group: "content",
      description:
        'Free text, not a number — a project may run "2024–2026". Also the tie-breaker when two projects share a position.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      group: "content",
      description:
        "The acid chip in the tile's corner. Set in 10px mono and never wraps, so keep it to two or three words.",
      validation: (rule) => rule.required().max(24),
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      group: "content",
      description: "Yours on this project, not the job title.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
      rows: 2,
      group: "content",
      description:
        "One line, under the title on the case page. It is also the page's meta description.",
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      group: "content",
      description:
        "A case study is a record of judgement, not a feature list: what it was, what made it hard, what you decided. Two or three paragraphs is usually right.",
      of: [
        defineArrayMember({
          type: "block",
          // The case page renders one paragraph style and inline emphasis.
          // Anything else here would come out unstyled, so it is not offered.
          styles: [{ title: "Paragraph", value: "normal" }],
          lists: [],
          marks: {
            decorators: [
              { title: "Bold", value: "strong" },
              { title: "Italic", value: "em" },
            ],
            annotations: [
              defineArrayMember({
                name: "link",
                title: "Link",
                type: "object",
                fields: [
                  defineField({
                    name: "href",
                    title: "URL",
                    type: "url",
                    validation: (rule) => rule.required(),
                  }),
                ],
              }),
            ],
          },
        }),
      ],
    }),
    defineField({
      name: "stack",
      title: "Stack",
      type: "array",
      group: "content",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),

    defineField({
      name: "cover",
      title: "Cover",
      type: "image",
      group: "media",
      description:
        "Cropped to three different shapes depending on the tile's ratio, plus a 16/9 lead on the case page. Set the hotspot so the subject survives all four.",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          type: "string",
          description:
            "What the image shows, for anyone who cannot see it. Leave empty only if the cover is purely decorative.",
        }),
      ],
    }),

    defineField({
      name: "position",
      title: "Position",
      type: "number",
      group: "layout",
      description:
        "Order in the grid, lowest first. This is a composition, not a sort: the spans and ratios only tile without gaps in one sequence.",
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      group: "layout",
      description:
        "Featured projects appear in Chapter .04 on the homepage. Everything appears at /work.",
      initialValue: true,
    }),
    defineField({
      name: "span",
      title: "Width (desktop)",
      type: "number",
      group: "layout",
      description: "Columns out of twelve, from the md breakpoint up.",
      options: {
        list: [
          { title: "4 / 12 — third", value: 4 },
          { title: "6 / 12 — half", value: 6 },
          { title: "8 / 12 — two thirds", value: 8 },
          { title: "12 / 12 — full", value: 12 },
        ],
        layout: "radio",
      },
      initialValue: 6,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "spanSm",
      title: "Width (mobile)",
      type: "number",
      group: "layout",
      description: "Columns out of twelve below md, where the grid is still 12 wide.",
      options: {
        list: [
          { title: "6 / 12 — half", value: 6 },
          { title: "12 / 12 — full", value: 12 },
        ],
        layout: "radio",
      },
      initialValue: 12,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "ratio",
      title: "Tile shape",
      type: "string",
      group: "layout",
      options: {
        list: [
          { title: "Wide — 16/10", value: "wide" },
          { title: "Square — 4/3", value: "square" },
          { title: "Tall — 3/4", value: "tall" },
        ],
        layout: "radio",
      },
      initialValue: "square",
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: "live",
      title: "Live URL",
      type: "url",
      group: "links",
    }),
    defineField({
      name: "repo",
      title: "Source URL",
      type: "url",
      group: "links",
    }),
  ],

  orderings: [
    {
      name: "position",
      title: "Grid order",
      by: [{ field: "position", direction: "asc" }],
    },
  ],

  preview: {
    select: { title: "name", year: "year", kind: "kind", media: "cover" },
    prepare: ({ title, year, kind, media }) => ({
      title,
      subtitle: [year, kind].filter(Boolean).join("  ·  "),
      media,
    }),
  },
});
