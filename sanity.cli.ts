import { defineCliConfig } from "sanity/cli";

import { dataset, studioProjectId } from "./lib/sanity/env";

/**
 * Read by the `sanity` CLI — `sanity dataset import`, `sanity cors add`,
 * `sanity typegen`. The Studio itself is served by Next at /studio, so nothing
 * here deploys a separate host.
 */
export default defineCliConfig({
  api: { projectId: studioProjectId, dataset },
});
