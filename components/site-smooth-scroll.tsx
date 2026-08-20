"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";
import { getLenis, useSmoothScroll } from "@/lib/use-smooth-scroll";

/**
 * Owns smooth scrolling for the whole site.
 *
 * It used to live inside the hero, which meant it only existed on the
 * homepage: a project page scrolled natively while the homepage glided, and
 * the two felt like different sites. The instance belongs to the document, so
 * it is created here, once, in the root layout.
 *
 * Renders nothing. It is a component only because hooks need one.
 */
export default function SiteSmoothScroll() {
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();

  useSmoothScroll(!reducedMotion);

  useEffect(() => {
    const lenis = getLenis();
    if (!lenis) return;

    // A route change swaps the whole document for one of a different height.
    // Lenis caches its scroll limit and ScrollTrigger caches every start/end
    // it computed, and neither is told that the page underneath them is gone.
    lenis.resize();
    ScrollTrigger.refresh();
  }, [pathname]);

  return null;
}
