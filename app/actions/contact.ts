"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "next-sanity";

import {
  apiVersion,
  dataset,
  isSanityConfigured,
  projectId,
} from "@/lib/sanity/env";
import { check } from "@/lib/rate-limit";
import { contactCopy } from "@/components/contact/contact-copy";

/**
 * What Chapter .06's form does when you press send.
 *
 * Messages go into the same Sanity dataset the rest of the site reads from, as
 * `message` documents. That is not the only place they could go, but it is the
 * only one this project already has: no new service, no new dependency, no
 * second inbox to remember to check — they land in the Studio, which is already
 * open. Swapping to an email provider later means rewriting this file and
 * nothing else.
 *
 * The write needs `SANITY_API_WRITE_TOKEN`, which the read client does not have
 * and must never be given: `lib/sanity/client.ts` is imported by `coverSrc()`
 * and ends up in the browser bundle. A write token there would be a public
 * write token. The client below is built here, inside a `"use server"` module,
 * and the token is read at call time rather than at import so a missing one is
 * a handled error instead of a crash on boot.
 *
 * ─── What this is defended against, and what it is not ───────────────────────
 *
 * **Injection.** There is no SQL here and no query built from anything a
 * visitor typed. The three values are sent as JSON fields of a document through
 * Sanity's client; they are stored as data and never parsed as anything. The
 * one shape of injection this stack *could* have is GROQ, and the defence that
 * matters for it is the one already in place everywhere in this repo: no query
 * string is ever assembled from user input. Escaping would be theatre; not
 * concatenating is the control.
 *
 * **Cross-site scripting.** The body is never rendered on this site. It is read
 * in the Studio, where React escapes it like any other string. Stripping HTML
 * out of it would only make the message harder to read and would not be the
 * thing keeping anyone safe.
 *
 * **Cross-site request forgery.** Server Actions are POST endpoints, and Next
 * checks `Origin` against `Host` on every one of them before this function is
 * reached. Nothing to add.
 *
 * **Brute force.** There is nothing here to guess: no login, no token, no
 * secret compared against anything. What "brute force" means for a form is
 * somebody hammering it, and that is what the rate limit below is for.
 *
 * **Flooding and spam.** Four layers, cheapest first — a honeypot, a time trap,
 * a per-address rate limit, and a link-count heuristic. Each one on its own is
 * easy to beat by hand; together they cost more to defeat than a portfolio's
 * contact form is worth to anybody.
 *
 * **Payload size.** Capped at the framework, in `next.config.ts`. The caps
 * below are about content, and a body big enough to matter never reaches them.
 */

/** What the form renders. `useActionState` holds the last one returned. */
export type ContactState = {
  status: "idle" | "sent" | "error";
  /** Shown above the form. Already user-facing — never a raw error. */
  message?: string;
  /** Keyed by field name, so each one can be marked in place. */
  fieldErrors?: Partial<Record<"name" | "email" | "body", string>>;
  /**
   * Bumped on every submission. Two identical failures in a row produce two
   * identical states, and without this the form has no way to tell that the
   * second one happened — the notice would not re-announce itself.
   */
  attempt: number;
};

export const CONTACT_INITIAL: ContactState = { status: "idle", attempt: 0 };

/** Caps, matched by `maxLength` on the inputs so the limit is visible first. */
const LIMITS = { name: 80, email: 160, body: 2000 } as const;

/**
 * Three messages per ten minutes from one address, and sixty across everyone.
 *
 * The global figure is the backstop for the weakness in the per-address one:
 * addresses can be rotated, and a limiter that only ever counts per key cannot
 * see a flood spread across a thousand of them. Sixty in ten minutes is far
 * more mail than this form has ever had in a day — a bound on the damage, not a
 * target anyone legitimate will reach.
 */
const PER_ADDRESS = { limit: 3, windowMs: 10 * 60 * 1000 };
const OVERALL = { limit: 60, windowMs: 10 * 60 * 1000 };

/**
 * How long a human takes to fill this in, at the very least.
 *
 * Anything faster did not type it. This is not proof — the field is client-set
 * and can be forged — and it is not meant to be: it is the cheapest thing that
 * catches the overwhelming majority of automated submissions, which fetch the
 * form, fill every input and post it back inside a few hundred milliseconds.
 */
const MIN_FILL_MS = 1200;

/** Past this a message is an advertisement, whatever else it is. */
const MAX_LINKS = 4;

/**
 * Deliberately loose. Address syntax is far wider than any regex worth writing,
 * and the only thing worth catching here is a typo bad enough that a reply
 * could never arrive — a missing `@`, a missing dot, a stray space.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LINK =
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|ru|xyz|top|link)\b/gi;

/**
 * Control characters, which have no business in a message and would only ever
 * be there to make it render as something other than what was sent.
 *
 * Tab and both newlines are spared: a message has paragraphs. The C1 block goes
 * with the C0 one — nothing types those either.
 *
 * This is not an escaping step. There is nothing here to escape; see the note
 * at the top of the file.
 */
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

function clean(value: string, max: number): string {
  return value
    .replace(CONTROL, "")
    // Any run of blank lines past three, which is padding, not paragraphs.
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Who is asking, as well as this can be known.
 *
 * `x-forwarded-for` is only as trustworthy as whatever set it — on a platform
 * that terminates TLS for you it is authoritative, and behind nothing at all it
 * is a header the client chose. The fallback key is what keeps the limiter
 * meaningful in that case: no address at all counts as one shared client, which
 * is stricter than handing every unknown caller a fresh window.
 */
async function clientKey(): Promise<string> {
  const head = await headers();
  const forwarded = head.get("x-forwarded-for");
  const address =
    forwarded?.split(",")[0]?.trim() || head.get("x-real-ip")?.trim() || "";

  // Hashed rather than stored: the limiter needs to tell callers apart, not to
  // keep a record of who they were.
  return address
    ? createHash("sha256").update(address).digest("hex").slice(0, 32)
    : "unknown";
}

/** Success, without having sent anything. See the note at each call site. */
function silentlyAccepted(attempt: number): ContactState {
  return { status: "sent", message: contactCopy.sentMessage, attempt };
}

export async function sendMessage(
  previous: ContactState,
  form: FormData,
): Promise<ContactState> {
  const attempt = previous.attempt + 1;

  // ─── The two traps ────────────────────────────────────────────────────────
  // Both answer with success rather than an error, and that is the point:
  // telling something what it got wrong is how it learns to get it right. A bot
  // is told exactly what a person is told, and goes away.

  // A field no human sees and most bots fill in anyway.
  if (read(form, contactCopy.trapName).trim() !== "") {
    return silentlyAccepted(attempt);
  }

  // And the clock. `elapsed` is written by the form from the visitor's first
  // keystroke; a submission with no interaction behind it reports zero.
  const elapsed = Number(read(form, contactCopy.elapsedName));
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return silentlyAccepted(attempt);
  }

  // ─── The limits ───────────────────────────────────────────────────────────
  // Both are counted before the message is even looked at: work done for a
  // caller who is over their limit is work an attacker got for free.
  const overall = check("all", OVERALL);
  const mine = check(await clientKey(), PER_ADDRESS);

  if (!overall.ok || !mine.ok) {
    const retryAfter = Math.max(overall.retryAfter, mine.retryAfter);
    return {
      status: "error",
      message: contactCopy.errorTooMany(Math.max(1, Math.round(retryAfter / 60))),
      attempt,
    };
  }

  // ─── The message ──────────────────────────────────────────────────────────
  const name = clean(read(form, "name"), LIMITS.name);
  const email = clean(read(form, "email"), LIMITS.email);
  const body = clean(read(form, "body"), LIMITS.body);

  const fieldErrors: ContactState["fieldErrors"] = {};
  if (!name) fieldErrors.name = contactCopy.errorName;
  if (!email || !EMAIL.test(email)) fieldErrors.email = contactCopy.errorEmail;
  if (!body) fieldErrors.body = contactCopy.errorBody;
  else if ((body.match(LINK) ?? []).length > MAX_LINKS) {
    fieldErrors.body = contactCopy.errorLinks;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: contactCopy.errorSummary,
      fieldErrors,
      attempt,
    };
  }

  const token = process.env.SANITY_API_WRITE_TOKEN;

  // Two different failures, one thing to say. A visitor cannot act on either,
  // and "the form is not wired up yet" is information for whoever owns the
  // site — so it goes to the server log, where they will find it.
  if (!isSanityConfigured || !token) {
    console.error(
      "Contact form: no Sanity project or no SANITY_API_WRITE_TOKEN, message dropped.",
    );
    return { status: "error", message: contactCopy.errorSend, attempt };
  }

  try {
    const writeClient = createClient({
      projectId,
      dataset,
      apiVersion,
      // Never the CDN for a write, and never for anything that has to be true
      // the moment it returns.
      useCdn: false,
      token,
    });

    await writeClient.create({
      _type: "message",
      name,
      email,
      body,
      // Server time. A timestamp the form could send is a timestamp a form can
      // lie about.
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    // The error itself never reaches the visitor. A client library's failure
    // text can carry the project id, the dataset and the shape of the request,
    // and none of that is theirs to have.
    console.error("Contact form: failed to store message.", error);
    return { status: "error", message: contactCopy.errorSend, attempt };
  }

  return { status: "sent", message: contactCopy.sentMessage, attempt };
}
