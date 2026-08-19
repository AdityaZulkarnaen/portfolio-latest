/** Site-wide chrome. Lives outside the hero because the nav is global now. */
export const siteConfig = {
  brand: "ADITYA Z",
  nav: [
    { label: "INDEX", href: "#" },
    { label: "WORK", href: "#" },
    { label: "ABOUT", href: "#" },
    { label: "CONTACT", href: "#" },
  ],
} as const;

/**
 * Shared monospace label treatment. `META_TYPE_BASE` carries everything except
 * the colour, so sections that invert the ground (Chapter .02 sits on the slab)
 * can pick their own without fighting utility order.
 */
export const META_TYPE_BASE = "font-mono text-[11px] uppercase tracking-[0.18em]";

/** The default, on-void variant used by the nav and the hero meta row. */
export const META_TYPE = `${META_TYPE_BASE} text-ink`;
