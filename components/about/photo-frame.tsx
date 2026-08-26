"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { photoSrc } from "@/lib/sanity/image";
import { useReducedMotion } from "@/lib/use-media-query";
import type { AboutPhoto } from "@/lib/content/types";
import { aboutCopy } from "./about-copy";

/** How long a photo holds the frame, in ms. */
const DWELL = 4200;

/** How long one dissolve runs, in ms. */
const FADE = 1100;

/** Side of a pixel block, in CSS px. Scaled by DPR when the canvas is sized. */
const CELL = 18;

/**
 * How far into the dissolve the reveal front has finished crossing the frame.
 *
 * The remainder is the tail: the outermost blocks still have to resolve from
 * flat colour into real pixels after the front has passed them, and that has to
 * happen *inside* the run — otherwise the last corner snaps into focus a frame
 * after the animation has already declared itself over.
 */
const FRONT = 0.68;

/**
 * How long one block stays a flat square before it resolves, in progress.
 *
 * This and `FRONT` are a solved pair rather than taste. The last block to be
 * revealed sits at `FRONT * (1 + jitter/2)` and still has to finish resolving
 * inside the run, so `FRONT * 1.17 + RESOLVE` has to stay under 1 — over it, a
 * handful of blocks in the corners jump from flat colour to sharp on the frame
 * *after* the animation declared itself finished. These values land at 0.94.
 * Retune them together, and against the CPU port of this loop rather than by
 * eye: at 60fps the offending frame is the one nobody can catch.
 */
const RESOLVE = 0.24;

/**
 * Deterministic per-cell noise, in 0..1.
 *
 * A ragged edge is the whole point — a clean expanding disc of pixels reads as
 * a circular wipe rather than as an image resolving. It has to be a hash and
 * not `Math.random()` because every cell is asked for its threshold on every
 * frame of the dissolve: a fresh random each time would make blocks flicker
 * between revealed and not.
 */
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Draws `img` into `w`×`h` the way `object-fit: cover` would. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/**
 * The calibration card, drawn rather than laid out.
 *
 * It lives on the canvas — not as a DOM layer behind it — so a photo can
 * dissolve into a slot that has no file yet, and back out of one again. The
 * frame then has one code path whether the dataset is finished or empty.
 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  n: number,
  scale: number,
) {
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, "#a3a39b");
  wash.addColorStop(1, "#84847d");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  const step = 28 * scale;
  ctx.strokeStyle = "rgba(8,8,10,0.12)";
  ctx.lineWidth = scale;
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(8,8,10,0.55)";
  ctx.font = `${11 * scale}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`IMG ${String(n).padStart(2, "0")} — AWAITING FILE`, w / 2, h / 2);
}

/**
 * Chapter .02's photograph: one frame, and a pixel dissolve between shots.
 *
 * The deck of tilted cards this replaces said "here is a pile of pictures".
 * One box says "here is me", and the interest moved to the change itself: the
 * next photo comes up out of the centre of the current one as blocks of its own
 * average colour, and each block resolves into real pixels a beat behind the
 * front that revealed it. Two shots that share a composition therefore read as
 * one photograph resolving into another rather than as a slideshow.
 *
 * It is a canvas because that is the only way to keep the *outgoing* image on
 * screen underneath the blocks. Two stacked `<img>`s can cross-fade and a
 * `mask-image` can wipe, but neither can composite one bitmap's mosaic over
 * another's full resolution, per block.
 *
 * Under the canvas sits a plain `<img>` of the same URL — the same URL on
 * purpose, so it is one download — which is the photograph without scripting or
 * without a 2D context, and which carries the alt text either way.
 */
export default function PhotoFrame({ photos }: { photos: AboutPhoto[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  /** Bumped when a late bitmap lands, to repaint the frame it belongs to. */
  const [tick, setTick] = useState(0);
  const reducedMotion = useReducedMotion();
  const depth = photos.length;

  /** Decoded bitmaps by photo index; a slot stays undefined until it lands. */
  const imagesRef = useRef<(HTMLImageElement | undefined)[]>([]);
  /** Which frame the canvas is showing, so a dissolve knows where it starts. */
  const paintedRef = useRef(0);
  const frameRef = useRef(0);

  const srcs = photos.map((photo) =>
    photo.image ? photoSrc(photo.image) : null,
  );
  // Joined rather than kept as an array: this is an effect dependency, and a
  // fresh array on every render would re-run the preload on every render.
  const srcKey = srcs.join("|");

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % Math.max(depth, 1));
  }, [depth]);

  // Every shot is decoded up front. There are a handful of them and each is
  // needed the instant its turn comes: a dissolve that has to wait on a
  // download is a photo that changes with no transition at all.
  useEffect(() => {
    const list = srcKey ? srcKey.split("|") : [];
    imagesRef.current = new Array(list.length).fill(undefined);

    const loaded: HTMLImageElement[] = [];
    list.forEach((src, i) => {
      if (!src) return;
      const img = new Image();
      // The canvas never reads a pixel back — `drawImage` from a tainted
      // source is allowed — but asking for CORS keeps that option open and
      // costs nothing on Sanity's CDN, which sends the header.
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imagesRef.current[i] = img;
        // The first photo may well decode after the canvas has sized itself
        // and painted the calibration card in its place.
        if (i === paintedRef.current) setTick((t) => t + 1);
      };
      img.src = src;
      loaded.push(img);
    });

    return () => {
      for (const img of loaded) img.onload = null;
    };
  }, [srcKey]);

  // Only cycle while the frame is on screen: an off-screen timer would burn
  // frames and desync the dwell bar from what the visitor actually sees.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setRunning(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running || reducedMotion || depth < 2) return;
    const id = window.setInterval(advance, DWELL);
    return () => window.clearInterval(id);
  }, [running, reducedMotion, depth, advance]);

  /**
   * The dissolve, and the only thing that ever paints the canvas.
   *
   * Both frames are rendered once into offscreen canvases before the run
   * starts, and every per-block draw during it reads from those. That is what
   * lets a photograph and a drawn calibration card take part in the same
   * transition without the loop knowing which it has, and it makes the mosaic
   * phase, the flat-block phase and the sharp phase three reads of the same two
   * bitmaps rather than three code paths.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = boxRef.current;
    if (!canvas || !host) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const from = document.createElement("canvas");
    const to = document.createElement("canvas");
    const mosaic = document.createElement("canvas");
    const fromCtx = from.getContext("2d");
    const toCtx = to.getContext("2d");
    const mosaicCtx = mosaic.getContext("2d");
    if (!fromCtx || !toCtx || !mosaicCtx) return;

    let width = 0;
    let height = 0;
    let scale = 1;
    let animating = false;

    /** Renders photo `i` — bitmap or calibration card — into a layer. */
    const render = (layer: CanvasRenderingContext2D, i: number) => {
      layer.clearRect(0, 0, width, height);
      const img = imagesRef.current[i];
      if (img?.complete && img.naturalWidth) {
        drawCover(layer, img, width, height);
      } else {
        drawPlaceholder(layer, width, height, i + 1, scale);
      }
    };

    const paint = (i: number) => {
      paintedRef.current = i;
      render(fromCtx, i);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(from, 0, 0);
    };

    /**
     * Resizing repaints whatever frame the canvas was on, and abandons a run
     * in progress rather than trying to rescale it — every layer the loop
     * reads from has just been cleared by the new backing size, so there is
     * nothing left to continue from. It lands on the incoming photo, which is
     * where the run was going anyway.
     *
     * The no-change bail is not an optimisation, it is what makes that safe.
     * `ResizeObserver` fires once on `observe()` with the size the element
     * already had, which would otherwise cancel every dissolve on the frame
     * after it started.
     */
    const size = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const next = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * next);
      const h = Math.round(rect.height * next);
      if (w === width && h === height) return;

      if (animating) {
        animating = false;
        cancelAnimationFrame(frameRef.current);
      }

      scale = next;
      width = w;
      height = h;
      for (const layer of [canvas, from, to]) {
        layer.width = width;
        layer.height = height;
      }
      paint(paintedRef.current);
    };

    // Read before the first `size()`, which repaints and would otherwise call
    // the frame it lands on the one the dissolve starts from.
    const previous = paintedRef.current;
    size();

    if (previous === index || !width) {
      paint(index);
    } else if (reducedMotion) {
      paint(index);
    } else {
      const cell = Math.max(Math.round(CELL * scale), 4);
      const cols = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);

      render(fromCtx, previous);
      render(toCtx, index);

      // One pixel per block. Letting the browser downscale the whole frame to
      // the grid is what averages each block's colour — which is why a block
      // already reads as "that part of the next photo" before any detail of it
      // has arrived.
      mosaic.width = cols;
      mosaic.height = rows;
      mosaicCtx.clearRect(0, 0, cols, rows);
      mosaicCtx.drawImage(to, 0, 0, width, height, 0, 0, cols, rows);

      // Distance from the centre, normalised on the corner — so the front
      // reaches all four of them at once instead of sweeping past three.
      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.hypot(cx, cy);

      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - start) / FADE, 1);

        if (p >= 1) {
          animating = false;
          paint(index);
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(from, 0, 0);
        ctx.imageSmoothingEnabled = false;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * cell;
            const y = row * cell;
            const d = Math.hypot(x + cell / 2 - cx, y + cell / 2 - cy) / reach;
            // The jitter frays the edge. It cuts both ways, so the front is a
            // band of half-arrived blocks rather than a clean ring with a few
            // stragglers outside it.
            const at = (d + (hash(col, row) - 0.5) * 0.34) * FRONT;
            if (p < at) continue;

            if (p < at + RESOLVE) {
              ctx.drawImage(mosaic, col, row, 1, 1, x, y, cell, cell);
            } else {
              ctx.drawImage(to, x, y, cell, cell, x, y, cell, cell);
            }
          }
        }

        ctx.imageSmoothingEnabled = true;
        frameRef.current = requestAnimationFrame(step);
      };

      // Claimed before the first frame runs: `size()` and the next pass of
      // this effect both read it to know where they are coming from.
      paintedRef.current = index;
      animating = true;
      frameRef.current = requestAnimationFrame(step);
    }

    const observer = new ResizeObserver(size);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  }, [index, reducedMotion, tick]);

  if (!depth) return null;

  const active = photos[index];
  const next = photos[(index + 1) % depth];
  const src = srcs[index];

  return (
    <div className="flex w-full flex-col md:h-full md:min-h-0">
      {/* Two sizing regimes on one box. Stacked (<md) it is width-driven and
          capped, the way a photo behaves in a column of text. Pinned (md+) it
          is height-driven — the parent hands it a slice of viewport and the
          frame takes its width from that — so the aside can never grow past one
          screen no matter how wide the column gets. */}
      <div
        ref={boxRef}
        onClick={depth > 1 ? advance : undefined}
        className={`relative mx-auto aspect-[4/5] w-full max-w-[20rem] self-center overflow-hidden rounded-[10px] bg-slab-deep shadow-[0_24px_60px_-24px_rgba(8,8,10,0.75)] ring-1 ring-void/25 sm:max-w-[24rem] md:mx-0 md:w-auto md:min-h-0 md:max-w-full md:flex-1 md:self-end ${
          depth > 1 ? "cursor-pointer" : ""
        }`}
      >
        {/* The fallback layer, and the one carrying the alt text. Covered by
            the canvas the moment that paints, but never removed: without
            scripting, or without a 2D context, this *is* the photograph. */}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={active.alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Placeholder n={index + 1} alt={active.alt} />
        )}

        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full"
        />

      </div>

      <div className="mt-4 flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-void sm:gap-3 sm:text-[11px] sm:tracking-[0.18em]">
        <span className="tabular-nums">
          {aboutCopy.deckLabel} {String(index + 1).padStart(2, "0")}/
          {String(depth).padStart(2, "0")}
        </span>
        <span className="relative block h-px flex-1 overflow-hidden bg-void/30">
          <span
            key={index}
            className="absolute inset-0 origin-left scale-x-0 bg-void [animation:deck-dwell_var(--deck-dwell)_linear_forwards] motion-reduce:scale-x-100 motion-reduce:[animation:none]"
            style={{ "--deck-dwell": `${DWELL}ms` } as React.CSSProperties}
          />
        </span>
        {/* First thing to go when the column is narrow: the label and the
            counter still say everything the caption does. */}
        {active.caption ? (
          <span className="hidden text-void/60 sm:inline">{active.caption}</span>
        ) : null}
        {depth > 1 ? (
          <button
            type="button"
            onClick={advance}
            aria-label={`Next photo — ${next.alt}`}
            className="cursor-pointer text-void/60 transition-colors hover:text-void focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-void"
          >
            NEXT &gt;
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Stand-in until the shots are uploaded in the Studio. */
function Placeholder({ n, alt }: { n: number; alt: string }) {
  return (
    <span
      role="img"
      aria-label={alt}
      className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#a3a39b,#84847d)]"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(8,8,10,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,8,10,0.12)_1px,transparent_1px)] bg-[size:28px_28px]"
      />
      <span className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-void/55">
        IMG {String(n).padStart(2, "0")} — AWAITING FILE
      </span>
    </span>
  );
}
