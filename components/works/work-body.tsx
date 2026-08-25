import { PortableText, type PortableTextComponents } from "next-sanity";

import type { PortableTextBlock } from "@/lib/content/types";

/**
 * The case study's prose.
 *
 * Portable Text rather than an array of strings, which is what this was before
 * the content moved into Sanity. The gain is not formatting for its own sake:
 * a case study that cannot link to the thing it describes, or emphasise the one
 * decision it turned on, is a worse record than one that can.
 *
 * The schema offers exactly what is styled here — one paragraph style, bold,
 * italic and links — and nothing else, so an editor cannot produce a block that
 * comes out unstyled. If a heading level is ever wanted, it has to be added in
 * both places or not at all.
 */
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="max-w-[62ch] font-sans text-lg leading-relaxed text-ink/80">
        {children}
      </p>
    ),
  },
  marks: {
    strong: ({ children }) => (
      <strong className="font-semibold text-ink">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    link: ({ children, value }) => (
      <a
        href={value?.href as string}
        target="_blank"
        rel="noreferrer"
        className="text-acid underline decoration-acid/40 underline-offset-4 transition-opacity hover:opacity-70"
      >
        {children}
      </a>
    ),
  },
};

export default function WorkBody({ value }: { value: PortableTextBlock[] }) {
  return (
    <div className="space-y-6">
      <PortableText value={value} components={components} />
    </div>
  );
}
