"use client";

import * as React from "react";

import { splitText, type SplitTextResult } from "@/lib/split";

export type {
  SplitCharacter,
  SplitWord,
  SplitTextResult,
} from "@/lib/split";
export { splitText } from "@/lib/split";

/** Memoised wrapper so the split DOM is only rebuilt when the phrase changes. */
export function useSplitText(source: string): SplitTextResult {
  return React.useMemo(() => splitText(source), [source]);
}
