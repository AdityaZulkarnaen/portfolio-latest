"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Registering once at module scope keeps plugin availability independent of the
// order in which component effects happen to run. Both imports are SSR-safe;
// the guard just avoids touching the DOM during the server pass.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export { gsap, ScrollTrigger, useGSAP };
