import Link from "next/link";
import { META_TYPE_BASE } from "@/lib/site-config";

type BackLinkProps = {
  href: string;
  children: React.ReactNode;
};

/**
 * The way out of a page that is not the home page.
 *
 * A bordered box rather than the bare rule-and-label these two pages carried
 * before. The label was the same either way; what was missing was any sign
 * that it could be pressed — on a page whose every other line is also mono
 * caps, a back link set in mono caps is furniture, not a control. The border is
 * the whole point of this component.
 *
 * The rule leads rather than follows, because this one goes back: the same mark
 * that reaches forward out of "ALL WORKS" and "NEXT PROJECT" is put in front of
 * the label here, and it grows on hover the way every other one on the site
 * does.
 */
export default function BackLink({ href, children }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 border border-line px-4 py-3 text-ink transition-colors hover:border-acid hover:text-acid ${META_TYPE_BASE}`}
    >
      <span
        aria-hidden
        className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
      />
      {children}
    </Link>
  );
}
