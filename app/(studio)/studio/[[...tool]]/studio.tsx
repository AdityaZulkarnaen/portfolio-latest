"use client";

import { NextStudio } from "next-sanity/studio/client-component";

import config from "@/sanity.config";

/**
 * The Studio, isolated behind a client boundary.
 *
 * This split is not stylistic. `sanity.config.ts` pulls in the whole `sanity`
 * package, and if a Server Component imports it the config lands in the RSC
 * graph — where module resolution uses the `react-server` export condition.
 * Several of the Studio's transitive dependencies ship a `react-server` build
 * with a different shape from their browser one (`swr` has no default export
 * there), and the build fails on an import that is perfectly valid in the
 * browser. Importing the config only from a `"use client"` module keeps the
 * whole Studio in the client graph, which is the only graph it was ever meant
 * to run in.
 *
 * `next-sanity/studio/client-component` rather than `next-sanity/studio`: the
 * latter is the Server Component wrapper that would put us back where we
 * started. It lazy-loads the real Studio, so none of this is in the first
 * chunk either.
 */
export default function Studio() {
  return <NextStudio config={config} />;
}
