/**
 * The shape the site renders, independent of where it came from.
 *
 * These types are the contract between `lib/content/source.ts` — which reads
 * from Sanity, or from the seed when Sanity is not configured yet — and the
 * chapters. Nothing below mentions Sanity except `SanityImageValue`, and that
 * is carried whole on purpose: the crop is an editorial decision made in the
 * Studio, so the raw value has to survive as far as `coverSrc()`.
 */

import type { PortableTextBlock } from "@portabletext/types";

export type { PortableTextBlock };

/**
 * How much of a row a desktop tile asks for. Ignored on a mobile project,
 * whose tile is sized by height instead.
 *
 * `row` is not a fraction: its basis is only wide enough to stop two of them
 * sharing a line, and it then grows into whatever that line has left — the rest
 * of the width beside a phone tile, or all of it when alone. That is what saves
 * anyone from working out what fraction a phone leaves behind.
 *
 * `half` is exactly what it says and does not grow. Beside a phone it leaves
 * the remainder of the line empty rather than swallowing it, because a width
 * that quietly comes out different from the one chosen reads as a broken
 * dropdown.
 */
export type WorkWidth = "row" | "half";

/**
 * What kind of screen the project lives on — and therefore the shape of its
 * tile, which is the whole reason this field exists rather than a free choice
 * of aspect ratio. A phone app shown in a 16/10 frame is a phone app with two
 * columns of empty room beside it; the grid says what a project *is* by the
 * shape of the hole it makes.
 */
export type WorkDevice = "desktop" | "mobile";

/** A Sanity image field, as it comes back from GROQ without dereferencing. */
export type SanityImageValue = {
  _type: "image";
  asset: { _ref: string; _type: "reference" };
  hotspot?: { x: number; y: number; height: number; width: number };
  crop?: { top: number; bottom: number; left: number; right: number };
};

export type WorkCover = {
  /** Kept raw so `coverSrc()` can apply the hotspot per frame. */
  image: SanityImageValue;
  /** Alt text lives on the image field, beside the asset reference. */
  alt: string;
  /**
   * Sanity's 20px base64 preview, used as `blurDataURL`. Null when the asset
   * predates metadata extraction, in which case the image just pops in.
   */
  lqip: string | null;
};

export type Work = {
  /** URL segment. Also the React key, so it has to be unique. */
  slug: string;
  name: string;
  /** Free text, not a number — a project may run "2024–2026". */
  year: string;
  /** The acid chip on the tile. Kept short; it is set in 10px mono. */
  kind: string;
  role: string;
  /** One line under the title on the detail page. */
  summary: string;
  /** Portable Text. The detail page renders it through `WorkBody`. */
  body: PortableTextBlock[];
  stack: string[];
  /** Null renders the calibration placeholder rather than a broken image. */
  cover: WorkCover | null;
  device: WorkDevice;
  /** Desktop only. A phone tile has one size, set by height. */
  width: WorkWidth;
  /** Chapter .04 shows only these. The index at /work shows everything. */
  featured: boolean;
  /** Optional outbound links, rendered on the detail page when present. */
  live?: string;
  repo?: string;
};

/**
 * One photograph in Chapter .02's frame.
 *
 * The image is carried raw for the same reason `WorkCover` is: the frame is a
 * fixed 4/5 box, the shots will not be, and only Sanity's builder can apply
 * the editor's hotspot to that crop.
 *
 * A null image is not an error — it renders the calibration frame, which is
 * what the seed leans on so the chapter is presentable before the shoot
 * exists.
 */
export type AboutPhoto = {
  image: SanityImageValue | null;
  alt: string;
  /** Set beside the counter under the frame. May be empty. */
  caption: string;
  /** Sanity's 20px base64 preview, or null on assets with no metadata. */
  lqip: string | null;
};

/**
 * Chapter .02, as content. A singleton in the Studio.
 *
 * The chapter number, the seam label and the button's wording are *not* here —
 * those are chrome, and they stay in `components/about/about-copy.ts`. What is
 * here is everything an editor would want to change without a deploy.
 */
export type About = {
  name: string;
  /** Marquee lines, in the order they run. */
  roles: string[];
  /** One string per paragraph. `*asterisks*` mark the acid-swiped phrases. */
  bio: string[];
  /** Empty renders the calibration frame rather than an empty box. */
  photos: AboutPhoto[];
  /** Null falls back to the copy file's `/resume.pdf`. */
  resumeUrl: string | null;
};

export type Experience = {
  /** React key. Unique, and stable across edits to the copy. */
  slug: string;
  /** The big line. Sentence case — this chapter is not shouting. */
  role: string;
  /** Sits beside the role, smaller. The place, not the job. */
  org: string;
  /** The open card's body. Two or three sentences; the bar is short. */
  summary: string;
  /** Free text, not dates — a role may run "2024 – Present". */
  period: string;
};

/**
 * One mark in Chapter .03's tunnel.
 *
 * Deliberately not an image field. Every other picture on the site is laid out
 * by `next/image` from a raw Sanity value, but this one is rasterised into a
 * sprite sheet by `buildLogoAtlas` — it goes to a bare `new Image()`, so the
 * only useful shape is a finished URL. That is also what lets the seed point at
 * `/logo/*.png` in `public/` and the Studio point at the asset CDN without the
 * tunnel knowing which it got.
 */
export type Tool = {
  /** Full name. Screen-reader text, and the visible list without WebGL. */
  name: string;
  /** Initials for the calibration frame, when there is no artwork or it fails. */
  label: string;
  /** Null draws the calibration frame instead. */
  src: string | null;
  /** Repaint a black-on-transparent mark in bone, keeping its alpha. */
  reverse: boolean;
};
