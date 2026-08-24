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

/**
 * One uploaded file: a single physical face, not a family.
 *
 * A woff2 holds one weight and one style unless it is variable, and there is no
 * way to know which without parsing the binary. So a variant records what it
 * actually is and the picker offers exactly that — the previous shape advertised
 * every weight from 100 to 900 for any upload, so asking for 700 got a
 * synthesised bold that no export could reproduce.
 */
export type CustomFontVariant = {
  /** Unique per uploaded face. */
  id: string;
  /** Groups variants into one pickable family. */
  familyId: string;
  /** The CSS font-family these variants are registered under. */
  family: string;
  /** What the picker shows for the family. */
  name: string;
  weight: number;
  italic: boolean;
  /** `data:` URL, so the face can be embedded in a standalone export. */
  dataUrl: string;
  format: string;
  bytes: number;
};

/** A family, as the picker sees it. */
export type CustomFontFamily = {
  familyId: string;
  family: string;
  name: string;
  variants: CustomFontVariant[];
  bytes: number;
};

const CUSTOM_STORAGE_KEY = "stw:custom-fonts:v2";
const CUSTOM_STORAGE_KEY_V1 = "stw:custom-fonts:v1";
/** Above this a face is kept for the session but not persisted. */
const PERSIST_LIMIT = 1_600_000;

export const SUPPORTED_FONT_EXTENSIONS = [".woff2", ".woff", ".ttf", ".otf"] as const;

const FORMAT_BY_EXTENSION: Record<string, string> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

const customFonts = new Map<string, CustomFontVariant>();
const registered = new Map<string, Promise<void>>();
let customLoaded = false;

/**
 * Registers one variant under its family with explicit descriptors.
 *
 * The descriptors are the point. Registered without them, every uploaded file
 * lands on 400 normal — so a Bold upload and a Regular upload overwrite each
 * other and asking for 700 gets whichever won.
 */
function registerCustomFace(variant: CustomFontVariant): Promise<void> {
  if (typeof window === "undefined" || !("FontFace" in window)) return Promise.resolve();

  const cached = registered.get(variant.id);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const face = new FontFace(variant.family, `url(${variant.dataUrl})`, {
        weight: String(variant.weight),
        style: variant.italic ? "italic" : "normal",
      });
      await face.load();
      document.fonts.add(face);
    } catch {
      // Reported by the caller that owns the upload; a restored face fails quietly.
    }
  })();

  registered.set(variant.id, promise);
  return promise;
}

/** A v1 entry described a whole family, with no weight and no style. */
type LegacyCustomFont = {
  id: string;
  name: string;
  family: string;
  dataUrl: string;
  format: string;
  bytes: number;
};

function migrateLegacyCustomFont(entry: LegacyCustomFont): CustomFontVariant {
  return {
    id: `${entry.id}:400:normal`,
    familyId: entry.id,
    family: entry.family,
    name: entry.name,
    // v1 recorded neither axis. Regular upright is the only honest reading, and
    // it is what the uploaded file almost always was.
    weight: 400,
    italic: false,
    dataUrl: entry.dataUrl,
    format: entry.format,
    bytes: entry.bytes,
  };
}

const isVariantish = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CustomFontVariant).id === "string" &&
  typeof (value as CustomFontVariant).dataUrl === "string";

function readPersistedCustomFonts(): void {
  if (customLoaded || typeof window === "undefined") return;
  customLoaded = true;

  const read = (key: string): unknown[] => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // A corrupted entry must not take the editor down with it.
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* storage unavailable */
      }
      return [];
    }
  };

  for (const entry of read(CUSTOM_STORAGE_KEY)) {
    if (!isVariantish(entry)) continue;
    const variant = entry as CustomFontVariant;
    customFonts.set(variant.id, {
      ...variant,
      familyId: variant.familyId ?? variant.id,
      weight: Number.isFinite(variant.weight) ? variant.weight : 400,
      italic: variant.italic === true,
    });
  }

  // Faces uploaded before variants existed are migrated in place rather than
  // dropped, then written back under the current key.
  const legacy = read(CUSTOM_STORAGE_KEY_V1);
  if (legacy.length) {
    for (const entry of legacy) {
      if (!isVariantish(entry)) continue;
      const variant = migrateLegacyCustomFont(entry as LegacyCustomFont);
      if (!customFonts.has(variant.id)) customFonts.set(variant.id, variant);
    }
    persistCustomFonts();
    try {
      window.localStorage.removeItem(CUSTOM_STORAGE_KEY_V1);
    } catch {
      /* storage unavailable */
    }
  }

  for (const variant of customFonts.values()) void registerCustomFace(variant);
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

export function listCustomVariants(): CustomFontVariant[] {
  readPersistedCustomFonts();
  return [...customFonts.values()];
}

/** Uploaded faces, grouped into the families the picker offers. */
export function listCustomFamilies(): CustomFontFamily[] {
  const families = new Map<string, CustomFontFamily>();

  for (const variant of listCustomVariants()) {
    const existing = families.get(variant.familyId);
    if (existing) {
      existing.variants.push(variant);
      existing.bytes += variant.bytes;
      continue;
    }
    families.set(variant.familyId, {
      familyId: variant.familyId,
      family: variant.family,
      name: variant.name,
      variants: [variant],
      bytes: variant.bytes,
    });
  }

  for (const family of families.values()) {
    family.variants.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
  }
  return [...families.values()];
}

export function getCustomFamily(familyId: string): CustomFontFamily | null {
  return listCustomFamilies().find((family) => family.familyId === familyId) ?? null;
}

/**
 * The uploaded face that best answers a weight/style request.
 *
 * Style wins over weight: an upright 700 is a better answer for "italic 700"
 * than an italic 300 is, only when no italic exists at all.
 */
export function pickCustomVariant(
  family: CustomFontFamily,
  weight: number,
  italic: boolean,
): CustomFontVariant | null {
  if (!family.variants.length) return null;
  const matchingStyle = family.variants.filter((variant) => variant.italic === italic);
  const pool = matchingStyle.length ? matchingStyle : family.variants;
  return pool.reduce((best, variant) =>
    Math.abs(variant.weight - weight) < Math.abs(best.weight - weight) ? variant : best,
  );
}

export class FontLoadError extends Error {}

/**
 * Registers an uploaded font file for the session.
 *
 * The file is kept as a data URL rather than an object URL: an object URL dies
 * with the tab, and the standalone HTML export needs the actual bytes to embed
 * a `@font-face` that still works after the editor is closed.
 */
export type CustomFontUpload = {
  /** Display name for the family. Uploads sharing one become one family. */
  name?: string;
  weight?: number;
  italic?: boolean;
};

/**
 * The axis words a font filename might carry, longest first.
 *
 * Order is load-bearing: "SemiBold" has to be read before "Bold", and
 * "ExtraLight" before "Light", or the shorter word wins on a prefix.
 */
const WEIGHT_WORDS: readonly (readonly [string, number])[] = [
  ["hairline", 100],
  ["extralight", 200],
  ["ultralight", 200],
  ["semibold", 600],
  ["demibold", 600],
  ["extrabold", 800],
  ["ultrabold", 800],
  ["regular", 400],
  ["normal", 400],
  ["medium", 500],
  ["black", 900],
  ["heavy", 900],
  ["light", 300],
  ["book", 400],
  ["roman", 400],
  ["thin", 100],
  ["bold", 700],
];

/**
 * Matches a word only where a word actually ends.
 *
 * A filename runs its words together in two ways — separators and camel case —
 * so the boundary after a match is a separator, the end of the name, or the
 * capital that starts the next word. Without the trailing boundary, "Thing"
 * contains "Thin" and a family called Thing uploads as weight 100.
 */
function axisPattern(word: string): RegExp {
  const spaced = word.replace(/(?<=[a-z])(?=[a-z])/g, "[-_ ]?");
  return new RegExp(`(?:^|[-_ ]|(?<=[a-z]))(${spaced})(?=[-_ ]|$|[A-Z])`, "i");
}

const ITALIC_PATTERN = axisPattern("italic");
const OBLIQUE_PATTERN = axisPattern("oblique");
const NUMERIC_WEIGHT = /(?:^|[-_ ])([1-9]00)(?=[-_ ]|$)/;

/** What a filename suggests, so the upload form starts on the right answer. */
export function guessVariantFromFilename(filename: string): {
  name: string;
  weight: number;
  italic: boolean;
} {
  const stem = filename.replace(/\.[^.]+$/, "");

  const italic = ITALIC_PATTERN.test(stem) || OBLIQUE_PATTERN.test(stem);
  const numeric = NUMERIC_WEIGHT.exec(stem);
  const named = WEIGHT_WORDS.find(([word]) => axisPattern(word).test(stem));
  const weight = numeric ? Number(numeric[1]) : (named?.[1] ?? 400);

  // Strip the axis words out of the family name: "MyFont-BoldItalic" is the
  // bold italic of "MyFont", not a family called "MyFont-BoldItalic".
  let name = stem;
  for (const pattern of [
    ITALIC_PATTERN,
    OBLIQUE_PATTERN,
    NUMERIC_WEIGHT,
    ...WEIGHT_WORDS.map(([word]) => axisPattern(word)),
  ]) {
    name = name.replace(pattern, "");
  }

  name =
    name
      .replace(/[-_]+/g, " ")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Custom";

  return { name, weight, italic };
}

const familyIdFor = (name: string) =>
  `${CUSTOM_FONT_PREFIX}${name.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "")}`;

export async function addCustomFont(
  file: File,
  requested: CustomFontUpload = {},
): Promise<CustomFontVariant> {
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

  const guess = guessVariantFromFilename(file.name);
  const name = (requested.name ?? guess.name).trim() || "Custom";
  const weight = requested.weight ?? guess.weight;
  const italic = requested.italic ?? guess.italic;

  const familyId = familyIdFor(name);
  // The CSS family is namespaced so an uploaded "Inter" cannot collide with the
  // built-in one and quietly restyle it.
  const family = `STW ${name}`;
  const variant: CustomFontVariant = {
    id: `${familyId}:${weight}:${italic ? "italic" : "normal"}`,
    familyId,
    family,
    name,
    weight,
    italic,
    dataUrl,
    format,
    bytes: file.size,
  };

  readPersistedCustomFonts();

  // Validate by actually loading it — a renamed archive must fail here, loudly,
  // rather than silently falling back to system-ui on the stage.
  if (typeof window !== "undefined" && "FontFace" in window) {
    try {
      const probe = new FontFace(family, `url(${dataUrl})`, {
        weight: String(weight),
        style: italic ? "italic" : "normal",
      });
      await probe.load();
      document.fonts.add(probe);
      registered.set(variant.id, Promise.resolve());
    } catch {
      throw new FontLoadError("That file could not be parsed as a font.");
    }
  }

  customFonts.set(variant.id, variant);
  persistCustomFonts();
  return variant;
}

/** True when a family already carries this exact weight and style. */
export function hasCustomVariant(name: string, weight: number, italic: boolean): boolean {
  readPersistedCustomFonts();
  return customFonts.has(`${familyIdFor(name)}:${weight}:${italic ? "italic" : "normal"}`);
}

export function removeCustomVariant(id: string): void {
  readPersistedCustomFonts();
  customFonts.delete(id);
  registered.delete(id);
  persistCustomFonts();
}

/** Drops a whole family, every uploaded weight and style with it. */
export function removeCustomFamily(familyId: string): void {
  readPersistedCustomFonts();
  for (const variant of [...customFonts.values()]) {
    if (variant.familyId === familyId) removeCustomVariant(variant.id);
  }
}

/** True when the face is large enough that persistence was skipped. */
export function isSessionOnly(font: { bytes: number }): boolean {
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
  /** Weights this face can actually render, not weights it can synthesise. */
  weights: readonly number[];
  italic: boolean;
  /** Every uploaded face behind this family; empty for a built-in. */
  variants: readonly CustomFontVariant[];
  custom: CustomFontFamily | null;
};

const FALLBACK_STACKS: Record<FontCategory, string> = {
  sans: "system-ui, -apple-system, Segoe UI, sans-serif",
  display: "Impact, system-ui, sans-serif",
  serif: "Georgia, Times New Roman, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export function resolveFont(fontId: string): ResolvedFont {
  if (fontId.startsWith(CUSTOM_FONT_PREFIX)) {
    const custom = getCustomFamily(fontId);
    if (custom) {
      return {
        id: custom.familyId,
        name: custom.name,
        family: custom.family,
        stack: `"${custom.family}", ${FALLBACK_STACKS.sans}`,
        category: "sans",
        // Exactly what was uploaded. Offering 100-900 for a single Regular file
        // is an invitation to pick a weight the browser can only fake.
        weights: [...new Set(custom.variants.map((variant) => variant.weight))].sort(
          (a, b) => a - b,
        ),
        italic: custom.variants.some((variant) => variant.italic),
        variants: custom.variants,
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
    variants: [],
    custom: null,
  };
}

/** The nearest weight a face actually ships. */
export function nearestWeight(weights: readonly number[], wanted: number): number {
  if (!weights.length) return wanted;
  if (weights.includes(wanted)) return wanted;
  return weights.reduce((best, weight) =>
    Math.abs(weight - wanted) < Math.abs(best - wanted) ? weight : best,
  );
}

export function googleFontHref(fontId: string): string | null {
  const font = FONT_INDEX.get(fontId);
  if (!font?.googleSpec) return null;
  return `https://fonts.googleapis.com/css2?family=${font.googleSpec}&display=swap`;
}

/* ------------------------------------------------------------------ *
 * Font requests
 * ------------------------------------------------------------------ */

/**
 * One face, fully specified.
 *
 * The unit of loading has to be the face, not the family. Loading was keyed by
 * font id alone, so selecting Poppins 600 and then Poppins 400 returned the
 * cached 600 promise and the timeline measured a variant that was not ready —
 * and every mask height in this app is derived from those measurements. Italic
 * was not part of the request at all.
 */
export type FontRequest = {
  fontId: string;
  weight: number;
  italic: boolean;
};

export const fontRequestKey = (request: FontRequest): string =>
  `${request.fontId}:${request.weight}:${request.italic ? "italic" : "normal"}`;

/** Collapses a list of requests to the distinct faces it actually needs. */
export function dedupeFontRequests(requests: readonly FontRequest[]): FontRequest[] {
  const byKey = new Map<string, FontRequest>();
  for (const request of requests) {
    const resolved = resolveFont(request.fontId);
    // Normalising here rather than at every call site: two layers asking for
    // 550 and 600 of a face that ships neither are one request, not two.
    const normalised: FontRequest = {
      fontId: request.fontId,
      weight: nearestWeight(resolved.weights, request.weight),
      italic: request.italic && resolved.italic,
    };
    byKey.set(fontRequestKey(normalised), normalised);
  }
  return [...byKey.values()].sort((a, b) => fontRequestKey(a).localeCompare(fontRequestKey(b)));
}

const loading = new Map<string, Promise<void>>();

/** How long a face gets before the editor stops waiting and renders anyway. */
export const FONT_LOAD_TIMEOUT_MS = 4000;

/**
 * Injects a family's stylesheet once and resolves when that exact face is
 * measurable.
 *
 * Resolving on `document.fonts.load` rather than on the link's load event
 * matters: the stylesheet arriving is not the same event as the woff2 being
 * ready to measure. The cache key is the whole request, so a second weight of
 * an already-loaded family is a real load and not a cache hit.
 */
export function loadFontRequest(request: FontRequest): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const key = fontRequestKey(request);
  const cached = loading.get(key);
  if (cached) return cached;

  const resolved = resolveFont(request.fontId);
  const style = request.italic ? "italic" : "normal";

  if (request.fontId.startsWith(CUSTOM_FONT_PREFIX)) {
    const family = resolved.custom;
    const variant = family ? pickCustomVariant(family, request.weight, request.italic) : null;
    const promise = variant ? registerCustomFace(variant) : Promise.resolve();
    loading.set(key, promise);
    return promise;
  }

  const href = googleFontHref(request.fontId);
  if (!href) return Promise.resolve();

  const promise = new Promise<void>((resolve) => {
    const id = `stw-font-${request.fontId}`;
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
      .load(`${style} ${request.weight} 1em "${resolved.family}"`)
      .then(() => resolve())
      .catch(() => resolve());

    window.setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
  });

  loading.set(key, promise);
  return promise;
}

/** Loads every distinct face a set of requests names. */
export function loadFontRequests(requests: readonly FontRequest[]): Promise<void> {
  return Promise.all(dedupeFontRequests(requests).map(loadFontRequest)).then(() => undefined);
}

/** Preconnect origins the export documents need. */
export const GOOGLE_FONT_PRECONNECT = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
] as const;
