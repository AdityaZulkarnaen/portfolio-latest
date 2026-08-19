"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * `useSyncExternalStore` rather than effect-plus-setState: a media query is
 * exactly the external store this hook is designed for, and it gives us a
 * defined server snapshot instead of a cascading render after mount.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True for mouse/trackpad. Touch-only devices get no pointer repulsion. */
export function useFinePointer(): boolean {
  return useMediaQuery("(pointer: fine)");
}
