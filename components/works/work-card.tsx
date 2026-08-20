import Image from "next/image";
import Link from "next/link";
import { META_TYPE_BASE } from "@/lib/site-config";
import CoverPlaceholder from "./cover-placeholder";
import { type Work, type WorkRatio } from "./works-copy";

/**
 * Span classes have to exist as literal strings in the source for Tailwind to
 * generate them — a template literal built at runtime produces nothing.
 */
const SPAN_SM: Record<Work["spanSm"], string> = {
  6: "col-span-6",
  12: "col-span-12",
};

const SPAN_MD: Record<Work["span"], string> = {
  4: "md:col-span-4",
  6: "md:col-span-6",
  8: "md:col-span-8",
  12: "md:col-span-12",
};

const RATIO: Record<WorkRatio, string> = {
  wide: "aspect-[16/10]",
  square: "aspect-[4/3]",
  tall: "aspect-[3/4]",
};

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
  return (
    <Link
      href={`/work/${work.slug}`}
      className={`group block ${SPAN_SM[work.spanSm]} ${SPAN_MD[work.span]}`}
    >
      <div
        {...(peel ? { "data-peel": "" } : {})}
        style={
          // Alternating, so two tiles side by side never curl in step — the
          // whole point of a note is that it was placed by a hand.
          { "--peel-tilt": index % 2 === 0 ? "0.4deg" : "-0.4deg" } as React.CSSProperties
        }
        className={`relative overflow-hidden bg-[#101014] ring-1 ring-ink/[0.08] ${RATIO[work.ratio]}`}
      >
        {work.cover ? (
          <Image
            src={work.cover}
            alt={work.alt}
            fill
            sizes="(min-width: 768px) 66vw, 100vw"
            className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder n={index + 1} />
        )}

        {/* The chip, flush into the tile's top-right corner exactly as on the
            reference. Inside the tile rather than beside it, so it curls with
            the note instead of floating off it. */}
        <span
          className="absolute right-0 top-0 z-10 bg-acid px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-void"
        >
          {work.kind}
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
