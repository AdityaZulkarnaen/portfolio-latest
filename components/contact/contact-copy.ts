/** Every user-facing string in Chapter .06, mirroring the other chapters. */
export const contactCopy = {
  eyebrow: "--- Chapter .06",
  chapter: "Contact",

  /**
   * Split in two so the turn can be set in acid. The question is the setup and
   * the answer is the offer; giving them one colour each is the whole reason
   * this is two strings and not one.
   */
  headingAsk: "Have a bold vision?",
  headingAnswer: "Let's turn it into reality.",

  /** Sits under the heading, in the register the rest of the meta type uses. */
  lead: "Tell me what you are building. Every project here started as a message like the one you are about to write.",

  formLabel: "Send a message",
  nameLabel: "Your name",
  emailLabel: "Email",
  bodyLabel: "Message",
  bodyHint: "What it is, and what you need.",

  send: "SEND MESSAGE",
  sending: "SENDING",
  sendAgain: "SEND ANOTHER",

  sentTitle: "Message sent.",
  sentMessage: "Thank you — it has landed. I read everything, and I reply to what I can take on.",

  errorSummary: "Have another look at the fields marked below.",
  errorName: "A name, so I know who I am replying to.",
  errorEmail: "An address a reply could actually reach.",
  errorBody: "The message itself is the one part I cannot guess.",
  errorTooLong: "That is longer than this field takes.",
  errorSend: "That did not get through. Try again in a moment.",
  errorLinks: "Too many links for a first message. Tell me in words.",
  /** Minutes, already rounded — the caller does the arithmetic, not the copy. */
  errorTooMany: (minutes: number) =>
    `That is a few messages in a row. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,

  /**
   * The honeypot's field name. Plausible enough that a bot filling every input
   * it finds will fill this one too, and no human ever sees it.
   */
  trapName: "company",
  trapLabel: "Company — leave this empty",

  /**
   * Field name for the time trap. Written by the form from the visitor's first
   * keystroke, and read by the action as "did anybody actually type this".
   */
  elapsedName: "elapsed",

  seamLeft: "CHAPTER .06 // CONTACT",
  hint: "",
} as const;
