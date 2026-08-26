import type { StructureResolver } from "sanity/structure";

/**
 * Every list defaults to `position` ascending rather than the Studio's usual
 * "last edited", because in two of the three chapters the order *is* content:
 * Chapter .04's grid only tiles without gaps in one sequence, and Chapter .05's
 * stack closes each card under the next one. An editor should be looking at the
 * running order by default, not at what they touched most recently. Chapter
 * .03's tunnel deals its cells at random, so there `position` is only the order
 * of this list and of the no-WebGL fallback — but reading it in stack order
 * still beats reading it in edit order.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Work")
        .schemaType("work")
        .child(
          S.documentTypeList("work")
            .title("Work")
            .defaultOrdering([{ field: "position", direction: "asc" }]),
        ),
      S.listItem()
        .title("Tech stack")
        .schemaType("tool")
        .child(
          S.documentTypeList("tool")
            .title("Tech stack")
            .defaultOrdering([{ field: "position", direction: "asc" }]),
        ),
      S.listItem()
        .title("Experience")
        .schemaType("experience")
        .child(
          S.documentTypeList("experience")
            .title("Experience")
            .defaultOrdering([{ field: "position", direction: "asc" }]),
        ),
      S.divider(),
      // A singleton, and pinned to one document id rather than listed: there
      // is exactly one "me", and a second `about` document would be picked up
      // by the query at random. Reaching the editor directly is also the only
      // thing standing between an editor and a "create new" button that would
      // make that second document.
      S.listItem()
        .title("About")
        .id("about")
        .schemaType("about")
        .child(S.document().schemaType("about").documentId("about")),
      S.divider(),
      // Not content, and kept apart from it: the site writes these, the Studio
      // only reads them. Newest first, because a mailbox is read from the top.
      S.listItem()
        .title("Messages")
        .schemaType("message")
        .child(
          S.documentTypeList("message")
            .title("Messages")
            .defaultOrdering([{ field: "sentAt", direction: "desc" }]),
        ),
    ]);
