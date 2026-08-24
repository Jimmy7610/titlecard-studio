# Changelog

## 1.0.0

The three P1 defects the roadmap had been carrying are fixed, each at its cause.
No new product surface.

### A scaled word sits on the shared baseline

A word with a size multiplier sat about `0.1em` below its neighbours. The cause
was structural rather than arithmetic: an inline-block whose `overflow` is not
`visible` takes its **bottom margin edge** as its baseline, so for as long as
`.stw-word` was both the layout box and the clipping mask, it had no text
baseline to align on. Equal-sized neighbours hid it — bottom-aligned and
baseline-aligned look identical when the boxes match — and a size multiplier
made the two disagree by the difference in descent.

The clip moved inward to a new `.stw-mask`. The word keeps `overflow: visible`
and its own strut, the strut sits on the glyphs' baseline, and
`vertical-align: baseline` means what it says at any size. The mask is
`vertical-align: top`, which is what leaves the strut to set the baseline.

The line box is unchanged: the word still contributes the same margin box, so
leading, wrapping, the underline and the tight-leading correction all measure
what they measured before. Every renderer emits the new element — the editor,
the standalone HTML, the React component, the GSAP source and the template
gallery — and the video layout capture clips to the mask rather than the word.

### Layer offsets are a share of the canvas

`Offset X` and `Offset Y` were a `translate()` percentage applied to the text
block, and CSS resolves a translate percentage against the element being
transformed. The same number therefore meant a different distance for every
phrase: an offset of 40 moved a one-line subtitle by about 5% of the canvas and
a four-line headline by four times that, and no value the slider allowed could
move a short line far enough to clear another layer.

The transform now sits on `.stw-layer`, which is `position: absolute; inset: 0`
— exactly the canvas box. `+10` on X is a tenth of the canvas width for a
subtitle and for a headline alike. Anchoring is unaffected: the flexbox that
places the block still runs inside the layer, so the anchor and the offset
compose the way they read. All nine anchors are tested with an offset.

This exposed a second bug nothing had reported. The raster exporters read
geometry through `offsetLeft`/`offsetTop`, which are layout values and blind to
transforms — right for glyph positions, wrong for the layer offset, because the
offset *is* a transform. **Video and PNG exports were dropping Offset X and Y
out of every frame.** The layer's translate is now read from its computed matrix
and applied once per layer while painting.

**Schema 4.** The shape did not change; the meaning did. The offset value is
carried across untouched and a file that used one opens with a warning saying
what changed and that the anchor did not. There is no honest conversion: the old
unit was a percentage of the rendered text block, and no file records that
block's size — it falls out of the phrase, face, weight, tracking and canvas. A
factor tuned against one project would be wrong for every other, silently.
Anchors are untouched, a layer with no offset is pixel-identical, and looks
carry no positions so v4 is a version bump and nothing else for them.

### The canvas says when the type no longer fits

Size is canvas-relative on purpose, so a phrase set large enough is cut by
`overflow: hidden`. That is the control behaving as documented; nothing said so
at the moment it happened. It is now reported under the canvas, in a live region
a screen reader announces, per layer, on both axes, naming the layer.

Nothing is auto-shrunk. The size is a control the user set deliberately.

The measurement is of layout boxes, not of what is on screen: almost every
template begins with its characters outside the canvas, so screen rectangles
would warn about every project for the first second and then stop. A layout box
ignores transforms and transforms are the whole animation, so it describes the
resting frame without pausing or seeking anything. The layer's own offset is
added back, so a layer nudged past the edge is caught too. It re-measures on the
phrase, the face, weight, size, tracking, leading, per-word multipliers, the
canvas format and the layer position, and again once the real face has loaded —
and it clears when the composition fits again.

The first measurement is synchronous rather than on a frame: `requestAnimation-
Frame` does not run in a tab that is not compositing, so a warning that waited
for a frame would never appear for anyone who set a composition up in a
background tab. It never writes to the DOM, it lives outside `.stw-canvas` where
the raster exporters cannot reach it, and exporting an overflowing composition
still works. All three are asserted.

### Accessibility

Every slider in the settings panels was announced as just "slider". The label
was on the Base UI root, but the element carrying `role="slider"` is the thumb,
so Size, Tracking, Leading, Speed and Stagger were all anonymous to a screen
reader. The label is forwarded to the thumb.

### Shared geometry

`staticRect` and the layer-translate read moved out of the video exporter into
`lib/geometry.ts`. The overflow check and the exporter now measure through the
same code rather than through two copies that could drift.

### Tests

103 unit tests and 71 browser tests, none skipped.

New: `e2e/typography.spec.ts` (baseline and mask geometry), `e2e/position.spec.ts`
(anchors, offsets, the raster capture, the v3 migration), `e2e/overflow.spec.ts`
(the warning). `tests/persistence.test.ts` gains the v4 migration cases.

Two existing tests were made deterministic rather than left to chance. The
timeline-slider accessibility test pressed a key while the composition was still
playing, so the time moved whether or not the key did anything — it pauses and
rewinds first now. The position specs stage their storage write on a page that
does not mount the editor, so the editor's own debounced save cannot land on top
of the seed.

One visual baseline changed. `multi-layer-scene` asked for `+40/-40` to separate
two layers and, under the old unit, barely moved them — the spec's own comment
said the offset could not do that job. It nudges by 8 from each anchor now and
renders as the scene always described.

## Production hardening

The engineering caught up with the scope. No new features; the work was making
the app harder to break, easier to test and honest about what it produces.

### Reproducibility and CI

`npm run check` was strong but only ran when someone remembered, and three of its
four steps began with `npx --yes tsx` — a tool resolved off the registry at run
time, so a clean clone could get a different version and a network hiccup could
fail the suite. `tsx` is pinned, `check:react` resolves the project's own `tsc`,
and GitHub Actions runs lint, unit tests, export checks, the generated-component
type-check, the production build and the browser suite on every push.

### Browser tests

36 Playwright tests: boot, all 28 templates in one registry-driven pass,
playback, editor controls, persistence and migration, exports, keyboard
behaviour, and 8 curated screenshots. The screenshots render against a vendored
font and a timeline parked at an exact frame, so they do not depend on the
network or on which frame the machine happened to be on.

### Fonts

The unit of loading is a face — family, weight and style — not a family. Loading
keyed by id alone returned a cached promise for the wrong variant, and the
timeline measures those variants to derive every mask height. Italic was never
requested at all, and the stage only ever asked for the project's default weight,
so a layer overriding either was measured against a face nobody had loaded.

Uploaded fonts became variants. A `.woff2` holds one weight and one style, but a
custom family advertised 100–900 and registered every upload under 400 normal, so
two uploads overwrote each other and any weight you picked was synthesised.

### Projects, looks and the session

One format was doing five jobs. Applying a saved "preset" could replace your
canvas and your layer structure, and every phrase was stored twice — which is
what forced an `as unknown as` at the serialisation boundary.

There are now three documents: a **project** (`.titlecard.json`, the whole
thing, replaces the canvas and asks first), a **look**
(`.titlecard-look.json`, style only, never touches your words), and the
**session** (a project file in `localStorage`). Storage keys walk backwards
through the versions they know, so a schema bump no longer abandons a project
that is still sitting in storage.

### Word styling

Styling is keyed by word index, so inserting a word before a styled one moved the
style to the wrong word. Edits are now diffed: styling follows its word, and a
word that cannot be matched confidently loses it rather than passing it to a
neighbour.

### Raster exports

A PNG sequence held every frame as a byte array until it had all of them — heap
that cannot spill to disk, and a 900-frame cap bounds nothing when 900 frames of
4K is not 900 frames of 360p. Frames now stream into the archive as blobs, the
job is costed in bytes before it starts, and both raster exports take an
`AbortSignal` with a Cancel button behind it. Cancelling stops the recorder,
stops every track, restores the timeline and downloads nothing.

### Honesty

"Standalone HTML" is one file, not an offline one: it fetches GSAP and its web
fonts. The generated file now lists exactly what it loads and how to make it
offline, and the export panel says the same thing.

### Accessibility

Every switch in the editor was unlabelled — Base UI puts the `id` on a hidden
checkbox, so `for=` named that rather than the button a user focuses.

### Documentation

The README became a product README. The architecture, typography, export,
persistence and testing detail moved to `docs/`, with `CONTRIBUTING.md` and a
`ROADMAP.md` that names the remaining limitations instead of burying them.


## Stabilisation pass on v2

A QA pass over the merged v2: every template, every face, every export path
driven in a real browser rather than read. No new features. Everything below is
a defect that was reachable from the UI.

### Typography

- **The gradient rule cut through descenders.** It was pinned `0.17em` above the
  block's bottom edge — but the block ends *above* the last row's descent, by
  the word box's own negative leading margin. The rule now adds that step back
  and reads the font's content area through `1lh`, so it clears the ink in every
  built-in face at every size and leading. Verified by measuring the rule
  against `actualBoundingBoxDescent` across 14 faces x 9 phrases x 7 size and
  leading combinations.
- **The leading correction is split above and below the mask** instead of hung
  entirely under it. The block now overhangs its glyphs equally at both ends, so
  a centred layer is centred on the type rather than roughly 0.09em below it.
- **The terminal caret rendered on a line of its own**, centred under the phrase
  rather than after it, and stretched the layer's box by a whole line — which
  pushed the text visibly off centre in every caret template. It is emitted
  inside the last line now, in the preview and in both exports.
- **A word carrying a size multiplier sat off the line's baseline** by most of
  an ascender. The mask box is bottom-aligned rather than top-aligned, which
  brings it to within a descender — the closest CSS can get for a box that clips.
- **The typeface picker kept a weight the new face does not ship**, so the
  control read 600 over a list whose only entry was 400 and the preview rendered
  a synthesised bold. Switching face now snaps to the nearest real weight.

### Export

- **The standalone page lost its typography entirely.** The layer's custom
  properties are written into a `style` attribute, and the font stack is quoted
  — so the attribute closed on `--stw-font:"` and everything after it (font,
  size, weight, tracking, leading, alignment) was dropped. Exported pages fell
  back to Times at 4rem. The attribute is escaped now.
- **The printed markup set every character a space apart** and every word three:
  a newline between two `inline-block` spans is collapsible whitespace, and it
  renders. The editor's JSX carries none, so the two disagreed by about 0.17em
  per glyph. The seams are HTML comments now, and the file stays readable.
- **Word styling reached React with CSS keys** (`font-size`, `text-shadow`),
  which logs "Unsupported style property" for every styled word — in the editor
  and inside the generated component. The exporters get CSS, React gets React.
- **The rasteriser read the font size out of a canvas `font` shorthand with
  `parseFloat`**, which is `NaN`, so the outline was always one pixel wide and
  the glow always one fixed radius whatever the type was set at.
- **A video exported at an aspect the canvas does not have left a transparent
  band** across the frame. The canvas is fitted and centred, and the background
  is painted across the whole frame behind it.
- **The video length defaulted to a constant four seconds**; it now starts from
  the animation's own duration.

### Editor

- **Space stopped activating any focused control.** The bare-key shortcuts
  preempted the default without checking what had focus, so Space, `r`, `l` and
  the arrow keys were taken from every button, switch, tab and select in the
  app. They only fire when nothing is listening for the key already.
- **Duplicating a layer gave the copy the original's id**, so React warned about
  the duplicate key, editing one edited both, and deleting one deleted both.
  `createLayer` now mints the id last and will not accept one.
- **The transport read its own buttons rather than the timeline.** Play/pause
  disagreed with reality after the Space shortcut, after `r`, and whenever a
  non-looping animation simply ended — and pressing play on a finished timeline
  did nothing at all. The playback rate also silently reset to 1x whenever the
  timeline was rebuilt while the control kept claiming 2x.
- **"Reset to palette" also switched off glow, drop shadow, outline and text
  opacity** — controls in a different section that have nothing to do with the
  palette.
- **The Surprise Me step arrows were live-looking controls that did nothing**
  before the first roll; they disable themselves now.
- **The word-styling panel kept its selection across a layer change**, pointing
  the controls at a different word.
- Preset import clamped every number to its own wider bounds, so a file could
  import a value no slider can reach and leave that control pinned at its end
  stop. Every clamp is the control's own range now.
- A preset describing more layers than the project has no longer drops them, and
  a saved preset offers the phrase it was saved with — which is what the panel
  already promised.
- The context panel starts closed below 1420px, where three columns leave the
  preview about 250px wide.

### Tests

`tests/export-parity.test.ts` covers the export defects above — the escaped
style attribute, the whitespace seams, the caret's position, React style keys,
and the two CSS invariants the underline geometry rests on. 52 tests to 58.

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
