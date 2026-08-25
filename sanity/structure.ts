import type { StructureResolver } from "sanity/structure";

/**
 * Both lists default to `position` ascending rather than the Studio's usual
 * "last edited", because in both chapters the order *is* content: Chapter .04's
 * grid only tiles without gaps in one sequence, and Chapter .05's stack closes
 * each card under the next one. An editor should be looking at the running
 * order by default, not at what they touched most recently.
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
        .title("Experience")
        .schemaType("experience")
        .child(
          S.documentTypeList("experience")
            .title("Experience")
            .defaultOrdering([{ field: "position", direction: "asc" }]),
        ),
    ]);
