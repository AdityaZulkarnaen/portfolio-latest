import { defineField, defineType } from "sanity";

/**
 * One mark in Chapter .03's tunnel.
 *
 * Everything here exists because of how the tunnel draws: the twenty-odd marks
 * are rasterised into a single sprite sheet, one cell each, and the shader only
 * ever gets a tile index. So a tool is not a logo and a name — it is a cell,
 * and each field below is a way that cell can go wrong.
 *
 * `logo` is optional on purpose. A tool with no artwork gets the bracketed
 * calibration frame with its `label` inside, which is a legible cell rather
 * than a hole in the field; that is also the fallback if an upload fails to
 * decode. Which is why `label` is required even when there is a logo.
 */
export const tool = defineType({
  name: "tool",
  title: "Tech stack",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description:
        "The full name — \"Next.js\", \"Tailwind CSS\". Never drawn in the tunnel; it is what a screen reader is read, and the visible list when WebGL is unavailable.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      description:
        "Initials drawn in the calibration frame when there is no logo, or when the artwork fails to load. Two to eight characters, no spaces — it is fitted to the cell, so a long one comes out small.",
      validation: (rule) =>
        rule
          .required()
          .max(8)
          .regex(/^\S+$/, { name: "a single word" }),
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      description:
        "The mark on its own, no wordmark and no padding — the cell adds its own margin, and a mark that touches the edge bleeds into its neighbour at depth. Transparent PNG or SVG.",
      // No hotspot: the artwork is trimmed to its own content box at raster
      // time and scaled by optical area, so an editorial crop would be
      // measured away again.
      options: { hotspot: false },
    }),
    defineField({
      name: "reverse",
      title: "Reverse out of the void",
      type: "boolean",
      description:
        "For marks that ship black on transparent — GitHub, Next.js, Expo, Solidity. The tunnel is near-black, so those are not dim there, they are absent. This repaints the mark in bone while keeping its alpha exactly, so knockouts survive: GitHub's disc turns bone and the octocat stays void, which is the official reversed mark rather than a negative of it.",
      initialValue: false,
    }),
    defineField({
      name: "position",
      title: "Position",
      type: "number",
      description:
        "Ordering, lowest first. The tunnel hands cells out at random, so this is not what ends up on screen — it is the order of the fallback list and of this list in the Studio. Front-of-stack down to tooling reads best.",
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
    select: { title: "name", label: "label", media: "logo" },
    prepare: ({ title, label, media }) => ({
      title,
      subtitle: label,
      media,
    }),
  },
});
