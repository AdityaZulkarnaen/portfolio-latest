/**
 * Opens the page at the top, unless the fragment in the URL was genuinely
 * asked for.
 *
 * The homepage kept loading at Chapter .06. `hero.tsx` reads `window.scrollY`
 * on its first layout pass and takes "opened away from the hero" to mean there
 * is no arrival to stage, so the loader never runs and a visit looks like a
 * site that failed to load.
 *
 * ## What decides
 *
 * A fragment is honoured only when it arrived from a link **on this site**.
 * That is the actual distinction — not whether a fragment exists, and not
 * whether this is a reload:
 *
 *  - `back_forward` is left completely alone. The restored position is the
 *    whole point of a back button.
 *  - `reload` always goes to the top, whatever the referrer says. A refresh
 *    carries the referrer of the navigation that first opened the page, so
 *    testing the referrer first would leave a refreshed `/#about` sitting on
 *    Chapter .02.
 *  - Anything else is honoured only with a same-origin referrer. `/#about`
 *    clicked in the menu from a project page is a real navigation to a real
 *    place and has to keep working. A typed URL, a bookmark and a new tab all
 *    arrive with no referrer, and those are the ones carrying a fragment
 *    nobody asked for.
 *
 * The one case this gets wrong is a `/#work` link shared with someone else and
 * opened cold: it lands on the hero rather than Chapter .04. That is the price
 * of not being able to tell a shared link from browser autocomplete, and it is
 * the right way round — a visitor who lands on the hero has lost nothing.
 *
 * ## The hold is what actually lands the page, not the flag
 *
 * Setting `history.scrollRestoration = "manual"` during parsing is not
 * sufficient here, and the measurements say so plainly. With the flag set at
 * 0ms and still reading "manual" at six seconds, the browser *still* threw the
 * page down to 11565px at 495ms. Whatever Chromium is doing on a reload of a
 * document this tall, declining restoration by the documented mechanism does
 * not stop it.
 *
 * So the flag is kept — it costs nothing and it is the correct declaration of
 * intent — but the thing that holds the page at the top is the loop below.
 * For the first few seconds any scroll that arrives without the visitor asking
 * for one is undone on the next frame. In the run that confirmed the fix that
 * is exactly what the timeline shows: `0ms y=0` → `495ms y=11565` →
 * `496ms y=0`, a single frame of displacement nobody can see.
 *
 * The first real `wheel`, `touchstart`, `keydown` or `pointerdown` ends the
 * hold permanently, so it can never fight someone who actually wants to
 * scroll. That release is what makes a generous window safe: the cost of
 * holding too long is zero for a visitor who is reading, and the cost of
 * holding too briefly is the original bug on a slower machine. The observed
 * displacement lands around 500ms; the window is several times that, and it
 * is extended past `load` for a page that takes longer to settle than this one.
 *
 * ## Restoration is handed back on the way out, not on `load`
 *
 * `scrollRestoration` belongs to the session history *entry*, so leaving it on
 * "manual" forever would also flatten the position when someone later returns
 * to this page with the back button. The obvious place to hand it back is the
 * `load` event — "after the moment the browser would have used it".
 *
 * That reasoning is false, and it caused this bug rather than fixing it.
 * Chrome converges on the saved offset as the document grows, well past
 * `load`. Handing the flag back there re-armed restoration exactly in time to
 * be used: the scroll went `0px at 16ms` → `8708px at 452ms` → `11182px at
 * 1216ms`, the first attempt capped by the height the document had reached by
 * then and the second once it was fully laid out. `pagehide` is the correct
 * moment — nothing restores after it, the saved position is recorded
 * independently of this flag, and the entry is left on "auto" so a future
 * back-navigation restores normally.
 *
 * ## Why this is an inline script and not a component with an effect
 *
 * Timing, and it is not close. Effects run children-first, so an effect in the
 * root layout fires *after* the hero's — by which point the hero has already
 * read the scroll position and decided not to play the intro. And
 * `scrollRestoration` has to be set before the browser performs the
 * restoration, which begins well before hydration. A script in the document
 * runs during parsing, which is early enough for both.
 */
const SCRIPT = `(function(){
  try {
    var nav = performance.getEntriesByType("navigation")[0];
    var type = nav ? nav.type : "navigate";

    if (type === "back_forward") return;

    var fromHere = document.referrer.indexOf(location.origin + "/") === 0;
    if (type !== "reload" && fromHere) return;

    history.scrollRestoration = "manual";
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    window.scrollTo(0, 0);

    addEventListener("pagehide", function () {
      history.scrollRestoration = "auto";
    }, { once: true });

    var asked = false;
    var release = function () { asked = true; };
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (name) {
      addEventListener(name, release, { once: true, passive: true });
    });

    var until = performance.now() + 4000;
    addEventListener("load", function () {
      until = Math.max(until, performance.now() + 1500);
    }, { once: true });

    var hold = function () {
      if (asked) return;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      if (performance.now() < until) requestAnimationFrame(hold);
    };
    requestAnimationFrame(hold);
  } catch (e) {}
})();`;

export default function OpenAtTop() {
  return (
    // No `src`, so React renders it where it stands rather than hoisting it,
    // and it runs as the parser reaches it. The content is a constant in this
    // file — nothing from a request or the CMS reaches it — so there is no
    // injection surface to escape against.
    <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
  );
}
