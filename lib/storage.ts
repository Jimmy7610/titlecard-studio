"use client";

import {
  parseProjectFile,
  parseStylePreset,
  projectFileJson,
  stylePresetJson,
  type StylePreset,
} from "@/lib/persistence";
import { DEFAULT_PROJECT, SCHEMA_VERSION } from "@/lib/project";
import type { ProjectState } from "@/lib/types";

/**
 * Local persistence.
 *
 * Two stores, both `localStorage`: the session (one project, rewritten as you
 * work) and the saved looks (a list). Reads are total — a corrupted or
 * half-written entry returns the default rather than throwing, because a bad
 * byte in storage must not be able to make the editor unopenable.
 *
 * Keys are versioned, and every reader walks *back* through the versions it
 * knows. A key that only looked at the current version would silently abandon
 * a project the moment the schema moved: the old entry is still sitting there,
 * still readable, and the user would open the app to an empty canvas.
 */

const SESSION_KEY = `stw:session:v${SCHEMA_VERSION}`;
const PRESETS_KEY = `stw:presets:v${SCHEMA_VERSION}`;
const ONBOARDING_KEY = "stw:onboarding-dismissed:v1";

/**
 * Every session key this build can read, newest first.
 *
 * Adding a version means adding its key here, not just bumping the constant.
 */
const SESSION_KEYS = [SESSION_KEY, "stw:session:v2"] as const;
const PRESET_KEYS = [PRESETS_KEY, "stw:presets:v2"] as const;

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

/** The first key that holds something, and what it held. */
function findStored(keys: readonly string[]): { key: string; raw: string } | null {
  for (const key of keys) {
    const raw = readRaw(key);
    if (raw) return { key, raw };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Session
 * ------------------------------------------------------------------ */

export type RestoredSession = {
  project: ProjectState;
  /** True when the project came back from a previous session. */
  restored: boolean;
  /** True when it had to be migrated from an older schema on the way in. */
  migrated: boolean;
};

/**
 * Restores the last session.
 *
 * The stored blob goes through the same validator an imported file does, so a
 * project written by an older build — or hand-edited in devtools — is migrated
 * and clamped rather than trusted. A successful migration is written forward
 * immediately, and only then is the old copy dropped: a crash in between leaves
 * the original where it was rather than losing it.
 */
export function loadSession(): RestoredSession {
  const found = findStored(SESSION_KEYS);
  if (!found) return { project: DEFAULT_PROJECT, restored: false, migrated: false };

  try {
    const parsed = parseProjectFile(found.raw);
    const migrated = found.key !== SESSION_KEY;

    if (migrated) {
      // Write forward first, drop the old copy second.
      if (writeRaw(SESSION_KEY, projectFileJson(parsed.project))) removeRaw(found.key);
    }

    return { project: parsed.project, restored: true, migrated };
  } catch {
    removeRaw(found.key);
    return { project: DEFAULT_PROJECT, restored: false, migrated: false };
  }
}

export function saveSession(project: ProjectState): void {
  writeRaw(SESSION_KEY, projectFileJson(project));
}

export function clearSession(): void {
  for (const key of SESSION_KEYS) removeRaw(key);
}

/* ------------------------------------------------------------------ *
 * Saved looks
 * ------------------------------------------------------------------ */

export type SavedPreset = {
  id: string;
  name: string;
  /** Epoch millis, for ordering. */
  savedAt: number;
  /** A serialised `StylePresetFile`. */
  payload: string;
};

const isSavedPreset = (entry: unknown): entry is SavedPreset =>
  typeof entry === "object" &&
  entry !== null &&
  typeof (entry as SavedPreset).id === "string" &&
  typeof (entry as SavedPreset).payload === "string";

export function listSavedPresets(): SavedPreset[] {
  const found = findStored(PRESET_KEYS);
  if (!found) return [];

  try {
    const parsed: unknown = JSON.parse(found.raw);
    if (!Array.isArray(parsed)) return [];
    const presets = parsed.filter(isSavedPreset);

    // Entries saved under an older key are re-parsed through the current
    // reader and written forward, so a look saved in v2 keeps working.
    if (found.key !== PRESETS_KEY && presets.length) {
      const upgraded = presets.map((preset) => {
        try {
          return { ...preset, payload: stylePresetJson(parseStylePreset(preset.payload).preset) };
        } catch {
          return preset;
        }
      });
      if (writeRaw(PRESETS_KEY, JSON.stringify(upgraded))) removeRaw(found.key);
      return upgraded;
    }

    return presets;
  } catch {
    removeRaw(found.key);
    return [];
  }
}

function writePresets(presets: SavedPreset[]): boolean {
  return writeRaw(PRESETS_KEY, JSON.stringify(presets));
}

const newId = () =>
  `saved-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function savePreset(name: string, preset: StylePreset): SavedPreset[] {
  const label = name.trim() || "Untitled look";
  const entry: SavedPreset = {
    id: newId(),
    name: label,
    savedAt: Date.now(),
    payload: stylePresetJson({ ...preset, name: label }),
  };

  const next = [entry, ...listSavedPresets()];
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
    id: newId(),
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

/** Reads a saved look back. Throws only if the payload is not a look at all. */
export function readSavedPreset(preset: SavedPreset) {
  return parseStylePreset(preset.payload);
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
