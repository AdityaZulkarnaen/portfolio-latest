/** Every user-facing string in Chapter .02 lives here, mirroring `hero-copy`. */
export const aboutCopy = {
  eyebrow: "--- Chapter .02",
  chapter: "About Me",
  /** Marquee phrases. Rendered in BlurWeb; the separator is added by the band. */
  roles: [
    "FULL STACK WEB DEVELOPER",
    "MOBILE APP ENGINEER",
    "UI DESIGNER",
  ],
  name: "Aditya Lucky Zulkarnaen",
  bio: [
    "‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ My name is Aditya Lucky Zulkarnaen, I am a undergraduate student at Universitas Gadjah Mada, majoring in Software Engineering. I have a strong passion for Software Development and Data Engineering.", "I explore how to create seamless design experiences into scalable architectures, building systems that are not only functional but also intuitive and visually appealing."
  ],
  resume: "See My Resume",
  resumeHref: "/resume.pdf",
  /** Left of the seam that closes over the hero. */
  seamLeft: "CHAPTER .02 // ABOUT",
  seamRight: "SECTION LOCKED",
  deckLabel: "IMG",
  deckHint: "CLICK TO ADVANCE",
  /**
   * Drop files into `public/photos/` and point `src` at them. An empty `src`
   * renders the calibration placeholder instead of a broken image, so the deck
   * is presentable before the shoot exists.
   */
  photos: [
    { src: "", alt: "Aditya at work", caption: "STUDIO — 2026" },
    { src: "", alt: "Aditya presenting", caption: "FIELD NOTES" },
    { src: "", alt: "Aditya on location", caption: "OFF THE CLOCK" },
    { src: "", alt: "Aditya portrait", caption: "PORTRAIT — 01" },
  ],
} as const;

export type AboutPhoto = (typeof aboutCopy.photos)[number];
