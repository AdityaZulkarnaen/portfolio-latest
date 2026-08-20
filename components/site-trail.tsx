"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { useFinePointer, useReducedMotion } from "@/lib/use-media-query";

/** Target edge of one cell, in px. The real cell is rounded off this. */
const CELL = 54;
/** Brush radius, in cells. Wide enough that the head is a plume, not a worm. */
const BRUSH = 0.8;
/** How fast a lit cell gives its light back, per second. */
const DECAY = 1.5;
/** Pushes the tail down faster than the head, so the smear reads as a comet. */
const GAMMA = 1.7;
/** Opacity of a cell at full charge. */
const MAX_ALPHA = 1;
/** Below this a cell is dark enough to drop out of the active list. */
const CUTOFF = 0.006;

type Grid = { cols: number; rows: number; cellW: number; cellH: number };

/**
 * The pointer trail, for the whole site.
 *
 * The screen is a grid and the cursor is a light source moving over it: cells
 * charge as the pointer passes and discharge on their own. Nothing draws the
 * grid itself — an unlit cell is fully transparent, so the lattice only ever
 * exists as the shape of the trail. No borders, no gaps, no resting state.
 *
 * Cells are integer-sized rather than `1fr` tracks: fractional tracks leave
 * antialiased hairlines between neighbours, which is exactly the checkerboard
 * this is not supposed to be. The last row and column overflow by a pixel or
 * two instead, and the container clips them.
 *
 * Every write goes straight to the DOM from `gsap.ticker` — no React state, no
 * re-render, for the same reason the particle uniforms are not state. Only the
 * grid's dimensions live in state, because only a resize changes them.
 *
 * The whole board is a few hundred nodes, but a frame only touches the handful
 * that are currently lit: `activeList` is a compacted index list, and a cell
 * leaves it the moment it crosses `CUTOFF`. Idle costs one comparison.
 *
 * Flat acid, no blend mode. `mix-blend-screen` reads well on the void chapters
 * but there is nothing under it there to screen against, so it buys nothing —
 * and over Chapter .02's light slab it washes the trail out to a faint smear.
 * The nav solves the same two-ground problem with `difference`, which is right
 * for type but turns acid into muddy sage. Acid is bright enough to hold on
 * both grounds unaided — but not on a third one made of acid, where the trail
 * would be painting the ground onto itself. Chapter .05 declares that ground
 * and `globals.css` recolours the lattice to void while it is under the
 * pointer; nothing in here changes, only the cells' `background-color`.
 *
 * `fixed` and driven by raw client coords, so it is unaffected by scroll,
 * sticky frames or which chapter currently owns the screen. Mounted below the
 * nav and below the hero's loader, so it passes behind type rather than over
 * it — and never shows during the intro wipe.
 */
export default function SiteTrail() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<Grid | null>(null);

  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const active = finePointer && !reducedMotion;

  // Measure. Split from the ticker below because the cells have to exist in the
  // DOM before anything can light them, and that takes a render in between.
  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cols = Math.max(1, Math.round(w / CELL));
      const rows = Math.max(1, Math.round(h / CELL));
      const next = {
        cols,
        rows,
        cellW: Math.ceil(w / cols),
        cellH: Math.ceil(h / rows),
      };
      setGrid((prev) =>
        prev &&
        prev.cols === next.cols &&
        prev.rows === next.rows &&
        prev.cellW === next.cellW &&
        prev.cellH === next.cellH
          ? prev
          : next,
      );
    };

    measure();
    // Coalesced: a drag-resize fires this continuously, and every accepted
    // measurement rebuilds the entire board.
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, [active]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active || !grid) return;

    const { cols, rows, cellW, cellH } = grid;
    const count = cols * rows;
    const cells = root.children as HTMLCollectionOf<HTMLElement>;

    const charge = new Float32Array(count);
    // Fixed per-cell dimming, so the plume has grain and its edge never
    // resolves into the clean diamond an even falloff would give it.
    const grain = new Float32Array(count);
    for (let i = 0; i < count; i++) grain[i] = 0.72 + Math.random() * 0.28;

    // Compacted list of the cells with charge left, plus a membership flag so
    // repainting a still-lit cell does not enter it twice.
    const activeList = new Int32Array(count);
    const listed = new Uint8Array(count);
    let activeCount = 0;

    // React may hand back recycled nodes after a resize; clear inherited light.
    for (let i = 0; i < count; i++) cells[i].style.opacity = "0";

    let pointerX = 0;
    let pointerY = 0;
    let lastX = 0;
    let lastY = 0;
    let moved = false;
    let seeded = false;

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      moved = true;
    };

    /** Stamp the brush at one point, in px, taking the max against what is there. */
    const stamp = (px: number, py: number) => {
      // Cell space, where a whole number lands on a cell's centre.
      const cx = px / cellW - 0.5;
      const cy = py / cellH - 0.5;
      const col0 = Math.max(0, Math.ceil(cx - BRUSH));
      const col1 = Math.min(cols - 1, Math.floor(cx + BRUSH));
      const row0 = Math.max(0, Math.ceil(cy - BRUSH));
      const row1 = Math.min(rows - 1, Math.floor(cy + BRUSH));

      for (let row = row0; row <= row1; row++) {
        const dy = row - cy;
        for (let col = col0; col <= col1; col++) {
          const dx = col - cx;
          const value = 1 - Math.sqrt(dx * dx + dy * dy) / BRUSH;
          if (value <= 0) continue;

          const i = row * cols + col;
          if (value > charge[i]) charge[i] = value;
          if (!listed[i]) {
            listed[i] = 1;
            activeList[activeCount++] = i;
          }
        }
      }
    };

    const tick = (_time: number, deltaTime: number) => {
      // Clamped: a backgrounded tab hands back one enormous delta, and an
      // unclamped exponential on that wipes the whole board in a single frame.
      const dt = Math.min(deltaTime / 1000, 0.05);

      if (moved) {
        moved = false;
        if (!seeded) {
          // Otherwise the first movement paints a streak in from the origin.
          lastX = pointerX;
          lastY = pointerY;
          seeded = true;
        }
        // Walk the segment rather than stamping the endpoint: a fast flick
        // crosses half the screen between frames, and the trail has to be
        // continuous through it.
        const dx = pointerX - lastX;
        const dy = pointerY - lastY;
        const span = Math.sqrt(dx * dx + dy * dy);
        const stride = Math.min(cellW, cellH) * 0.5;
        const steps = Math.min(160, Math.max(1, Math.ceil(span / stride)));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          stamp(lastX + dx * t, lastY + dy * t);
        }
        lastX = pointerX;
        lastY = pointerY;
      }

      if (activeCount === 0) return;

      const decay = Math.exp(-DECAY * dt);
      for (let n = 0; n < activeCount; n++) {
        const i = activeList[n];
        const value = charge[i] * decay;

        if (value < CUTOFF) {
          charge[i] = 0;
          listed[i] = 0;
          cells[i].style.opacity = "0";
          // Swap-remove, then re-test this slot on the next pass.
          activeList[n] = activeList[--activeCount];
          n--;
          continue;
        }

        charge[i] = value;
        cells[i].style.opacity = String(value ** GAMMA * MAX_ALPHA * grain[i]);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      gsap.ticker.remove(tick);
      // Guarded: a resize replaces the board before this runs, so on a smaller
      // grid some of these indices no longer name a node.
      for (let n = 0; n < activeCount; n++) {
        const cell = cells[activeList[n]] as HTMLElement | undefined;
        if (cell) cell.style.opacity = "0";
      }
    };
  }, [active, grid]);

  if (!active) return null;

  // The host mounts a frame before the grid exists: the measure effect needs
  // something in the tree to hand dimensions to.
  return (
    <div
      ref={rootRef}
      aria-hidden
      data-trail
      className="pointer-events-none fixed inset-0 z-40 grid overflow-hidden"
      style={
        grid
          ? {
              gridTemplateColumns: `repeat(${grid.cols}, ${grid.cellW}px)`,
              gridTemplateRows: `repeat(${grid.rows}, ${grid.cellH}px)`,
            }
          : undefined
      }
    >
      {grid
        ? Array.from({ length: grid.cols * grid.rows }, (_, i) => (
            <div key={i} className="bg-acid opacity-0" />
          ))
        : null}
    </div>
  );
}
