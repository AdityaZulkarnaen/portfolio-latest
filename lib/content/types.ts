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

export type WorkRatio = "wide" | "square" | "tall";

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
  /** Columns out of 12, from `md` up. */
  span: 4 | 6 | 8 | 12;
  /** Columns out of 12 below `md`, where the grid is still 12 wide. */
  spanSm: 6 | 12;
  ratio: WorkRatio;
  /** Chapter .04 shows only these. The index at /work shows everything. */
  featured: boolean;
  /** Optional outbound links, rendered on the detail page when present. */
  live?: string;
  repo?: string;
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
