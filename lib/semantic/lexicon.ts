import type { PaletteId } from "@/lib/palettes";
import type { TemplateId } from "@/lib/templates";
import type { EasingId, TextTransform } from "@/lib/types";

/**
 * The semantic lexicon.
 *
 * A mood is the unit, not a template: "calm" implies a palette, a face, a
 * tempo and a background as much as it implies a motion. Keeping them together
 * is what lets one match produce a coherent look instead of a template swap
 * with everything else left at whatever it happened to be.
 *
 * Both English and Swedish are first-class. Swedish inflects heavily, so each
 * mood may also list stems — matched as prefixes against words of five letters
 * or more, which covers "lansering" / "lanserar" / "lanserat" without a table
 * of forms per verb.
 *
 * Words spelled the same in both languages are listed in both, deliberately:
 * matching deduplicates anyway, and it means editing one language's list
 * cannot silently break the other. What must never happen is one word
 * appearing under two different moods — a test enforces that.
 */

export type MoodId =
  | "authoritative"
  | "calm"
  | "machinic"
  | "terminal"
  | "numeric"
  | "editorial"
  | "luxury"
  | "energetic"
  | "future"
  | "organic";

export type MoodLook = {
  /** Ranked candidates. The first is the headline suggestion. */
  templates: readonly TemplateId[];
  paletteId: PaletteId;
  fontId: string;
  weight: number;
  tracking: number;
  transform: TextTransform;
  speed: number;
  stagger: number;
  easing: EasingId;
  invertCanvas: boolean;
  background: {
    mode: "solid" | "gradient" | "transparent";
    vignette: number;
    grid: number;
    glow: number;
    grain: number;
  };
};

export type MoodDefinition = {
  id: MoodId;
  label: string;
  /** Shown as the reason a suggestion was made. */
  reason: string;
  look: MoodLook;
  tokens: { en: readonly string[]; sv: readonly string[] };
  /** Prefix matches for inflected forms, five letters and up. */
  stems?: readonly string[];
};

export const MOODS: readonly MoodDefinition[] = [
  {
    id: "authoritative",
    label: "Authoritative",
    reason: "Corporate, product-launch wording",
    look: {
      templates: ["agent-reveal", "film-title", "dramatic-mask"],
      paletteId: "agent",
      fontId: "outfit",
      weight: 600,
      tracking: -0.025,
      transform: "none",
      speed: 1,
      stagger: 0.045,
      easing: "template",
      invertCanvas: false,
      background: { mode: "solid", vignette: 0, grid: 0.35, glow: 0, grain: 0 },
    },
    tokens: {
      en: ["agent", "corporate", "premium", "enterprise", "studio", "launch",
        "flagship", "official", "platform", "product", "release", "3"],
      sv: ["företag", "premium", "studio", "lansera", "lansering", "officiell",
        "plattform", "produkt", "släpp", "flaggskepp"],
    },
    stems: ["lanser", "företag", "produkt"],
  },
  {
    id: "calm",
    label: "Calm",
    reason: "Slow, unhurried wording",
    look: {
      templates: ["weightless-blur", "soft-reveal", "focus-in"],
      paletteId: "ice",
      fontId: "manrope",
      weight: 400,
      tracking: 0.02,
      transform: "none",
      speed: 0.75,
      stagger: 0.07,
      easing: "cinematic",
      invertCanvas: true,
      background: { mode: "gradient", vignette: 0.35, grid: 0, glow: 0.25, grain: 0 },
    },
    tokens: {
      en: ["calm", "smooth", "breathe", "soft", "slow", "quiet", "drift",
        "gentle", "flow", "rest", "still", "ease", "sleep"],
      sv: ["lugn", "lugnt", "mjuk", "mjukt", "långsam", "långsamt", "andas",
        "stilla", "tyst", "vila", "sakta", "sömn", "flyt"],
    },
    stems: ["långsa", "lugna", "andas", "stilla"],
  },
  {
    id: "machinic",
    label: "Machinic",
    reason: "Engineering and build wording",
    look: {
      templates: ["glitch-mask", "scanline", "data-stream"],
      paletteId: "terminal",
      fontId: "space-grotesk",
      weight: 600,
      tracking: 0,
      transform: "uppercase",
      speed: 1.25,
      stagger: 0.03,
      easing: "template",
      invertCanvas: true,
      background: { mode: "solid", vignette: 0.2, grid: 0.5, glow: 0, grain: 0.15 },
    },
    tokens: {
      en: ["tech", "build", "glitch", "hack", "code", "system", "protocol",
        "render", "compile", "machine", "engine", "deploy", "stack"],
      sv: ["teknik", "bygg", "bygga", "kod", "system", "protokoll", "maskin",
        "motor", "rendera", "kompilera"],
    },
    stems: ["bygga", "kodar", "maskin", "system"],
  },
  {
    id: "terminal",
    label: "Terminal",
    reason: "Boot and decode wording",
    look: {
      templates: ["glyph-decode", "terminal-type", "data-stream"],
      paletteId: "terminal",
      fontId: "jetbrains-mono",
      weight: 500,
      tracking: 0.04,
      transform: "uppercase",
      speed: 1.1,
      stagger: 0.035,
      easing: "template",
      invertCanvas: true,
      background: { mode: "solid", vignette: 0.3, grid: 0.4, glow: 0.15, grain: 0.2 },
    },
    tokens: {
      en: ["terminal", "decode", "boot", "init", "scan", "cipher", "signal",
        "loading", "shell", "console", "kernel", "encrypt"],
      sv: ["terminal", "avkoda", "starta", "uppstart", "skanna", "signal",
        "laddar", "konsol", "kryptera"],
    },
    stems: ["avkod", "krypte", "skanna"],
  },
  {
    id: "numeric",
    label: "Numeric",
    reason: "Counting and metrics wording",
    look: {
      templates: ["odometer-roll", "data-stream", "terminal-type"],
      paletteId: "mono",
      fontId: "jetbrains-mono",
      weight: 500,
      tracking: 0,
      transform: "uppercase",
      speed: 1.15,
      stagger: 0.04,
      easing: "template",
      invertCanvas: true,
      background: { mode: "solid", vignette: 0.2, grid: 0.45, glow: 0, grain: 0 },
    },
    tokens: {
      en: ["counter", "ticker", "count", "score", "stats", "metrics", "index",
        "total", "revenue", "growth"],
      sv: ["räknare", "poäng", "statistik", "mätvärden", "index", "total",
        "intäkter", "tillväxt"],
    },
    stems: ["räkna", "statis", "tillväx"],
  },
  {
    id: "editorial",
    label: "Editorial",
    reason: "Headline and feature wording",
    look: {
      templates: ["ribbon-wipe", "editorial-reveal", "light-sweep"],
      paletteId: "ember",
      fontId: "archivo",
      weight: 700,
      tracking: -0.03,
      transform: "none",
      speed: 0.95,
      stagger: 0.05,
      easing: "template",
      invertCanvas: false,
      background: { mode: "solid", vignette: 0, grid: 0, glow: 0, grain: 0 },
    },
    tokens: {
      en: ["headline", "feature", "highlight", "brand", "bold", "editorial",
        "reveal", "story", "issue", "cover"],
      sv: ["rubrik", "reportage", "varumärke", "berättelse", "avslöja",
        "utgåva", "omslag"],
    },
    stems: ["rubrik", "varumärk", "berätt"],
  },
  {
    id: "luxury",
    label: "Luxury",
    reason: "Exclusive, high-end wording",
    look: {
      templates: ["gold-sweep", "luxury-tracking", "editorial-reveal"],
      paletteId: "ember",
      fontId: "playfair",
      weight: 500,
      tracking: 0.14,
      transform: "uppercase",
      speed: 0.7,
      stagger: 0.08,
      easing: "cinematic",
      invertCanvas: true,
      background: { mode: "gradient", vignette: 0.45, grid: 0, glow: 0.2, grain: 0.12 },
    },
    tokens: {
      en: ["luxury", "couture", "atelier", "prestige", "exclusive", "elegant",
        "fine", "gold", "heritage", "maison"],
      sv: ["lyx", "exklusiv", "exklusivt", "elegant", "prestige", "guld",
        "arv", "förfinad"],
    },
    stems: ["exklusi", "elegan", "förfin"],
  },
  {
    id: "energetic",
    label: "Energetic",
    reason: "High-energy, creator wording",
    look: {
      templates: ["punch-words", "pop-caption", "zoom-impact"],
      paletteId: "plasma",
      fontId: "anton",
      weight: 400,
      tracking: -0.01,
      transform: "uppercase",
      speed: 1.5,
      stagger: 0.028,
      easing: "snappy",
      invertCanvas: true,
      background: { mode: "gradient", vignette: 0.3, grid: 0, glow: 0.4, grain: 0 },
    },
    tokens: {
      en: ["power", "energy", "boost", "hype", "viral", "impact", "now", "go",
        "fast", "wow", "insane", "huge"],
      sv: ["kraft", "energi", "fart", "snabb", "snabbt", "nu", "enorm",
        "grym", "grymt", "explosiv"],
    },
    stems: ["energi", "explos", "snabb"],
  },
  {
    id: "future",
    label: "Future",
    reason: "Forward-looking, AI wording",
    look: {
      templates: ["letterbox-reveal", "focus-in", "light-sweep"],
      paletteId: "ice",
      fontId: "space-grotesk",
      weight: 500,
      tracking: 0.08,
      transform: "uppercase",
      speed: 0.85,
      stagger: 0.055,
      easing: "cinematic",
      invertCanvas: true,
      background: { mode: "gradient", vignette: 0.4, grid: 0.25, glow: 0.3, grain: 0 },
    },
    tokens: {
      en: ["future", "tomorrow", "next", "ai", "neural", "intelligence",
        "beyond", "horizon", "vision", "space"],
      sv: ["framtid", "framtiden", "morgondagen", "nästa", "intelligens",
        "vision", "bortom", "horisont", "rymd"],
    },
    stems: ["framtid", "intellig", "horison"],
  },
  {
    id: "organic",
    label: "Organic",
    reason: "Natural, human wording",
    look: {
      templates: ["wave", "soft-reveal", "particle-assemble"],
      paletteId: "ember",
      fontId: "cormorant",
      weight: 500,
      tracking: 0.05,
      transform: "none",
      speed: 0.85,
      stagger: 0.06,
      easing: "smooth",
      invertCanvas: false,
      background: { mode: "solid", vignette: 0.25, grid: 0, glow: 0.15, grain: 0.18 },
    },
    tokens: {
      en: ["nature", "human", "hand", "craft", "grow", "seed", "earth",
        "water", "light", "warm"],
      sv: ["natur", "mänsklig", "hand", "hantverk", "växa", "frö", "jord",
        "vatten", "ljus", "varm"],
    },
    stems: ["hantver", "mänsk", "naturl"],
  },
] as const;

/** Every mood a template can be reached from, for the "why this?" copy. */
export const MOOD_INDEX = new Map(MOODS.map((mood) => [mood.id, mood]));

export function getMood(id: MoodId): MoodDefinition {
  return MOOD_INDEX.get(id) ?? MOODS[0];
}

export const LEXICON_SIZE = MOODS.reduce(
  (total, mood) => total + mood.tokens.en.length + mood.tokens.sv.length,
  0,
);
