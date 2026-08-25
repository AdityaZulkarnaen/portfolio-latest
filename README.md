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

Chapters .03 (Tech stack), .04 (Works) and .05 (Experience) come from Sanity.
Chapter .06 (Contact) writes *into* it — see **The contact form** below.
Everything else — the hero, the About slab, and every label and heading — is
copy in the repo, in the `*-copy.ts` files beside each chapter. That split is
deliberate: content changes on its own schedule, chrome changes when the design
does.

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

`npm run sanity:seed -- --only work` seeds one type only (`work`, `experience`
or `tool`) — useful once the
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
- **Filter** `_type in ["work", "experience", "tool"]`
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

## Scripts

| | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `node scripts/verify-peel.mjs` | Checks Chapter .04's curl still fits its gutters |
| `npm run sanity:seed` | Import placeholder content (`-- --only work\|experience\|tool`, `-- --dry-run`) |
| `npm run sanity:cors` | Allow `http://localhost:3000` to reach the API |
| `npm run sanity:typegen` | Regenerate `sanity.types.ts` from the schema |
