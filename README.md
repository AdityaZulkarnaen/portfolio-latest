# portfolio-latest

Aditya Zulkarnaen's portfolio. Next.js 16 (App Router, Turbopack), Tailwind v4,
GSAP + Lenis for the scroll rig, React Three Fiber for Chapters .01 and .03, and
Sanity for the content in Chapters .04 and .05.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The site runs without any Sanity setup — see
below.

## Layout

`app/` has **two root layouts**, which is why the route groups are there:

| Path | What it is |
| --- | --- |
| `app/(site)/` | The site. Nav, pointer trail, Lenis smooth scroll, Tailwind. |
| `app/(studio)/studio/[[...tool]]` | The Sanity Studio, with none of the above. |
| `app/api/revalidate` | The webhook that makes a Studio edit show up on the site. |

Navigating between `/studio` and the site is a full page load. That is the
documented cost of separate root layouts, and it is the right trade here: the
site's Lenis instance hijacks wheel events document-wide and would break every
scroll container in the Studio.

## Content

Chapters .02 (About), .03 (Tech stack), .04 (Works) and .05 (Experience) come
from Sanity. Chapter .06 (Contact) writes *into* it — see **The contact form**
below. Everything else — the hero, and every label and heading — is copy in the
repo, in the `*-copy.ts` files beside each chapter. That split is deliberate:
content changes on its own schedule, chrome changes when the design does.

Chapter .02 is the one singleton. It is reached by its own item in the Studio's
sidebar rather than through a list, and it is deliberately missing from the
"create new" menu: the site reads the first `about` document in the dataset, so
a second one would not be an extra entry anywhere — it would quietly be the
chapter half the time. Its photographs are one box that dissolves through
pixels from the centre on each change, so shots that share a composition read as
one photo resolving into the next; upload them in the order you want them
cycled. An empty array draws the calibration frame rather than an empty box.

Chapter .03 splits along that line inside one chapter: the Studio holds each
tool's name, initials, logo and whether the mark is reversed; the bone it is
reversed *into* stays in `tech-copy.ts`, because that is a decision about this
ground, not about the tool. The seam line counts the tools it was handed rather
than stating a number, so it cannot go stale behind the dataset.

```
lib/content/types.ts    the shape the site renders
lib/content/source.ts   the only door between the site and its content
lib/content/seed.json   placeholder content: the fallback, and the seed
lib/sanity/queries.ts   GROQ
sanity/schema/          what the Studio shows an editor
```

### Before Sanity is configured

With `NEXT_PUBLIC_SANITY_PROJECT_ID` unset the site serves the placeholder
content in `lib/content/seed.json` and `/studio` shows a setup notice. Nothing
is broken; `npm run build` prerenders all eight case pages from the seed, and
the tunnel draws the logos in `public/logo`.

Seeding the tools uploads those same files as Sanity assets, so a configured
dataset serves its own copies and `public/logo` is only the fallback's.

The seed is a fallback for **absence, not failure**. Once a project is
configured, a failed query throws rather than quietly repainting a live site
with PLACEHOLDER copy.

### Connecting a project

```bash
npx sanity@latest login
npx sanity@latest projects create        # note the project id
cp .env.example .env.local               # paste the id in
npm run sanity:seed                      # imports the placeholder content
npm run sanity:cors                      # allows http://localhost:3000
npm run dev
```

Then edit at <http://localhost:3000/studio>.

`npm run sanity:seed -- --only work` seeds one type only (`work`, `experience`,
`tool` or `about`) — useful once the
other chapter has real content in it, since seeding both would leave
placeholders sitting beside your own entries. `--dry-run` prints the NDJSON and
imports nothing.

Re-running the seed **replaces** the documents it wrote last time, so do not run
it again over projects you have since edited in the Studio.

For production, add the same env vars to the host and run
`npx sanity cors add https://your-domain --credentials`.

### Making edits appear

`lib/content/source.ts` caches every read for an hour, tagged `work` and
`experience`. The hour is the safety net; the webhook is the mechanism.

In <https://sanity.io/manage> → API → Webhooks:

- **URL** `https://your-domain/api/revalidate`
- **Dataset** `production`, **Trigger on** create / update / delete
- **Filter** `_type in ["work", "experience", "tool", "about"]`
- **HTTP method** `POST`, **API version** `v2021-03-25`
- **Secret** the same value as `SANITY_REVALIDATE_SECRET`

Without the secret the route refuses every request — an open revalidation
endpoint is a free way to make a site rebuild on demand — and edits only appear
on the hourly fallback.

### The contact form

Chapter .06 stores what it is sent as `message` documents in the same dataset,
listed under **Messages** in the Studio. No second service and no second inbox:
they arrive where the content already is. `app/actions/contact.ts` is the only
file that knows this — swapping to an email provider means rewriting it and
nothing else.

It needs `SANITY_API_WRITE_TOKEN`, an Editor token from sanity.io/manage > API >
Tokens. Keep it off anything `NEXT_PUBLIC_`: the read client is in the browser
bundle by way of `coverSrc()`, and a write token there would be a public one.
Without the token the form still validates and still refuses politely — and
logs the reason on the server, where whoever owns the site will find it.

`message` is `readOnly` in the Studio, and deliberately outside the revalidation
webhook's filter: a message changes no page, and pointing the webhook at it
would rebuild the site every time somebody said hello.

**What guards it, and what does not.** The long note at the top of
`app/actions/contact.ts` is the real answer; the short one is that there is no
SQL and no query built from anything a visitor typed, so injection has no
surface here — the controls that do matter are a honeypot, a time trap, a rate
limit and a link-count heuristic, plus the body cap in `next.config.ts` and
Next's own Origin check on every Server Action.

The rate limit in `lib/rate-limit.ts` is **in memory**. It resets on every
deploy and every cold start, and two instances mean two windows. That is the
honest trade for a portfolio form, and `check()` is the whole surface: moving to
Upstash or Vercel KV means rewriting that one file.

### Layout fields

The works grid is a **wrapped row, not a twelve-column composition**. Tiles take
what they ask for and the line breaks where it runs out, so adding a project is
never a packing problem — `position` is the only layout decision, and the row
sorts itself out.

`device` is the tile's shape, and it is a statement about the project rather
than a choice of rectangle: a desktop project gets a 16/10 frame, a mobile one a
9/19.5 phone frame, and the cover is cropped to whichever it is. A phone tile is
sized by **height** — `min(70svh, 36rem)`, so it fits on a laptop screen — and
its aspect decides the width. That is backwards from every other tile, and
deliberately: a 9/19.5 frame given a width instead comes out taller than the
screen reading it.

`width` applies to desktop projects only, and is about how much a tile *asks*
for before the line wraps, not about fractions of a row:

| | |
| --- | --- |
| `row` | Grows. Its 60% basis only stops two of them sharing a line; beside a phone it takes everything the phone left over, and alone it takes the full width. |
| `half` | Half the row minus the gap, and it stays that — two pair up exactly, and a half beside a phone leaves the rest of that line empty. |

Only `row` grows, which is why nobody has to work out what fraction a phone tile
leaves behind — and why `half` never comes out a different width than the one
that was chosen. Both values are
constrained dropdowns because Tailwind can only generate classes it can see as
literal strings in `work-card.tsx`.

Rows of mixed screens have ragged bottoms on purpose: a phone tile stands taller
than the desktop tile beside it, and the grid saying what a project is before
the caption does is the point. On Experience, `position` is load-bearing in a
different way — each card closes under the next one, so the highest position is
the entry left open at the end of the chapter. Put the current role last.

## SEO

Everything a crawler reads is generated, and it is all built on one value:
`NEXT_PUBLIC_SITE_URL`, the site's real public origin. Set it before the first
production deploy. Canonical links, `metadataBase`, the sitemap, robots.txt,
every Open Graph image URL and every JSON-LD id are absolute URLs derived from
it, and with it unset the build falls back to Vercel's production hostname and
then to `http://localhost:3000` — which, shipped, tells Google that the
canonical copy of every page lives on a machine it cannot reach.

```
lib/seo.ts                       the origin, shared metadata, JSON-LD builders
components/json-ld.tsx           one structured-data block, escaped
app/robots.ts                    /robots.txt
app/sitemap.ts                   /sitemap.xml, built from Sanity
app/(site)/opengraph-image.tsx   the 1200x630 card, drawn at build time
```

What each page carries:

| | |
| --- | --- |
| Every page | Canonical URL, description, `og:` and `twitter:` tags, the generated card, `max-image-preview:large` |
| `/` | `Person` + `WebSite` JSON-LD, built from the live About document |
| `/work` | `BreadcrumbList` |
| `/work/[slug]` | `CreativeWork` + `BreadcrumbList`, and the project's own cover as its card |

Three things about this are worth knowing before changing any of it.

**The sitemap is built from the content, not written by hand.** A project added
in the Studio appears in it on the next revalidation. `lastmod` is each
document's own `_updatedAt` and never the build clock: build time would mark
every page as changed on every deploy, and a crawler told that everything
changed and finding that nothing did learns to ignore the field — so it is worth
nothing on the day something really did change.

**Preview deployments take themselves out of the index.** On Vercel,
`VERCEL_ENV=preview` flips robots.txt to a blanket disallow and every page to
`noindex`. A crawlable preview is a second copy of the site competing with the
real one for the same queries, and Google is under no obligation to prefer the
one you meant.

**Per-page `openGraph` replaces the layout's, it does not extend it.** That is
Next's merge, not a bug, and it is easy to miss because the tags the page cared
about are all present — only the inherited `og:site_name` and `og:locale`
quietly vanish. Build the object with `pageOpenGraph()` in `lib/seo.ts` and that
cannot happen.

### Getting into Google

Being indexable is not the same as being indexed. Nothing below is optional if
the site is meant to be findable by name, and none of it works before the site
is live on a real domain.

**1. Deploy with the origin set.** `NEXT_PUBLIC_SITE_URL=https://your-domain`
in the host's environment variables, then deploy. Confirm before going further:
`https://your-domain/robots.txt` should name your domain in the `Sitemap:` line,
and `https://your-domain/sitemap.xml` should list every project URL. If either
says `localhost`, the variable did not reach the build.

**2. Add the property in Search Console.** <https://search.google.com/search-console>
→ Add property. Choose **Domain** if you control DNS — it covers `www`, every
subdomain and both schemes at once. Verify by adding the TXT record it gives you
at your registrar. If you cannot reach DNS, choose **URL prefix** instead, take
the `content` value out of the `<meta name="google-site-verification">` tag it
offers, put it in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, redeploy, then press
Verify.

**3. Submit the sitemap.** Search Console → Sitemaps → enter `sitemap.xml` →
Submit. This is what tells Google the site exists at all; without a link from
somewhere it already crawls, it has no other way to find out.

**4. Ask for the homepage directly.** Search Console → URL Inspection → paste
the homepage URL → **Request indexing**. Do the same for two or three project
pages. This is a request and not a command; the queue is usually days, and it is
normal for it to be a couple of weeks before anything appears.

**5. Give it corroboration.** The `Person` block claims the GitHub, LinkedIn and
Instagram profiles in `footerConfig.social` belong to the same person. That
claim is worth much more when it points both ways, so put the site URL in each
of those profiles. For a name query — "Aditya Zulkarnaen" — those links are most
of what decides whether this site or someone else's page ranks for it.

**6. Check what you actually shipped.** Paste a project URL into the
[Rich Results Test](https://search.google.com/test/rich-results) to confirm the
structured data parses, and into
[Facebook's Sharing Debugger](https://developers.facebook.com/tools/debug/) or
LinkedIn's Post Inspector to see the card. Both cache aggressively; re-scrape
from those tools after changing an image or a title.

Then watch Search Console → Pages over the following weeks. "Crawled — currently
not indexed" on a new site is normal and usually resolves on its own; "Discovered
— currently not indexed" for a long time means Google has decided the page is not
worth fetching, and the answer to that is links and content, never markup.

## Scripts

| | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `node scripts/verify-peel.mjs` | Checks Chapter .04's curl still fits its gutters |
| `python scripts/verify-wordmark.py` | Checks no two letters of the hero wordmark close up (needs `pip install fonttools brotli uharfbuzz`, and a build) |
| `npm run sanity:seed` | Import placeholder content (`-- --only work\|experience\|tool\|about`, `-- --dry-run`) |
| `npm run sanity:cors` | Allow `http://localhost:3000` to reach the API |
| `npm run sanity:typegen` | Regenerate `sanity.types.ts` from the schema |
