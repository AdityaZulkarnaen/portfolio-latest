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
import HeroCanvas from "./hero-canvas";
import { heroCopy } from "./hero-copy";
import HeroHud from "./hero-hud";
import HeroLoader from "./hero-loader";
import { createHeroMotion, resolveParticleCount } from "./hero-motion";

const META_CLASS = "font-mono text-[11px] uppercase tracking-[0.18em] text-muted";

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

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    // The canvas fills the sticky hero, which is exactly the viewport, so
    // window dimensions are correct here and cost no layout read.
    const motion = motionRef.current;
    motion.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    motion.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
    motion.pointerInside = 1;
  }, []);

  const handlePointerLeave = useCallback(() => {
    motionRef.current.pointerInside = 0;
  }, []);

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
        );
    },
    { scope: wrapperRef, dependencies: [revealed, reducedMotion, writeSignal] },
  );

  // Scroll-out. One ScrollTrigger drives both the shader dispersion and the DOM
  // fade, so they can never drift apart.
  useGSAP(
    () => {
      if (reducedMotion || !wrapperRef.current) return;
      const motion = motionRef.current;

      gsap
        .timeline({
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
        })
        .to(contentRef.current, { opacity: 0, yPercent: -6, ease: "none" }, 0);

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
        onPointerMove={finePointer ? handlePointerMove : undefined}
        onPointerLeave={finePointer ? handlePointerLeave : undefined}
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
          className="pointer-events-none relative z-10 flex h-full flex-col justify-between p-5 md:p-8"
        >
          <header className={`flex items-start justify-between ${META_CLASS}`}>
            <span className="pointer-events-auto text-ink">
              {heroCopy.brand}
              <span className="text-acid">.</span>
            </span>
            <nav className="pointer-events-auto hidden gap-7 sm:flex">
              {heroCopy.nav.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="transition-colors hover:text-acid"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </header>

          {/* The particles are decorative; this is what a screen reader gets. */}
          <h1 className="sr-only">{heroCopy.heading}</h1>

          <footer
            className={`grid gap-8 md:grid-cols-[1fr_auto_1fr] md:items-end ${META_CLASS}`}
          >
            <div className="space-y-3">
              <div className="overflow-hidden">
                <p data-reveal className="text-acid">
                  {heroCopy.eyebrow}
                </p>
              </div>
              <div className="overflow-hidden">
                <p
                  data-reveal
                  className="max-w-[36ch] font-sans text-sm normal-case leading-relaxed tracking-normal text-muted"
                >
                  {heroCopy.tagline.join(" ")}
                </p>
              </div>
            </div>

            <div className="hidden justify-self-center md:block">
              <div className="overflow-hidden">
                <div data-reveal className="flex flex-col items-center gap-2">
                  <span className="block h-10 w-px bg-gradient-to-b from-acid to-transparent" />
                  <span>{heroCopy.scrollCue}</span>
                </div>
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
                <p data-reveal className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-acid" />
                  {heroCopy.status}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </section>

      <HeroLoader
        rootRef={loaderRef}
        counterRef={loaderCounterRef}
        barRef={loaderBarRef}
      />
    </div>
  );
}
