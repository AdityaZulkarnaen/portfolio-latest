import { NextStudioLayout, metadata, viewport } from "next-sanity/studio";

/** `noindex`, and a referrer policy tight enough for an admin surface. */
export { metadata, viewport };

/**
 * The Studio's own root layout — the reason `app/` is split into two route
 * groups at all.
 *
 * Nothing from `(site)` may reach this tree. The site's chrome is not merely
 * unwanted here, it is actively hostile: `SiteSmoothScroll` mounts one Lenis
 * instance that hijacks wheel events document-wide, which breaks every scroll
 * container in the Studio; `SiteTrail` tracks the pointer over the whole
 * viewport; `SiteGround` writes ground colours onto the root element; and
 * `globals.css` carries Tailwind's preflight, which would reset Sanity's UI out
 * from under it. A route group with its own `<html>` is the only clean way to
 * be certain none of them run.
 *
 * The cost is the documented one: navigating between /studio and the site is a
 * full page load rather than a client transition. For an admin route entered
 * by typing the URL, that is not a cost at all.
 */
export default function StudioRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <NextStudioLayout>{children}</NextStudioLayout>
      </body>
    </html>
  );
}
