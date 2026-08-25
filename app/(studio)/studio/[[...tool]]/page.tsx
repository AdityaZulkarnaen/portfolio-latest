import { isSanityConfigured } from "@/lib/sanity/env";
import Studio from "./studio";

/**
 * The Studio is a single-page app that routes itself — the catch-all segment
 * exists only so Next hands every path under /studio to the same component.
 * Nothing here depends on the request, so the shell is static and the Studio
 * takes over on the client.
 */
export const dynamic = "force-static";

export default function StudioPage() {
  if (!isSanityConfigured) return <SetupNotice />;

  return <Studio />;
}

/**
 * What /studio shows before a Sanity project exists.
 *
 * The alternative — mounting the Studio against the placeholder project id —
 * gets a CORS failure and a stack trace, which says nothing about what to do
 * next. Styled inline because this route deliberately loads no stylesheet of
 * its own; see the note in `app/(studio)/layout.tsx`.
 */
function SetupNotice() {
  const steps = [
    "npx sanity@latest login",
    "npx sanity@latest projects create",
    "Put the project id in .env.local as NEXT_PUBLIC_SANITY_PROJECT_ID",
    "npm run sanity:seed   — imports the placeholder content",
    "npx sanity@latest cors add http://localhost:3000 --credentials",
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#08080a",
        color: "#f2f2f0",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div style={{ maxWidth: "44rem", width: "100%" }}>
        <p
          style={{
            color: "#e1ff00",
            fontSize: "11px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Studio // not configured
        </p>
        <h1
          style={{
            fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
            lineHeight: 1.1,
            margin: "1rem 0 1.5rem",
          }}
        >
          No Sanity project is connected yet.
        </h1>
        <p style={{ lineHeight: 1.7, color: "rgba(242,242,240,0.7)", margin: 0 }}>
          The site is running on the seed content in{" "}
          <code>lib/content/seed.json</code>. To move it into a CMS, run these in
          the project root, then restart <code>next dev</code>:
        </p>
        <ol style={{ lineHeight: 2, paddingLeft: "1.25rem", marginTop: "1.5rem" }}>
          {steps.map((step) => (
            <li key={step} style={{ color: "rgba(242,242,240,0.9)" }}>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
