"use client";

import * as React from "react";

/**
 * Reads a browser-only value without a hydration mismatch.
 *
 * `localStorage` does not exist during the server render, so the first client
 * render has to match the server's answer and only then reconcile to the real
 * one. That is exactly what `useSyncExternalStore` is for — and unlike reading
 * it in an effect, it does not schedule a second render pass on every mount.
 *
 * `read` must be a stable function (a module-level one), because the snapshot
 * is cached against it.
 */
const noSubscribe = () => () => {};

export function useClientValue<T>(read: () => T, serverValue: T): T {
  const cache = React.useRef<{ value: T } | null>(null);

  const getSnapshot = React.useCallback(() => {
    // The store never changes under us, so the snapshot has to be referentially
    // stable — recomputing it would loop.
    if (cache.current === null) cache.current = { value: read() };
    return cache.current.value;
  }, [read]);

  const getServerSnapshot = React.useCallback(() => serverValue, [serverValue]);

  return React.useSyncExternalStore(noSubscribe, getSnapshot, getServerSnapshot);
}

/**
 * The same, plus a local override for values the UI also writes.
 *
 * The stored value is the starting point; every edit after that lives in React
 * state, which is what the caller gets back.
 */
export function useClientState<T>(
  read: () => T,
  serverValue: T,
): [T, (next: T) => void] {
  const stored = useClientValue(read, serverValue);
  const [override, setOverride] = React.useState<{ value: T } | null>(null);
  return [override ? override.value : stored, (next) => setOverride({ value: next })];
}
