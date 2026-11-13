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
/** Fallback width / height until the field has loaded. The real value is
 *  read off the texture, so swapping the photo never needs an edit here. */
const DEFAULT_ASPECT = 0.85;
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

/** Leaf density ramp, sparse → dense. Its own contiguous block in the atlas
 *  (duplicates of ramp glyphs included) so the shader can index it as a run. */
const FOLIAGE = ".:;*o&%@";

/** Every glyph the atlas holds: ramp, noise, what the copy adds, blossoms,
 *  then the foliage run. */
const GLYPHS = (() => {
  let out = RAMP + NOISE;
  for (const ch of XRAY_TEXT + "o") if (!out.includes(ch)) out += ch;
  return out + FOLIAGE;
})();

/** Atlas indices the garden needs, handed to the shader as `#define`s. */
const GARDEN_DEFINES = {
  G_AT: GLYPHS.indexOf("@"),
  G_STAR: GLYPHS.indexOf("*"),
  G_PLUS: GLYPHS.indexOf("+"),
  G_O: GLYPHS.indexOf("o"),
  FOL_START: GLYPHS.length - FOLIAGE.length,
  FOL_COUNT: FOLIAGE.length,
};

/** Hedges, back to front: far, mid (both behind the portrait), near, canopy. */
const LAYER_COUNT = 4;

/** Fireflies in the air at once. Each costs a few ops per pixel. */
const FIREFLY_COUNT = 26;

/** Mono advance as a fraction of the cell height. Geist Mono is 0.6em. */
const CHAR_W = 0.6;
/** Atlas cell, in texels. Tall enough that a 2x desktop cell is still minified. */
const ATLAS_H = 64;
const ATLAS_W = Math.round(ATLAS_H * CHAR_W);

const INK = "#f2f2f0";
const ACID = "#e1ff00";
/* The garden. Green that leans toward the acid where the light hits, so the
   brand colour reads as sun on the leaves rather than as a second palette;
   the far hedges wash toward a cool violet (the Currents ground) for depth.
   Lilac is the Currents line colour, pink its streak. */
const VOID = "#08080a";
const LEAF_DARK = "#173f27";
const LEAF_LIGHT = "#b9ec62";
const FAR_TINT = "#2a2f52";
const LILAC = "#cba7f5";
const PINK = "#ff5fa2";

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

type Layer = {
  /** Glyph size relative to the portrait's cell. Far = small type. */
  scale: number;
  /** Bush spacing and size (fraction of spacing). */
  spacing: number;
  size: number;
  /** Baseline height, and how far it climbs at each screen edge. */
  base: number;
  liftL: number;
  liftR: number;
  /** How far in from each edge the climb reaches, as a fraction of width. */
  reachL: number;
  reachR: number;
  /** 1 = nearest/brightest; lower washes toward FAR_TINT. */
  bright: number;
  /** Fraction of bush slots left empty. */
  bare: number;
  /** Parallax travel in css px at full pointer deflection. */
  parallax: number;
  /** Hangs from the top edge instead of growing from the bottom. */
  hanging: boolean;
};

/**
 * The four hedges for a viewport, in css px.
 *
 * Landscape keeps the lower left low — that is where the wordmark and copy
 * sit — and lets the hedges climb around the portrait on the right; the
 * canopy hangs mostly from the top left, balancing the face on the right.
 * Portrait screens climb evenly at both edges and hang a lighter canopy.
 */
function gardenLayers(w: number, h: number): Layer[] {
  if (w >= h) {
    return [
      { scale: 0.62, spacing: w * 0.07, size: 0.95, base: h * 0.3, liftL: h * 0.05, liftR: h * 0.1, reachL: 0.25, reachR: 0.25, bright: 0.5, bare: 0.15, parallax: 6, hanging: false },
      { scale: 0.85, spacing: w * 0.11, size: 0.85, base: h * 0.09, liftL: h * 0.1, liftR: h * 0.2, reachL: 0.18, reachR: 0.22, bright: 0.78, bare: 0.3, parallax: 13, hanging: false },
      { scale: 1.45, spacing: w * 0.16, size: 0.8, base: -h * 0.07, liftL: h * 0.16, liftR: h * 0.3, reachL: 0.14, reachR: 0.16, bright: 1, bare: 0.3, parallax: 30, hanging: false },
      { scale: 1.25, spacing: w * 0.1, size: 0.95, base: -h * 0.14, liftL: h * 0.2, liftR: h * 0.08, reachL: 0.17, reachR: 0.1, bright: 0.85, bare: 0.2, parallax: 24, hanging: true },
    ];
  }
  return [
    { scale: 0.6, spacing: w * 0.16, size: 0.95, base: h * 0.3, liftL: h * 0.04, liftR: h * 0.04, reachL: 0.3, reachR: 0.3, bright: 0.5, bare: 0.15, parallax: 4, hanging: false },
    { scale: 0.85, spacing: w * 0.24, size: 0.85, base: h * 0.15, liftL: h * 0.1, liftR: h * 0.1, reachL: 0.25, reachR: 0.25, bright: 0.78, bare: 0.3, parallax: 8, hanging: false },
    { scale: 1.35, spacing: w * 0.34, size: 0.8, base: -h * 0.05, liftL: h * 0.14, liftR: h * 0.18, reachL: 0.25, reachR: 0.25, bright: 1, bare: 0.25, parallax: 18, hanging: false },
    { scale: 1.2, spacing: w * 0.3, size: 0.8, base: -h * 0.09, liftL: h * 0.12, liftR: h * 0.1, reachL: 0.3, reachR: 0.3, bright: 0.85, bare: 0.25, parallax: 14, hanging: true },
  ];
}

/**
 * Where the portrait sits, in css px with the origin bottom-left.
 *
 * Landscape: right-hand side, bust cut by the bottom edge, so the wordmark
 * owns the lower left and the face owns the upper right. Portrait screens:
 * centred, hung from just under the nav, with the copy laid over the
 * shoulders — the gradient scrim is what keeps that readable.
 */
function portraitRect(w: number, h: number, aspect: number): [number, number, number, number] {
  if (w >= h) {
    const ph = h * 0.96;
    const pw = ph * aspect;
    const x0 = Math.max(w * 0.96 - pw, w * 0.5 - pw * 0.5);
    return [x0, 0, pw, ph];
  }
  const ph = Math.min(h * 0.74, (w * 1.15) / aspect);
  const pw = ph * aspect;
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
        FIREFLY_COUNT,
        LAYER_COUNT,
        ...GARDEN_DEFINES,
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
        uLayerA: { value: Array.from({ length: LAYER_COUNT }, () => new THREE.Vector4()) },
        uLayerB: { value: Array.from({ length: LAYER_COUNT }, () => new THREE.Vector4()) },
        uLayerC: { value: Array.from({ length: LAYER_COUNT }, () => new THREE.Vector4()) },
        uParallax: { value: new THREE.Vector2() },
        uGrowFrom: { value: 0.7 },
        uHover: { value: 0 },
        uVoid: { value: srgb(VOID) },
        uLeafDark: { value: srgb(LEAF_DARK) },
        uLeafLight: { value: srgb(LEAF_LIGHT) },
        uFarTint: { value: srgb(FAR_TINT) },
        uLilac: { value: srgb(LILAC) },
        uPink: { value: srgb(PINK) },
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
    const img = textures?.field.image as { width: number; height: number } | undefined;
    const aspect = img ? img.width / img.height : DEFAULT_ASPECT;
    const rect = portraitRect(size.width, size.height, aspect);
    u.uRect.value.set(...rect);
    gardenLayers(size.width, size.height).forEach((l, i) => {
      (u.uLayerA.value[i] as THREE.Vector4).set(l.scale, l.spacing, l.size, l.base);
      (u.uLayerB.value[i] as THREE.Vector4).set(l.liftL, l.liftR, l.reachL, l.reachR);
      (u.uLayerC.value[i] as THREE.Vector4).set(l.bright, l.bare, l.parallax, l.hanging ? 1 : 0);
    });
    u.uGrowFrom.value = (rect[0] + rect[2] / 2) / size.width;
    invalidate();
  }, [size.width, size.height, textures, u, invalidate]);

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
      u.uHover.value = 0;
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
      // Hover for the garden is not gated on the reveal: grass parting under
      // the cursor while it is still growing is part of the fun.
      u.uHover.value = THREE.MathUtils.damp(
        u.uHover.value,
        pointerEnabled ? motion.pointerInside : 0,
        5,
        dt,
      );
      // Parallax follows the pointer softly and drifts home when it leaves.
      const par = u.uParallax.value as THREE.Vector2;
      const inside = pointerEnabled ? motion.pointerInside : 0;
      par.set(
        THREE.MathUtils.damp(par.x, motion.pointerX * inside, 3, dt),
        THREE.MathUtils.damp(par.y, motion.pointerY * inside, 3, dt),
      );
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
