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
    // drei re-exports hundreds of modules and is not in Next's default list.
    optimizePackageImports: ["@react-three/drei"],
  },
};

export default nextConfig;
