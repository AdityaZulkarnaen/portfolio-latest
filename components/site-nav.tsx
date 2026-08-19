import Link from "next/link";
import { META_TYPE, siteConfig } from "@/lib/site-config";

/**
 * Global fixed navigation. A Server Component — it has no state, so it costs
 * nothing on the client.
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
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-void via-void/70 to-transparent"
      />

      <div
        className={`relative flex items-start justify-between p-5 md:p-8 ${META_TYPE}`}
      >
        <Link href="/" className="transition-colors hover:text-acid">
          {siteConfig.brand}
          <span className="text-acid">.</span>
        </Link>

        <nav aria-label="Main" className="hidden gap-7 sm:flex">
          {siteConfig.nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-acid"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
