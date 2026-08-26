"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-media-query";

/** Two identical groups; the tween travels exactly one group width (-50%). */
const GROUPS = [0, 1];

/**
 * The headline of Chapter .02, set in BlurWeb and running edge to edge.
 *
 * It reacts to scroll the same way the hero particles do — velocity feeds the
 * timeScale and the direction flips with the scroll direction — so the panel
 * feels driven by the same hand as the section it just covered.
 */
export default function RoleMarquee({ roles }: { roles: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track || reducedMotion) return;

      const tween = gsap.to(track, {
        xPercent: -50,
        duration: 26,
        ease: "none",
        repeat: -1,
      });

      // Written by the scroll handler, decayed back to 1 by its own tween, and
      // read every frame — never React state, so scrolling costs no renders.
      const speed = { value: 1 };
      let direction = 1;

      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          direction = self.direction;
          speed.value = 1 + Math.min(Math.abs(self.getVelocity()) / 700, 5);
          tween.timeScale(direction * speed.value);

          gsap.to(speed, {
            value: 1,
            duration: 0.8,
            ease: "power2.out",
            overwrite: true,
            onUpdate: () => tween.timeScale(direction * speed.value),
          });
        },
      });
    },
    { scope: rootRef, dependencies: [reducedMotion] },
  );

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="relative overflow-hidden border-b border-[#71737D] py-1 select-none"
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
        {GROUPS.map((group) => (
          <div key={group} className="flex shrink-0 items-center">
            {roles.map((role) => (
              <span
                key={role}
                className="flex shrink-0 items-center font-display font-black text-[clamp(2.25rem,min(8.5vw,11vh),9rem)] leading-[0.95] uppercase tracking-[-0.01em] text-void/90"
              >
                {role}
                <span className="px-[0.35em] text-void/35">—</span>
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* The band bleeds out of both edges instead of stopping dead at them. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#71737D] to-transparent md:w-28"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#71737D] to-transparent md:w-28"
      />
    </div>
  );
}
