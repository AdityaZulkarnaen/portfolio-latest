import type { AtlasTile } from "@/lib/build-logo-atlas";
import type { Tool } from "@/lib/content/types";

/**
 * Bone, for reversing single-colour marks out of the void.
 *
 * Lives here rather than in the atlas builder because which marks get reversed,
 * and into what, is an editorial call about this stack on this ground — the
 * builder just applies whatever colour it is handed. What the Studio stores is
 * only the decision, `reverse: true`; the colour it resolves to is chrome, and
 * chrome stays in the repo.
 */
const MONO_BONE = "#e6e6e1";

/**
 * A tool, as the sprite sheet wants it.
 *
 * The whole mapping is this one function: `Tool` is content — a name, initials,
 * a URL, a yes/no — and `AtlasTile` is what `buildLogoAtlas` rasterises.
 * `label` is not dead weight beside `src`; it is what gets drawn if the artwork
 * 404s or fails to decode, so a bad asset costs one legible placeholder rather
 * than a hole in the field.
 */
export function toAtlasTile(tool: Tool): AtlasTile {
  return {
    label: tool.label,
    src: tool.src ?? undefined,
    mono: tool.reverse ? MONO_BONE : undefined,
  };
}

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
     the stack was a list in this file, and stayed wrong the moment one was
     added. Now the count comes from the dataset, so it cannot be edited apart
     from the tunnel it describes. */
  seamLeft: (count: number) =>
    `${spell(count)} ${count === 1 ? "TOOL" : "TOOLS"} // ONE PIPELINE`,
  seamRight: "TUNNEL OPEN",
  depthLabel: "DEPTH",
  runtimeLabel: "RUNTIME / WEBGL",
  /** Names the tunnel for a screen reader, which cannot see any of it. */
  stackLabel: "Tools and technologies",
  /** The glyphs of the tag, for the no-WebGL fallback and screen readers. */
  tagOpen: "<",
  tagClose: "/>",
  /**
   * Drawn into the font probe, which has to hold *something* legible in the
   * mono face before the tools have loaded — it is what `waitForFont` waits on.
   */
  probeLabel: "STACK",
} as const;
