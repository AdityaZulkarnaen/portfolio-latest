/**
 * The three values every Sanity call needs, read once and in one place.
 *
 * `projectId` is deliberately allowed to be missing. The site has to build and
 * run before a Sanity project exists — that is what `isSanityConfigured` and
 * the seed fallback in `lib/content/source.ts` are for — so this module reports
 * the absence rather than throwing on import.
 *
 * Everything here is public, and it has to stay that way. `coverSrc()` reads
 * this module, `work-card.tsx` reads `coverSrc()`, and that card renders inside
 * Chapter .04 — a client component. So this file is in the browser bundle.
 * Secrets are read where they are used instead: the revalidation route reads
 * `SANITY_REVALIDATE_SECRET` itself, and it is a Route Handler, which never is.
 */

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

/**
 * Pinned, not floating. A date here freezes the API's behaviour, so a change on
 * Sanity's side can never alter what a query returns without a commit here.
 */
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-08-24";

/**
 * Whether there is a project to talk to at all. Every read goes through this:
 * false means fall back to the seed content rather than fail the render.
 */
export const isSanityConfigured = Boolean(projectId);

/**
 * The Studio cannot run without a real project id, but it is imported at build
 * time by `app/(studio)/studio/[[...tool]]/page.tsx`, so `defineConfig` has to
 * be given *something*. The route renders a setup notice instead of the Studio
 * when `isSanityConfigured` is false, so this placeholder is never dialled.
 */
export const studioProjectId = projectId ?? "unconfigured";
