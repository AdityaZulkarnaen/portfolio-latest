import { parseBody } from "next-sanity/webhook";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import {
  ABOUT_TAG,
  EXPERIENCE_TAG,
  TOOL_TAG,
  WORK_TAG,
} from "@/lib/sanity/queries";

/**
 * What makes a Studio edit show up on the site.
 *
 * Point a Sanity webhook at POST /api/revalidate, filtered to
 * `_type in ["work", "experience", "tool", "about"]`, with the same secret as
 * `SANITY_REVALIDATE_SECRET`. The hourly `revalidate` in
 * `lib/content/source.ts` is only the net under this.
 *
 * `parseBody` does two things worth knowing about: it verifies the HMAC
 * signature Sanity sends in `sanity-webhook-signature`, and it waits out
 * Content Lake's eventual consistency before returning — without that wait a
 * revalidation triggered by an edit can race ahead of the edit itself and
 * re-cache the old document.
 */

/**
 * Read here rather than from `lib/sanity/env.ts`, which is in the browser
 * bundle by way of `coverSrc()`. A Route Handler never is.
 */
const revalidateSecret = process.env.SANITY_REVALIDATE_SECRET;

/** Only tags this app actually attaches to a fetch. */
const TAGS = new Set<string>([WORK_TAG, EXPERIENCE_TAG, TOOL_TAG, ABOUT_TAG]);

type WebhookBody = { _type?: string };

export async function POST(req: NextRequest) {
  // Fail closed. Without a secret every caller's signature is "unverified"
  // rather than "invalid", and an open revalidation endpoint is a free way to
  // make the site rebuild its pages on demand.
  if (!revalidateSecret) {
    return new Response(
      "SANITY_REVALIDATE_SECRET is not set; refusing to revalidate.",
      { status: 500 },
    );
  }

  try {
    const { body, isValidSignature } = await parseBody<WebhookBody>(
      req,
      revalidateSecret,
    );

    if (!isValidSignature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const tag = body?._type;
    // An unknown `_type` means the webhook's filter is wider than this route.
    // Reported rather than swallowed, so the mismatch is visible in Sanity's
    // delivery log instead of silently doing nothing.
    if (!tag || !TAGS.has(tag)) {
      return new Response(`Unhandled document type: ${tag ?? "none"}`, {
        status: 400,
      });
    }

    // "max" is stale-while-revalidate: the next visitor gets the cached page
    // immediately and the fresh one is fetched behind them. The bare
    // single-argument form is deprecated in Next 16.
    revalidateTag(tag, "max");

    return NextResponse.json({ revalidated: true, tag, now: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(message, { status: 500 });
  }
}
