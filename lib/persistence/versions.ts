import {
  DEFAULT_BACKGROUND,
  DEFAULT_CANVAS,
  DEFAULT_COLOR,
  DEFAULT_MOTION,
  DEFAULT_TYPOGRAPHY,
} from "@/lib/project";
import { isBag, bagAt, type Bag } from "@/lib/persistence/readers";

/**
 * Version detection and shape migrations.
 *
 * Kept pure and away from the readers on purpose: a migration reshapes one
 * document into the *next version's field layout* and nothing more. Clamping,
 * defaulting and rejecting are the readers' job, and running them once at the
 * end means a v1 file and a v3 file go through exactly the same validation.
 */

export class PersistenceError extends Error {}

/** The schema a document claims, however it claims it. */
export function detectVersion(source: Bag): number {
  if (typeof source.schemaVersion === "number") return source.schemaVersion;

  const schema = source.$schema;
  if (typeof schema === "string") {
    const match = /@(\d+)$/.exec(schema);
    if (match) return Number(match[1]);
  }

  // The very first build wrote no version marker at all; a flat `phrase` field
  // is what identifies it.
  return "phrase" in source ? 1 : 0;
}

/** True when a document describes a whole project rather than a look. */
export function looksLikeProject(source: Bag): boolean {
  const schema = typeof source.$schema === "string" ? source.$schema : "";
  if (schema.includes("project")) return true;
  if (schema.includes("style-preset")) return false;

  // A v1 file called itself a preset but held the user's only copy of the
  // words, so it opens as a document. The picker confirms before replacing
  // anything, which is what makes that the safe reading rather than the lossy
  // one.
  if (typeof source.phrase === "string") return true;

  // Otherwise a project is the only document that carries layer text.
  const layers = Array.isArray(source.layers) ? source.layers : [];
  const carriesText = layers.some((layer) => isBag(layer) && typeof layer.text === "string");
  return carriesText || isBag(source.text);
}

/**
 * Reshapes a v1 preset into the v2 field layout.
 *
 * v1 was a flat settings dump with `type`/`motion` sub-objects and a `canvas`
 * that was a light/dark *string*. Everything it could express still exists, so
 * the migration is total — no v1 file loses information opening in v3.
 */
export function migrateV1Preset(source: Bag): Bag {
  const type = bagAt(source, "type");
  const motion = bagAt(source, "motion");

  return {
    schemaVersion: 2,
    name: typeof source.phrase === "string" ? source.phrase : "Imported preset",
    paletteId: source.palette,
    invertCanvas: source.canvas === "dark",
    gradientDigits: true,
    canvas: { ...DEFAULT_CANVAS },
    typography: {
      ...DEFAULT_TYPOGRAPHY,
      fontSize: type.fontSize,
      tracking: type.tracking,
      leading: type.leading,
      weight: type.weight,
    },
    motion: {
      ...DEFAULT_MOTION,
      speed: motion.speed,
      stagger: motion.stagger,
      loop: motion.loop,
    },
    color: { ...DEFAULT_COLOR },
    background: {
      ...DEFAULT_BACKGROUND,
      // v1 had no background system; the palette canvas tone was the whole of
      // it, and that is what `invertCanvas` still selects.
      mode: "solid",
      color: DEFAULT_BACKGROUND.color,
    },
    layers: [
      {
        name: "Headline",
        text: source.phrase,
        templateId: source.template,
        glyphPool: source.glyphPool,
        delay: 0,
        position: { anchor: "center", x: 0, y: 0 },
        typography: {},
        wordStyles: {},
        visible: true,
      },
    ],
  };
}

/**
 * True when a v3 document leans on the old, text-block-relative offset.
 *
 * The value itself does not move between v3 and v4 — there is nothing to
 * convert it *with*. The old unit was a percentage of the rendered text block,
 * and no file records the size of that block: it depends on the phrase, the
 * face, the weight, the tracking and the canvas. So the number is carried
 * across unchanged and the reader says so, rather than inventing a conversion
 * factor that would be wrong for every project that is not the one it was
 * tuned against.
 *
 * In practice the new reading is the one the value was reaching for. The old
 * unit could not move a short line far enough to clear another layer at any
 * setting the slider allowed.
 */
export function usesLegacyOffsets(source: Bag): boolean {
  const layers = Array.isArray(source.layers) ? source.layers : [];
  return layers.some((layer) => {
    if (!isBag(layer)) return false;
    const position = bagAt(layer, "position");
    const x = typeof position.x === "number" ? position.x : 0;
    const y = typeof position.y === "number" ? position.y : 0;
    return x !== 0 || y !== 0;
  });
}

/** Marks a v3 document as read; the offset fields are carried across as they are. */
export function migrateV3Project(source: Bag): Bag {
  return { ...source, schemaVersion: 4 };
}

/**
 * Reshapes a v2 document into the v3 project layout.
 *
 * v2 stored every phrase twice: once in `text.layers[]` and once in
 * `layers[].text`. v3 has one copy, on the layer. Where the two disagree the
 * layer wins, because that is the field the editor wrote last and the one the
 * session reader already preferred.
 */
export function migrateV2Project(source: Bag): Bag {
  const layers = Array.isArray(source.layers) ? source.layers : [];
  const mirrored = bagAt(source, "text");
  const mirroredLayers = Array.isArray(mirrored.layers) ? mirrored.layers : [];

  const merged = layers.map((layer, index) => {
    const bag = isBag(layer) ? layer : {};
    const twin = isBag(mirroredLayers[index]) ? (mirroredLayers[index] as Bag) : {};
    return {
      ...bag,
      text: typeof bag.text === "string" ? bag.text : twin.text,
      name: typeof bag.name === "string" ? bag.name : twin.name,
    };
  });

  // A v2 file whose only phrases lived in the mirror still has to open.
  const recovered =
    merged.length === 0 && mirroredLayers.length > 0
      ? mirroredLayers.map((layer) => (isBag(layer) ? { ...layer } : {}))
      : merged;

  const { text: _mirror, ...rest } = source;
  return { ...rest, schemaVersion: 3, layers: recovered };
}
