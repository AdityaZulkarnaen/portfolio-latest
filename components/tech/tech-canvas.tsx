"use client";

import dynamic from "next/dynamic";

/**
 * The `ssr: false` boundary, same shape as `hero-canvas.tsx`. Next 16 only
 * allows this option inside a Client Component, which is exactly what this file
 * exists to be — three.js touches `window` at import time and must never run
 * during the server pass.
 */
const TechCanvas = dynamic(() => import("./tech-scene"), { ssr: false });

export default TechCanvas;
