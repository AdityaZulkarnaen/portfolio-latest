"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/use-media-query";
import { createScene, type Brush, type SceneName } from "./scenes";

/**
 * The ASCII language of Chapter .01, carried through the rest of the page —
 * one small Canvas 2D layer per chapter, each one an hour of the same night
 * and day (`scenes.ts` has the clock).
 *
 * Deliberately not WebGL. These are a few hundred glyphs at most, and three.js
 * is fenced off the eager bundle for a reason (see eslint.config.mjs); a 2D
 * context costs nothing to create and nothing to ship.
 *
 * Three things keep it cheap on a long page:
 *
 * - **Only while visible.** An IntersectionObserver starts and stops the loop;
 *   a chapter that is off screen costs zero frames.
 * - **A viewport-sized canvas, not a section-sized one.** Chapters here run to
 *   several thousand pixels; a canvas that tall is tens of megabytes of
 *   backing store. Instead the canvas is ~1.5 viewports tall and slides inside
 *   its section to cover what is on screen. Scenes work in section
 *   coordinates, and the same offset that places the canvas is subtracted when
 *   drawing — so glyphs stay locked to the page even on a frame where the
 *   canvas itself trails the scroll by one tick.
 * - **30fps.** ASCII reads as ASCII at 30; the other 30 frames are battery.
 *
 * Reduced motion gets one fully grown, still frame.
 */

/** Live pointer, shared by every layer: one listener for the whole page. */
let pointer: { x: number; y: number } | null = null;
let listening = false;
function listenPointer() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer = { x: e.clientX, y: e.clientY };
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null;
  });
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** `#rrggbb` + alpha → `rgba()`, for gradient stops (which take no alpha). */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp01(alpha)})`;
}

type AsciiLayerProps = {
  scene: SceneName;
  /** Cell height in css px (desktop); narrow screens use ~85% of it. */
  cell?: number;
  className?: string;
};

export default function AsciiLayer({ scene, cell = 12, className = "" }: AsciiLayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!host || !canvas || !ctx) return;
    listenPointer();

    const sc = createScene(scene);
    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() ||
      "monospace";

    let width = 0;
    let height = 0; // section height
    let canvasH = 0;
    let cellW = 0;
    let cellH = 0;
    let offset = 0; // section y of the canvas's top edge
    let raf = 0;
    let last = 0;
    let t = 0;
    let visible = false;

    const put = (col: number, row: number, ch: string, color: string, alpha = 1) => {
      const y = (row + 0.5) * cellH - offset;
      if (y < -cellH || y > canvasH + cellH || alpha <= 0.01) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = color;
      ctx.fillText(ch, (col + 0.5) * cellW, y);
    };

    const glow = (x: number, y: number, radius: number, color: string, alpha: number) => {
      const yy = y - offset;
      if (yy < -radius || yy > canvasH + radius || alpha <= 0.01) return;
      const g = ctx.createRadialGradient(x, yy, 0, x, yy, radius);
      g.addColorStop(0, color);
      // Fade to the same colour at zero alpha, not to transparent black: on a
      // light ground (the day sky) the latter interpolates through grey and
      // rings the glow with a dirty halo.
      g.addColorStop(1, color.replace(/,\s*[\d.]+\)\s*$/, ",0)"));
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, yy - radius, radius * 2, radius * 2);
    };

    /** A flat rect over cells [col0, col1) of one row — for bodies of colour. */
    const fill = (col0: number, col1: number, row: number, color: string, alpha: number) => {
      const y = row * cellH - offset;
      if (y < -cellH || y > canvasH || alpha <= 0.01 || col1 <= col0) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = color;
      ctx.fillRect(col0 * cellW, y, (col1 - col0) * cellW, cellH + 0.5);
    };

    /**
     * A full-width vertical gradient between two section ys — skies, horizon
     * glows. One gradient per call, clipped to the canvas's slice.
     */
    const band = (y0: number, y1: number, stops: [number, string, number][]) => {
      const a = y0 - offset;
      const b = y1 - offset;
      if (b < 0 || a > canvasH || b <= a) return;
      const g = ctx.createLinearGradient(0, a, 0, b);
      for (const [at, color, alpha] of stops) g.addColorStop(at, withAlpha(color, alpha));
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      const top = Math.max(a, 0);
      ctx.fillRect(0, top, width, Math.min(b, canvasH) - top);
    };

    const brush: Brush = { put, glow, fill, band };

    const layout = () => {
      const rect = host.getBoundingClientRect();
      const vh = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      canvasH = Math.min(height, Math.ceil(vh * 1.5));
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(canvasH * dpr));
      canvas.style.height = `${canvasH}px`;
      cellH = width < 640 ? Math.round(cell * 0.85) : cell;
      cellW = cellH * 0.6;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `500 ${Math.round(cellH * 0.9)}px ${family}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      sc.setup({
        cols: Math.ceil(width / cellW),
        rows: Math.ceil(height / cellH),
        cellW,
        cellH,
        width,
        height,
      });
    };

    const render = (dt: number) => {
      const rect = host.getBoundingClientRect();
      const vh = window.innerHeight;
      // Slide the canvas over the visible slice, with a quarter screen of
      // slack either side so its edges are never the thing you see.
      const want = -rect.top - vh * 0.25;
      offset = Math.round(Math.min(Math.max(want, 0), Math.max(height - canvasH, 0)));
      canvas.style.transform = `translate3d(0, ${offset}px, 0)`;

      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, canvasH);
      sc.draw(brush, {
        t,
        dt,
        progress: reduced ? 1 : clamp01((vh - rect.top) / (vh + rect.height)),
        enter: reduced ? 1 : clamp01((vh - rect.top) / (vh * 0.6)),
        viewTop: -rect.top,
        viewport: vh,
        rowStart: Math.floor(offset / cellH) - 1,
        rowEnd: Math.ceil((offset + canvasH) / cellH) + 1,
        pointer: pointer && !reduced ? { x: pointer.x - rect.left, y: pointer.y - rect.top } : null,
        reduced,
      });
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 30 - 2) return;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      t += dt;
      render(dt);
    };

    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Reduced motion still has to follow the scroll — the canvas slides, it
    // just never animates on its own.
    const onScroll = () => {
      if (reduced && visible) render(0);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          start();
          render(0);
        } else stop();
      },
      { rootMargin: "200px 0px" },
    );
    const ro = new ResizeObserver(() => {
      layout();
      render(0);
    });

    let cancelled = false;
    // Glyphs measured before the face arrives would be drawn in the fallback.
    document.fonts
      .load(`500 12px ${family}`)
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        layout();
        io.observe(host);
        ro.observe(host);
        window.addEventListener("scroll", onScroll, { passive: true });
      });

    return () => {
      cancelled = true;
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [scene, cell, reduced]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0 w-full will-change-transform" />
    </div>
  );
}
