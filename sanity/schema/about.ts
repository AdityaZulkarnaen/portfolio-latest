import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Chapter .02 — the About slab, as one document.
 *
 * A singleton: there is exactly one "me", so the Studio pins this to a single
 * editor (see `sanity/structure.ts`) rather than a list an editor could add a
 * second row to. The id is fixed to `about` for the same reason.
 *
 * What is here and what stayed in `components/about/about-copy.ts` follows the
 * split the rest of the site uses: the *facts* — the name, the roles, the bio,
 * the photographs — are content and live here; the chapter number, the seam
 * label and the button's wording are chrome and stay in the repo.
 */
export const about = defineType({
  name: "about",
  title: "About",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: "Read by screen readers as the heading of the chapter.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "roles",
      title: "Roles",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      description:
        "The marquee. Set in BlurWeb at display size and repeated edge to edge, so three or four short lines read best — a long one scrolls past as a wall.",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "array",
      of: [defineArrayMember({ type: "text", rows: 4 })],
      description:
        "One entry per paragraph. Wrap a phrase in *asterisks* to give it the acid swipe — *Universitas Gadjah Mada* — the marker never renders. Two paragraphs is the shape the chapter is built for; each word is faded in and out by scroll, so a third makes the block outlast its own sweep.",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "resumeFile",
      title: "Resume file",
      type: "file",
      // The ordinary case: drop the PDF here and the button points at the
      // asset Sanity stores. Nothing to rebuild, nothing to commit — replacing
      // the file replaces what the button serves.
      options: { accept: ".pdf,application/pdf" },
      description:
        "Upload the PDF. This wins over the link below; use the link only to point somewhere else entirely.",
    }),
    defineField({
      name: "resumeUrl",
      title: "Resume link",
      type: "string",
      description:
        "Only used when no file is uploaded. A path in `public/` (`/resume.pdf`) or a full URL. Left empty it falls back to /resume.pdf.",
      hidden: ({ document }) => Boolean(document?.resumeFile),
    }),
    defineField({
      name: "photos",
      title: "Photos",
      type: "array",
      of: [
        defineArrayMember({
          type: "image",
          // The frame is a fixed 4/5 box and the shots will not be, so the
          // editor's hotspot is what decides which part of a landscape frame
          // survives the crop.
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt text",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "caption",
              title: "Caption",
              type: "string",
              description:
                'Set in 10px mono beside the counter — "STUDIO — 2026". Kept short; it is the first thing dropped when the column is narrow.',
            }),
          ],
          preview: {
            select: { title: "alt", subtitle: "caption", media: "asset" },
          },
        }),
      ],
      description:
        "One box, cycled. Each change dissolves through pixels out of the centre of the frame, so consecutive shots that share a composition read as one photo resolving into another. Portrait or square crops sit best. Empty renders the calibration frame.",
    }),
  ],

  preview: {
    select: { title: "name", media: "photos.0" },
    prepare: ({ title, media }) => ({
      title: title || "About",
      subtitle: "Chapter .02",
      media,
    }),
  },
});
