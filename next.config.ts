import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // three.js ships untranspiled addons; recommended by the R3F docs for Next.js.
  transpilePackages: ["three"],
  images: {
    // Covers come from Sanity's asset CDN, already cropped to the frame by
    // `lib/sanity/image.ts`. Next re-optimizes on top of that; the pathname is
    // scoped to this project so the optimizer cannot be pointed at arbitrary
    // assets on the shared host.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: `/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "*"}/**`,
      },
    ],
  },
  experimental: {
    /**
     * Ships the stylesheet as a `<style>` in the head instead of a `<link>`.
     *
     * The site had exactly one render-blocking resource — a 49KB Tailwind
     * sheet — and it cost a round trip in front of first paint on every cold
     * load. The trade documented for this flag is that inlined CSS cannot be
     * cached separately, so returning visitors re-download it; that is the
     * right side of the trade here. This is a portfolio, most arrivals are
     * first-time and come from a link, and the sheet is atomic CSS that stays
     * small no matter how much UI is added to it.
     *
     * Production only — it does nothing in `next dev`.
     */
    inlineCss: true,
    // drei re-exports hundreds of modules and is not in Next's default list.
    // gsap and lenis are barrels too, and every chapter imports through them.
    optimizePackageImports: ["@react-three/drei", "gsap", "lenis"],
    serverActions: {
      /**
       * The contact form sends three short strings; the default ceiling is a
       * megabyte. Nothing here needs more than this, and a limit the framework
       * enforces is one reached before any of our own code runs — which is the
       * only place a size limit is worth anything.
       */
      bodySizeLimit: "64kb",
    },
  },
};

export default nextConfig;
