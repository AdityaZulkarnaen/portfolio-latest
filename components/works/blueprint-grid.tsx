/** Pitch of the horizontal rules, and of the crossings along each column. */
const PITCH = 220;

/** Column positions, as percentages of the section width. */
const COLUMNS = [0, 25, 50, 75, 100] as const;

/** Length of the brighter arm drawn through each crossing. */
const ARM = 11;

const HAIRLINE = "rgba(242, 242, 240, 0.055)";
const CROSSING = "rgba(242, 242, 240, 0.22)";

/**
 * The registration grid Chapter .04 is laid out on: faint rules with a brighter
 * mark at every crossing, in the register of a printer's guide.
 *
 * Built out of two repeating gradients and five spans rather than an SVG
 * pattern, for one reason: the columns have to sit at percentages of the
 * section — the same proportional divisions the cards are laid out on — while
 * the crossing marks stay a fixed size in pixels. An SVG `pattern` can do one
 * or the other, not both, and a fixed pixel pitch would drift off the layout
 * the moment the viewport changed.
 *
 * No state, no measurement, no client JS: it is a Server Component and stays
 * one.
 */
export default function BlueprintGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, ${HAIRLINE} 0 1px, transparent 1px ${PITCH}px)`,
      }}
    >
      {COLUMNS.map((x) => (
        <span
          key={x}
          className="absolute top-0 h-full w-px"
          style={{
            // The last column would otherwise hang its own width outside the
            // section and be clipped away entirely.
            left: x === 100 ? "calc(100% - 1px)" : `${x}%`,
            backgroundColor: HAIRLINE,
          }}
        >
          {/* The crossings. Same pitch and same origin as the rules above, so
              the two land on each other and read as one mark rather than as a
              bar floating near a line. */}
          <span
            className="absolute top-0 h-full"
            style={{
              left: `${-(ARM - 1) / 2}px`,
              width: `${ARM}px`,
              backgroundImage: `repeating-linear-gradient(to bottom, ${CROSSING} 0 1px, transparent 1px ${PITCH}px)`,
            }}
          />
        </span>
      ))}
    </div>
  );
}
