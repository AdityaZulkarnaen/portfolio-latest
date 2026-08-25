import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

import { dataset, studioProjectId } from "./env";
import type { WorkCover, WorkRatio } from "@/lib/content/types";

const builder = createImageUrlBuilder({
  projectId: studioProjectId,
  dataset,
});

/**
 * The pixel box each tile ratio is cropped to.
 *
 * These are the same aspect ratios `work-card.tsx` sets on the frame, written
 * out in pixels because the crop has to happen on Sanity's side: that is the
 * whole reason the raw image object is carried through the query instead of a
 * finished URL. `fit("crop")` with the editor's hotspot then decides *what*
 * gets cut, rather than the centre of the frame deciding it by default.
 */
const BOX: Record<WorkRatio | "hero", [number, number]> = {
  wide: [1600, 1000],
  square: [1200, 900],
  tall: [900, 1200],
  /** The detail page's 16/9 lead image, which is wider than any tile. */
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
export function coverSrc(cover: WorkCover, ratio: WorkRatio | "hero") {
  const [width, height] = BOX[ratio];

  return builder
    .image(cover.image as SanityImageSource)
    .width(width)
    .height(height)
    .fit("crop")
    .auto("format")
    .url();
}
