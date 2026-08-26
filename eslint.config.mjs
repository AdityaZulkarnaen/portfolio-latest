import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  /**
   * three, and the two React wrappers around it, may only be imported from
   * inside a scene subtree.
   *
   * This is a bundling rule with a performance number attached, not a taste
   * one. `hero-canvas.tsx` and `tech-canvas.tsx` are `next/dynamic` boundaries
   * with `ssr: false`, and they are what keeps ~370KB of three off the
   * homepage's critical path. A single value import from a component that
   * renders eagerly defeats both of them at once and nothing fails — the site
   * still works, it just ships the whole library in a `<script async>` on first
   * load. That is precisely how it regressed the first time: `tech-stack.tsx`
   * imported `buildLogoAtlas`, and `build-logo-atlas.ts` imported three for
   * twelve lines of texture setup.
   *
   * `import type` is unaffected — types are erased and cost nothing. The files
   * exempted below are the ones that only ever load behind a canvas boundary.
   */
  {
    files: ["components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: [
      "components/**/*-scene.tsx",
      "components/hero/currents-field.tsx",
      "components/tech/logo-tunnel.tsx",
      "components/tech/code-tag.tsx",
      "components/tech/tag-geometry.ts",
      "components/tech/atlas-texture.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "three",
              allowTypeImports: true,
              message:
                "three may only be imported inside an ssr:false scene subtree — see components/tech/atlas-texture.ts for the pattern.",
            },
            {
              name: "@react-three/fiber",
              allowTypeImports: true,
              message: "Import only from inside an ssr:false scene subtree.",
            },
            {
              name: "@react-three/drei",
              allowTypeImports: true,
              message: "Import only from inside an ssr:false scene subtree.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
