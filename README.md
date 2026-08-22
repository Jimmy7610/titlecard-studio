# Motion Typography Studio

A browser text-animation studio built on **Next.js 16**, **TypeScript**,
**Tailwind v4**, **GSAP 3** and **Base UI**. Type anything, pick any animation,
style it, and export it as a standalone page, a React component, a GSAP
timeline, a preset, a video or a PNG sequence.

```bash
npm install
npm run dev
```

Node 20+ (Tailwind v4). Open <http://localhost:3000>.

---

## The constraint everything is built on

Every reveal happens *inside the word's own bounding box*. No character travels
across the stage. The DOM every template animates against:

```html
<span class="stw-word">           <!-- overflow: hidden — the mask box -->
  <span class="stw-flash"></span> <!-- colour slab, behind the glyphs -->
  <span class="stw-char">         <!-- the transformed element -->
    <span class="stw-glyph"></span>  <!-- scramble overlay, absolute -->
    <span class="stw-real">A</span>  <!-- always holds the layout -->
  </span>
</span>
```

Four relationships carry the whole system.

**The mask is the font's own line box.** `.stw-word` is set to
`line-height: normal`, so it is exactly one line box tall — the typeface's own
content area, whatever face is loaded. A character parked at `translateY(110%)`
sits clear of it with headroom to spare, and a descender can never be clipped at
rest. Earlier versions pinned this to a constant calibrated against one typeface,
which clipped the tail of a `g` in anything with taller metrics.

**Leading is not the mask.** The leading slider sets the strut and a *negative
margin* (`calc((var(--stw-leading) * 1em - 1lh) / 2)`) split evenly above and
below the word. An inline-block contributes its margin box to the line box, so
lines pull as tight as `0.75` while the box the glyphs are clipped against never
shrinks. Tight display leading and intact descenders, both.

Splitting the correction rather than hanging all of it under the box is what
keeps the mask centred on the line: the block then overhangs its own glyphs by
the same amount at each end, so centring the block centres the type.

**Decorations are measured from the descent, not from the box.** The block's
bottom edge sits half a leading step above the last row's descent — exactly the
word box's own negative margin. The gradient rule adds that step back:

```css
top: calc(100% + (1lh - var(--stw-leading) * 1em) / 2 + var(--stw-underline-gap));
```

`1lh` there is the font's own content area, because the rule sets
`line-height: normal` on itself. So the rule lands on the descent in any face, at
any size, at any leading, and the only figure in it that is a design choice
rather than a font metric is the gap underneath. A fixed offset from the bottom
edge — which is what this used to be — draws the rule through every descender.

**The overlay never leaves the flow.** `.stw-real` always holds the layout, so
substituting a full-width `█` for an `i` during a decode cannot reflow the line —
the overlay is painted on top of a slot that is already the right size.

A handful of templates — the ones whose whole idea is oversize scale or a seeded
scatter — opt out of the clip with `unmasked: true`, because the mask does not
bound those, it amputates them.

---

## The editor

Nine sections on the left, the canvas in the middle, context settings on the
right, transport along the bottom.

| Section | What it holds |
|---|---|
| **Templates** | The full library as a gallery. Cards animate *your* phrase on hover. Favourites are kept locally. |
| **Text** | Phrase (multi-line), Smart Suggest, and the Style Director. |
| **Typography** | 14 curated faces plus your own uploads, size, weight, tracking, leading, alignment, case, italic, and the animated unit. |
| **Style** | Palette, dark canvas tones, and — behind a toggle — custom text/accent/gradient colours, glow, shadow, outline, opacity. |
| **Motion** | Speed, stagger, delay, easing, loop and hold. Surprise Me lives here. |
| **Background** | Solid, gradient, transparent or image, plus optional grid, vignette, accent glow, colour cloud and film grain. |
| **Canvas** | Format presets, custom size, aspect readout, orientation swap, safe zones. |
| **Layers** | Add, duplicate, reorder, hide and delete text layers; per-layer position, delay and size. |
| **Presets** | 14 built-in looks, your saved presets, and JSON import/export. |

The canvas is laid out at a real pixel width rather than scaled with a CSS
transform, because the display size is expressed in `cqw` against the canvas —
so the preview measures type exactly the way an export will, at any zoom.

---

## Templates

28 templates in six categories. Six are the originals, hand-written; the rest are
declarative `MotionSpec` data.

| Category | Templates |
|---|---|
| **Clean** | Fade Up · Focus In · Line Mask · Slide Reveal · Soft Reveal · Weightless Blur |
| **Cinematic** | Agent Reveal · Dramatic Mask · Film Title · Letterbox Reveal · Light Sweep |
| **Tech** | Data Stream · Glitch Mask · Glyph Decode · Odometer Roll · Scanline · Terminal |
| **Social** | Bounce Reveal · Pop Caption · Punch Words · Zoom Impact |
| **Luxury** | Editorial Reveal · Gold Sweep · Luxury Tracking · Ribbon Wipe |
| **Experimental** | Particle Assemble · Split Reveal · Wave |

**Every template works with every phrase.** Nothing is gated on the words you
typed — that gate is the single biggest thing this version removed.

### Adding one

Append a `MotionSpec` to `lib/templates/library.ts`. A spec is data: a list of
steps with targets, vars, durations in reference seconds and `each` as a
multiple of the project stagger. One description drives three consumers that
must never disagree — the preview builds a GSAP timeline from it, the code
exporters print GSAP source from it, and the video exporter records the timeline
the preview built. Numbers are resolved once, in `resolveStep`, and both the
builder and the printer consume that result, so exported code cannot drift away
from what you are watching.

The six original templates keep their imperative builders and their own
hand-written source strings, because each encodes a decision that reads as a bug
when generalised — the odometer's single driver for both reel offset and glyph,
the ribbon's explicit `set` where a `fromTo` would leave the slab at the baseline
opacity.

### Determinism

Nothing visual uses `Math.random`. Glitch clip paths, jitter, debris positions,
particle scatter and every scramble sequence come from a seeded `mulberry32`
(`lib/random.ts`). The scramble templates go further: the tween drives a plain
number and the glyph on screen is *derived* from it, so the rendered character is
a pure function of timeline progress — scrubbing backwards or restarting
reproduces the decode exactly.

---

## Smart Suggest and the Style Director

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

## Text handling

- **Grapheme segmentation** via `Intl.Segmenter`, with a hand-rolled cluster
  walk as a fallback rather than `Array.from` — which tears emoji ZWJ sequences,
  regional-indicator flags and combining marks into fragments.
- `RÄKSMÖRGÅS`, `COATOR ✨ STUDIO`, `AI → FUTURE` and `🔥 BUILD 🔥` all animate as
  the units a human would count.
- **Complex scripts are protected.** Arabic, Hebrew, Devanagari, Thai and their
  neighbours shape or reorder across characters, and an atomic inline-block
  cannot be bidi-reordered or joined. Those phrases are widened to whole-word
  boxes automatically and the layer is marked `dir="rtl"` where appropriate, so
  the text stays correct instead of rendering reversed and broken. The editor
  says when it has done this.
- The animated unit is also a manual choice: per character, per word, or one box
  for the whole line.

---

## Canvas formats

16:9 · 9:16 · 1:1 · 4:5 · 21:9 · custom, with YouTube, TikTok/Reels/Shorts,
Instagram square and portrait, and cinema presets. Safe-zone guides approximate
each platform's UI overlay; they are editing guides and are never exported.

---

## Presets and project state

- **14 built-in looks** — Cinematic Intro, Luxury Brand, AI Terminal, Soft
  Minimal, Cyber Decode, Editorial, Product Launch, Gaming Reveal, Calm Future,
  Creator Hook, Dark Technology, Neon Data, Minimal White, Ice Future.
- **Save your own**, with rename, duplicate and delete, kept in `localStorage`.
- **A preset is a look, never a document.** It carries no canvas size and no
  per-word styling, and applying one cannot take your phrase away. A file that
  *does* carry text says so and offers it as a separate action.
- **Versioned schema.** Files written by version 1 are migrated on import rather
  than rejected; a field from a newer build is ignored rather than fatal; an
  out-of-range number is clamped; a colour that could escape a stylesheet is
  refused; a remote background image is dropped rather than fetched on your
  behalf.
- **The session survives a refresh** — phrase, template, typography, colours,
  canvas, background, layers. Reset Project clears it, with a confirmation.
- **Undo/redo** with `Ctrl/⌘+Z` and `Ctrl/⌘+Shift+Z` (or `Ctrl+Y`). Slider drags
  coalesce into one entry.

---

## Export

| Output | What you get |
|---|---|
| **Standalone page** `.html` | A complete document — markup, CSS, fonts, GSAP from CDN. Opens with a double-click. |
| **React component** `.tsx` | A drop-in client component with the CSS inlined and the phrase pre-segmented. Needs `gsap` and `@gsap/react`. Compiles under strict TypeScript. |
| **Preset** `.json` | The full look, versioned and re-importable. |
| **GSAP timeline** | The timeline code on its own, to the clipboard, with your actual timing, stagger and easing. |
| **Video** `.webm` / `.mp4` | Recorded frame by frame from the running timeline. Only containers this browser will actually encode are offered. |
| **PNG sequence** `.zip` | Numbered frames with alpha, for an editor. |

All of them bake in the current phrase, layers, template, word styling and every
slider value.

**The video exporter does not screen-capture.** It seeks the real GSAP timeline,
reads the animated state back off the live DOM, and rasterises to a 2D canvas —
so nothing else on your machine can get into the clip, and a slow frame stretches
the export rather than dropping out of the video. Layout comes from the browser's
own `offsetLeft`/`offsetTop`, which are unaffected by transforms, so kerning,
tracking, font metrics and line breaking are the browser's, not a
reimplementation.

The `.stw-*` CSS has exactly one copy, in `lib/export/css.ts`. The editor injects
that string and every export inlines it, so a preview and an exported file cannot
drift apart through a stale stylesheet.

---

## Keyboard

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `R` | Replay |
| `L` | Toggle loop |
| `←` `→` | Step one frame |
| `Shift` + `←` `→` | Step ten frames |
| `Ctrl/⌘+Z` | Undo |
| `Ctrl/⌘+Shift+Z`, `Ctrl+Y` | Redo |

Bare-key shortcuts never fire while you are typing in a field.

---

## Accessibility

The split spans are hidden from assistive technology and the untouched phrase is
exposed once via `.stw-sr`, so a screen reader announces "MOTION STUDIO" rather
than thirteen disconnected letters. Controls are labelled, focus is visible,
every button is a real button, and sliders carry names.

`prefers-reduced-motion: reduce` skips timeline construction entirely and commits
the resting state instead of animating a shortened version. **Reduce preview
motion** in Motion → Advanced does the same on demand, without touching exports.

---

## Known limitations

Measured, not suspected.

**Per-character splitting costs kerning and ligatures.** Measured in Outfit,
`Toy` is 8.5% wider than unsplit text, `LTA` 9.9%, and the `fi` ligature never
forms. The effect is font-dependent — faces without kern pairs are unaffected.
Switch the animated unit to per word or per line if the measure matters more than
the motion.

**RTL and complex scripts animate per word, not per character.** This is a
deliberate downgrade, not a fix: an inline-block cannot participate in a shaping
run or be bidi-reordered, so per-character animation would render the text wrong.
Whole-word boxes shape and reorder internally and stay correct.

**Google Fonts is a network dependency.** The thirteen built-in web faces are
loaded on demand from `fonts.googleapis.com`. If it is blocked or offline the
editor falls back to the system stack rather than hanging — the loader gives up
after four seconds — but the preview will not match a machine that can reach it.
An uploaded font has no such dependency and is embedded in exports.

**Video export approximates three things.** Film grain is not painted (it is a
blend-mode overlay), a gradient-filled glyph gets a per-glyph gradient rather than
one spanning the whole line, and CSS filters other than `blur` are ignored.
Everything else — transforms, clip paths, colours, glow, outline, the decode
overlays, the debris — is read from the same elements the preview animates.

**GIF is not offered.** `MediaRecorder` cannot produce one, and a hand-rolled
quantiser and LZW encoder is a lot of surface area to get subtly wrong. WebM
covers the same ground with better quality, and the PNG sequence covers anything
an editor needs. MP4 appears only when the browser reports it can encode it —
which today means recent Chrome and Safari.

**Video is capped** at 900 frames and 30 seconds, and either canvas edge at
4096px, to keep the tab responsive.

**A custom font over ~1.6 MB is session-only.** It works for as long as the tab
is open and embeds into exports, but it is not written to `localStorage`, which
would blow the quota.

**Everything plays on mount.** There is no trigger model — no ScrollTrigger, no
in-view, no hover, no scrub — and no exit or reverse timeline in the exported
output. The editor's transport can scrub; the exports play and loop.

---

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

## Checks

```bash
npm run check
```

Runs lint, the unit tests, the codegen smoke test, the generated-React type
check, and the production build. Individually:

| Script | What it proves |
|---|---|
| `npm run test` | Segmentation, the bilingual lexicon, preset migration and validation, template and export configuration. |
| `npm run check:exports` | Every template × every export kind × three phrases holds together, the generated JavaScript parses, presets round-trip, v1 migrates, multi-layer emits. |
| `npm run check:react` | Every generated React component compiles under this project's strict TypeScript. |
| `npm run lint` | ESLint, including the React Compiler rules. |
| `npm run build` | The production build. |

`npx tsx scripts/emit-samples.ts public/__samples` writes real export artifacts
you can open in a browser — useful when a document parses fine and still renders
nothing.
