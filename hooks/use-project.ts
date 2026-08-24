"use client";

import * as React from "react";

import { useClientValue } from "@/hooks/use-client-value";
import { activeLayer, DEFAULT_PROJECT, layerTypography } from "@/lib/project";
import { clearSession, loadSession, saveSession } from "@/lib/storage";
import { remapWordStyles } from "@/lib/word-styles";
import type { ProjectState, TextLayer } from "@/lib/types";

/**
 * Project state, history and persistence.
 *
 * History is a plain snapshot stack rather than a command architecture: the
 * state is a few kilobytes of JSON, undo is "put the old object back", and a
 * command system would buy nothing except a second place for a bug to live.
 *
 * The stack lives *inside* React state, not in refs beside it. That is not a
 * style preference — an earlier version pushed onto a ref from inside the state
 * updater, and because React re-invokes updaters (under Strict Mode, and when
 * replaying a render) the stack picked up phantom entries and undo jumped to
 * the wrong snapshot. Every transition here is a pure function of the previous
 * history, so running it twice is indistinguishable from running it once.
 *
 * The one piece of real machinery is coalescing. Dragging a slider fires a
 * change per frame, and forty entries per drag would make undo useless — so
 * consecutive edits carrying the same tag inside a short window replace each
 * other instead of stacking.
 */

const HISTORY_LIMIT = 60;
const COALESCE_MS = 600;
const SAVE_DEBOUNCE_MS = 450;

export type ProjectUpdate = Partial<ProjectState> | ((project: ProjectState) => ProjectState);

export type UpdateOptions = {
  /**
   * Edits sharing a tag inside the coalesce window collapse into one history
   * entry. Pass a distinct tag per control — `"typography.fontSize"` and
   * `"motion.speed"` must not merge into each other.
   */
  tag?: string;
  /** Skip history entirely — for transient, non-authored changes. */
  silent?: boolean;
};

export type ProjectController = {
  project: ProjectState;
  layer: TextLayer;
  /** True when the project came back from a previous session. */
  restored: boolean;
  /** True when that session had to be migrated from an older schema. */
  migrated: boolean;
  update: (update: ProjectUpdate, options?: UpdateOptions) => void;
  updateLayer: (patch: Partial<TextLayer>, options?: UpdateOptions) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: () => void;
};

type History = {
  present: ProjectState;
  past: ProjectState[];
  future: ProjectState[];
  /** The tag and timestamp of the last recorded edit, for coalescing. */
  lastTag: string;
  lastAt: number;
};

/** The server has no storage, so it always answers with the blank project. */
const SERVER_SESSION = { project: DEFAULT_PROJECT, restored: false, migrated: false };

/**
 * Carries per-word styling across a text edit.
 *
 * Applied here rather than in the text field because *every* route that can
 * change a phrase has to go through it — the panel, the phrase presets, the
 * "use its text too" offer after an import. A rule enforced at one call site is
 * a rule with as many holes as there are other call sites.
 *
 * Undo and redo restore whole snapshots and deliberately do not come through
 * here: their styling is already correct for the text they carry.
 */
function reconcileWordStyles(previous: ProjectState, next: ProjectState): ProjectState {
  if (previous === next || previous.layers === next.layers) return next;

  let changed = false;
  const layers = next.layers.map((layer) => {
    const before = previous.layers.find((entry) => entry.id === layer.id);
    if (!before || before.text === layer.text) return layer;
    if (Object.keys(layer.wordStyles).length === 0) return layer;

    const typography = layerTypography(next, layer);
    const { wordStyles } = remapWordStyles(before.text, layer.text, layer.wordStyles, {
      granularity: typography.granularity,
      transform: typography.transform,
      gradientDigits: next.gradientDigits,
    });

    changed = true;
    return { ...layer, wordStyles };
  });

  return changed ? { ...next, layers } : next;
}

const initial = (project: ProjectState): History => ({
  present: project,
  past: [],
  future: [],
  lastTag: "",
  lastAt: 0,
});

export function useProject(): ProjectController {
  // `useSyncExternalStore` is what reconciles the server's blank project with
  // the stored one: no hydration mismatch, and no effect scheduling a second
  // render pass on every mount.
  const session = useClientValue(loadSession, SERVER_SESSION);
  const [edited, setEdited] = React.useState<History | null>(null);
  const history = edited ?? initial(session.project);
  const project = history.present;

  React.useEffect(() => {
    const timer = window.setTimeout(() => saveSession(project), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [project]);

  const commit = (next: (previous: History) => History) => {
    setEdited((current) => next(current ?? initial(session.project)));
  };

  const update = (patch: ProjectUpdate, options: UpdateOptions = {}) => {
    // Read the clock once, out here: sampling it inside the updater would give
    // a different answer on a re-invocation and change the merge decision.
    const now = Date.now();

    commit((previous) => {
      const patched =
        typeof patch === "function" ? patch(previous.present) : { ...previous.present, ...patch };
      const next = reconcileWordStyles(previous.present, patched);
      if (next === previous.present) return previous;

      if (options.silent) return { ...previous, present: next };

      const tag = options.tag ?? "";
      const merge =
        tag !== "" && tag === previous.lastTag && now - previous.lastAt < COALESCE_MS;

      return {
        present: next,
        past: merge ? previous.past : [...previous.past, previous.present].slice(-HISTORY_LIMIT),
        future: [],
        lastTag: tag,
        lastAt: now,
      };
    });
  };

  const updateLayer = (patch: Partial<TextLayer>, options?: UpdateOptions) => {
    update(
      (previous) => ({
        ...previous,
        layers: previous.layers.map((entry) =>
          entry.id === previous.activeLayerId ? { ...entry, ...patch } : entry,
        ),
      }),
      options,
    );
  };

  const undo = () => {
    commit((previous) => {
      if (previous.past.length === 0) return previous;
      return {
        present: previous.past[previous.past.length - 1],
        past: previous.past.slice(0, -1),
        future: [previous.present, ...previous.future].slice(0, HISTORY_LIMIT),
        lastTag: "",
        lastAt: 0,
      };
    });
  };

  const redo = () => {
    commit((previous) => {
      if (previous.future.length === 0) return previous;
      return {
        present: previous.future[0],
        past: [...previous.past, previous.present].slice(-HISTORY_LIMIT),
        future: previous.future.slice(1),
        lastTag: "",
        lastAt: 0,
      };
    });
  };

  const reset = () => {
    clearSession();
    setEdited(initial(DEFAULT_PROJECT));
  };

  return {
    project,
    layer: activeLayer(project),
    restored: session.restored,
    migrated: session.migrated,
    update,
    updateLayer,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
  };
}
