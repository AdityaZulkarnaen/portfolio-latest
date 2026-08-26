/**
 * Reports — and optionally enforces a ceiling on — the JavaScript a route
 * actually executes on first load.
 *
 * Reads the prerendered HTML rather than any build manifest, because the
 * manifest describes the module graph and this question is about the `<script>`
 * tags a browser really receives. That distinction is the whole point: the
 * regression this exists to catch was three.js arriving in a `<script async>`
 * on the homepage while two `next/dynamic` boundaries insisted it could not.
 * The graph looked lazy. The HTML was not.
 *
 *   node scripts/bundle-budget.mjs            # report every prerendered route
 *   node scripts/bundle-budget.mjs --check    # exit 1 if a route is over budget
 *
 * Run it after `next build`.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const APP = path.join(ROOT, ".next", "server", "app");
const NEXT = path.join(ROOT, ".next");

/**
 * Ceilings in KB of gzipped eager JS, by route.
 *
 * Set from the measured numbers after the three.js split, with roughly 15% of
 * headroom — tight enough that adding a library to an eager component trips it,
 * loose enough that ordinary feature work does not. `default` covers any route
 * without an entry of its own.
 */
const BUDGET_KB = {
  "/": 290,
  default: 290,
};

/** Markers that name what a chunk is, so a report says something useful. */
const FINGERPRINTS = [
  ["three", /WebGLRenderer|THREE\.Scene/],
  ["r3f", /react-three|useFrame/],
  ["gsap", /ScrollTrigger|gsap/],
  ["lenis", /Lenis|lenis/],
  ["react-dom", /react-dom|scheduler/],
];

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

/** The route a prerendered file corresponds to, for display and budgeting. */
function routeOf(file) {
  const rel = path.relative(APP, file).replace(/\\/g, "/");
  const route = "/" + rel.replace(/\.html$/, "");
  return route === "/index" ? "/" : route.replace(/\/index$/, "");
}

async function measure(file) {
  const html = await readFile(file, "utf8");

  // Only `<script src>`. A `<link rel=preload>` is a hint the browser may
  // ignore and does not execute; counting it would overstate the cost, and
  // more importantly would hide the difference between the two — which is
  // exactly the difference that matters here.
  const srcs = [
    ...html.matchAll(/<script[^>]+src="(\/_next\/static\/[^"]+\.js)"/g),
  ].map((m) => m[1]);

  const seen = new Set();
  const chunks = [];
  let rawTotal = 0;
  let gzipTotal = 0;

  for (const src of srcs) {
    if (seen.has(src)) continue;
    seen.add(src);

    const disk = path.join(NEXT, src.replace("/_next/", ""));
    if (!existsSync(disk)) continue;

    const buf = await readFile(disk);
    const gz = gzipSync(buf).length;
    rawTotal += buf.length;
    gzipTotal += gz;

    const head = buf.toString("utf8", 0, Math.min(buf.length, 400_000));
    const tags = FINGERPRINTS.filter(([, re]) => re.test(head)).map(([n]) => n);

    chunks.push({ src, raw: buf.length, gz, tags });
  }

  chunks.sort((a, b) => b.gz - a.gz);
  return { chunks, rawTotal, gzipTotal };
}

const kb = (n) => Math.round(n / 1024);

const check = process.argv.includes("--check");

if (!existsSync(APP)) {
  console.error("No .next/server/app — run `next build` first.");
  process.exit(1);
}

let failed = false;

for (const file of (await htmlFiles(APP)).sort()) {
  // Skip the tiny prerendered error shells; they are not routes anyone lands on.
  if ((await stat(file)).size < 1024) continue;

  const route = routeOf(file);
  const { chunks, rawTotal, gzipTotal } = await measure(file);
  if (chunks.length === 0) continue;

  const budget = BUDGET_KB[route] ?? BUDGET_KB.default;
  const over = kb(gzipTotal) > budget;
  if (over) failed = true;

  console.log(
    `\n${route}  ${kb(gzipTotal)}KB gzip / ${kb(rawTotal)}KB raw` +
      `  [budget ${budget}KB]${over ? "  ** OVER **" : ""}`,
  );

  for (const c of chunks) {
    if (c.gz < 2048) continue;
    const tags = c.tags.length ? `  <- ${c.tags.join(", ")}` : "";
    console.log(`  ${String(kb(c.gz)).padStart(5)}KB  ${c.src}${tags}`);
  }
}

if (check && failed) {
  console.error("\nEager JS over budget. See scripts/bundle-budget.mjs.");
  process.exit(1);
}
