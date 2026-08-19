"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | undefined;

function detect(): boolean {
  if (cached !== undefined) return cached;
  try {
    cached = Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    cached = false;
  }
  return cached;
}

// Support never changes within a session, so there is nothing to subscribe to.
const subscribe = () => () => {};

/**
 * Reports `false` on the server and during hydration, which is deliberate: the
 * plain-DOM wordmark is the progressive-enhancement base, so it ships in the
 * server HTML and is only swapped out once WebGL is confirmed on the client.
 */
export function useWebGLSupport(): boolean {
  return useSyncExternalStore(subscribe, detect, () => false);
}
