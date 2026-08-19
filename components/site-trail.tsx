"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useFinePointer, useReducedMotion } from "@/lib/use-media-query";

/** Links in the chain. Short on purpose: this is a smear, not a comet. */
const NODES = 6;
/** How hard each link is pulled toward the one ahead of it, per second. */
const FOLLOW = 10;
/** How fast the whole trail arrives and leaves with the pointer. */
const PRESENCE = 40;

const HEAD_SIZE = 30;
const TAIL_SIZE = 15;

/**
 * The pointer trail, for the whole site.
 *
 * Every link is a plain DOM node written straight from `gsap.ticker` — no React
 * state, no re-render, for the same reason the particle uniforms are not state:
 * this runs on every frame the pointer moves.
 *
 * It carries its own pointer listener rather than reading the hero's motion
 * object, because it now outlives the hero: the chapters below have no shared
 * mutable state to hang off, and a global overlay reaching into one section's
 * internals would be the wrong dependency anyway.
 *
 * `fixed` and driven by raw client coords, so it is unaffected by scroll,
 * sticky frames or which chapter currently owns the screen. Mounted below the
 * nav and below the hero's loader, so it passes behind type rather than over
 * it — and never shows during the intro wipe.
 *
 * Flat acid, no blend mode. `mix-blend-screen` reads well on the void chapters
 * but there is nothing under it there to screen against, so it buys nothing —
 * and over Chapter .02's light slab it washes the trail out to a faint smear.
 * The nav solves the same two-ground problem with `difference`, which is right
 * for type but turns acid into muddy sage. Acid is bright enough to hold on
 * both grounds unaided.
 */
export default function SiteTrail() {
  const rootRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<(HTMLSpanElement | null)[]>([]);

  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const active = finePointer && !reducedMotion;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return;

    const nodes = nodesRef.current;
    const xs = new Float64Array(NODES);
    const ys = new Float64Array(NODES);

    let pointerX = 0;
    let pointerY = 0;
    let inside = 0;
    let seeded = false;
    let presence = 0;

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      inside = 1;
    };
    const onLeave = () => {
      inside = 0;
    };

    const tick = (_time: number, deltaTime: number) => {
      // Clamped: a backgrounded tab hands back one enormous delta, and an
      // unclamped exponential on that snaps the whole chain onto the cursor.
      const dt = Math.min(deltaTime / 1000, 0.05);

      presence += (inside - presence) * (1 - Math.exp(-PRESENCE * dt));

      // Nothing on screen and nothing to chase: this ticker now runs for the
      // whole session, so the idle case has to cost nothing.
      if (presence < 0.002 && !inside) {
        if (root.style.opacity !== "0") root.style.opacity = "0";
        return;
      }

      // Drop the chain onto the cursor the first time it is seen, or the trail
      // whips in from the top-left corner on the very first movement.
      if (!seeded && inside) {
        xs.fill(pointerX);
        ys.fill(pointerY);
        seeded = true;
      }

      const follow = 1 - Math.exp(-FOLLOW * dt);
      xs[0] += (pointerX - xs[0]) * follow;
      ys[0] += (pointerY - ys[0]) * follow;
      for (let i = 1; i < NODES; i++) {
        xs[i] += (xs[i - 1] - xs[i]) * follow;
        ys[i] += (ys[i - 1] - ys[i]) * follow;
      }

      root.style.opacity = String(presence);
      for (let i = 0; i < NODES; i++) {
        const node = nodes[i];
        if (node) {
          node.style.transform = `translate3d(${xs[i]}px, ${ys[i]}px, 0)`;
        }
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      gsap.ticker.remove(tick);
      root.style.opacity = "0";
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden opacity-0"
    >
      {Array.from({ length: NODES }, (_, i) => {
        const t = i / (NODES - 1);
        const size = HEAD_SIZE - (HEAD_SIZE - TAIL_SIZE) * t;
        return (
          <span
            key={i}
            ref={(el) => {
              nodesRef.current[i] = el;
            }}
            className="absolute left-0 top-0 block rounded-sm bg-acid will-change-transform"
            style={{
              width: size,
              height: size,
              // Centres the dot on the cursor without a second transform.
              marginLeft: -size / 2,
              marginTop: -size / 2,
              opacity: 1 - t * 0.85,
            }}
          />
        );
      })}
    </div>
  );
}
