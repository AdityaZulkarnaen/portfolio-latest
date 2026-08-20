/**
 * Every user-facing string in Chapter .04, plus the project data itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER CONTENT. Every project below is a slot, not a real project.
 *  Names are deliberately generic so nothing here can be mistaken for shipped
 *  work. Replace `name`, `year`, `summary`, `role`, `stack` and `cover` — the
 *  section, the index and the detail pages all read from this one array, so
 *  there is no second place to update.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `cover` follows the same convention as `aboutCopy.photos` and the stack
 * logos: an empty string renders the calibration placeholder rather than a
 * broken image, so the chapter is presentable before the artwork exists.
 */

export type WorkRatio = "wide" | "square" | "tall";

export type Work = {
  /** URL segment. Also the React key, so it has to be unique. */
  slug: string;
  name: string;
  /** Free text, not a number — a project may run "2024–2026". */
  year: string;
  /** The acid chip on the tile. Kept short; it is set in 10px mono. */
  kind: string;
  role: string;
  /** One line under the title on the detail page. */
  summary: string;
  /** Longer body for the detail page. One string per paragraph. */
  body: string[];
  stack: string[];
  /** Drop files into `public/works/` and point this at them. */
  cover: string;
  /** Alt text for `cover`. Ignored while the placeholder is showing. */
  alt: string;
  /** Columns out of 12, from `md` up. */
  span: 4 | 6 | 8 | 12;
  /** Columns out of 12 below `md`, where the grid is still 12 wide. */
  spanSm: 6 | 12;
  ratio: WorkRatio;
  /** Chapter .04 shows only these. The index at /work shows everything. */
  featured: boolean;
  /** Optional outbound links, rendered on the detail page when present. */
  live?: string;
  repo?: string;
};

export const works: Work[] = [
  {
    slug: "commerce-platform",
    name: "Commerce Platform",
    year: "2025",
    kind: "CODING PROJECT",
    role: "Full-stack",
    summary: "A storefront and its back office, built as one deployable.",
    body: [
      "Placeholder body copy. Replace with what the project actually was, what made it hard, and what you decided — a case study is a record of judgement, not a feature list.",
      "Two or three paragraphs is usually the right length. The detail page renders one paragraph per string in this array.",
    ],
    stack: ["Next.js", "TypeScript", "Laravel", "Supabase"],
    cover: "",
    alt: "",
    span: 8,
    spanSm: 12,
    ratio: "wide",
    featured: true,
  },
  {
    slug: "campus-superapp",
    name: "Campus Superapp",
    year: "2025",
    kind: "MOBILE",
    role: "Mobile engineer",
    summary: "One app for everything a campus makes students queue for.",
    body: [
      "Placeholder body copy. Replace with the real account of the project.",
    ],
    stack: ["Flutter", "Firebase", "Kotlin"],
    cover: "",
    alt: "",
    span: 4,
    spanSm: 12,
    ratio: "tall",
    featured: true,
  },
  {
    slug: "realtime-dashboard",
    name: "Realtime Dashboard",
    year: "2024",
    kind: "CODING PROJECT",
    role: "Frontend / data",
    summary: "Live operational telemetry, readable at a glance.",
    body: [
      "Placeholder body copy. Replace with the real account of the project.",
    ],
    stack: ["React", "TypeScript", "Python", "Docker"],
    cover: "",
    alt: "",
    span: 6,
    spanSm: 12,
    ratio: "square",
    featured: true,
  },
  {
    slug: "vision-pipeline",
    name: "Vision Pipeline",
    year: "2024",
    kind: "MACHINE LEARNING",
    role: "Data engineer",
    summary: "Training and serving a model without two codebases.",
    body: [
      "Placeholder body copy. Replace with the real account of the project.",
    ],
    stack: ["PyTorch", "TensorFlow", "Python"],
    cover: "",
    alt: "",
    span: 6,
    spanSm: 12,
    ratio: "square",
    featured: true,
  },
  {
    slug: "onchain-ledger",
    name: "Onchain Ledger",
    year: "2023",
    kind: "WEB3",
    role: "Contracts / frontend",
    summary: "Settlement that anyone can audit and nobody can quietly edit.",
    body: [
      "Placeholder body copy. Replace with the real account of the project.",
    ],
    stack: ["Solidity", "Next.js", "TypeScript"],
    cover: "",
    alt: "",
    span: 6,
    spanSm: 6,
    ratio: "square",
    featured: true,
  },
  {
    slug: "design-system",
    name: "Design System",
    year: "2023",
    kind: "UI SYSTEM",
    role: "Designer / engineer",
    summary: "The tokens, the components, and the rules that keep them honest.",
    body: [
      "Placeholder body copy. Replace with the real account of the project.",
    ],
    stack: ["Figma", "React", "Tailwind CSS"],
    cover: "",
    alt: "",
    span: 6,
    spanSm: 6,
    ratio: "square",
    featured: true,
  },

  /* Not featured. These two exist so the distinction is real rather than
     theoretical: Chapter .04 shows six, /work shows all eight. Delete them if
     everything you have is worth featuring — but then the "ALL WORKS" door
     leads to the same six tiles, and it should probably not be there. */
  {
    slug: "type-specimen",
    name: "Type Specimen",
    year: "2022",
    kind: "CODING PROJECT",
    role: "Designer / engineer",
    summary: "A variable-font specimen you can drag around.",
    body: [
      "Placeholder body copy. Replace with the real account of the project.",
    ],
    stack: ["JavaScript", "Figma"],
    cover: "",
    alt: "",
    span: 6,
    spanSm: 6,
    ratio: "square",
    featured: false,
  },
  {
    slug: "queue-service",
    name: "Queue Service",
    year: "2022",
    kind: "BACKEND",
    role: "Backend",
    summary: "Jobs that survive a deploy, a crash, and a bad Tuesday.",
    body: [
      "Placeholder body copy. Replace with the real account of the project.",
    ],
    stack: ["Java", "Docker", "PHP"],
    cover: "",
    alt: "",
    span: 6,
    spanSm: 6,
    ratio: "square",
    featured: false,
  },
];

/**
 * Chapter .04 is a selection, not the archive — that is the whole point of a
 * featured strip, and the reason `/work` exists to hold the rest.
 */
export const featuredWorks = works.filter((work) => work.featured);

export const worksCopy = {
  eyebrow: "--- Chapter .04",
  chapter: "Selected Work",
  heading: "FEATURED",
  /** Right of the section head, linking to the full index. */
  allLabel: "ALL WORKS",
  allHref: "/work",
  seamLeft: "SELECTED // NOT THE ARCHIVE",
  /** Sits under the grid, in the reference's bottom-corner register. */
  hint: "CLICK A TILE TO OPEN THE CASE",

  /** The index at /work. */
  indexEyebrow: "INDEX // ALL WORKS",
  indexHeading: "ALL WORKS",
  indexBack: "BACK TO INDEX",

  /** The detail page. */
  backLabel: "ALL WORKS",
  roleLabel: "ROLE",
  yearLabel: "YEAR",
  stackLabel: "STACK",
  liveLabel: "VISIT LIVE",
  repoLabel: "SOURCE",
  nextLabel: "NEXT PROJECT",
  /** Shown in place of a cover while `cover` is still empty. */
  awaiting: "AWAITING FILE",
} as const;
