"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import {
  sampleTextToPoints,
  waitForFont,
  type TextSample,
} from "@/lib/sample-text-to-points";
import { useFinePointer, useReducedMotion } from "@/lib/use-media-query";
import { useSmoothScroll } from "@/lib/use-smooth-scroll";
import { useWebGLSupport } from "@/lib/use-webgl-support";
import { META_TYPE } from "@/lib/site-config";
import HeroCanvas from "./hero-canvas";
import { heroCopy } from "./hero-copy";
import HeroHud from "./hero-hud";
import HeroLoader from "./hero-loader";
import { createHeroMotion, resolveParticleCount } from "./hero-motion";

/**
 * The pool the scramble draws from. Deliberately not the alphabet: uppercase
 * plus the punctuation the rest of the site is built out of, so the noise looks
 * like this page mid-decode rather than like a slot machine.
 *
 * No `<`, `>` or `&`. The plugin writes the noise in as innerHTML, so those get
 * parsed as markup mid-tween — a stray `<` swallows the characters after it
 * and leaves entity fragments like `lt;` sitting in the copy.
 */
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/[]{}#*+=-_.:";

export default function Hero() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fontProbeRef = useRef<HTMLSpanElement>(null);

  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderCounterRef = useRef<HTMLSpanElement>(null);
  const loaderBarRef = useRef<HTMLSpanElement>(null);

  const signalLabelRef = useRef<HTMLSpanElement>(null);
  const signalBarRef = useRef<HTMLSpanElement>(null);
  const signalValueRef = useRef<HTMLSpanElement>(null);

  // A ref is the sanctioned mutable container. The ref object itself is passed
  // down — `.current` is only ever touched inside callbacks, never during render.
  const motionRef = useRef(createHeroMotion());

  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const webgl = useWebGLSupport();

  const [sample, setSample] = useState<TextSample | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [inView, setInView] = useState(true);

  // Wait for the real webfont, then rasterise the wordmark into particle
  // targets. The family is read off a live node rather than imported, so the
  // sampler is guaranteed to use exactly the face the browser resolved.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const probe = fontProbeRef.current;
      const fontFamily = probe
        ? getComputedStyle(probe).fontFamily
        : "sans-serif";

      await waitForFont(fontFamily);
      if (cancelled) return;
      setFontsReady(true);
      if (!webgl) return;

      const next = sampleTextToPoints({
        text: heroCopy.wordmark,
        fontFamily,
        count: resolveParticleCount(),
      });
      if (!cancelled) setSample(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [webgl]);

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

  const handleVelocity = useCallback((velocity: number) => {
    motionRef.current.scrollVel = velocity;
  }, []);
  useSmoothScroll(!reducedMotion, handleVelocity);

  // Tracked on window rather than on the hero section: the global nav is a fixed
  // overlay, so section-scoped handlers would leave a dead zone across the top
  // of the screen where the particles stop responding. The canvas fills the
  // sticky hero, which is exactly the viewport, so window coords map directly
  // and cost no layout read.
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

  const writeSignal = useCallback((value: number) => {
    const percent = Math.round(value * 100);
    if (signalBarRef.current) {
      signalBarRef.current.style.transform = `scaleX(${value})`;
    }
    if (signalValueRef.current) {
      signalValueRef.current.textContent = `${String(percent).padStart(3, "0")}%`;
    }
    if (signalLabelRef.current) {
      signalLabelRef.current.textContent =
        percent >= 100 ? heroCopy.signalLocked : heroCopy.signalLabel;
    }
  }, []);

  // Loader counter. Runs on its own clock so the veil never flashes; the reveal
  // still waits for the scene to actually be ready.
  useGSAP(
    () => {
      const proxy = { value: 0 };
      gsap.to(proxy, {
        value: 1,
        duration: 1.1,
        ease: "power2.inOut",
        onUpdate: () => {
          const percent = Math.round(proxy.value * 100);
          if (loaderBarRef.current) {
            loaderBarRef.current.style.transform = `scaleX(${proxy.value})`;
          }
          if (loaderCounterRef.current) {
            loaderCounterRef.current.textContent = String(percent).padStart(3, "0");
          }
        },
        onComplete: () => setMinElapsed(true),
      });
    },
    { scope: wrapperRef, dependencies: [] },
  );

  // Derived, not stored: the veil lifts once the scene is genuinely ready and
  // the counter has run its minimum.
  const revealed = fontsReady && (!webgl || sceneReady) && minElapsed;

  // Intro choreography. The first pass (revealed === false) only sets the
  // hidden start state, so nothing can flash between the veil lifting and the
  // timeline starting.
  useGSAP(
    () => {
      const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      const motion = motionRef.current;

      if (!revealed) {
        gsap.set(targets, { yPercent: 110, opacity: 0 });
        return;
      }

      if (reducedMotion) {
        motion.progress = 1;
        motion.dispersion = 0;
        writeSignal(1);
        gsap.set(loaderRef.current, { autoAlpha: 0 });
        gsap.set(targets, { yPercent: 0, opacity: 1 });
        return;
      }

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .to(loaderRef.current, {
          yPercent: -100,
          duration: 0.9,
          ease: "power4.inOut",
        })
        .to(
          motion,
          {
            progress: 1,
            duration: 2.4,
            ease: "power3.out",
            onUpdate: () => writeSignal(motion.progress),
            onComplete: () => writeSignal(1),
          },
          0.35,
        )
        .to(
          targets,
          { yPercent: 0, opacity: 1, duration: 1, stagger: 0.07 },
          0.55,
        )
        // Each line lands as noise and resolves into itself.
        //
        // The timing is built around the two things already on screen. It
        // starts at 0.4 — before the slide at 0.55 — so a line is already
        // scrambled by the time it clears its `overflow-hidden` mask, rather
        // than appearing correct and then falling apart. `revealDelay` then
        // holds it at full noise until 0.9, which is exactly when the loader
        // finishes wiping up: nothing decodes behind the veil where it cannot
        // be seen. What is left resolves alongside the particle assembly, so
        // the wordmark and the copy come into focus as one gesture.
        //
        // `{original}` is the plugin reading the text already in the DOM, which
        // keeps the real copy server-rendered and the markup free of a
        // duplicate of every string.
        .to(
          gsap.utils.toArray<HTMLElement>("[data-scramble]"),
          {
            duration: 1.5,
            ease: "none",
            // 0.40 and 0.54 — the tagline decodes between them, at 0.47.
            stagger: 0.14,
            scrambleText: {
              text: "{original}",
              chars: SCRAMBLE_CHARS,
              // Below 1 the glyph churn is slow enough to read as characters
              // rather than as a grey flicker.
              speed: 0.45,
              revealDelay: 0.5,
            },
          },
          0.4,
        )
        // The tagline gets its own pass because it is the one line set in
        // proportional sans rather than mono. Uppercase noise sets far wider
        // than the real lowercase copy there — measured, it pushed the
        // paragraph from three lines to five and shunted the whole footer 59px
        // mid-intro, which lands as a jolt right as the hero settles.
        // Lowercase noise keeps the measure honest and the layout still.
        .to(
          gsap.utils.toArray<HTMLElement>("[data-scramble-soft]"),
          {
            duration: 1.5,
            ease: "none",
            scrambleText: {
              text: "{original}",
              chars: "lowerCase",
              speed: 0.45,
              revealDelay: 0.5,
            },
          },
          0.47,
        );
    },
    { scope: wrapperRef, dependencies: [revealed, reducedMotion, writeSignal] },
  );

  // Scroll-out. One ScrollTrigger drives both the shader dispersion and the DOM
  // fade, so they can never drift apart.
  // Scroll-out. One ScrollTrigger drives both the shader dispersion and the DOM
  // fade, so they can never drift apart.
  useGSAP(
    () => {
      if (reducedMotion || !wrapperRef.current) return;
      const motion = motionRef.current;

      gsap.timeline({
        scrollTrigger: {
          trigger: wrapperRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            motion.dispersion = self.progress;
            motion.opacity = 1 - self.progress * 0.25;
          },
        },
      });

      ScrollTrigger.refresh();
    },
    { scope: wrapperRef, dependencies: [reducedMotion, revealed] },
  );

  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  return (
    <div ref={wrapperRef} className="relative h-[200svh] w-full">
      <section
        ref={sectionRef}
        id="hero"
        className="sticky top-0 h-svh w-full overflow-hidden"
      >
        {/* Cheap stand-in for a bloom pass: one gradient, zero render cost. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_42%_at_50%_50%,rgba(225,255,0,0.08),transparent_72%)]"
        />

        {/* Never display:none — a hidden node would not trigger the font load. */}
        <span
          ref={fontProbeRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 select-none font-display text-[10px] font-black opacity-0"
        >
          {heroCopy.wordmark}
        </span>

        {webgl && sample ? (
          <div aria-hidden className="absolute inset-0">
            <HeroCanvas
              sample={sample}
              motionRef={motionRef}
              pointerEnabled={finePointer}
              reducedMotion={reducedMotion}
              active={inView}
              onReady={handleSceneReady}
            />
          </div>
        ) : null}

        {!webgl ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center px-6"
          >
            <span className="font-display text-[clamp(3rem,15vw,13rem)] font-black uppercase leading-none tracking-[-0.04em] text-ink">
              {heroCopy.wordmark}
            </span>
          </div>
        ) : null}

        <div
          ref={contentRef}
          className="pointer-events-none relative z-10 flex h-full flex-col justify-end p-5 md:p-8"
        >
          {/* The particles are decorative; this is what a screen reader gets. */}
          <h1 className="sr-only">{heroCopy.heading}</h1>

          <footer
            className={`flex md:justify-between flex-col md:flex-row gap-8 md:items-end ${META_TYPE}`}
          >
            <div className="space-y-3">
              <div className="overflow-hidden">
                <p data-reveal data-scramble className="text-acid">
                  {heroCopy.eyebrow}
                </p>
              </div>
              <div className="overflow-hidden">
                <p
                  data-reveal
                  data-scramble-soft
                  className="max-w-[52ch] font-sans text-lg normal-case leading-relaxed tracking-normal text-ink"
                >
                  {heroCopy.tagline.join(" ")}
                </p>
              </div>
            </div>

            {/* <div className="hidden justify-self-center md:block">
              <div className="overflow-hidden">
                <div data-reveal className="flex flex-col items-center gap-2">
                  <span className="block h-10 w-px bg-gradient-to-b from-acid to-transparent" />
                  <span>{heroCopy.scrollCue}</span>
                </div>
              </div>
            </div> */}

            <div className="space-y-3 md:justify-self-end">
              <div className="overflow-hidden">
                <div data-reveal>
                  <HeroHud
                    labelRef={signalLabelRef}
                    barRef={signalBarRef}
                    valueRef={signalValueRef}
                  />
                </div>
              </div>
              <div className="overflow-hidden">
                <p data-reveal className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-acid" />
                  {/* Only the text half is handed to the plugin — it rewrites
                      the innerHTML of whatever it is given, which would take
                      the dot with it. */}
                  <span data-scramble>{heroCopy.status}</span>
                </p>
              </div>
            </div>
          </footer>
        </div>
        {/* Driven by `slat-curtain.tsx`, which owns the crossover: whatever is
            still visible between the closing slabs sinks back behind them. A
            veil rather than a `filter` so the compositor only blends one flat
            layer over the live canvas — and last in the section, at the same
            z as the content it dims, so it covers the hero without ever
            climbing over the curtain itself (equal z, and the curtain is
            later in the tree). */}
        <div
          data-hero-veil
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 bg-void opacity-0"
        />
      </section>

      <HeroLoader
        rootRef={loaderRef}
        counterRef={loaderCounterRef}
        barRef={loaderBarRef}
      />
    </div>
  );
}
