# Changelog

## v2 — Motion Typography Studio

A demo with six animations became an editor. Nothing that worked before was
removed; the four original export formats still work and are covered by tests.

### The headline change

**The semantic engine no longer locks anything.** It used to match a word and
*force* a template, so a phrase containing "system" could not be animated any
other way, and the template picker was disabled whenever it fired. It now
proposes: Smart Suggest offers a complete look with Apply / Regenerate / Ignore,
and the manual choice stands until Apply is pressed. Auto-apply exists and is off
by default.

### Architecture

**A declarative template system.** `lib/animation/spec.ts` describes a timeline
as data. One description drives three consumers that must never disagree: the
preview builds a GSAP timeline from it, the code exporters print GSAP source from
it, and the video exporter records the timeline the preview built. Durations are
resolved once, in `resolveStep`, and both the builder and the printer consume
that result — so adding a template adds it to every export at the same time, and
exported code cannot quote different numbers from the ones on screen.

The six original templates keep their imperative builders and their own
hand-written source strings. Each encodes a decision that reads as a bug when
generalised, and their motion and their output are unchanged.

**One copy of the CSS.** The `.stw-*` primitives lived in two places — a
stylesheet and a hand-kept duplicate inside the exporter — with a comment asking
future maintainers to keep them in step. They are now a single exported string in
`lib/export/css.ts` that the editor injects and every export inlines. There is
nothing left to keep in step.

**Structured project state.** A flat `GeneratorSettings` became `ProjectState`:
canvas, typography, motion, colour, background, and layers each with their own
template, delay, position and per-word styling.

### Fixed

- **The mask is no longer calibrated to one typeface.** It was pinned at
  `1.25em`, the height of Outfit's content area, which clipped descenders in any
  face with taller metrics — Poppins visibly. The word box is now
  `line-height: normal` with leading applied as `calc(var(--stw-leading) * 1em -
  1lh)`, so the clip box is derived from whatever font is loaded. Verified across
  the library: no glyph is clipped at rest, at any leading down to 0.75.
- **Grapheme segmentation.** `Array.from` tore emoji ZWJ sequences, flags and
  combining marks into fragments. `Intl.Segmenter` now does the splitting, with a
  cluster-walking fallback rather than a regression to code points.
- **RTL and complex scripts no longer render wrong.** Arabic came out reversed
  and 33% wider because atomic inline boxes cannot be bidi-reordered. Those
  phrases are now widened to whole-word boxes automatically, with `dir="rtl"`
  where appropriate, and the editor says it has done so.
- **The React export had no `@font-face`.** It set `font-family: Outfit` and
  loaded nothing, silently falling back to `system-ui`. It now documents the
  stylesheet it needs in a header comment, and embeds uploaded faces inline.
- **The React export did not type-check.** The emitted runtime prelude is
  JavaScript, so every `function rng(seed)` was an implicit-any error the moment
  it was pasted into a strict project — it ran fine and would not build. Codegen
  now emits type annotations for the TSX target. `npm run check:react` compiles
  all 29 generated components and keeps it that way.
- **Undo jumped to the wrong snapshot.** The history stack was pushed from inside
  a React state updater, and because React re-invokes updaters the stack picked
  up phantom entries. History is now part of the state and every transition is a
  pure function of the previous one.
- **The preview could fail to appear.** It waited for a `ResizeObserver`
  delivery, and those ride the rendering lifecycle — a container that is not
  compositing never delivers one. The frame is now measured synchronously on
  mount, with the observer only handling updates.

### Added

- 22 new templates (28 total) across Clean, Cinematic, Tech, Social, Luxury and
  Experimental, with a gallery that animates *your* phrase rather than a fixed
  example.
- A three-panel editor with a dominant canvas, zoom and fit, transparency
  checkerboard, safe-zone guides, and a scrubbing transport with playback rate
  and frame stepping.
- Canvas formats: 16:9, 9:16, 1:1, 4:5, 21:9 and custom.
- 14 web faces loaded on demand, plus custom font upload embedded into exports.
- Full colour control — palette or custom text, accents, gradient, glow, shadow,
  outline, opacity — and a background system with solid, gradient, transparent
  and image modes plus optional grid, vignette, glow, colour cloud and grain.
- Per-word styling: colour, gradient fill, weight, size, glow, opacity, entrance
  delay and emphasis.
- Multiple text layers with their own template, delay, position and size.
- 14 built-in preset looks, saved presets with rename/duplicate/delete, and JSON
  import.
- Swedish across the whole lexicon, including stem matching for inflected forms.
- Style Director (free-text brief to a coherent look) and a Surprise Me that
  varies inside one style family.
- Session persistence, undo/redo, and a dismissible four-step onboarding strip.
- Video export (WebM, and MP4 where the browser can encode it) and PNG sequence
  export, both rasterised from the real timeline.

### Preset schema

Version 2. Sections are `canvas`, `typography`, `motion`, `color`, `background`,
`layers`, plus `paletteId`, `invertCanvas` and `gradientDigits`. Text rides along
under `text.layers` but is applied only when the user explicitly asks for it.

Version 1 files migrate on import — the migration is total, since everything v1
could express still exists. Unknown templates degrade, missing sections fall back
to defaults, out-of-range numbers are clamped, fields from a newer schema are
ignored with a warning, colours that could escape a stylesheet are refused, and
remote background images are dropped rather than fetched. Malformed input
produces a message, never a crash and never a half-applied project.

### Export compatibility

| Format | Status |
|---|---|
| Standalone HTML | Preserved. Now carries fonts, background layers, multiple layers and word styling. |
| React component | Preserved. Now type-checks, pre-segments the phrase, and documents its font requirements. |
| Preset JSON | Preserved. Now versioned, with v1 migration and import validation. |
| GSAP timeline copy | Preserved. Now reflects layers, word delays and the easing override. |
| WebM / MP4 | New. |
| PNG sequence | New. |

### Dependencies

None added. The ZIP writer for PNG sequences is 90 lines of stored-entry
encoding, because PNG is already deflated and a compression library would be
carried by everyone to serve one panel.

### Known limitations

See the Known limitations section of the README — per-character kerning loss, the
Google Fonts network dependency, the three approximations in video export, why
GIF is not offered, and the video size caps.
