/**
 * Bone, for reversing single-colour marks out of the void.
 *
 * Lives here rather than in the atlas builder because which marks get reversed,
 * and into what, is an editorial call about this stack on this ground — the
 * builder just applies whatever colour it is handed.
 */
const MONO_BONE = "#e6e6e1";

/**
 * The tiles the tunnel is built from.
 *
 * `src` is real artwork under `public/logo`. `label` is not dead weight beside
 * it — it is what `buildLogoAtlas` draws if the file 404s or fails to decode,
 * so a bad asset costs one legible placeholder rather than a hole in the field.
 *
 * `mono` reverses a single-colour mark out of the void. Only the four marks
 * that ship black-on-transparent carry it; on a #08080a ground those are not
 * dim, they are absent. Everything else keeps its own brand colour, which is
 * the point of using real logos at all.
 *
 * Ordered front-of-stack to tooling. The tunnel assigns tiles at random, so
 * this is for whoever reads the file, not for what ends up on screen.
 */
const stack = [
  { label: "REACT", name: "React", src: "/logo/React-icon.svg.png" },
  { label: "NEXT", name: "Next.js", src: "/logo/next.png", mono: MONO_BONE },
  { label: "SVELTE", name: "Svelte", src: "/logo/Svelte.png" },
  { label: "TW", name: "Tailwind CSS", src: "/logo/Tailwind_CSS_Logo.svg.png" },
  { label: "JS", name: "JavaScript", src: "/logo/JavaScript-logo.png" },
  { label: "PHP", name: "PHP", src: "/logo/PHP-logo.svg.png" },
  { label: "LARAVEL", name: "Laravel", src: "/logo/laravel.png" },
  { label: "PY", name: "Python", src: "/logo/Python-logo-notext.svg.png" },
  { label: "JAVA", name: "Java", src: "/logo/java.png" },
  { label: "KOTLIN", name: "Kotlin", src: "/logo/Kotlin_Icon.png" },
  { label: "FLUTTER", name: "Flutter", src: "/logo/flutter.png" },
  { label: "EXPO", name: "Expo", src: "/logo/expo.svg", mono: MONO_BONE },
  { label: "SUPA", name: "Supabase", src: "/logo/supabase.svg" },
  { label: "FIREBASE", name: "Firebase", src: "/logo/firebase.svg" },
  { label: "TORCH", name: "PyTorch", src: "/logo/PyTorch.png" },
  { label: "TF", name: "TensorFlow", src: "/logo/TensorFlow.png" },
  {
    label: "SOL",
    name: "Solidity",
    src: "/logo/solidity_logo.svg",
    mono: MONO_BONE,
  },
  { label: "DOCKER", name: "Docker", src: "/logo/docker-mark-ocean-blue.png" },
  { label: "GIT", name: "GitHub", src: "/logo/github.png", mono: MONO_BONE },
  { label: "FIGMA", name: "Figma", src: "/logo/figma.webp" },
] as const;

const NUMBER_WORDS = [
  "ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT",
  "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN",
  "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN", "TWENTY", "TWENTY-ONE",
  "TWENTY-TWO", "TWENTY-THREE", "TWENTY-FOUR",
] as const;

/** Spelled out where there is one, the numeral where there is not. */
function spell(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** Every user-facing string in Chapter .03 lives here, mirroring `hero-copy`. */
export const techCopy = {
  eyebrow: "--- Chapter .03",
  chapter: "Tech Stack",
  /** Rendered as two stacked display lines, locked to the mouth of the tunnel. */
  heading: ["TECH", "STACK"],
  /* Counted rather than written: the seam claimed twelve tools for as long as
     the stack was placeholders, and stayed wrong the moment one was added. */
  seamLeft: `${spell(stack.length)} TOOLS // ONE PIPELINE`,
  seamRight: "TUNNEL OPEN",
  depthLabel: "DEPTH",
  runtimeLabel: "RUNTIME / WEBGL",
  /** Names the tunnel for a screen reader, which cannot see any of it. */
  stackLabel: "Tools and technologies",
  /** The glyphs of the tag, for the no-WebGL fallback and screen readers. */
  tagOpen: "<",
  tagClose: "/>",
  stack,
} as const;

export type TechTile = (typeof techCopy.stack)[number];
