"use client";

import type { StageHandle } from "@/components/editor/stage";

/**
 * The seam the browser tests drive the editor through.
 *
 * Playwright can click, but it cannot ask "is the timeline finished building
 * against the face you just loaded" or "park the playhead at 1.20s" — and every
 * visual assertion in this app depends on being able to do exactly that. Poking
 * at GSAP from the test would mean the test knowing about internals it has no
 * business knowing; this exposes the same handle the transport bar already uses
 * and nothing more.
 *
 * It is a read-and-drive handle over state that is already entirely client-side
 * and user-controllable, so publishing it costs nothing: there is no privilege
 * here that a user with devtools does not already have.
 */
export const TEST_HOOK = "__titlecard" as const;

export type TitlecardTestHook = StageHandle;

declare global {
  interface Window {
    [TEST_HOOK]?: TitlecardTestHook;
  }
}

export function installTestHook(handle: TitlecardTestHook | null): () => void {
  if (typeof window === "undefined") return () => {};
  window[TEST_HOOK] = handle ?? undefined;
  return () => {
    if (window[TEST_HOOK] === handle) delete window[TEST_HOOK];
  };
}
