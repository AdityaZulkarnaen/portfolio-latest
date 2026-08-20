/**
 * Every user-facing string in Chapter .05, plus the record itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  The four entries below are real, the prose around three of them is not.
 *  `summary` and `period` for GAMAFORCE, KATY and UGM BCC are placeholders in
 *  the same sense as `works-copy` — plausible shape, wrong facts. Replace them
 *  before this ships. The GDGoC entry is the one that came with the design and
 *  is left verbatim.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ordered oldest first. That ordering is load-bearing, not editorial: the
 * stack in `experience.tsx` closes each card under the next one, so the last
 * entry in this array is the one left open at the end of the chapter. Put the
 * current role last or the section ends on something you have finished.
 */

export type Experience = {
  /** React key. Unique, and stable across edits to the copy. */
  slug: string;
  /** The big line. Sentence case — this chapter is not shouting. */
  role: string;
  /** Sits beside the role, smaller. The place, not the job. */
  org: string;
  /** The open card's body. Two or three sentences; the bar is short. */
  summary: string;
  /** Free text, not dates — a role may run "2024 – Present". */
  period: string;
};

export const experiences: Experience[] = [
  {
    slug: "gamaforce",
    role: "Software Programmer",
    org: "GAMAFORCE",
    summary:
      "PLACEHOLDER. Writing software for the team's unmanned aerial systems — ground-control tooling and the interfaces the crew actually flies with. Replace this with what you built, what constrained it, and what you decided.",
    period: "PLACEHOLDER — 2023",
  },
  {
    slug: "katy-sman1-yogyakarta",
    role: "Frontend Developer",
    org: "KATY SMAN 1 Yogyakarta",
    summary:
      "PLACEHOLDER. Front-end work on the school's own web platform: turning the design into responsive, accessible screens and keeping one component set honest as the scope grew. Replace with the real account.",
    period: "PLACEHOLDER — 2024",
  },
  {
    slug: "ugm-bcc",
    role: "Backend Mentee",
    org: "UGM BCC",
    summary:
      "PLACEHOLDER. Backend track at the Basic Computing Community — services, data models and API design, learned by shipping small systems end to end and having them reviewed. Replace with the real account.",
    period: "PLACEHOLDER — 2025",
  },
  {
    slug: "gdgoc-ugm",
    role: "Hacker Frontend",
    org: "Google Developer Groups on Campus",
    summary:
      "Representing GDGoC UGM in the Google Solution Challenge, I serve as a Front-End Developer tasked with engineering an intuitive and performance-optimized application. My role involves transforming complex social challenges into user-centric digital experiences, leveraging modern web technologies to build a solution that is not only functional but also scalable for real-world implementation.",
    period: "December 2025 – July 2026",
  },
];

export const experienceCopy = {
  eyebrow: "--- Chapter .05",
  chapter: "Experiences",
  /** The one heading, set in sentence case exactly as drawn. */
  heading: "My past work and organization experience.",
  /** Screen-reader name for the list, which is otherwise headed by nothing. */
  listLabel: "Work and organization experience",
  seamLeft: "CHAPTER .05 // EXPERIENCE",
  hint: "SCROLL TO CLOSE THE STACK",
} as const;
