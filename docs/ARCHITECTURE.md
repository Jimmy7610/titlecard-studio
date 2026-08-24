# Architecture

## The shape of it

```
app/                 the Next.js route; one page
components/editor/   the editor shell, panels and the stage
hooks/               project state, history, persistence
lib/animation/       MotionSpec, the runtime builder and the source emitter
lib/export/          the export model and the four generated documents
lib/persistence/     the three file formats and their migrations
lib/templates/       the template registry
lib/video/           raster export: layout capture, painting, zip
e2e/                 browser tests and the curated screenshot baselines
tests/               unit tests
scripts/             codegen checks and sample emission
```

## One source of truth, three consumers

The rule the whole codebase is organised around: **the preview and every export
read the same thing**, so they cannot disagree about what the user is looking at.

`lib/animation/spec.ts` describes a timeline as data. `resolveStep` turns one
step plus the project's tempo into concrete numbers, exactly once. Three
consumers read that result:

- `lib/animation/runtime.ts` builds a real GSAP timeline for the preview
- `lib/animation/emit.ts` prints GSAP source for the code exports
- `lib/video/` records the timeline the preview built

Adding a template adds it to every export at the same time, and an exported file
cannot quote a different number from the one on screen.

The six original templates keep hand-written builders and hand-written source
strings. Each encodes a decision that reads as a bug when generalised, and their
motion and their output are deliberately unchanged.

The same rule applies to CSS. The `.stw-*` primitives are a single exported
string in `lib/export/css.ts` that the editor injects and every export inlines.
There is nothing to keep in step.

## The stage

`components/editor/stage.tsx` owns one master timeline; each layer contributes a
child timeline at its own offset. Nothing re-renders on a frame — the transport
reads `timeline()` through a handle, so dragging the scrubber or running a
twenty-second loop costs zero React work.

The timeline is rebuilt when anything it *measures* changes. That digest
includes typography, because GSAP resolves `yPercent` to pixels at build time:
building against the outgoing font's box bakes a stale offset in. The build also
waits two animation frames after the faces load, because `document.fonts.ready`
resolves when a face has downloaded, not when the stylesheet has been applied to
these elements.

`StageHandle.settled()` resolves when the faces are measurable and the build has
painted. The export paths and the browser tests both need that point.

## Project state

`hooks/use-project.ts` holds the project, an undo stack and the debounced save.

History is a plain snapshot stack, not a command architecture: the state is a
few kilobytes of JSON and undo is "put the old object back". The stack lives
inside React state rather than in a ref beside it, because React re-invokes
updaters and a ref picked up phantom entries.

Edits sharing a tag inside a short window coalesce into one history entry, which
is what stops a slider drag filling the stack with forty frames.

Every update passes through `reconcileWordStyles`, which carries per-word styling
across a text edit. It lives there rather than in the text field because every
route that can change a phrase has to go through it — a rule enforced at one call
site has as many holes as there are other call sites.

## Layout

```
app/               layout (theme, fonts), page, globals.css (editor chrome only)
components/
  editor/          shell, canvas viewport, stage, transport, panels, dialogs
  ui/              Base UI primitives
hooks/             use-project (state + history), use-client-value
lib/
  animation/       spec, runtime builder, source emitter, effects, units, timing
  templates/       types, legacy (the six originals), library (spec templates)
  semantic/        lexicon (EN + SV), engine (suggest, director, surprise)
  export/          model, css, markup, runtime, legacy-source, timeline, documents
  presets/         schema (versioning + validation), builtin
  video/           layout capture, canvas painter, recorder, zip
  fonts, palettes, theme, split, segment, canvas-formats, easing, project, storage
scripts/           check-exports, check-react, emit-samples
tests/             segmentation, semantic, presets
```

## Semantic engine

The old semantic engine matched a word and *forced* a template, which meant a
phrase containing "system" could not be animated any other way. It now only ever
proposes.

- **Smart Suggest** reads the phrase against a bilingual lexicon and offers a
  complete look — animation, palette, typeface, tempo, stagger, tracking,
  background — with **Apply**, **Regenerate** and **Ignore**. Your manual choice
  stands until you press Apply.
- **Auto-apply** exists, off by default.
- **Style Director** takes a free-text brief ("calm futuristic AI launch"),
  scores every mood it touches and blends the top two. Structure comes from the
  primary mood; only the continuous quantities are averaged, because
  interpolating the categorical choices would produce a serif terminal in a
  plasma palette — not a blend of two looks but the absence of either.
- **Surprise Me** picks a style family and varies *inside* it, so a calm look
  never gets an elastic bounce. Previous/next step through the variations.

Ten moods, English and Swedish. Swedish inflects heavily, so each mood may list
stems matched as prefixes against words of five letters or more — `lanser`
covers *lansering*, *lanserar*, *lanserat* without a table of forms per verb.
Matching is on whole normalised words, so `technique` still does not trigger
`tech`.

Everything runs locally. No API key, and no network call. `direct(brief)` has
the signature a hosted model would fill later — brief in, look out — so adding a
provider is a swap in one function rather than a rewrite upstream.

---

## Deploying

A static Next.js build. No server, no environment variables, no runtime
configuration.

```bash
npm ci
npm run build
npm run start
```

On Vercel: import the repository and accept the Next.js preset. There is nothing
to add.

### The Turbopack root pin

`next.config.ts` pins `turbopack.root` to the repository directory. Turbopack
infers the workspace root by walking upwards looking for a lockfile, so a clone
nested under another JavaScript project — a monorepo, or a `~/projects` folder
with a stray `package-lock.json` — can have its root inferred somewhere
unhelpful. Pinning it makes the build depend on the repository and nothing above
it, which is the property a clean clone needs.
