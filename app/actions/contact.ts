"use server";

import { createClient } from "next-sanity";

import { apiVersion, dataset, isSanityConfigured, projectId } from "@/lib/sanity/env";
import { contactCopy } from "@/components/contact/contact-copy";

/**
 * What Chapter .06's form does when you press send.
 *
 * Messages go into the same Sanity dataset the rest of the site reads from,
 * as `message` documents. That is not the only place they could go, but it is
 * the only one this project already has: no new service, no new dependency, no
 * second inbox to remember to check — they land in the Studio, which is
 * already open. Swapping to an email provider later means rewriting this file
 * and nothing else.
 *
 * The write needs `SANITY_API_WRITE_TOKEN`, which the read client does not
 * have and must never be given: `lib/sanity/client.ts` is imported by
 * `coverSrc()` and ends up in the browser bundle. A write token there would be
 * a public write token. The client below is built here, inside a `"use server"`
 * module, and the token is read at call time rather than at import so a missing
 * one is a handled error instead of a crash on boot.
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
 * Deliberately loose. Address syntax is far wider than any regex worth writing,
 * and the only thing worth catching here is a typo bad enough that a reply
 * could never arrive — a missing `@`, a missing dot, a stray space.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendMessage(
  previous: ContactState,
  form: FormData,
): Promise<ContactState> {
  const attempt = previous.attempt + 1;

  // The honeypot. A field no human sees and most bots fill in anyway. Answered
  // with success rather than an error, because telling a bot what it got wrong
  // is how it learns to get it right.
  if (read(form, contactCopy.trapName) !== "") {
    return { status: "sent", message: contactCopy.sentMessage, attempt };
  }

  const name = read(form, "name");
  const email = read(form, "email");
  const body = read(form, "body");

  const fieldErrors: ContactState["fieldErrors"] = {};
  if (!name) fieldErrors.name = contactCopy.errorName;
  else if (name.length > LIMITS.name) fieldErrors.name = contactCopy.errorTooLong;
  if (!email || !EMAIL.test(email)) fieldErrors.email = contactCopy.errorEmail;
  else if (email.length > LIMITS.email) fieldErrors.email = contactCopy.errorTooLong;
  if (!body) fieldErrors.body = contactCopy.errorBody;
  else if (body.length > LIMITS.body) fieldErrors.body = contactCopy.errorTooLong;

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
    console.error("Contact form: failed to store message.", error);
    return { status: "error", message: contactCopy.errorSend, attempt };
  }

  return { status: "sent", message: contactCopy.sentMessage, attempt };
}
