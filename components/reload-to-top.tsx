/**
 * Sends a reloaded page back to the top, before anything else can read where
 * it was.
 *
 * Refreshing the homepage used to leave you wherever you had scrolled to —
 * Chapter .06, usually, since that is where a page gets left — with no intro,
 * because `hero.tsx` checks `window.scrollY` on its first layout pass and
 * treats "opened away from the hero" as "there is no arrival to stage". Both
 * halves were working as designed; together they meant a refresh looked like
 * the site had failed to load.
 *
 * Two separate causes, and both have to be handled or the fix only works
 * sometimes:
 *
 *  - The browser restores the scroll position of a reloaded document by
 *    itself. `history.scrollRestoration = "manual"` is what declines that.
 *  - Clicking CONTACT in the menu puts `#contact` in the address bar, so a
 *    refresh is a load *with a fragment* and the browser jumps to it. Nothing
 *    about scroll restoration touches that; the fragment has to go.
 *
 * ## Why this is an inline script and not a component with an effect
 *
 * Timing, and it is not close. Effects run children-first, so an effect in the
 * root layout fires *after* the hero's — by which point the hero has already
 * read the restored scroll position and decided not to play the intro. And
 * `scrollRestoration` has to be set before the browser performs the
 * restoration, which happens well before hydration. A script in the document
 * runs during parsing, which is early enough for both.
 *
 * ## Why it only fires on a reload
 *
 * Because a fragment is not always noise. `/#about` reached from a project
 * page is a real navigation to a real place — the site menu links that way on
 * purpose — and a shared `/#work` link has to land on Chapter .04.
 * `PerformanceNavigationTiming.type` draws exactly the line that matters here:
 * "reload" is the refresh key, "navigate" is a link or a typed URL, and
 * "back_forward" is history. Only the first is touched.
 *
 * Restoration is handed back at `load`, after the moment the browser would
 * have used it. `scrollRestoration` belongs to the history *entry*, so leaving
 * it on "manual" would also flatten the scroll position when someone later
 * returns to this page with the back button — which nobody asked for and which
 * would be a worse bug than the one being fixed here.
 */
const SCRIPT = `(function(){
  try {
    var nav = performance.getEntriesByType("navigation")[0];
    if (!nav || nav.type !== "reload") return;
    history.scrollRestoration = "manual";
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    window.scrollTo(0, 0);
    addEventListener("load", function () {
      history.scrollRestoration = "auto";
    }, { once: true });
  } catch (e) {}
})();`;

export default function ReloadToTop() {
  return (
    // No `src`, so React renders it where it stands rather than hoisting it,
    // and it runs as the parser reaches it. The content is a constant in this
    // file — nothing from a request or the CMS reaches it — so there is no
    // injection surface to escape against.
    <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
  );
}
