import type { Metadata, Viewport } from "next";
import SiteGround from "@/components/site-ground";
import SiteNav from "@/components/site-nav";
import SiteScroll from "@/components/site-scroll";
import SiteSmoothScroll from "@/components/site-smooth-scroll";
import SiteTrail from "@/components/site-trail";
import { archivo, blurWeb, geistMono, geistSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aditya Zulkarnaen — Creative Frontend Developer",
  description:
    "Passionate developer who excels in crafting scalable architectures and thrives under pressure. coverting complex technical bottlenecks into seamless, scalable, production-ready systems.",
};

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
      </body>
    </html>
  );
}
