"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  META_TYPE,
  META_TYPE_BASE,
  siteConfig,
  type NavItem,
} from "@/lib/site-config";
import { worksCopy } from "@/components/works/works-copy";
import { useReducedMotion } from "@/lib/use-media-query";
import { getLenis } from "@/lib/use-smooth-scroll";

const { nav } = siteConfig;

/** The id an item points at, or "" for a link that is not an anchor. */
function idOf(item: NavItem): string {
  const hash = item.href.indexOf("#");
  return hash === -1 ? "" : item.href.slice(hash + 1);
}

/**
 * The menu, in both of its shapes: a row of links from `sm` up, and a panel
 * that comes in from the right below it.
 *
 * The items come from `siteConfig.nav`, and every one of them is a real
 * root-relative link that works with the JavaScript switched off — from a case
 * page they navigate home to a section, and on the home page the browser would
 * jump to the anchor by itself. What this component adds on top is the smooth
 * trip: a click is only intercepted when the target is already on the page.
 *
 * It owns the nav row rather than being rendered inside it, and that is
 * structural, not stylistic. The row is `mix-blend-difference`; the panel is a
 * full sheet of ground and must not be. Blending applies to a `position: fixed`
 * descendant just the same, so the panel has to be the row's *sibling* — which
 * means one component has to render both. The brand comes in as a prop so it
 * stays server-rendered and out of this bundle.
 */
export default function SiteMenu({ brand }: { brand: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const [open, setOpen] = useState(false);

  // Closing on navigation, adjusted during render rather than in an effect.
  // It has to happen before the effects below run: an open panel has stopped
  // Lenis, and a route change that left `open` true would hand the next page
  // over unable to scroll, with no panel on screen to explain why.
  const [routeAt, setRouteAt] = useState(pathname);
  if (routeAt !== pathname) {
    setRouteAt(pathname);
    setOpen(false);
  }

  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /**
   * Marks the section you are actually in, straight onto the DOM.
   *
   * Offsets are measured rather than taken from the config, because only the
   * page knows them — the chapters are svh-sized, so a mobile URL bar
   * collapsing moves every one. Written as an attribute rather than held in
   * state: this runs on every frame of a smooth scroll, and going through
   * React would re-render the page shell sixty times a second to move one
   * word's colour.
   *
   * A section the current route does not have is simply skipped, which is what
   * makes this quiet on a case page instead of wrong.
   */
  useEffect(() => {
    const links = [
      ...document.querySelectorAll<HTMLElement>("[data-menu-link]"),
    ];
    if (links.length === 0) return;

    let tops: { id: string; top: number }[] = [];

    const measure = () => {
      tops = nav
        .map(idOf)
        .map((id) => ({ id, el: id ? document.getElementById(id) : null }))
        .filter((entry) => entry.el !== null)
        .map(({ id, el }) => ({
          id,
          top: el!.getBoundingClientRect().top + window.scrollY,
        }))
        .sort((a, b) => a.top - b.top);
    };

    const sync = () => {
      if (tops.length === 0) return;
      // The section you are in is the last one whose top you have passed. The
      // half-viewport allowance is what makes the next one light up as it takes
      // over the screen, rather than once it has finished arriving.
      const at = window.scrollY + window.innerHeight * 0.5;
      let active = tops[0].id;
      for (const entry of tops) if (entry.top <= at) active = entry.id;

      for (const el of links) {
        el.dataset.active = el.dataset.menuLink === active ? "true" : "false";
      }
    };

    const remeasure = () => {
      measure();
      sync();
    };

    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", remeasure);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", remeasure);
    };
    // `open` re-runs it because the panel's links only exist while it is open,
    // and they have to be given their state the moment they mount.
  }, [pathname, open]);

  /**
   * Takes the click only when there is something here to scroll to, and then
   * goes through Lenis. Writing `scrollTop` would leave the smooth-scroll loop
   * animating toward its own stale target, and the page fights the pointer
   * until it gives up.
   *
   * Everything else — a section this route does not have — falls through to
   * the link, which is a real one.
   */
  const goTo = useCallback(
    (event: React.MouseEvent, id: string) => {
      const target = id ? document.getElementById(id) : null;
      if (!target) {
        setOpen(false);
        return;
      }

      event.preventDefault();
      setOpen(false);

      const lenis = getLenis();
      if (lenis) {
        // Started first: `scrollTo` on a stopped instance goes nowhere, and it
        // is stopped for as long as the panel is open.
        lenis.start();
        lenis.scrollTo(target, { immediate: reducedMotion });
      } else {
        target.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      }
    },
    [reducedMotion],
  );

  // The page must not scroll behind an open panel, and Lenis owns the scroll —
  // `overflow: hidden` on the body would do nothing to it. The native branch is
  // for the reduced-motion build, which has no Lenis instance at all.
  useEffect(() => {
    if (!open) return;

    const lenis = getLenis();
    lenis?.stop();
    const previous = document.body.style.overflow;
    if (!lenis) document.body.style.overflow = "hidden";

    return () => {
      lenis?.start();
      if (!lenis) document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes, and Tab stays inside. An open panel covers the page, so
  // tabbing behind it would put focus on things nobody can see.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus follows the panel in, and back out to the button that opened it, so a
  // keyboard never loses its place — but only when focus was left on the body.
  // If something else has claimed it since, that is not ours to take back.
  //
  // `openedOnce` is what keeps this from firing on mount. The effect runs once
  // when the component first renders, with `open` false and `activeElement`
  // still the body — which is every fresh page load — and the `else` branch
  // would then focus a button nobody has touched. Below `sm` that paints the
  // browser's focus ring around the burger the moment the page appears, and a
  // ring around a box wrapping two hairlines reads as a selection, not as
  // focus. Above `sm` the button is `sm:hidden`, and focusing a `display: none`
  // element does nothing, so the bug was invisible on desktop the whole time.
  //
  // Returning focus is only meaningful after a close that followed an open, so
  // that is exactly what this now tracks. A ref rather than state: nothing
  // renders from it, and flipping it must not cost a pass.
  const openedOnce = useRef(false);

  useEffect(() => {
    if (open) {
      openedOnce.current = true;
      closeRef.current?.focus();
      return;
    }
    if (!openedOnce.current) return;
    if (document.activeElement === document.body) burgerRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* `mix-blend-difference` instead of a fixed colour: the page scrolls a
          light slab (Chapter .02) under a nav that used to only ever sit on the
          void, and inverting against the backdrop keeps it legible on both
          without a scroll listener swapping classes.

          Both, and only both. Difference against Chapter .05's acid sends ink
          to a hard blue, so that ground is the one case handled by hand: the
          section declares `data-ground`, `site-ground.tsx` stamps it on the
          root, and `globals.css` turns the blending off and the type void. */}
      <div
        data-nav
        className={`relative flex items-start justify-between p-5 mix-blend-difference md:p-8 ${META_TYPE}`}
      >
        {brand}

        <nav aria-label="Main" className="hidden gap-7 sm:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-menu-link={idOf(item)}
              data-active="false"
              onClick={(event) => goTo(event, idOf(item))}
              className="transition-colors hover:text-acid data-[active=true]:text-acid"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          ref={burgerRef}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="site-menu-panel"
          onClick={() => setOpen(true)}
          className="-m-2 flex flex-col items-end gap-1.5 p-2 sm:hidden"
        >
          {/* Two rules, not three. The whole of this page's furniture is
              hairlines — the rail, the loader bar, the tick dashes — and a
              third bar would make this the one heavy object in the chrome. */}
          <span aria-hidden className="block h-px w-6 bg-current" />
          <span aria-hidden className="block h-px w-4 bg-current" />
        </button>
      </div>

      <SiteMenuPanel
        ref={panelRef}
        closeRef={closeRef}
        open={open}
        onClose={() => setOpen(false)}
        onNavigate={goTo}
        reducedMotion={reducedMotion}
      />
    </>
  );
}

type PanelProps = {
  ref: React.RefObject<HTMLDivElement | null>;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  onNavigate: (event: React.MouseEvent, id: string) => void;
  reducedMotion: boolean;
};

/**
 * The panel, in from the right.
 *
 * It brings its own ground, which is the whole reason it lives outside the
 * blended row — see the note on `SiteMenu`.
 *
 * `inert` rather than `hidden` while closed: the panel keeps its box so the
 * slide has something to animate, and `inert` is what actually takes it out of
 * the tab order and off the accessibility tree while it is parked off-screen.
 */
function SiteMenuPanel({
  ref,
  closeRef,
  open,
  onClose,
  onNavigate,
  reducedMotion,
}: PanelProps) {
  return (
    <div className="sm:hidden" {...(open ? {} : { inert: true })}>
      {/* Not a blur. The chapters behind this are live WebGL, and a backdrop
          filter over them costs a full-frame readback every frame the panel is
          open. Flat void at 70% reads the same and costs nothing. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-void/70 transition-opacity duration-500 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        ref={ref}
        id="site-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col bg-void ${
          reducedMotion
            ? ""
            : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        } ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* The seam down the left edge, so the panel reads as a sheet laid over
            the page rather than as the page having changed colour. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-line" />

        <div className="flex items-start justify-between p-5">
          <span className={`${META_TYPE_BASE} text-muted`}>MENU</span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="-m-2 grid place-items-center p-2 text-ink transition-colors hover:text-acid"
          >
            {/* The burger's own two rules, crossed. Same weight, same language
                — a heavier X would be the only bold mark in the chrome. */}
            <span aria-hidden className="relative block size-5">
              <span className="absolute left-0 top-1/2 block h-px w-full rotate-45 bg-current" />
              <span className="absolute left-0 top-1/2 block h-px w-full -rotate-45 bg-current" />
            </span>
          </button>
        </div>

        <nav
          aria-label="Sections"
          className="flex flex-1 flex-col justify-center px-5"
        >
          <ul>
            {nav.map((item, i) => (
              <li key={item.href} className="overflow-hidden">
                <Link
                  href={item.href}
                  data-menu-link={idOf(item)}
                  data-active="false"
                  onClick={(event) => onNavigate(event, idOf(item))}
                  style={
                    // Staggered on the way in only. On the way out they leave
                    // together: a staggered exit reads as the panel being slow
                    // to answer the tap that closed it.
                    reducedMotion
                      ? undefined
                      : { transitionDelay: open ? `${140 + i * 55}ms` : "0ms" }
                  }
                  className={`group flex items-baseline gap-3 py-2 text-ink transition-[transform,opacity,color] duration-500 ease-out data-[active=true]:text-acid ${
                    open || reducedMotion
                      ? "translate-y-0 opacity-100"
                      : "translate-y-6 opacity-0"
                  }`}
                >
                  <span
                    className={`${META_TYPE_BASE} text-muted transition-colors group-data-[active=true]:text-acid`}
                  >
                    {item.mark}
                  </span>
                  <span className="font-display text-[clamp(2rem,11vw,2.75rem)] font-black uppercase leading-[1.05] tracking-[-0.035em]">
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* A real destination rather than the decorative button the reference
            has here: the archive is the one place on this site the sections
            above do not reach. */}
        <div className="p-5">
          <Link
            href={worksCopy.allHref}
            onClick={onClose}
            className={`group flex items-center justify-between gap-3 border border-line px-4 py-4 text-ink transition-colors hover:border-acid hover:text-acid ${META_TYPE_BASE}`}
          >
            {worksCopy.allLabel}
            <span
              aria-hidden
              className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
