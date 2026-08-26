import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { siteDescription } from "@/lib/seo";

/**
 * The card every link to this site unfurls into — on Google, in a Slack paste,
 * in a WhatsApp forward, on LinkedIn.
 *
 * Generated rather than designed as a file, for a reason that outlives the
 * convenience: a PNG in `public/` is a copy of the identity that stops being
 * true the moment the palette or the wordmark changes, and nobody re-exports
 * it. This is drawn from the same acid, the same void and the same display face
 * the footer is set in, so it can only go stale if the site does.
 *
 * 1200x630 because that is what the crawlers crop to. Anything smaller is
 * upscaled by them; anything with a different ratio is cropped by them, and it
 * is never the crop you would have chosen.
 *
 * Rendered once at build and cached — it is a static route with no dynamic
 * inputs, so it costs nothing per request.
 */
export const alt = "Aditya Zulkarnaen — Creative Frontend Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori — what `ImageResponse` renders with — has no system fonts. It cannot
 * fall back, so every glyph drawn has to be covered by a font handed to it as
 * bytes, and the file has to be read off disk rather than fetched: at build
 * time there is no server to fetch it from.
 *
 * BlurWeb is the site's own display face, already in `public/font` because the
 * footer wordmark is set in it. Using it here rather than a second face is what
 * makes the card read as this site and not as a generic template.
 */
async function displayFont() {
  return readFile(
    join(process.cwd(), "public", "font", "BlurWeb-Medium W03 Regular.ttf"),
  );
}

export default async function OpengraphImage() {
  const font = await displayFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08080a",
          color: "#f2f2f0",
          padding: "64px 72px",
          fontFamily: "BlurWeb",
        }}
      >
        {/* The seam readout, in the same language as every chapter's. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
            letterSpacing: 6,
            color: "#8a8a85",
            textTransform: "uppercase",
          }}
        >
          <span>Aditya Z.</span>
          <span style={{ color: "#e1ff00" }}>Portfolio</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Two lines, the second on the acid — the polarity flip the whole
              site is built on, said once at a glance. */}
          <span style={{ fontSize: 132, lineHeight: 1, letterSpacing: -4 }}>
            Aditya
          </span>
          <span
            style={{
              fontSize: 132,
              lineHeight: 1,
              letterSpacing: -4,
              color: "#08080a",
              background: "#e1ff00",
              // Room for the descenders the band would otherwise cut.
              padding: "6px 18px 22px 18px",
              alignSelf: "flex-start",
              marginTop: 8,
            }}
          >
            Zulkarnaen
          </span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            lineHeight: 1.35,
            color: "#f2f2f0",
            maxWidth: 900,
          }}
        >
          {/* The description the card carries is the one the page carries, cut
              at its first sentence: a social card is read in a glance, and the
              crawlers truncate the rest anyway. */}
          {siteDescription.split(" — ")[0]}.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "BlurWeb", data: font, style: "normal", weight: 500 }],
    },
  );
}
