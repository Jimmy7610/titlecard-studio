"use client";

/**
 * Font library.
 *
 * `next/font` cannot help here: it resolves faces at build time and the user
 * picks one at runtime. So the library is a curated list of Google faces loaded
 * on demand — one stylesheet per family, injected the first time that family is
 * selected, never all fourteen at once.
 */

export type FontCategory = "sans" | "display" | "serif" | "mono";

export type FontDefinition = {
  id: string;
  name: string;
  /** CSS `font-family` value, without the fallback stack. */
  family: string;
  category: FontCategory;
  note: string;
  /** Weights the picker offers. */
  weights: readonly number[];
  italic: boolean;
  /**
   * The `family=` parameter for the Google Fonts CSS2 endpoint. `null` for a
   * face that needs no network request.
   */
  googleSpec: string | null;
};

export const FONTS: readonly FontDefinition[] = [
  {
    id: "outfit", name: "Outfit", family: "Outfit", category: "sans",
    note: "Geometric grotesk — the reference face",
    weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: false,
    googleSpec: "Outfit:wght@200..900",
  },
  {
    id: "inter", name: "Inter", family: "Inter", category: "sans",
    note: "Neutral UI workhorse",
    weights: [300, 400, 500, 600, 700, 800, 900], italic: false,
    googleSpec: "Inter:wght@300..900",
  },
  {
    id: "manrope", name: "Manrope", family: "Manrope", category: "sans",
    note: "Semi-geometric, open apertures",
    weights: [300, 400, 500, 600, 700, 800], italic: false,
    googleSpec: "Manrope:wght@300..800",
  },
  {
    id: "space-grotesk", name: "Space Grotesk", family: "Space Grotesk", category: "sans",
    note: "Technical grotesk with quirks",
    weights: [300, 400, 500, 600, 700], italic: false,
    googleSpec: "Space+Grotesk:wght@300..700",
  },
  {
    id: "dm-sans", name: "DM Sans", family: "DM Sans", category: "sans",
    note: "Low-contrast geometric",
    weights: [300, 400, 500, 600, 700, 800, 900], italic: true,
    googleSpec: "DM+Sans:ital,wght@0,300..900;1,300..900",
  },
  {
    id: "poppins", name: "Poppins", family: "Poppins", category: "sans",
    note: "Monolinear geometric",
    weights: [300, 400, 500, 600, 700, 800, 900], italic: true,
    googleSpec:
      "Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600",
  },
  {
    id: "montserrat", name: "Montserrat", family: "Montserrat", category: "sans",
    note: "Urban signage geometry",
    weights: [300, 400, 500, 600, 700, 800, 900], italic: true,
    googleSpec: "Montserrat:ital,wght@0,300..900;1,300..900",
  },
  {
    id: "archivo", name: "Archivo", family: "Archivo", category: "sans",
    note: "Grotesque built for headlines",
    weights: [400, 500, 600, 700, 800, 900], italic: true,
    googleSpec: "Archivo:ital,wght@0,400..900;1,400..900",
  },
  {
    id: "bebas", name: "Bebas Neue", family: "Bebas Neue", category: "display",
    note: "All-caps condensed — one weight",
    weights: [400], italic: false,
    googleSpec: "Bebas+Neue",
  },
  {
    id: "anton", name: "Anton", family: "Anton", category: "display",
    note: "Heavy condensed poster face",
    weights: [400], italic: false,
    googleSpec: "Anton",
  },
  {
    id: "oswald", name: "Oswald", family: "Oswald", category: "display",
    note: "Condensed gothic",
    weights: [300, 400, 500, 600, 700], italic: false,
    googleSpec: "Oswald:wght@300..700",
  },
  {
    id: "playfair", name: "Playfair Display", family: "Playfair Display", category: "serif",
    note: "High-contrast didone",
    weights: [400, 500, 600, 700, 800, 900], italic: true,
    googleSpec: "Playfair+Display:ital,wght@0,400..900;1,400..900",
  },
  {
    id: "cormorant", name: "Cormorant Garamond", family: "Cormorant Garamond", category: "serif",
    note: "Delicate old-style — set it large",
    weights: [300, 400, 500, 600, 700], italic: true,
    googleSpec: "Cormorant+Garamond:ital,wght@0,300..700;1,300..700",
  },
  {
    id: "jetbrains-mono", name: "JetBrains Mono", family: "JetBrains Mono", category: "mono",
    note: "Fixed pitch — pairs with decode motion",
    weights: [300, 400, 500, 600, 700, 800], italic: false,
    googleSpec: "JetBrains+Mono:wght@300..800",
  },
] as const;

const FONT_INDEX = new Map(FONTS.map((font) => [font.id, font]));

export const CUSTOM_FONT_PREFIX = "custom:";

/* ------------------------------------------------------------------ *
 * Custom uploads
 * ------------------------------------------------------------------ */

export type CustomFont = {
  id: string;
  name: string;
  family: string;
  /** `data:` URL, so the face can be embedded in a standalone export. */
  dataUrl: string;
  format: string;
  bytes: number;
};

const CUSTOM_STORAGE_KEY = "stw:custom-fonts:v1";
/** Above this a face is kept for the session but not persisted. */
const PERSIST_LIMIT = 1_600_000;

export const SUPPORTED_FONT_EXTENSIONS = [".woff2", ".woff", ".ttf", ".otf"] as const;

const FORMAT_BY_EXTENSION: Record<string, string> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

const customFonts = new Map<string, CustomFont>();
let customLoaded = false;

async function registerCustomFace(font: CustomFont): Promise<void> {
  if (typeof window === "undefined" || !("FontFace" in window)) return;
  try {
    const face = new FontFace(font.family, `url(${font.dataUrl})`);
    await face.load();
    document.fonts.add(face);
  } catch {
    // Reported by the caller that owns the upload; a restored face fails quietly.
  }
}

function readPersistedCustomFonts(): void {
  if (customLoaded || typeof window === "undefined") return;
  customLoaded = true;
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      const font = entry as CustomFont;
      if (entry && typeof entry === "object" && typeof font.id === "string" && typeof font.dataUrl === "string") {
        customFonts.set(font.id, font);
        void registerCustomFace(font);
      }
    }
  } catch {
    // A corrupted entry must not take the editor down with it.
    try {
      window.localStorage.removeItem(CUSTOM_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}

function persistCustomFonts(): void {
  if (typeof window === "undefined") return;
  const persistable = [...customFonts.values()].filter((font) => font.bytes <= PERSIST_LIMIT);
  try {
    window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // Quota exceeded — the face still works for this session.
  }
}

export function listCustomFonts(): CustomFont[] {
  readPersistedCustomFonts();
  return [...customFonts.values()];
}

export function getCustomFont(id: string): CustomFont | null {
  readPersistedCustomFonts();
  return customFonts.get(id) ?? null;
}

export class FontLoadError extends Error {}

/**
 * Registers an uploaded font file for the session.
 *
 * The file is kept as a data URL rather than an object URL: an object URL dies
 * with the tab, and the standalone HTML export needs the actual bytes to embed
 * a `@font-face` that still works after the editor is closed.
 */
export async function addCustomFont(file: File): Promise<CustomFont> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_BY_EXTENSION[extension];
  if (!format) {
    throw new FontLoadError(
      `Unsupported font format ".${extension}". Use ${SUPPORTED_FONT_EXTENSIONS.join(", ")}.`,
    );
  }
  if (file.size > 12_000_000) {
    throw new FontLoadError("Font file is over 12 MB — too large to embed in an export.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new FontLoadError("Could not read the font file."));
    reader.readAsDataURL(file);
  });

  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\s-]/g, "").trim() || "Custom";
  const family = `STW ${base}`;
  const font: CustomFont = {
    id: `${CUSTOM_FONT_PREFIX}${base.toLowerCase().replace(/\s+/g, "-")}`,
    name: base,
    family,
    dataUrl,
    format,
    bytes: file.size,
  };

  // Validate by actually loading it — a renamed archive must fail here, loudly,
  // rather than silently falling back to system-ui on the stage.
  if (typeof window !== "undefined" && "FontFace" in window) {
    try {
      const face = new FontFace(family, `url(${dataUrl})`);
      await face.load();
      document.fonts.add(face);
    } catch {
      throw new FontLoadError("That file could not be parsed as a font.");
    }
  }

  readPersistedCustomFonts();
  customFonts.set(font.id, font);
  persistCustomFonts();
  return font;
}

export function removeCustomFont(id: string): void {
  readPersistedCustomFonts();
  customFonts.delete(id);
  persistCustomFonts();
}

/** True when the face is large enough that persistence was skipped. */
export function isSessionOnly(font: CustomFont): boolean {
  return font.bytes > PERSIST_LIMIT;
}

/* ------------------------------------------------------------------ *
 * Resolution and loading
 * ------------------------------------------------------------------ */

export type ResolvedFont = {
  id: string;
  name: string;
  family: string;
  /** Full stack, ready for `font-family`. */
  stack: string;
  category: FontCategory;
  weights: readonly number[];
  italic: boolean;
  custom: CustomFont | null;
};

const FALLBACK_STACKS: Record<FontCategory, string> = {
  sans: "system-ui, -apple-system, Segoe UI, sans-serif",
  display: "Impact, system-ui, sans-serif",
  serif: "Georgia, Times New Roman, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export function resolveFont(fontId: string): ResolvedFont {
  if (fontId.startsWith(CUSTOM_FONT_PREFIX)) {
    const custom = getCustomFont(fontId);
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        family: custom.family,
        stack: `"${custom.family}", ${FALLBACK_STACKS.sans}`,
        category: "sans",
        weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
        italic: false,
        custom,
      };
    }
  }

  // Unknown ids degrade to the reference face rather than throwing: an id can
  // arrive from a preset written against a build that had a face this one lacks.
  const font = FONT_INDEX.get(fontId) ?? FONTS[0];
  return {
    id: font.id,
    name: font.name,
    family: font.family,
    stack: `"${font.family}", ${FALLBACK_STACKS[font.category]}`,
    category: font.category,
    weights: font.weights,
    italic: font.italic,
    custom: null,
  };
}

export function googleFontHref(fontId: string): string | null {
  const font = FONT_INDEX.get(fontId);
  if (!font?.googleSpec) return null;
  return `https://fonts.googleapis.com/css2?family=${font.googleSpec}&display=swap`;
}

const loading = new Map<string, Promise<void>>();

/**
 * Injects a family's stylesheet once and resolves when the face is usable.
 *
 * Resolving on `document.fonts.load` rather than on the link's load event
 * matters: the stylesheet arriving is not the same event as the woff2 being
 * ready to measure, and every mask height in this app is derived from font
 * metrics.
 */
export function loadFont(fontId: string, weight = 600): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  if (fontId.startsWith(CUSTOM_FONT_PREFIX)) {
    const custom = getCustomFont(fontId);
    return custom ? registerCustomFace(custom) : Promise.resolve();
  }

  const cached = loading.get(fontId);
  if (cached) return cached;

  const href = googleFontHref(fontId);
  if (!href) return Promise.resolve();
  const resolved = resolveFont(fontId);

  const promise = new Promise<void>((resolve) => {
    const id = `stw-font-${fontId}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      // A font that never arrives must not stall the editor.
      link.addEventListener("error", () => resolve());
      document.head.appendChild(link);
    }

    document.fonts
      .load(`${weight} 1em "${resolved.family}"`)
      .then(() => resolve())
      .catch(() => resolve());

    window.setTimeout(resolve, 4000);
  });

  loading.set(fontId, promise);
  return promise;
}

/** Preconnect origins the export documents need. */
export const GOOGLE_FONT_PRECONNECT = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
] as const;
