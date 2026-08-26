import type { Metadata, Viewport } from "next";
import { baseMetadata } from "@/lib/seo";
import ReloadToTop from "@/components/reload-to-top";
import SiteFooter from "@/components/site-footer";
import SiteGround from "@/components/site-ground";
import SiteNav from "@/components/site-nav";
import SiteScroll from "@/components/site-scroll";
import SiteSmoothScroll from "@/components/site-smooth-scroll";
import SiteTrail from "@/components/site-trail";
import { archivo, blurWeb, geistMono, geistSans } from "@/lib/fonts";
import "../globals.css";

/**
 * Everything under `(site)` inherits this. The per-page exports add only what
 * is actually per-page — a title, a description, a canonical, and an image when
 * the page has one of its own — and Next merges the rest down from here.
 *
 * It lives in `lib/seo.ts` rather than inline because the sitemap, the robots
 * file and the JSON-LD blocks all have to agree with it on one absolute origin.
 */
export const metadata: Metadata = baseMetadata;

export const viewport: Viewport = {
  themeColor: "#08080a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${blurWeb.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-ink">
        {/* First thing in the document, and it has to be: it runs while the
            parser is still here, which is before the browser restores the
            scroll position and long before the hero reads it. */}
        <ReloadToTop />

        {/* Before the nav, so the trail passes behind its type rather
            than over it. */}
        <SiteTrail />
        <SiteNav />
        <SiteScroll />
        {/* Renders nothing; it stamps the ground colour under each band of
            fixed chrome onto the root, and `globals.css` does the rest. */}
        <SiteGround />
        {/* Renders nothing; it exists so one Lenis instance covers every route
            rather than only the pages that happen to contain the hero. */}
        <SiteSmoothScroll />
        {children}
        {/* Under every page, not inside one. It is the only chrome that brings
            its own ground, so it declares `data-ground` like a chapter does. */}
        <SiteFooter />
      </body>
    </html>
  );
}
