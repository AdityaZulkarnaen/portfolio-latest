import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A project, and the tile it occupies in Chapter .04's grid.
 *
 * There are only two layout fields, and that is deliberate. The grid is a
 * wrapped row, not a twelve-column composition: tiles take what they ask for
 * and the line breaks where it runs out. Nobody has to solve a packing problem
 * to add a project — `position` decides the order, and the row sorts itself
 * out.
 *
 * Both fields are constrained lists rather than free values because Tailwind
 * can only generate the classes it can see as literal strings in
 * `work-card.tsx`; anything outside these produces no class at all and the tile
 * silently loses its width.
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
        "Cropped to the tile's shape — 16/10 for a desktop project, a 9/19.5 phone frame for a mobile one — and again for the lead on the case page. Set the hotspot so the subject survives every cut.",
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
        "Order in the grid, lowest first, and the only layout decision that needs making — the row wraps wherever it runs out, so the tiles compose themselves from this. Rows of mixed screens have ragged bottoms by design: a phone tile stands taller than the desktop tile beside it.",
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
      name: "device",
      title: "Screen",
      type: "string",
      group: "layout",
      description:
        "What the project runs on, which is what shapes its tile: a desktop project gets a 16/10 frame, a mobile one a 9/19.5 phone frame. The cover is cropped to whichever this is, so switching it re-cuts the image from the same hotspot.",
      options: {
        list: [
          { title: "Desktop — 16/10", value: "desktop" },
          { title: "Mobile — 9/19.5", value: "mobile" },
        ],
        layout: "radio",
      },
      initialValue: "desktop",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "width",
      title: "Width",
      type: "string",
      group: "layout",
      description:
        "From the md breakpoint up. \"Rest of the row\" never shares a line with another desktop project: beside a phone it takes everything the phone left over, and on its own it takes the full width. \"Half\" is exactly half and stays half — two of them pair up side by side, and a half beside a phone simply leaves the rest of that line empty.",
      options: {
        list: [
          { title: "Rest of the row", value: "row" },
          { title: "Half — always half, pairs with another desktop", value: "half" },
        ],
        layout: "radio",
      },
      initialValue: "half",
      // A phone tile has no width to choose: it is sized by height, so that it
      // fits on a laptop screen, and its aspect ratio decides the rest.
      hidden: ({ document }) => document?.device === "mobile",
      validation: (rule) =>
        rule.custom((width, context) => {
          const device = (context.document as { device?: string } | undefined)
            ?.device;
          if (device !== "mobile" && !width) {
            return "A desktop project needs a width.";
          }
          return true;
        }),
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
    select: {
      title: "name",
      year: "year",
      kind: "kind",
      device: "device",
      media: "cover",
    },
    prepare: ({ title, year, kind, device, media }) => ({
      title,
      subtitle: [year, kind, device].filter(Boolean).join("  ·  "),
      media,
    }),
  },
});
