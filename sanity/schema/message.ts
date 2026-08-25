import { defineField, defineType } from "sanity";

/**
 * A message sent from Chapter .06.
 *
 * The one document type on this dataset that the site writes and the Studio
 * only reads — hence `readOnly`. Nothing here is content in the sense the other
 * types are: it is a record of something that happened, and editing it would
 * only make it a less accurate one. Deleting is still allowed, because a
 * mailbox that cannot be emptied is not a mailbox.
 *
 * It is deliberately not in the revalidation webhook's filter. A message
 * changes no page, and pointing the webhook at it would rebuild the site every
 * time somebody said hello.
 */
export const message = defineType({
  name: "message",
  title: "Message",
  type: "document",
  readOnly: true,
  fields: [
    defineField({ name: "name", title: "From", type: "string" }),
    defineField({ name: "email", title: "Email", type: "string" }),
    defineField({ name: "body", title: "Message", type: "text", rows: 8 }),
    defineField({
      name: "sentAt",
      title: "Sent",
      type: "datetime",
      description:
        "Stamped by the server, not by the sender — a field the form could set is a field a form can lie about.",
    }),
  ],

  orderings: [
    {
      name: "sentAt",
      title: "Newest first",
      by: [{ field: "sentAt", direction: "desc" }],
    },
  ],

  preview: {
    select: { title: "name", email: "email", sentAt: "sentAt" },
    prepare: ({ title, email, sentAt }) => ({
      title: title || "(no name)",
      subtitle: [email, sentAt ? new Date(sentAt).toLocaleString() : null]
        .filter(Boolean)
        .join("  ·  "),
    }),
  },
});
