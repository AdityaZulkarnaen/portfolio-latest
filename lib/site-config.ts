/**
 * Site-wide chrome. Lives outside the hero because the nav is global now.
 *
 * The nav is a written list rather than something read out of the DOM, and the
 * difference matters: the rail can afford to discover its ticks at runtime
 * because it is decoration, while a menu has to be in the HTML the server
 * sends. Derived on the client it would arrive a frame late on every load, and
 * would not exist at all without JavaScript.
 *
 * `mark` and `label` mirror `data-chapter` and `data-chapter-name` on the
 * sections themselves, so the menu and the rail read the same. `href` is
 * root-relative on purpose — from a case page these are real links home to a
 * section, and `site-menu.tsx` only takes the click when the target is on the
 * page already.
 *
 * A new section joins the menu here, in one line, once it has the matching
 * `id` on its chapter wrapper.
 */
export const siteConfig = {
  brand: "ADITYA Z",
  nav: [
    { mark: ".01", label: "Intro", href: "/#hero" },
    { mark: ".02", label: "About", href: "/#about" },
    { mark: ".03", label: "Stack", href: "/#tech" },
    { mark: ".04", label: "Works", href: "/#work" },
    { mark: ".05", label: "Experience", href: "/#experience" },
    // { mark: ".06", label: "Contact", href: "/#contact" },
  ],
} as const;

export type NavItem = (typeof siteConfig.nav)[number];

/**
 * Shared monospace label treatment. `META_TYPE_BASE` carries everything except
 * the colour, so sections that invert the ground (Chapter .02 sits on the slab)
 * can pick their own without fighting utility order.
 */
export const META_TYPE_BASE = "font-mono text-[11px] uppercase tracking-[0.18em]";

/** The default, on-void variant used by the nav and the hero meta row. */
export const META_TYPE = `${META_TYPE_BASE} text-ink`;
