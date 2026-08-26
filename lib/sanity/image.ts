import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

import { dataset, studioProjectId } from "./env";
import type {
  SanityImageValue,
  WorkCover,
  WorkDevice,
} from "@/lib/content/types";

const builder = createImageUrlBuilder({
  projectId: studioProjectId,
  dataset,
});

/**
 * The pixel box each frame is cropped to.
 *
 * These are the same aspect ratios `work-card.tsx` sets on the tile, written
 * out in pixels because the crop has to happen on Sanity's side: that is the
 * whole reason the raw image object is carried through the query instead of a
 * finished URL. `fit("crop")` with the editor's hotspot then decides *what*
 * gets cut, rather than the centre of the frame deciding it by default.
 *
 * The widths are sized to the largest a tile of that shape is ever drawn, at
 * 2x. A phone tile is at most a third of a 1376px content column — 432 CSS px,
 * so 900 — while a desktop tile can be the full row.
 */
const BOX: Record<WorkDevice | "hero", [number, number]> = {
  desktop: [1600, 1000],
  mobile: [900, 1950],
  /** The detail page's 16/9 lead, wider than any tile. Desktop projects only —
      a mobile project stands its phone frame on that stage instead, cropped to
      `mobile` like its tile. */
  hero: [1920, 1080],
};

/**
 * A hotspot-aware URL for a cover, sized for the frame it is going into.
 *
 * Next's own optimizer still runs on top of this — `remotePatterns` in
 * `next.config.ts` allows `cdn.sanity.io` — so the double pass costs one cached
 * transform each. Worth it: the crop is an editorial decision made in the
 * Studio, and only Sanity's builder knows about it.
 */
export function coverSrc(cover: WorkCover, frame: WorkDevice | "hero") {
  const [width, height] = BOX[frame];

  return builder
    .image(cover.image as SanityImageSource)
    .width(width)
    .height(height)
    .fit("crop")
    .auto("format")
    .url();
}

/**
 * Chapter .02's frame, at 2x of the largest it is ever drawn — a little over
 * 550 CSS px in the pinned column.
 *
 * A finished URL rather than a raw value handed to `next/image`, because this
 * one does not only go into an `<img>`: the pixel dissolve draws the same
 * bitmap into a canvas, and a canvas needs one string that decodes. Both layers
 * asking for the identical URL is the point — the second is a cache hit, not a
 * second download.
 */
const PHOTO: [number, number] = [1100, 1375];

export function photoSrc(image: SanityImageValue) {
  const [width, height] = PHOTO;

  return builder
    .image(image as SanityImageSource)
    .width(width)
    .height(height)
    .fit("crop")
    .auto("format")
    .url();
}
