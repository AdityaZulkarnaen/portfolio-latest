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
 * How far into the run the circle has finished crossing the frame.
 *
 * The remainder is the tail: the last blocks the front reaches are still acid
 * when it gets there, and they have to turn into the photograph *inside* the
 * run — otherwise the corners flip on the frame after the animation has
 * declared itself over.
 */
const FRONT = 0.78;

/**
 * How long a block stays acid before the photograph arrives in it.
 *
 * This is the thickness of the ring, expressed in time rather than pixels, and
 * that is the useful way round: the front slows as it reaches the corners, so a
 * ring measured in time stays visually even while one measured in pixels would
 * bunch up at the end.
 *
 * It and `FRONT` are a solved pair rather than taste, and there are two
 * constraints on them, not one.
 *
 * The first is arithmetic: the last block to be reached sits at
 * `FRONT * (1 + JITTER/2)` and still has to finish, so
 * `FRONT * (1 + JITTER/2) + ACID` has to stay under 1. These values land at
 * 0.985. Over it, a block or two is still acid on the frame after the run has
 * declared itself over.
 *
 * The second is what it looks like, and it is the one that is easy to get
 * badly wrong: the ring's *area* is what the eye sees, not its width. The
 * first cut of this ran 0.68/0.26 — only a third thicker as a fraction of the
 * radius — and peaked at **59% of the frame acid at once**. That is not a
 * circle opening, it is the panel flashing green four times a minute. At these
 * values the peak is 34%, and the ring is about two blocks wide.
 *
 * Retune both together, and against the CPU port of this loop rather than by
 * eye: at 60fps neither the overshoot nor the peak coverage is a frame anyone
 * can catch.
 */
const ACID = 0.15;

/** The ring's colour. `--color-acid`, written out for the canvas. */
const ACID_INK = "#e1ff00";

/**
 * How much the per-cell noise moves a block's turn, as a fraction of the
 * radius.
 *
 * Small on purpose, and it was not always: the previous version of this used
 * three times as much, because it was a dissolve and wanted no discernible
 * shape at all. This one is a circle opening, so the noise is only there to
 * keep the edge made of pixels rather than drawn with a compass. Past about
 * 0.2 the circle stops reading as a circle.
 */
const JITTER = 0.14;

/**
 * How much larger the incoming photograph starts, before settling to its frame.
 *
 * The circle opens *onto* something arriving, not onto something already
 * parked. A few percent is enough — at more than that the edges of the frame
 * visibly lose content on the way in.
 */
const ZOOM = 0.06;

/**
 * Deterministic per-cell noise, in 0..1.
 *
 * It has to be a hash and not `Math.random()` because every cell is asked for
 * its threshold on every frame of the run: a fresh random each time would make
 * blocks flicker between arrived and not.
 */
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Draws `img` into `w`×`h` the way `object-fit: cover` would, optionally
 * overscaled about the centre.
 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  zoom = 1,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
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
 * Chapter .02's photograph: one frame, and a circle of acid pixels that opens
 * onto the next shot.
 *
 * The deck of tilted cards this replaces said "here is a pile of pictures".
 * One box says "here is me", and the interest moved to the change itself. A
 * circle grows out of the centre of the frame; its rim is built from flat acid
 * blocks — the page's own colour, not a tint of either photograph — and behind
 * the rim the new shot is already there, arriving from a few percent
 * overscaled. So the frame is never blank and never cross-faded: the old photo
 * is cut away along a ragged pixel edge and the new one is underneath it.
 *
 * It is a canvas because that is the only way to have all three at once. Two
 * stacked `<img>`s can cross-fade and a `mask-image` can wipe a circle, but
 * neither can put a band of a third colour along the boundary, quantised to a
 * grid, with a different bitmap either side of it.
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
    const fromCtx = from.getContext("2d");
    const toCtx = to.getContext("2d");
    if (!fromCtx || !toCtx) return;

    let width = 0;
    let height = 0;
    let scale = 1;
    let animating = false;

    /** Renders photo `i` — bitmap or calibration card — into a layer. */
    const render = (
      layer: CanvasRenderingContext2D,
      i: number,
      zoom = 1,
    ) => {
      layer.clearRect(0, 0, width, height);
      const img = imagesRef.current[i];
      if (img?.complete && img.naturalWidth) {
        drawCover(layer, img, width, height, zoom);
      } else {
        // The calibration card is drawn to the box, not to a bitmap, so there
        // is nothing to overscale — it simply arrives at rest.
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

      // Distance from the centre, normalised on the corner — so the circle
      // reaches all four of them at once instead of sweeping past three, and
      // so the frame is exactly covered when the front reaches 1.
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

        // The incoming photograph is re-drawn every frame at a scale easing
        // back to 1, so what the circle opens onto is still arriving rather
        // than already parked. Once per frame, not once per block: the cells
        // below all read from this one layer.
        const eased = 1 - Math.pow(1 - p, 3);
        render(toCtx, index, 1 + ZOOM * (1 - eased));

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(from, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = ACID_INK;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * cell;
            const y = row * cell;
            // Clamped, and that is what makes the bound on `ACID` true rather
            // than nearly true. `cols`/`rows` are rounded up, so the last
            // column and row hang off the edge of the frame and their centres
            // sit *past* the corner — `d` reaches about 1.03, which pushed the
            // worst-case finish just over 1 and left a block or two still acid
            // when the run ended. The overhang is off-canvas anyway.
            const d = Math.min(
              1,
              Math.hypot(x + cell / 2 - cx, y + cell / 2 - cy) / reach,
            );
            // The jitter cuts both ways, so the rim is a band of blocks taking
            // their turn rather than a clean arc with a few stragglers outside
            // it. Small enough that the shape still reads as a circle — that is
            // the whole point of this transition, and the reason `JITTER` is a
            // fifth of what the dissolve it replaced used.
            const at = (d + (hash(col, row) - 0.5) * JITTER) * FRONT;
            if (p < at) continue;

            if (p < at + ACID) {
              // The opening edge: flat acid, one block at a time. Drawn as a
              // rect rather than sampled from anything, so the ring is the
              // page's own colour and not a tint of the photograph.
              ctx.fillRect(x, y, cell, cell);
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
