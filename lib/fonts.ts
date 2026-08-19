import localFont from "next/font/local";
import { Archivo, Geist, Geist_Mono } from "next/font/google";

/**
 * Display face for the hero. The particle field samples the rendered glyph
 * pixels, so we need heavy stems and open counters — Archivo at wght 900 has
 * both, and stays legible once it is only made of dots.
 *
 * Deliberately weight-only (no `wdth` axis): Canvas 2D has no way to set
 * font-variation-settings, so an expanded cut could never reach the sampler and
 * would only desync the DOM fallback from the particles.
 */
export const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Editorial display face for Chapter .02. Only the marquee uses it, but it is
 * loaded in the root layout as a CSS variable so the panel stays a Server
 * Component and the file is fetched with the document rather than after it.
 *
 * `display: "block"` on purpose: the marquee is the section's headline, and a
 * swap from a fallback metric mid-scroll is far more visible than a short
 * blank. The band is below the fold, so nothing is blocked at first paint.
 */
export const blurWeb = localFont({
  src: "../public/font/BlurWeb-Medium W03 Regular.ttf",
  variable: "--font-blurweb",
  display: "block",
  weight: "500",
  style: "normal",
  fallback: ["Archivo", "system-ui", "sans-serif"],
});
