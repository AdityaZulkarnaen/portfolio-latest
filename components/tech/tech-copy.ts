/** Every user-facing string in Chapter .03 lives here, mirroring `hero-copy`. */
export const techCopy = {
  eyebrow: "--- Chapter .03",
  chapter: "Tech Stack",
  /** Rendered as two stacked display lines, locked to the mouth of the tunnel. */
  heading: ["TECH", "STACK"],
  seamLeft: "TWELVE TOOLS // ONE PIPELINE",
  seamRight: "TUNNEL OPEN",
  depthLabel: "DEPTH",
  runtimeLabel: "RUNTIME / WEBGL",
  /** The glyphs of the tag, for the no-WebGL fallback and screen readers. */
  tagOpen: "<",
  tagClose: "/>",

  /**
   * The tiles the tunnel is built from.
   *
   * `label` is drawn into a placeholder tile by `buildLogoAtlas`. To ship the
   * real marks later, drop the artwork somewhere under `public/` and give the
   * entry a `src` — the atlas builder draws that image into the same cell and
   * nothing else in the pipeline changes.
   *
   * `accent` paints the placeholder in acid instead of bone. Keep it to a
   * handful: the accent is punctuation, not a colour scheme.
   */
  stack: [
    { label: "TS", name: "TypeScript" },
    { label: "REACT", name: "React", accent: true },
    { label: "NEXT", name: "Next.js" },
    { label: "GSAP", name: "GSAP" },
    { label: "R3F", name: "React Three Fiber" },
    { label: "THREE", name: "three.js", accent: true },
    { label: "GLSL", name: "GLSL" },
    { label: "TW", name: "Tailwind CSS" },
    { label: "NODE", name: "Node.js" },
    { label: "GIT", name: "Git" },
    { label: "FIGMA", name: "Figma" },
    { label: "VITE", name: "Vite" },
  ],
} as const;

export type TechTile = (typeof techCopy.stack)[number];
