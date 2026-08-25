import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Work, WorkDevice, WorkWidth } from "@/lib/content/types";
import { coverSrc } from "@/lib/sanity/image";
import { META_TYPE_BASE } from "@/lib/site-config";
import CoverPlaceholder from "./cover-placeholder";

/**
 * What each tile asks the flex row for.
 *
 * These have to exist as literal strings for Tailwind to generate them — a
 * class assembled at runtime produces nothing — which is the whole reason
 * `device` and `width` are constrained dropdowns in the Studio.
 *
 * The two differ in more than a number, and the difference is which one is
 * allowed to grow:
 *
 *  - `row` means *the rest of the line*, so it grows. Its 60% basis is only
 *    there to stop two of them ever sharing a line; what it actually ends up
 *    at is whatever is left after a phone tile has taken its share, or the
 *    whole width when it has the line to itself. Nobody has to work out what
 *    fraction a phone leaves behind.
 *  - `half` means half, and stays half. It does not grow, so a `half` beside a
 *    phone leaves the remainder of that line empty rather than quietly
 *    swallowing it. That gap is the honest answer: the editor asked for half.
 *    Growing here made the dropdown look broken, because the tile came out a
 *    different width than the one that was chosen.
 *
 * Below `md` every desktop tile is simply the full width; there is nothing to
 * compose at that size.
 */
const WIDTH: Record<WorkWidth, string> = {
  row: "w-full grow md:w-auto md:basis-[60%]",
  half: "w-full md:w-auto md:basis-[calc(50%-1.25rem)]",
};

/**
 * A phone tile, at its two sizes.
 *
 * **On a phone** it is half the row, so two stand side by side — which is the
 * only arrangement that makes sense there: one phone screenshot per row on a
 * phone-width screen is a column of tall objects with nothing beside them, and
 * you scroll past two projects in the space one used to take.
 *
 * **From `md` up** it goes back to being sized by *height* and letting its
 * aspect decide the width — the opposite of every other tile here, and the only
 * way to keep the promise: a 9/19.5 frame given a width instead comes out
 * taller than the laptop it is being read on. `min(70svh, 36rem)` caps it in
 * both directions, so it fits on a laptop screen without becoming a two-storey
 * object on a tall monitor.
 *
 * Written out as one literal string, and it has to stay that way: Tailwind
 * generates only the classes it can *see* in the source, so assembling this
 * from a constant produces a class name in the HTML with no rule behind it and
 * a tile with no width at all. The first pass here did exactly that. The 9/19.5
 * is duplicated from `FRAME.mobile` for the same reason — keep the two in step.
 *
 * `0.5rem` is half of `gap-x-4`, the gap below `md`; two tiles that each give
 * up half the gap fill the row exactly.
 *
 * `shrink-0` because a phone tile is not negotiable at either size: it is a
 * fixed object in a row of elastic ones, and letting flex squeeze it would
 * break the aspect the size was chosen for.
 */
const PHONE_TILE =
  "w-[calc(50%-0.5rem)] shrink-0 md:w-[calc(min(70svh,36rem)*9/19.5)]";

/**
 * The tile is the screen the project runs on.
 *
 * 9/19.5 is a current phone rather than the 9/16 of an older one, because these
 * are screenshots and a screenshot has the aspect of the device it was taken
 * on.
 */
const FRAME: Record<WorkDevice, string> = {
  desktop: "aspect-[16/10]",
  mobile: "aspect-[9/19.5]",
};

/* ─── The curl ──────────────────────────────────────────────────────────────
   A sticky note peels; it does not tilt. The old effect rotated the whole tile
   as one rigid plane, which is why it read as a hinged board — a flat thing
   cannot look like paper no matter how it is lit.

   So the tile is built as a chain of quads hinged along their top edges. The
   note stays flat where it is glued and then rolls, each band leaning a little
   further than the one above it. Every band carries the ones below it, so the
   angles compound into a curve rather than a fold. The whole chain is still
   driven by the single `--peel` number the scroll writes; nothing here needs a
   second one.

   The cost is DOM: each band shows its own slice of the same cover, so a card
   holds eight copies of one `<Image>`. They share a src, so it is one fetch and
   one decode — the cost is nodes, not bytes or bandwidth. */

/** Fraction of the tile that stays flat, where the note is stuck to the board. */
const HEAD = 0.05;

/**
 * How much further each band leans than the one above it, in degrees, summing
 * to 62 at the free edge.
 *
 * Solved, not chosen — run `node scripts/verify-peel.mjs`, which is the solver.
 * Perspective magnifies whatever leans toward the viewer, so the bottom of the
 * curl reaches sideways past the tile's own box, and two tiles sharing a line
 * have only half the column gap to spend before they collide. This profile
 * clears the tightest case by 21px.
 *
 * Two properties of the shape matter beyond the fit. No single step is much
 * over 10deg, or the band boundary reads as a crease instead of a curve. And
 * the steps grow rather than shrink, which is what makes it a roll: paper
 * curves tighter the further it gets from what is holding it.
 */
const BAND_DEG = [6.0, 7.79, 8.64, 9.25, 9.72, 10.13, 10.47];

/** Height of one rolling band, as a fraction of the tile. */
const BAND = (1 - HEAD) / BAND_DEG.length;

/**
 * A hair of overlap at every hinge.
 *
 * Two quads meeting exactly on an edge are antialiased separately, and the
 * board shows through the join as a hairline — seven of them up a bright cover.
 * Each slice is drawn one pixel past its own hinge instead. The plate geometry
 * below subtracts it back out, so the cover itself is never scaled by it.
 */
const BLEED = 1;

/**
 * How lit each hinge is, relative to the flat part of the note.
 *
 * A band's face starts pointing at the viewer and tilts upward as it rolls, so
 * it turns *into* a light coming from above and in front: the middle of the
 * curve is the brightest part, and the free edge falls away again past the
 * specular peak. That fall-off is the tell — a uniform gradient down the tile
 * reads as a gradient, while a bright band with darkness on both sides reads as
 * a curved surface.
 */
const LIT = (() => {
  const L = [0.6, 0.8]; // light direction, up and toward the viewer
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const lit = (L[0] * Math.sin(a) + L[1] * Math.cos(a)) / L[1] - 1;
    // Rounded, because these end up in the markup of every band of every card
    // and nobody needs seventeen digits of a lighting term.
    return Math.max(0, Math.round(lit * 1e4) / 1e4);
  };
  let cumulative = 0;
  // One value per hinge: the flat head, then the bottom edge of every band.
  return [at(0), ...BAND_DEG.map((d) => at((cumulative += d)))];
})();

/**
 * Where a slice's copy of the cover has to sit so the right part of it shows
 * through this band's window.
 *
 * The plate is always the full tile; the window is one band. Both are sized in
 * percentages of the window, which is the only unit available here — the tile's
 * pixel height is not known to CSS — so the bleed has to be subtracted out in
 * px at every term, or the cover would come out a fraction taller in each band
 * and the slices would not line up.
 */
function plate(skip: number, fraction: number, bleed: number): CSSProperties {
  const k = 1 / fraction; // the tile, measured in windows
  return {
    height: `calc(${(k * 100).toFixed(3)}% - ${(k * bleed).toFixed(3)}px)`,
    top: `calc(${(-skip * k * 100).toFixed(3)}% + ${(skip * k * bleed).toFixed(3)}px)`,
  };
}

/**
 * Roughly what share of the viewport a tile ends up occupying, so the browser
 * picks a sensible source. Only ever an estimate — a growing tile's real width
 * depends on what else landed on its line — and `sizes` is a hint, so erring
 * slightly wide is the safe direction.
 */
function sizesFor(work: Work): string {
  if (work.device === "mobile") return "(min-width: 768px) 20vw, 48vw";
  return work.width === "half"
    ? "(min-width: 768px) 50vw, 100vw"
    : "(min-width: 768px) 80vw, 100vw";
}

type WorkCardProps = {
  work: Work;
  /** Position in the rendered list — drives the alternating peel tilt. */
  index: number;
  /**
   * Whether this tile is one of the ones Chapter .04 peels. The index at
   * `/work` is a Server Component with no scroll rig, and a card there must
   * lie flat from the first paint rather than wait for a class it will never
   * be given.
   */
  peel?: boolean;
};

export default function WorkCard({ work, index, peel = false }: WorkCardProps) {
  const cover = work.cover;

  /**
   * One band's window onto the cover: a clipped box with the whole tile-sized
   * plate inside it, shifted so this band's part of the picture lands in view.
   *
   * `lit` runs from the band's top hinge to its bottom one, so the sheen is
   * continuous across the join rather than stepping band by band — seven flat
   * steps of brightness would give the curve away instantly.
   */
  const slice = (
    skip: number,
    fraction: number,
    bleed: number,
    litTop: number,
    litBottom: number,
  ) => (
    <span
      className="peel-face"
      style={
        {
          height: `calc(100% + ${bleed}px)`,
          // "--lit-a": litTop,
          // "--lit-b": litBottom,
        } as CSSProperties
      }
    >
      <span className="peel-plate" style={plate(skip, fraction, bleed)}>
        {cover ? (
          <Image
            // Cropped on Sanity's side to this tile's shape, so the editor's
            // hotspot decides what survives the cut rather than the centre of
            // the frame deciding it by default.
            //
            // Every band renders this same element with the same `sizes`, so
            // they resolve to one srcset candidate and the browser fetches and
            // decodes the cover once for the whole card.
            src={coverSrc(cover, work.device)}
            alt={cover.alt}
            fill
            sizes={sizesFor(work)}
            // The 20px preview Sanity extracts on upload. Absent only on assets
            // that predate metadata extraction, in which case the image pops in.
            {...(cover.lqip
              ? ({ placeholder: "blur", blurDataURL: cover.lqip } as const)
              : {})}
            className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder n={index + 1} />
        )}
      </span>
    </span>
  );

  /**
   * The chain, assembled from the free edge upward so each band can be nested
   * inside the one that carries it. Nesting is what makes the angles compound
   * into a curve — a flat list of siblings would need every band's position
   * worked out by hand, and would stop being a curve the moment one number
   * changed.
   */
  let bands: ReactNode = null;
  for (let i = BAND_DEG.length - 1; i >= 0; i--) {
    const tail = i === BAND_DEG.length - 1;
    const bleed = tail ? 0 : BLEED;
    bands = (
      <span
        key={i}
        className="peel-band"
        {...(tail ? { "data-tail": "" } : {})}
        style={
          {
            // The first band hangs off the head, which is a different height;
            // every band after it hangs off one of its own size.
            height: i === 0 ? `${((BAND / HEAD) * 100).toFixed(4)}%` : "100%",
            "--deg": `${BAND_DEG[i]}deg`,
          } as CSSProperties
        }
      >
        {slice(HEAD + i * BAND, BAND, bleed, LIT[i], LIT[i + 1])}
        {bands}
      </span>
    );
  }

  return (
    <Link
      href={`/work/${work.slug}`}
      className={`group block ${
        work.device === "mobile" ? PHONE_TILE : WIDTH[work.width]
      }`}
    >
      <div
        {...(peel ? { "data-peel": "" } : {})}
        style={
          // Alternating, so two tiles side by side never curl in step — the
          // whole point of a note is that it was placed by a hand.
          { "--peel-tilt": index % 2 === 0 ? "0.4deg" : "-0.4deg" } as CSSProperties
        }
        // No `overflow-hidden` and no ring here any more: both are grouping
        // properties, and a grouping property on this element would flatten the
        // whole chain of bands back into one plane. Each band clips and edges
        // its own slice instead.
        className={`peel-stage relative bg-transparent ${FRAME[work.device]}`}
      >
        <span
          className="peel-head"
          style={{ height: `${(HEAD * 100).toFixed(4)}%` }}
        >
          {slice(0, HEAD, BLEED, LIT[0], LIT[0])}
          {bands}

          {/* The chip, flush into the tile's top-right corner exactly as on the
              reference. It rides the head band, so it travels with the part of
              the note that stays flat and is never cut by a hinge.

              Last child and `peel-chip`, and both are load-bearing. Everything
              in here lives in a `preserve-3d` context, where `z-index` stops
              being the last word: siblings are sorted by depth, and the chip is
              exactly coplanar with an opaque slice that clips its own contents.
              A tie in depth is broken by paint order, and a tie is not
              something to rely on — so `peel-chip` gives it a real depth of its
              own, a hair in front of the note, and being written last settles
              the tie the same way in the engines that never got that far. */}
          <span className="peel-chip absolute right-0 top-0 max-w-[calc(100%-0.75rem)] truncate bg-acid px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-void">
            {work.kind}
          </span>
        </span>
      </div>

      {/* The caption is printed on the board, not on the note: it never peels,
          so the grid stays readable while the tiles are still settling. */}
      <div
        className={`mt-5 flex items-baseline justify-between gap-4 ${META_TYPE_BASE}`}
      >
        <span className="text-ink transition-colors group-hover:text-acid">
          {work.name}
        </span>
        <span className="tabular-nums text-muted">{work.year}</span>
      </div>
    </Link>
  );
}
