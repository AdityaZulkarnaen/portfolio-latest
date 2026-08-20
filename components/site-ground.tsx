"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ScrollTrigger } from "@/lib/gsap";

/**
 * The two bands of the viewport the fixed chrome actually occupies, and where
 * each is measured.
 *
 * `top` is the nav's band. `mid` is the chapter rail's, which hangs centred
 * down the right edge, and the pointer trail's, which is full-screen and takes
 * the middle as its best single answer.
 *
 * One flag for both would be wrong at every seam: a chapter whose top edge is
 * halfway up the screen owns the rail's band and not the nav's, and the two
 * would be styled for the wrong ground for half a screen of scroll each time.
 */
const BANDS = [
  { flag: "groundTop", start: "top", end: "bottom top" },
  { flag: "groundMid", start: "center", end: "bottom center" },
] as const;

/**
 * Tells the fixed chrome what colour it is standing on.
 *
 * The nav, the chapter rail and the pointer trail belong to no chapter but are
 * always on top of one. Two of them solve that with `mix-blend-difference`,
 * which held while every ground on the page was either the void or Chapter
 * .02's mid-grey slab. Chapter .05 is acid, and difference against acid sends
 * ink to a hard blue while the two flat-acid pieces — the rail's thumb and the
 * trail — vanish outright. So a section can declare its ground, and the
 * stylesheet flips the chrome by hand for the stretch that ground is under it.
 *
 * A section opts in with `data-ground="<name>"`, plus an optional
 * `data-ground-from` naming the scroll position at which its colour has
 * finished sealing the top of the frame — that is the takeover's end for a
 * chapter that reaches up with slats, and the default (`top`, i.e. the
 * section's own top edge) for one that does not.
 *
 * Nothing here knows which chapter is which, and no component holds a list.
 * Same reasoning as the chapter rail reading `[data-chapter]` out of the DOM:
 * one declaration on the section, no second place to update.
 */
export default function SiteGround() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const grounds = [...document.querySelectorAll<HTMLElement>("[data-ground]")];

    const write = (flag: string, ground: string, active: boolean) => {
      if (active) root.dataset[flag] = ground;
      // Only clear the flag if it is still ours. Two grounds meeting hand over
      // in whichever order the triggers happen to toggle, and the one leaving
      // must not wipe the one that has just arrived.
      else if (root.dataset[flag] === ground) delete root.dataset[flag];
    };

    const triggers = grounds.flatMap((el) => {
      const ground = el.dataset.ground ?? "";
      const from = el.dataset.groundFrom;

      return BANDS.map(({ flag, start, end }) => {
        const trigger = ScrollTrigger.create({
          trigger: el,
          // `data-ground-from` only moves the nav's band. The rail's opens when
          // the section's own top edge crosses the middle of the screen, and no
          // amount of reaching up can beat it there — a takeover fills from
          // just above the section upward, so the middle is already covered by
          // the time the top of the frame is.
          start: `top ${flag === "groundTop" && from ? from : start}`,
          end,
          onToggle: (self) => write(flag, ground, self.isActive),
        });
        // A reload partway down the page creates the trigger already active,
        // and `onToggle` only fires on a change.
        write(flag, ground, trigger.isActive);
        return trigger;
      });
    });

    return () => {
      triggers.forEach((trigger) => trigger.kill());
      delete root.dataset.groundTop;
      delete root.dataset.groundMid;
    };
    // Re-runs on navigation: the grounds are per-page, and a stale flag would
    // leave the next route's chrome inverted over the wrong colour.
  }, [pathname]);

  return null;
}
