import Link from "next/link";
import SiteMenu from "@/components/site-menu";
import { siteConfig } from "@/lib/site-config";

/**
 * Global fixed navigation.
 *
 * Still a Server Component. The header, the scrim and the brand are static, and
 * the brand is handed to `SiteMenu` as a prop rather than rendered inside it —
 * so the one interactive piece is the only piece that ships any JavaScript.
 *
 * `SiteMenu` owns the row itself, because the row is `mix-blend-difference` and
 * the panel that slides in below `sm` must not be: they have to be siblings,
 * and something has to render both.
 *
 * Sits at z-40: above the hero content (z-10) but below the hero's loader veil
 * (z-50), so the nav is revealed as the veil wipes up rather than sitting on
 * top of it.
 */
export default function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      {/* Scrim: the nav no longer fades out with the hero, so it has to stay
          readable once the wordmark dissolves into dust across the whole frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-transparent"
      />

      <SiteMenu
        brand={
          <Link href="/" className="transition-colors hover:text-acid">
            {siteConfig.brand}
            <span data-nav-dot className="text-acid">
              .
            </span>
          </Link>
        }
      />
    </header>
  );
}
