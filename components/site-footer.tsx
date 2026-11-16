import FooterWordmark from "@/components/footer-wordmark";
import SiteTexture from "@/components/site-texture";
import { footerConfig, META_TYPE_BASE } from "@/lib/site-config";
import AsciiLayer from "@/components/ascii/ascii-layer";

/**
 * The foot of every page.
 *
 * Night. The page is one day read top to bottom — the hero's evening garden,
 * midnight, stars, dawn, the day sky of Chapter .06, dusk over the contact
 * form — and this is where it ends: indigo rather than the void, so it reads
 * as the sky at the last hour, not as one more dark chapter. Back to top lands
 * on the hero's night again, which is the loop closing.
 *
 * It declares `void` to `site-ground.tsx` for the same reason Chapter .07
 * does: a dark ground wants the default chrome, and the flag hands it back
 * from the light ground above instead of leaving it stale.
 *
 * No `data-chapter` — it is not one, and the rail should not grow a tick for
 * the furniture.
 *
 * A Server Component. The only thing that moves is the wordmark, and it
 * moves behind its own client boundary.
 */
export default function SiteFooter() {
  const links = footerConfig.social.filter((item) => item.href !== "");

  return (
    <footer
      data-ground="void"
      // Above Chapter .06 (z-[37]), below the fixed nav (z-40).
      className="relative z-[38] w-full bg-night text-ink"
    >
      <SiteTexture className="text-lilac opacity-[0.08]" />
      {/* 23:59 — moon, stars, and the garden's grass in silhouette. */}
      <AsciiLayer scene="night" cell={15} className="z-0" />

      {/* `relative`, for the same reason Chapter .06 needs it. */}
      <div className="relative mx-auto w-full max-w-[110rem] px-5 pb-8 pt-14 sm:pr-[var(--rail-gutter)] md:px-8 md:pb-10 md:pt-20">
        {/* The wordmark, and its echoes.
            Four copies of one word, coincident at rest and scrubbed apart as
            the footer comes in — see `footer-wordmark.tsx`. The only client
            component under this roof; everything else here is static, so it
            stays behind its own boundary rather than making the footer one. */}
        <FooterWordmark word={footerConfig.wordmark} />

        <div className="mt-10 grid gap-x-8 gap-y-10 border-t-2 border-ink/80 pt-8 md:mt-14 md:grid-cols-12">
          <p className="max-w-[46ch] font-sans text-base leading-relaxed md:col-span-5 md:text-lg">
            {footerConfig.tagline.map((part, i) =>
              part.strong ? (
                <strong key={i} className="font-bold">
                  {part.text}
                </strong>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>

          {/* Two columns of two, each hung under its own rule — the same way
              the chapter rail hangs a mark off a hairline. Nothing here is
              rendered for a profile with no address behind it: a footer full of
              links that go nowhere is worse than a shorter footer. */}
          {links.length > 0 ? (
            <nav
              aria-label="Elsewhere"
              className="grid grid-cols-2 gap-x-8 gap-y-6 md:col-span-6 md:col-start-7"
            >
              {links.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  // `noopener` is the one that matters: without it the page
                  // opened here can reach back through `window.opener` and
                  // navigate this one.
                  rel="noreferrer noopener"
                  className="group flex items-center justify-between gap-4 border-t border-ink/25 pt-3 font-sans text-lg transition-colors hover:text-acid"
                >
                  {item.label}
                  {/* The mark for "this leaves the site", set at the far end of
                      the rule so the column reads as a name and its exit rather
                      than a name with a decoration after it. Drawn rather than
                      typed: ↗ sits on a different baseline in every fallback
                      face, and this one has to line up with the rule above it.

                      Sized in `em` so it tracks the label, and `aria-hidden`
                      because `target="_blank"` is what actually says this to a
                      screen reader. */}
                  <svg
                    aria-hidden
                    viewBox="0 0 12 12"
                    className="h-[0.62em] w-[0.62em] shrink-0 transition-transform duration-300 ease-out group-hover:-translate-y-[0.12em] group-hover:translate-x-[0.12em]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="square"
                  >
                    <path d="M1.6 10.4 10.4 1.6M3.9 1.6h6.5v6.5" />
                  </svg>
                </a>
              ))}
            </nav>
          ) : null}
        </div>

        <div
          className={`mt-14 flex flex-wrap items-baseline justify-between gap-4 text-muted md:mt-20 ${META_TYPE_BASE}`}
        >
          {/* The year is read at render. A hard-coded one is wrong every
              January, and nobody remembers a footer in January. */}
          <span>
            © {new Date().getFullYear()} {footerConfig.rights}
          </span>
          <span>{footerConfig.colophon}</span>
        </div>
      </div>
    </footer>
  );
}
