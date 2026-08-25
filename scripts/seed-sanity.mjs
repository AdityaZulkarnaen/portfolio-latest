/**
 * Puts the placeholder content into a fresh Sanity dataset.
 *
 * Run once, right after creating the project:
 *
 *     npm run sanity:seed
 *     npm run sanity:seed -- --only work  # just the projects
 *     npm run sanity:seed -- --dry-run    # print the NDJSON, import nothing
 *
 * It reads the same `lib/content/seed.json` the site falls back to, writes an
 * NDJSON file, and hands it to `sanity dataset import`. Document ids are
 * derived from the slug rather than generated, so re-running it replaces the
 * documents it wrote last time instead of producing a second set of eight.
 *
 * `--replace` means exactly that, and it is worth understanding before the
 * second run: a project you have since edited in the Studio will be reset to
 * the placeholder text. This script is for the empty-dataset moment.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

/**
 * Which document types to seed. Defaults to both.
 *
 * The reason this exists: `--replace` is per document id, so seeding a type you
 * have already written by hand is harmless to *your* documents but leaves four
 * placeholders sitting beside them to be deleted one at a time. Once a chapter
 * has real content in it, seed the other one on its own.
 */
const onlyFlag = process.argv.indexOf("--only");
const only = onlyFlag === -1 ? null : process.argv[onlyFlag + 1];

if (only && !["work", "experience"].includes(only)) {
  console.error(`--only takes "work" or "experience", got: ${only ?? "nothing"}`);
  process.exit(1);
}

/**
 * Node does not read `.env.local` on its own, and this script runs outside
 * Next. Deliberately minimal: `KEY=value`, no quote handling beyond stripping
 * a matched pair, no interpolation. A real value already in the environment
 * wins, so `NEXT_PUBLIC_SANITY_DATASET=staging npm run sanity:seed` works.
 */
function loadEnvLocal() {
  const file = resolve(root, ".env.local");
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;

    const match = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;

    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

/**
 * Plain paragraphs to Portable Text. Mirrors `toBlocks` in
 * `lib/content/seed.ts`; duplicated because this file is plain ESM run by
 * `node`, with no TypeScript loader in the way.
 */
function toBlocks(paragraphs) {
  return paragraphs.map((text, i) => ({
    _type: "block",
    _key: `p${i}`,
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: `p${i}s0`, text, marks: [] }],
  }));
}

const slugField = (current) => ({ _type: "slug", current });

loadEnvLocal();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

if (!projectId && !dryRun) {
  console.error(
    "NEXT_PUBLIC_SANITY_PROJECT_ID is not set.\n" +
      "Create a project first (npx sanity@latest projects create), then put the\n" +
      "id in .env.local. See README.md > Content.",
  );
  process.exit(1);
}

const seed = JSON.parse(
  readFileSync(resolve(root, "lib/content/seed.json"), "utf8"),
);

const documents = [
  ...(only === "experience" ? [] : seed.works).map((work) => ({
    _id: `work.${work.slug}`,
    _type: "work",
    name: work.name,
    slug: slugField(work.slug),
    year: work.year,
    kind: work.kind,
    role: work.role,
    summary: work.summary,
    body: toBlocks(work.bodyParagraphs),
    stack: work.stack,
    span: work.span,
    spanSm: work.spanSm,
    ratio: work.ratio,
    featured: work.featured,
    position: work.position,
  })),
  ...(only === "work" ? [] : seed.experiences).map((item) => ({
    _id: `experience.${item.slug}`,
    _type: "experience",
    role: item.role,
    org: item.org,
    slug: slugField(item.slug),
    summary: item.summary,
    period: item.period,
    position: item.position,
  })),
];

const ndjson = documents.map((doc) => JSON.stringify(doc)).join("\n");

if (dryRun) {
  console.log(ndjson);
  console.error(`\n--dry-run: ${documents.length} documents, nothing imported.`);
  process.exit(0);
}

const ndjsonPath = resolve(root, ".sanity-seed.ndjson");
writeFileSync(ndjsonPath, ndjson);

console.log(
  `Importing ${documents.length} documents into ${projectId}/${dataset}…`,
);

const result = spawnSync(
  "npx",
  [
    "--yes",
    "sanity",
    "dataset",
    "import",
    ndjsonPath,
    // A flag, not a positional: the CLI deprecated the positional form.
    "--dataset",
    dataset,
    "--replace",
  ],
  // `shell: true` because on Windows the CLI is a .cmd shim, which `spawnSync`
  // will not execute directly.
  { cwd: root, stdio: "inherit", shell: true },
);

unlinkSync(ndjsonPath);

if (result.status !== 0) {
  console.error(
    "\nImport failed. If it was an auth error, run `npx sanity@latest login` first.",
  );
}

process.exit(result.status ?? 1);
