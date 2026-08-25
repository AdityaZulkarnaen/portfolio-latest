import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { apiVersion, dataset, studioProjectId } from "./lib/sanity/env";
import { schemaTypes } from "./sanity/schema";
import { structure } from "./sanity/structure";

/**
 * The Studio, mounted at /studio by
 * `app/(studio)/studio/[[...tool]]/page.tsx`.
 *
 * `studioProjectId` rather than `projectId` because this module is imported at
 * build time: without a project configured yet, `defineConfig` would throw and
 * take the whole build with it. The route renders a setup notice instead of the
 * Studio in that case, so the placeholder is never actually dialled.
 */
export default defineConfig({
  name: "portfolio",
  title: "Aditya Zulkarnaen — Content",
  basePath: "/studio",

  projectId: studioProjectId,
  dataset,

  schema: { types: schemaTypes },

  plugins: [
    structureTool({ structure }),
    // Query playground. Handy for checking a GROQ change against the real
    // dataset before it goes into `lib/sanity/queries.ts`.
    visionTool({ defaultApiVersion: apiVersion }),
  ],
});
