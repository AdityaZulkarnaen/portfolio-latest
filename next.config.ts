import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // three.js ships untranspiled addons; recommended by the R3F docs for Next.js.
  transpilePackages: ["three"],
  experimental: {
    // drei re-exports hundreds of modules and is not in Next's default list.
    optimizePackageImports: ["@react-three/drei"],
  },
};

export default nextConfig;
