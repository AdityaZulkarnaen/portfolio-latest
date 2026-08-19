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

/** Shared monospace label treatment used by the nav and the hero meta row. */
export const META_TYPE =
  "font-mono text-[11px] uppercase tracking-[0.18em] text-ink";
