"use client";

import { parsePreset, presetPayload } from "@/lib/presets/schema";
import { DEFAULT_PROJECT, SCHEMA_VERSION } from "@/lib/project";
import type { ProjectState } from "@/lib/types";

/**
 * Local persistence.
 *
 * Two stores, both `localStorage`, both versioned by key: the session (one
 * project, rewritten as you work) and the saved presets (a list). Reads are
 * total — a corrupted or half-written entry returns the default rather than
 * throwing, because a bad byte in storage must not be able to make the editor
 * unopenable.
 */

const SESSION_KEY = `stw:session:v${SCHEMA_VERSION}`;
const PRESETS_KEY = `stw:presets:v${SCHEMA_VERSION}`;
const ONBOARDING_KEY = "stw:onboarding-dismissed:v1";

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/* ------------------------------------------------------------------ *
 * Session
 * ------------------------------------------------------------------ */

/**
 * Restores the last session.
 *
 * The stored blob goes through the same validator an imported file does, so a
 * project written by an older build — or hand-edited in devtools — is migrated
 * and clamped rather than trusted.
 */
export function loadSession(): { project: ProjectState; restored: boolean } {
  const raw = readRaw(SESSION_KEY);
  if (!raw) return { project: DEFAULT_PROJECT, restored: false };

  try {
    const parsed = parsePreset(raw);
    const layers = parsed.project.layers.map((layer, index) => ({
      ...layer,
      // A session *does* carry its phrases; only imported presets hold them back.
      text: parsed.texts[index] ?? layer.text,
    }));

    return {
      project: {
        ...parsed.project,
        layers: layers.length ? layers : DEFAULT_PROJECT.layers,
        activeLayerId: layers[0]?.id ?? DEFAULT_PROJECT.activeLayerId,
      },
      restored: true,
    };
  } catch {
    removeRaw(SESSION_KEY);
    return { project: DEFAULT_PROJECT, restored: false };
  }
}

export function saveSession(project: ProjectState): void {
  writeRaw(SESSION_KEY, JSON.stringify(presetPayload(project)));
}

export function clearSession(): void {
  removeRaw(SESSION_KEY);
}

/* ------------------------------------------------------------------ *
 * Saved presets
 * ------------------------------------------------------------------ */

export type SavedPreset = {
  id: string;
  name: string;
  /** Epoch millis, for ordering. */
  savedAt: number;
  /** A full preset payload, serialised. */
  payload: string;
};

export function listSavedPresets(): SavedPreset[] {
  const raw = readRaw(PRESETS_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedPreset =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as SavedPreset).id === "string" &&
        typeof (entry as SavedPreset).payload === "string",
    );
  } catch {
    removeRaw(PRESETS_KEY);
    return [];
  }
}

function writePresets(presets: SavedPreset[]): boolean {
  return writeRaw(PRESETS_KEY, JSON.stringify(presets));
}

export function savePreset(name: string, project: ProjectState): SavedPreset[] {
  const presets = listSavedPresets();
  const entry: SavedPreset = {
    id: `saved-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: name.trim() || "Untitled preset",
    savedAt: Date.now(),
    payload: JSON.stringify({ ...presetPayload(project), name: name.trim() || "Untitled preset" }),
  };

  const next = [entry, ...presets];
  writePresets(next);
  return next;
}

export function renamePreset(id: string, name: string): SavedPreset[] {
  const next = listSavedPresets().map((preset) =>
    preset.id === id ? { ...preset, name: name.trim() || preset.name } : preset,
  );
  writePresets(next);
  return next;
}

export function duplicatePreset(id: string): SavedPreset[] {
  const presets = listSavedPresets();
  const source = presets.find((preset) => preset.id === id);
  if (!source) return presets;

  const copy: SavedPreset = {
    ...source,
    id: `saved-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: `${source.name} copy`,
    savedAt: Date.now(),
  };

  const next = [copy, ...presets];
  writePresets(next);
  return next;
}

export function deletePreset(id: string): SavedPreset[] {
  const next = listSavedPresets().filter((preset) => preset.id !== id);
  writePresets(next);
  return next;
}

/** Reads a saved preset back into a project, keeping the current phrases. */
export function readSavedPreset(preset: SavedPreset) {
  return parsePreset(preset.payload);
}

/* ------------------------------------------------------------------ *
 * Onboarding
 * ------------------------------------------------------------------ */

export function isOnboardingDismissed(): boolean {
  return readRaw(ONBOARDING_KEY) === "true";
}

export function dismissOnboarding(): void {
  writeRaw(ONBOARDING_KEY, "true");
}
