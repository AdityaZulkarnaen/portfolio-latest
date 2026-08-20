import { worksCopy } from "./works-copy";

type CoverPlaceholderProps = {
  /** 1-based slot number, so a grid of empties still reads as an ordered set. */
  n: number;
};

/**
 * Stand-in until the real shots land in `public/works/`.
 *
 * Same bargain as the photo deck's placeholder and the stack's drawn tiles: the
 * chapter has to be presentable before the artwork exists, and an empty `cover`
 * must cost a calibration frame rather than a broken image.
 */
export default function CoverPlaceholder({ n }: CoverPlaceholderProps) {
  return (
    <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#15151b,#0a0a0d)]">
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(242,242,240,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(242,242,240,0.045)_1px,transparent_1px)] bg-[size:28px_28px]"
      />
      <span className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-ink/35">
        {worksCopy.awaiting} {String(n).padStart(2, "0")}
      </span>
    </span>
  );
}
