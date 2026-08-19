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
