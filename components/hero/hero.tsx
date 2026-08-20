"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { waitForFont } from "@/lib/sample-text-to-points";
import { useFinePointer, useReducedMotion } from "@/lib/use-media-query";
import { useScrollVelocity } from "@/lib/use-smooth-scroll";
import { useWebGLSupport } from "@/lib/use-webgl-support";
import { META_TYPE } from "@/lib/site-config";
import HeroCanvas from "./hero-canvas";
import { heroCopy } from "./hero-copy";
import HeroHud from "./hero-hud";
import HeroLoader from "./hero-loader";
import { createHeroMotion, useFieldQuality } from "./hero-motion";

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

/** Shared between the two wordmark lines so they cannot drift apart. */
const WORDMARK_TYPE =
  "block font-display text-[clamp(2.5rem,8.5vw,7.5rem)] font-black uppercase leading-[0.86] tracking-[-0.045em]";

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

  const [fontsReady, setFontsReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [inView, setInView] = useState(true);

  // Reports the server default during hydration, which costs nothing: `webgl`
  // reports false there too, so the canvas has not mounted yet either way.
  const quality = useFieldQuality();

  // The wordmark is the largest type on the page; a swap from the fallback
  // metric mid-intro would shove the whole bottom block sideways. Waiting on
  // the real face costs nothing visible — the loader is up until this resolves.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const probe = fontProbeRef.current;
      const fontFamily = probe
        ? getComputedStyle(probe).fontFamily
        : "sans-serif";

      await waitForFont(fontFamily);
      if (!cancelled) setFontsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Subscribes to the instance the root layout owns. The hero no longer
  // creates it — mounting a second Lenis would put two rAF loops on the same
  // document, each undoing the other's scroll.
  const handleVelocity = useCallback((velocity: number) => {
    motionRef.current.scrollVel = velocity;
  }, []);
  useScrollVelocity(handleVelocity);

  // Tracked on window rather than on the hero section: the global nav is a
  // fixed overlay, so section-scoped handlers would leave a dead zone across
  // the top of the screen where the sphere stops following. The canvas fills
  // the sticky hero, which is exactly the viewport, so client coords map
  // straight onto the field and cost no layout read.
  useEffect(() => {
    if (reducedMotion) return;
    const motion = motionRef.current;

    const write = (event: PointerEvent) => {
      motion.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      motion.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    const onMove = (event: PointerEvent) => {
      write(event);
      motion.pointerInside = 1;
    };

    // A press displaces the fluid. The render loop owns the ripple's whole
    // life; all this side does is say where and bump a counter, so a press
    // that lands between two frames is still picked up on the next one.
    const onDown = (event: PointerEvent) => {
      if (!inView) return;
      write(event);
      motion.pointerInside = 1;
      motion.pulseX = motion.pointerX;
      motion.pulseY = motion.pointerY;
      motion.pulseSeq += 1;
    };

    // Touch has no hover: the sphere is only handed over for the length of a
    // drag, and goes back to its idle orbit the moment the finger lifts.
    const release = () => {
      if (!finePointer) motion.pointerInside = 0;
    };
    const onLeave = () => {
      motion.pointerInside = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", release, { passive: true });
    window.addEventListener("pointercancel", release, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [finePointer, inView, reducedMotion]);

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
        motion.reveal = 1;
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
        // The field arrives as undifferentiated churn and settles into laminar
        // flow. `power2.inOut` rather than `power3.out` because the long, even
        // middle is the part worth watching — an ease-out front-loads it and
        // the last third then reads as the animation having already stopped.
        .to(
          motion,
          {
            reveal: 1,
            duration: 2.6,
            ease: "power2.inOut",
            onUpdate: () => writeSignal(motion.reveal),
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
        // be seen. What is left resolves alongside the field settling, so the
        // copy and the flow come into focus as one gesture.
        //
        // `{original}` is the plugin reading the text already in the DOM, which
        // keeps the real copy server-rendered and the markup free of a
        // duplicate of every string.
        .to(
          gsap.utils.toArray<HTMLElement>("[data-scramble]"),
          {
            duration: 1.5,
            ease: "none",
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

  // Scroll-out. One ScrollTrigger drives both the shader's dispersion and the
  // DOM fade, so they can never drift apart.
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
    <div
      ref={wrapperRef}
      data-chapter=".01"
      data-chapter-name="Currents"
      className="relative h-[200svh] w-full"
    >
      <section
        ref={sectionRef}
        id="hero"
        className="sticky top-0 h-svh w-full overflow-hidden bg-void"
      >
        {/* Never display:none — a hidden node would not trigger the font load. */}
        <span
          ref={fontProbeRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 select-none font-display text-[10px] font-black opacity-0"
        >
          {heroCopy.wordmark}
        </span>

        {webgl ? (
          <div aria-hidden className="absolute inset-0">
            <HeroCanvas
              motionRef={motionRef}
              quality={quality}
              pointerEnabled={!reducedMotion}
              reducedMotion={reducedMotion}
              active={inView}
              onReady={handleSceneReady}
            />
          </div>
        ) : null}

        {/* Progressive-enhancement base: the same rake, the same palette, one
            repeating gradient. It ships in the server HTML and is what a
            visitor without WebGL keeps. */}
        {!webgl ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,#08080a_30%,#2c1155_100%)]"
          >
            <div className="absolute inset-0 opacity-60 [background:repeating-linear-gradient(67deg,#cba7f5_0_2px,transparent_2px_8px)]" />
          </div>
        ) : null}

        {/* The field is at its most detailed exactly where the copy sits, so
            the copy needs a ground. Bottom-up rather than a flat scrim: the
            turbulent lower-right stays readable through the thin end of it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-2/3 bg-gradient-to-t from-void via-void/70 to-transparent"
        />

        <div
          ref={contentRef}
          className="pointer-events-none relative z-10 flex h-full flex-col justify-end p-5 md:p-8"
        >
          {/* The wordmark below is decorative; this is what a screen reader gets. */}
          <h1 className="sr-only">{heroCopy.heading}</h1>

          <div aria-hidden className="mb-7 md:mb-9">
            <div className="overflow-hidden">
              <span data-reveal className={`${WORDMARK_TYPE} text-ink`}>
                {heroCopy.wordmark}
              </span>
            </div>
            <div className="overflow-hidden">
              <span data-reveal data-outline className={WORDMARK_TYPE}>
                {heroCopy.surname}
              </span>
            </div>
          </div>

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
                  className="max-w-[52ch] font-mono text-lg normal-case leading-relaxed tracking-normal text-ink"
                >
                  {heroCopy.tagline.join(" ")}
                </p>
              </div>
            </div>

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
                <p data-reveal data-scramble className="text-muted">
                  {heroCopy.hint}
                </p>
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

        {/* Driven by `about.tsx`, which owns the crossover: whatever is still
            visible between the closing slabs sinks back behind them. A veil
            rather than a `filter` so the compositor only blends one flat layer
            over the live canvas — and last in the section, at the same z as
            the content it dims, so it covers the hero without ever climbing
            over the curtain itself (equal z, and the curtain is later in the
            tree). */}
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
