"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, killScrollTriggersIn, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { buildLogoAtlas, type LogoAtlas } from "@/lib/build-logo-atlas";
import { waitForFont } from "@/lib/sample-text-to-points";
import { useFinePointer, useReducedMotion } from "@/lib/use-media-query";
import { useWebGLSupport } from "@/lib/use-webgl-support";
import { META_TYPE_BASE } from "@/lib/site-config";
import TechCanvas from "./tech-canvas";
import { techCopy } from "./tech-copy";
import TechHud from "./tech-hud";
import {
  BEAT,
  createTechMotion,
  phase,
  resolveAtlasTile,
  resolveLogoCount,
} from "./tech-motion";

/** Slabs the chapter reaches up with, matching Chapter .02's takeover. */
const SLATS = 3;

/**
 * Chapter .03 — the tag that opens, the tunnel behind it, and the tag closing
 * again.
 *
 * Structurally this is the hero's frame: a tall wrapper with a `sticky` screen
 * inside it, so the pinning is pure CSS and behaves identically on a trackpad
 * fling, a keyboard PageDown and with JS disabled. Everything animated hangs
 * off exactly one scrubbed ScrollTrigger writing one mutable object, which is
 * why the tag, the tunnel and the heading cannot drift apart — there is only
 * ever one clock.
 */
export default function TechStack() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const fontProbeRef = useRef<HTMLSpanElement>(null);

  const depthBarRef = useRef<HTMLSpanElement>(null);
  const depthValueRef = useRef<HTMLSpanElement>(null);

  // The sanctioned mutable container: the ref object is handed to the scene,
  // and `.current` is only ever touched inside callbacks, never during render.
  const motionRef = useRef(createTechMotion());

  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const webgl = useWebGLSupport();

  const [atlas, setAtlas] = useState<LogoAtlas | null>(null);
  const [count, setCount] = useState(0);
  const [inView, setInView] = useState(false);

  // Rasterise the stack into one sprite sheet. The family is read off a live
  // node rather than imported, so the atlas is drawn with exactly the face the
  // browser resolved — Canvas 2D silently falls back to a system face
  // otherwise, and the labels come out in the wrong voice.
  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;

    (async () => {
      const probe = fontProbeRef.current;
      const fontFamily = probe
        ? getComputedStyle(probe).fontFamily
        : "monospace";

      await waitForFont(fontFamily, 700);
      if (cancelled) return;

      const next = await buildLogoAtlas(
        techCopy.stack,
        fontFamily,
        resolveAtlasTile(),
      );
      if (cancelled || !next) return;

      // Read once, here: the instanced buffers are allocated against this and
      // must not change on resize.
      setCount(resolveLogoCount());
      setAtlas(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [webgl]);

  useEffect(() => {
    return () => {
      atlas?.texture.dispose();
    };
  }, [atlas]);

  // Gates the render loop. Two WebGL contexts now live on this page, and this
  // is what keeps only one of them drawing at a time.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tracked on window rather than on the section: the sticky frame is exactly
  // the viewport while the chapter is live, so window coords map directly and
  // cost no layout read.
  useEffect(() => {
    if (!finePointer) return;

    const onMove = (event: PointerEvent) => {
      const motion = motionRef.current;
      motion.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      motion.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
      motion.pointerInside = 1;
    };
    const onLeave = () => {
      motionRef.current.pointerInside = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [finePointer]);

  const writeDepth = useCallback((value: number) => {
    const percent = Math.round(value * 100);
    if (depthBarRef.current) {
      depthBarRef.current.style.transform = `scaleX(${value})`;
    }
    if (depthValueRef.current) {
      depthValueRef.current.textContent = `${String(percent).padStart(3, "0")}%`;
    }
  }, []);

  // The takeover. Same mechanism as Chapter .02, in void rather than slab: the
  // slabs are pinned to the outside of the chapter's top edge so they travel
  // with it, and the grey panel above is taken over rather than covered.
  useGSAP(
    () => {
      if (reducedMotion) {
        killScrollTriggersIn(wrapperRef.current);
        gsap.set("[data-tech-slat]", { scaleY: 1 });
        return;
      }

      gsap.fromTo(
        "[data-tech-slat]",
        { scaleY: 0 },
        {
          // Past 1 so neighbouring slabs overlap by a hair — at 1 exactly,
          // sub-pixel rounding leaves seams of the panel above showing through.
          scaleY: 1.02,
          ease: "none",
          duration: 1.6,
          stagger: { each: 1, from: "end" },
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top bottom",
            end: "top 25%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    },
    { scope: wrapperRef, dependencies: [reducedMotion] },
  );

  // The one clock. Every beat below is derived from this single progress value.
  useGSAP(
    () => {
      const wrapper = wrapperRef.current;
      const head = headRef.current;
      const motion = motionRef.current;
      if (!wrapper || !head) return;

      if (reducedMotion) {
        killScrollTriggersIn(wrapper);
        // A held composition rather than a frozen mid-animation frame: the tag
        // sits cracked open, the tunnel shows one slice, the heading is simply
        // there. `code-tag` and `logo-tunnel` pin their own static values.
        head.style.opacity = "1";
        head.style.transform = "none";
        writeDepth(1);
        return;
      }

      head.style.opacity = "0";
      head.style.transform = "scale(1.35)";

      ScrollTrigger.create({
        trigger: wrapper,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          const opening = phase(p, BEAT.openStart, BEAT.openEnd);
          const closing = phase(p, BEAT.closeStart, 1);

          // One parametrisation for both directions: driving `aperture` back
          // down is literally the opening move in reverse, so the halves return
          // from off-frame and seal the chapter without a second timeline.
          motion.aperture = opening * (1 - closing);
          motion.reveal = Math.min(opening, 1 - closing);
          motion.travel = phase(p, BEAT.travelStart, BEAT.travelEnd);
          // px/sec into the per-frame units the shader's decay expects.
          motion.scrollVel = self.getVelocity() / 60;

          // The heading arrives with the tunnel and leaves before the tag
          // closes over it, so nothing is ever caught behind the shutting tag.
          const presence = Math.min(
            phase(p, 0.13, 0.33),
            1 - phase(p, 0.76, 0.93),
          );
          const scale = 1.35 - 0.35 * phase(p, 0.13, 0.36);
          const drift = -phase(p, BEAT.travelStart, BEAT.travelEnd) * 3;

          head.style.opacity = String(presence);
          head.style.transform = `translate3d(0, ${drift}vh, 0) scale(${scale})`;

          writeDepth(motion.travel);
        },
      });

      ScrollTrigger.refresh();
    },
    { scope: wrapperRef, dependencies: [reducedMotion, writeDepth] },
  );

  return (
    <div
      ref={wrapperRef}
      data-chapter=".03"
      data-chapter-name="Stack"
      className="relative z-30 h-[460svh] w-full"
    >
      {/* Sits directly on the outside of the chapter's top edge and moves with
          it — this section's own reach into the space above.

          The reach is shorter on mobile. Chapter .02 stacks its aside below the
          bio there instead of pinning it, so its last screenful is live content
          rather than the empty column desktop leaves behind; a 55svh reach ate
          the photo deck. The panel above pairs this with a matching tail of
          empty ground, and the invariant between them is simply that the tail
          must be at least as tall as this band. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full flex h-[30svh] flex-col md:h-[55svh]"
      >
        {Array.from({ length: SLATS }, (_, i) => (
          <span
            key={i}
            data-tech-slat
            className="w-full flex-1 origin-bottom scale-y-0 bg-void will-change-transform"
          />
        ))}
      </div>

      <section
        ref={sectionRef}
        id="tech"
        className="sticky top-0 h-svh w-full overflow-hidden bg-void"
      >
        {/* Never display:none — a hidden node would not trigger the font load. */}
        <span
          ref={fontProbeRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 select-none font-mono text-[10px] font-bold opacity-0"
        >
          {techCopy.stack[0].label}
        </span>

        {/* Cheap stand-in for a bloom pass at the vanishing point. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(46%_38%_at_50%_50%,rgba(225,255,0,0.07),transparent_70%)]"
        />

        {webgl && atlas && count > 0 ? (
          <div aria-hidden className="absolute inset-0">
            <TechCanvas
              atlas={atlas}
              motionRef={motionRef}
              count={count}
              pointerEnabled={finePointer}
              reducedMotion={reducedMotion}
              active={inView}
            />
          </div>
        ) : null}

        {/* Heading in front of the tunnel, as in the reference. This is the
            real heading — the canvas behind it is decorative and aria-hidden. */}
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-5">
          <h2
            ref={headRef}
            data-tech-head
            className="text-center font-blur text-[clamp(3rem,14vw,12rem)] font-black uppercase leading-[0.82] text-ink will-change-transform"
          >
            {techCopy.heading.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
        </div>

        {/* One list doing two jobs. Without WebGL it is the chapter's visible
            content, drawn in the same register as the rest of the meta type.
            With WebGL it stays in the tree as screen-reader text, because the
            canvas is `aria-hidden` and the logos are the only place the stack
            is ever stated — a heading reading "TECH STACK" over a decorative
            tunnel otherwise announces a section with no contents. */}
        <div
          className={
            webgl
              ? "sr-only"
              : "pointer-events-none absolute inset-x-0 bottom-24 z-10 px-5 md:px-8"
          }
        >
          <h3 className="sr-only">{techCopy.stackLabel}</h3>
          <ul
            className={
              webgl
                ? undefined
                : `flex flex-wrap justify-center gap-x-6 gap-y-2 ${META_TYPE_BASE} text-muted`
            }
          >
            {techCopy.stack.map((tile) => (
              <li key={tile.name}>{tile.name}</li>
            ))}
          </ul>
        </div>

        <TechHud barRef={depthBarRef} valueRef={depthValueRef} />
      </section>

      {/* Chapter .04 joins on here. The tag has closed and the frame is sealed
          void at progress = 1, so the next panel only needs the Chapter .02
          takeover pattern (slats on `bottom-full`, "top bottom" -> "top 25%")
          with a ground colour of its own. Nothing scrubs across the seam. */}
      <div data-chapter-seam aria-hidden />
    </div>
  );
}
