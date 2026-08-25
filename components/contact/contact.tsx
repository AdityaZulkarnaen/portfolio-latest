"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { gsap, killScrollTriggersIn, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";
import { META_TYPE_BASE } from "@/lib/site-config";
import { CONTACT_INITIAL, sendMessage } from "@/app/actions/contact";
import { contactCopy } from "./contact-copy";

/** Slabs the chapter reaches up with, matching every takeover before it. */
const SLATS = 4;

/** Shared by every input, so the three of them cannot drift apart. */
const FIELD =
  "w-full border-0 border-b border-line bg-transparent pb-3 pt-2 font-sans text-lg text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-acid";

/**
 * Chapter .06 — the way to reach him.
 *
 * The last chapter, and the only one that asks for something back. It takes the
 * void again after Chapter .05's acid, so the page closes on the ground it
 * opened on.
 *
 * Nothing is pinned or scrubbed here on purpose. Every chapter before this one
 * holds the screen and makes you scroll through it; the one with a form in it
 * must not — a field that moves while you are typing into it, on a page that
 * animates the moment the on-screen keyboard changes the viewport height, is a
 * form nobody finishes. It is a plain section that rises once and then behaves.
 */
export default function Contact() {
  const rootRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const reducedMotion = useReducedMotion();

  const [state, action] = useActionState(sendMessage, CONTACT_INITIAL);

  /**
   * The time trap's clock: when somebody first touched this form.
   *
   * A hidden field carries the elapsed milliseconds, rewritten on every input
   * event so it is current whenever the form is posted. The server treats a
   * submission with no human time behind it as automated. It is forgeable —
   * anything the client sets is — and it is not trying to be proof: it costs
   * one DOM write per keystroke and catches the fetch-fill-post bots that make
   * up nearly all of it. The layers that do not depend on the client are the
   * rate limit and the honeypot.
   */
  const startedAt = useRef(0);
  const elapsedRef = useRef<HTMLInputElement>(null);

  const stampInteraction = () => {
    if (startedAt.current === 0) startedAt.current = Date.now();
    if (elapsedRef.current) {
      elapsedRef.current.value = String(Date.now() - startedAt.current);
    }
  };

  // The takeover, and the same rise the other chapters open with.
  useGSAP(
    () => {
      const rises = gsap.utils.toArray<HTMLElement>("[data-contact-rise]");

      if (reducedMotion) {
        killScrollTriggersIn(rootRef.current);
        gsap.set("[data-contact-slat]", { scaleY: 1 });
        gsap.set(rises, { yPercent: 0, opacity: 1 });
        return;
      }

      gsap.fromTo(
        "[data-contact-slat]",
        { scaleY: 0 },
        {
          // Past 1 so neighbouring slabs overlap by a hair — at 1 exactly,
          // sub-pixel rounding leaves seams of the panel above showing through.
          scaleY: 1.02,
          ease: "none",
          duration: 1.6,
          stagger: { each: 1, from: "end" },
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top bottom",
            end: "top 25%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );

      gsap.fromTo(
        rises,
        { yPercent: 105, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 68%" },
        },
      );
    },
    { scope: rootRef, dependencies: [reducedMotion] },
  );

  // Clear the fields once a message is actually away, and move focus to the
  // notice so the outcome is announced rather than left to be noticed.
  // Keyed on `attempt` so a second identical result still counts as news.
  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "sent") {
      formRef.current?.reset();
      // The clock restarts with the form. Without this a second message
      // inherits the first one's elapsed time and skips the trap entirely.
      startedAt.current = 0;
      if (elapsedRef.current) elapsedRef.current.value = "0";
    }
    noticeRef.current?.focus();
  }, [state.status, state.attempt]);

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <section
      ref={rootRef}
      id="contact"
      data-chapter=".06"
      data-chapter-name="Contact"
      // Void is the page's default ground and carries no rules of its own, so
      // this flag exists only to *take the top band back* from Chapter .05's
      // acid. `site-ground.tsx` hands over rather than clearing, so the acid
      // stops the moment this seals the frame — not a screen and a half later,
      // when .05's bottom edge finally reaches the top. Without it the nav
      // spends the whole takeover painted void on void.
      data-ground="void"
      data-ground-from="25%"
      // Above Chapter .05 (z-[36]) so the slats can climb over its acid, and
      // still below the fixed nav (z-40).
      className="relative z-[37] w-full bg-void"
    >
      {/* Sits directly on the outside of the chapter's top edge and moves with
          it — this section's own reach into the acid above. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full flex h-[30svh] flex-col md:h-[55svh]"
      >
        {Array.from({ length: SLATS }, (_, i) => (
          <span
            key={i}
            data-contact-slat
            className="w-full flex-1 origin-bottom scale-y-0 bg-void will-change-transform"
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-[110rem] pb-24 pl-5 pr-5 pt-24 sm:pr-[var(--rail-gutter)] md:pb-32 md:pl-8 md:pt-32">
        <div className="overflow-hidden">
          <p data-contact-rise className={`text-acid ${META_TYPE_BASE}`}>
            {contactCopy.eyebrow}
          </p>
        </div>

        {/* The ask in ink, the answer in acid. Two lines rather than one
            paragraph, so the turn lands on its own. */}
        <h2 className="mt-6 max-w-[18ch] font-display text-[clamp(2.25rem,7.5vw,6rem)] font-black leading-[0.94] tracking-[-0.04em] md:mt-8">
          <span className="block overflow-hidden">
            <span data-contact-rise className="block text-ink">
              {contactCopy.headingAsk}
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-contact-rise className="block text-acid">
              {contactCopy.headingAnswer}
            </span>
          </span>
        </h2>

        <div className="mt-16 grid gap-10 md:mt-24 md:grid-cols-12 md:gap-8">
          <p className="max-w-[42ch] font-sans text-lg leading-relaxed text-ink/70 md:col-span-4">
            {contactCopy.lead}
          </p>

          {/* The column the brief asked for: one measure, nothing beside it.
              A form is the one thing on this page that is read straight down. */}
          <form
            ref={formRef}
            action={action}
            onInput={stampInteraction}
            aria-label={contactCopy.formLabel}
            className="max-w-[36rem] md:col-span-7 md:col-start-6"
          >
            {/* The outcome, and the first thing a screen reader is told about
                it. `tabIndex={-1}` makes it focusable from script without
                putting it in the tab order; `aria-live` covers the case where
                focus has moved on before the answer arrives. */}
            <p
              ref={noticeRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className={`outline-none ${META_TYPE_BASE} ${
                state.status === "idle"
                  ? "sr-only"
                  : state.status === "sent"
                    ? "mb-8 text-acid"
                    : "mb-8 text-ink"
              }`}
            >
              {state.status === "sent" ? (
                <>
                  <span className="text-acid">{contactCopy.sentTitle}</span>{" "}
                  <span className="normal-case tracking-normal text-ink/70">
                    {contactCopy.sentMessage}
                  </span>
                </>
              ) : (
                state.message
              )}
            </p>

            <div className="grid gap-8 sm:grid-cols-2">
              <Field
                name="name"
                label={contactCopy.nameLabel}
                error={fieldErrors.name}
                maxLength={80}
                autoComplete="name"
              />
              <Field
                name="email"
                type="email"
                label={contactCopy.emailLabel}
                error={fieldErrors.email}
                maxLength={160}
                autoComplete="email"
              />
            </div>

            <div className="mt-8">
              <Field
                name="body"
                label={contactCopy.bodyLabel}
                hint={contactCopy.bodyHint}
                error={fieldErrors.body}
                maxLength={2000}
                multiline
              />
            </div>

            {/* The honeypot. Off-screen rather than `display: none`, because a
                hidden field is the one thing a bot checking for honeypots looks
                for. `tabIndex` and `aria-hidden` keep it away from anyone who
                is not one. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
            >
              <label htmlFor="contact-trap">{contactCopy.trapLabel}</label>
              <input
                id="contact-trap"
                name={contactCopy.trapName}
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <input
              ref={elapsedRef}
              type="hidden"
              name={contactCopy.elapsedName}
              defaultValue="0"
            />

            <div className="mt-10">
              <Submit sent={state.status === "sent"} />
            </div>
          </form>
        </div>

        <footer
          className={`mt-20 flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-muted md:mt-28 ${META_TYPE_BASE}`}
        >
          <span>{contactCopy.seamLeft}</span>
          <span>{contactCopy.hint}</span>
        </footer>
      </div>
    </section>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  type?: string;
  maxLength: number;
  multiline?: boolean;
  autoComplete?: string;
};

/**
 * One field: a mono label above a hairline.
 *
 * Underlines rather than boxes, because the whole page is built from hairlines
 * — the rail, the loader bar, the seams — and a set of outlined boxes would be
 * the only piece of upholstery on it.
 *
 * `maxLength` is on the input as well as in the action. The server is the one
 * that decides; this is so the limit is felt while typing rather than reported
 * afterwards.
 */
function Field({
  name,
  label,
  hint,
  error,
  type = "text",
  maxLength,
  multiline = false,
  autoComplete,
}: FieldProps) {
  const id = `contact-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  const shared = {
    id,
    name,
    maxLength,
    required: true,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
    className: `${FIELD} ${error ? "border-ink/60" : ""}`,
  };

  return (
    <div>
      <label htmlFor={id} className={`block text-muted ${META_TYPE_BASE}`}>
        {label}
      </label>

      {multiline ? (
        <textarea {...shared} rows={5} className={`${shared.className} resize-y`} />
      ) : (
        <input {...shared} type={type} autoComplete={autoComplete} />
      )}

      {hint ? (
        <p id={hintId} className={`mt-3 text-muted ${META_TYPE_BASE}`}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className={`mt-3 text-acid ${META_TYPE_BASE}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Its own component because `useFormStatus` only reports the form *above* it in
 * the tree — called from the component that renders the `<form>` it would
 * always say idle.
 */
function Submit({ sent }: { sent: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`group inline-flex items-center gap-4 bg-acid px-6 py-4 text-void transition-opacity disabled:opacity-60 ${META_TYPE_BASE}`}
    >
      {pending
        ? contactCopy.sending
        : sent
          ? contactCopy.sendAgain
          : contactCopy.send}
      <span
        aria-hidden
        className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
      />
    </button>
  );
}
