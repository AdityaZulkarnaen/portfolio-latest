/**
 * A structured-data block.
 *
 * A Server Component with no client bundle: this is markup for crawlers, and
 * shipping a kilobyte of JavaScript to the browser to write a `<script>` nobody
 * executes would be the wrong trade twice over.
 *
 * The escape is not decoration. JSON-LD is embedded in a `<script>` element,
 * whose content is CDATA — the parser stops at the first `</script>`, and
 * `JSON.stringify` has no reason to escape a `<`. Some of what goes in here
 * comes from Sanity, which means it comes from whoever can edit the Studio, so
 * a project summary containing a closing script tag would otherwise end the
 * block early and run whatever followed it. Escaping every `<` to its `<`
 * form is valid JSON, parses back to the same string, and makes that
 * impossible.
 */
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
