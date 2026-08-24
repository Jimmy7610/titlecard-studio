# Exports

Six outputs, all built from one `ExportModel`.

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

The one thing a layout box cannot tell you is a layer's position offset, because
that *is* a transform. It is read back separately, from the layer's computed
matrix, and applied once per layer while painting. Until it was, video and PNG
exports silently dropped Offset X and Y out of every frame.

The `.stw-*` CSS has exactly one copy, in `lib/export/css.ts`. The editor injects
that string and every export inlines it, so a preview and an exported file cannot
drift apart through a stale stylesheet.

---

## What "standalone" means

The standalone page is **one file**, not an **offline** file. It inlines its
markup, CSS, colours and the whole timeline, and it fetches two things when it
opens:

- GSAP from cdnjs
- the Google Fonts stylesheet for any built-in typeface it uses

Uploaded faces are embedded as `@font-face` data URLs and need no network.

Every generated page lists its own dependencies in a comment at the top, so
someone archiving one can see what it needs and repoint the tags at local copies.

GSAP is not bundled into the artifact. That is a licensing decision, not a
technical one: embedding a third party's minified source into files this app
hands to users is redistribution, and the honest alternative is to say clearly
what the file loads.

## Raster exports

Frames are rasterised from the running timeline, not screen-captured, so a clip
is not affected by anything else on the machine. `lib/video/layout.ts` reads the
static geometry once through `lib/geometry.ts` — layout values, unaffected by
transforms — and only the animated part is recomputed per frame. The editor's
overflow check measures through the same module, so "does this fit" and "where
does this get painted" cannot answer from two different geometries.

Both raster exports take an `AbortSignal` and check it every frame. Cancelling
stops the recorder, stops every track, restores the timeline, releases the
scratch canvas and downloads nothing: a partial recording decodes as a broken
file. All of that runs in `finally`, so an error cleans up the same way.

### Memory

A PNG sequence is bounded in **bytes**, not just in frames. A frame cap alone
bounds nothing, because 900 frames of 4K is not 900 frames of 360p.

Frames are added to the archive one at a time and kept as `Blob`s, which live in
the browser's blob store and can spill to disk, rather than as `Uint8Array`s,
which are heap that cannot. The CRC is computed by streaming each blob once, so
peak heap is one chunk instead of one sequence.

On top of that the job is costed before it starts. A sequence projected past the
budget is refused with a message saying how large it would be and what to change,
and a run whose real output overshoots stops at the frame that crosses the line.

### Known differences from the preview

All deliberate, and all surfaced in the export panel:

- film grain is not painted (it is a blend-mode overlay)
- gradient-filled glyphs get a per-glyph gradient rather than one spanning the line
- CSS filters other than `blur` are ignored
