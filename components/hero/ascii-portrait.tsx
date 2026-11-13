"use client";

/* eslint-disable react-hooks/immutability --
 * Same exemption as currents-field.tsx: uniforms are GPU state written every
 * frame from useFrame, never React state.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { heroCopy } from "./hero-copy";
import type { HeroMotion } from "./hero-motion";
import { currentsVertexShader } from "./shaders/currents.vert";
import { asciiFragmentShader } from "./shaders/ascii.frag";

/** Baked by `npm run portrait`. */
const FIELD_URL = "/hero/portrait-field.png";
/** Width / height of the baked field — printed by the bake script. */
const PORTRAIT_ASPECT = 0.8446;
/** Where the lock starts, in portrait uv (y up): between the lenses. */
const FOCUS: [number, number] = [0.5, 0.6];

/** Sparse → dense. Index 0 is "no glyph". Mirrors RAMP in the bake script. */
const RAMP = " .:-=+*#%@";
/** Scramble pool. No glyph that could pass for a ramp step, so noise never
 *  reads as a darker or lighter patch of face. */
const NOISE = "ABCDEFGHJKLMNPRSTUVXYZ0123456789/\\[]{}<>?!$";

/**
 * What the portrait decodes into under the pointer. Read along each row as a
 * ticker, so the separators matter more than the wording: they keep a row
 * from reading as one unbroken word.
 */
const XRAY_TEXT = `${heroCopy.wordmark} ${heroCopy.surname} // CREATIVE FRONTEND DEVELOPER // REACT  NEXT.JS  THREE.JS  GLSL  GSAP  TYPESCRIPT // ${heroCopy.status} // `.toUpperCase();

/** Every glyph the atlas holds: ramp, noise, then what the copy adds. */
const GLYPHS = (() => {
  let out = RAMP + NOISE;
  for (const ch of XRAY_TEXT) if (!out.includes(ch)) out += ch;
  return out;
})();

/** Mono advance as a fraction of the cell height. Geist Mono is 0.6em. */
const CHAR_W = 0.6;
/** Atlas cell, in texels. Tall enough that a 2x desktop cell is still minified. */
const ATLAS_H = 64;
const ATLAS_W = Math.round(ATLAS_H * CHAR_W);

const INK = "#f2f2f0";
const ACID = "#e1ff00";

const PULSE_SLOTS = 4;
const PULSE_LIFE = 1.3;
/** css px per second. */
const PULSE_SPEED = 900;

/** One pass of the scanline every this many seconds; the pass takes SCAN_RUN. */
const SCAN_PERIOD = 7;
const SCAN_RUN = 1.3;

/** Raw sRGB, not THREE.Color: the shader writes straight to the canvas with no
 *  colour-space conversion, so the hex has to arrive as written. */
function srgb(hex: string): THREE.Vector3 {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Cell height in css px. Coarser on narrow screens so the face still has
 *  ~90 columns across it; finer on desktop where the portrait is larger. */
function cellFor(width: number): number {
  return width < 640 ? 8 : width < 1024 ? 9.5 : 11;
}

/**
 * Where the portrait sits, in css px with the origin bottom-left.
 *
 * Landscape: right-hand side, bust cut by the bottom edge, so the wordmark
 * owns the lower left and the face owns the upper right. Portrait screens:
 * centred, hung from just under the nav, with the copy laid over the
 * shoulders — the gradient scrim is what keeps that readable.
 */
function portraitRect(w: number, h: number): [number, number, number, number] {
  if (w >= h) {
    const ph = h * 0.96;
    const pw = ph * PORTRAIT_ASPECT;
    const x0 = Math.max(w * 0.96 - pw, w * 0.5 - pw * 0.5);
    return [x0, 0, pw, ph];
  }
  const ph = Math.min(h * 0.74, (w * 1.15) / PORTRAIT_ASPECT);
  const pw = ph * PORTRAIT_ASPECT;
  return [(w - pw) / 2, h - ph - h * 0.06, pw, ph];
}

async function buildAtlas(): Promise<THREE.CanvasTexture> {
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() ||
    "monospace";
  const font = `500 ${Math.round(ATLAS_H * 0.78)}px ${family}`;
  // Glyphs drawn before the face arrives would bake the fallback in for good.
  try {
    await document.fonts.load(font, GLYPHS);
  } catch {
    /* the fallback face is still a monospace — draw with it */
  }

  const glyphs = GLYPHS;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_W * glyphs.length;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < glyphs.length; i++) {
    ctx.fillText(glyphs[i], i * ATLAS_W + ATLAS_W / 2, ATLAS_H * 0.54);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Canvas rows run top-down; flipped so atlas v = 0 is the glyph's foot,
  // matching the cell's local y, which also grows upward.
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

/** The copy as atlas indices, one texel per character. Space is index 0 —
 *  the ramp's "no glyph" — so word gaps stay gaps. */
function buildText(): THREE.DataTexture {
  const chars = [...XRAY_TEXT];
  const data = new Uint8Array(chars.map((ch) => GLYPHS.indexOf(ch)));
  const texture = new THREE.DataTexture(data, chars.length, 1, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

type Pulse = { x: number; y: number; age: number; alive: boolean };

type AsciiPortraitProps = {
  motionRef: RefObject<HeroMotion>;
  pointerEnabled: boolean;
  reducedMotion: boolean;
  onReady?: () => void;
};

export default function AsciiPortrait({
  motionRef,
  pointerEnabled,
  reducedMotion,
  onReady,
}: AsciiPortraitProps) {
  const { size, viewport, invalidate, gl } = useThree();
  const readyFired = useRef(false);
  const [textures, setTextures] = useState<{
    field: THREE.Texture;
    atlas: THREE.Texture;
  } | null>(null);

  const pulses = useRef<Pulse[]>(
    Array.from({ length: PULSE_SLOTS }, () => ({ x: 0, y: 0, age: 0, alive: false })),
  );
  const lastPulseSeq = useRef(0);
  const nextSlot = useRef(0);
  const clock = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let owned: THREE.Texture[] = [];

    (async () => {
      const [field, atlas] = await Promise.all([
        new THREE.TextureLoader().loadAsync(FIELD_URL),
        buildAtlas(),
      ]);
      // Data, not an image: no mips (the shader samples cell centres), no
      // colour-space conversion, nearest-ish reads stay honest.
      field.colorSpace = THREE.NoColorSpace;
      field.generateMipmaps = false;
      field.minFilter = THREE.LinearFilter;
      field.magFilter = THREE.LinearFilter;
      owned = [field, atlas];
      if (cancelled) {
        owned.forEach((t) => t.dispose());
        return;
      }
      setTextures({ field, atlas });
      invalidate();
    })();

    return () => {
      cancelled = true;
      owned.forEach((t) => t.dispose());
    };
  }, [invalidate]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: currentsVertexShader,
      fragmentShader: asciiFragmentShader,
      defines: {
        PULSE_SLOTS,
        RAMP_COUNT: RAMP.length,
        NOISE_COUNT: NOISE.length,
        GLYPH_COUNT: GLYPHS.length,
        TEXT_LEN: [...XRAY_TEXT].length,
      },
      uniforms: {
        uField: { value: null },
        uAtlas: { value: null },
        uText: { value: buildText() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uDpr: { value: 1 },
        uCell: { value: 11 },
        uCharW: { value: CHAR_W },
        uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uFocus: { value: new THREE.Vector2(...FOCUS) },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uDispersion: { value: 0 },
        uOpacity: { value: 1 },
        uScan: { value: -1 },
        uPointer: { value: new THREE.Vector2(-1e4, -1e4) },
        uDecode: { value: 0 },
        uDecodeRadius: { value: 150 },
        uPulses: {
          value: Array.from({ length: PULSE_SLOTS }, () => new THREE.Vector4()),
        },
        uInk: { value: srgb(INK) },
        uAcid: { value: srgb(ACID) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  }, []);

  const u = material.uniforms;

  useEffect(
    () => () => {
      (u.uText.value as THREE.Texture).dispose();
      material.dispose();
    },
    [material, u],
  );

  useEffect(() => {
    if (!textures) return;
    u.uField.value = textures.field;
    u.uAtlas.value = textures.atlas;
    invalidate();
  }, [textures, u, invalidate]);

  useEffect(() => {
    u.uResolution.value.set(size.width, size.height);
    u.uCell.value = cellFor(size.width);
    u.uDecodeRadius.value = size.width < 640 ? 95 : 150;
    u.uRect.value.set(...portraitRect(size.width, size.height));
    invalidate();
  }, [size.width, size.height, u, invalidate]);

  useFrame((state, delta) => {
    if (!textures) return;
    const dt = Math.min(delta, 0.05);
    const motion = motionRef.current;
    // Read every frame: PerformanceMonitor can drop the canvas DPR mid-session.
    u.uDpr.value = gl.getPixelRatio();

    if (reducedMotion) {
      // One still, fully resolved frame. No clock, no lens, no scan.
      u.uReveal.value = 1;
      u.uDispersion.value = 0;
      u.uOpacity.value = motion.opacity;
      u.uScan.value = -1;
      u.uDecode.value = 0;
    } else {
      clock.current += dt;
      const t = clock.current;
      u.uTime.value = t;
      u.uReveal.value = motion.reveal;
      u.uDispersion.value = motion.dispersion;
      u.uOpacity.value = motion.opacity;

      // The scanline only starts once the face has locked: during the intro
      // it would just be more noise on top of noise.
      const phase = t % SCAN_PERIOD;
      u.uScan.value =
        motion.reveal >= 1 && phase < SCAN_RUN ? 1 - phase / SCAN_RUN : -1;

      // X-ray: tracks the pointer directly, and opens/closes by growing the
      // radius from the cursor out rather than fading, so arriving on the
      // portrait reads as the decode spreading.
      const w = state.size.width;
      const h = state.size.height;
      u.uPointer.value.set(((motion.pointerX + 1) / 2) * w, ((motion.pointerY + 1) / 2) * h);
      u.uDecode.value = THREE.MathUtils.damp(
        u.uDecode.value,
        pointerEnabled && motion.reveal >= 1 ? motion.pointerInside : 0,
        8,
        dt,
      );

      // Click rings: same counter hand-off as the currents ripples.
      if (motion.pulseSeq !== lastPulseSeq.current) {
        lastPulseSeq.current = motion.pulseSeq;
        const slot = pulses.current[nextSlot.current];
        slot.x = ((motion.pulseX + 1) / 2) * w;
        slot.y = ((motion.pulseY + 1) / 2) * h;
        slot.age = 0;
        slot.alive = true;
        nextSlot.current = (nextSlot.current + 1) % PULSE_SLOTS;
      }
      for (let i = 0; i < PULSE_SLOTS; i++) {
        const pulse = pulses.current[i];
        const out = u.uPulses.value[i] as THREE.Vector4;
        if (!pulse.alive) {
          out.set(0, 0, 0, 0);
          continue;
        }
        pulse.age += dt;
        if (pulse.age > PULSE_LIFE) {
          pulse.alive = false;
          out.set(0, 0, 0, 0);
          continue;
        }
        const life = pulse.age / PULSE_LIFE;
        out.set(pulse.x, pulse.y, pulse.age * PULSE_SPEED, (1 - life) ** 1.5);
      }
    }

    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  });

  return (
    <mesh
      material={material}
      scale={[viewport.width, viewport.height, 1]}
      frustumCulled={false}
      visible={textures !== null}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
