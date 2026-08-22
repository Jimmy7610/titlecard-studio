"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useClientState } from "@/hooks/use-client-value";
import { dismissOnboarding, isOnboardingDismissed } from "@/lib/storage";

const STEPS = [
  "Type your text",
  "Pick an animation",
  "Customise the look",
  "Export it",
] as const;

/**
 * First-run orientation.
 *
 * Four words, one dismissal, remembered locally. A modal tour would be a
 * bigger interruption than the thing it explains.
 */
export function Onboarding() {
  // Server-side the answer is "already dismissed", so the hint never flashes
  // into the markup and then out of it.
  const [dismissed, setDismissed] = useClientState(isOnboardingDismissed, true);

  if (dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-14 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-popover/95 py-1.5 pr-1.5 pl-4 shadow-xl shadow-black/40 backdrop-blur">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem]">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-1.5">
              <span className="grid size-4 place-items-center rounded-full bg-primary/15 text-[0.6rem] font-semibold text-primary">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss the getting-started hints"
          onClick={() => {
            dismissOnboarding();
            setDismissed(true);
          }}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
