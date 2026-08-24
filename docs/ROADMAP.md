# Roadmap

What is knowingly wrong, what is planned, and what is only an idea. Nothing here
is hidden in a comment or a commit message.

Ranked P0 (correctness a user will hit) → P2 (nice to have).

## Known limitations

### Closed in 1.0

Three P1s were listed here and are now fixed. Each has tests; none is a
workaround.

- **A scaled word sat about `0.1em` off the shared baseline.** An inline-block
  that clips takes its bottom margin edge as its baseline, so the word box
  could not be baseline-aligned while it was also the clipper. The clip moved
  to an inner `.stw-mask`; the word keeps its own strut and its baseline.
  See [TYPOGRAPHY.md](TYPOGRAPHY.md#the-word-and-its-mask).
- **The position offset was a percentage of the text block.** A `translate()`
  percentage resolves against the transformed element, so the same number meant
  a different distance for every phrase. The transform moved onto `.stw-layer`,
  which is the canvas box. Schema 4, with a migration.
  See [PRESETS-AND-PROJECTS.md](PRESETS-AND-PROJECTS.md#version-4).
- **Text larger than the canvas was clipped with no warning.** It is reported
  under the canvas, per layer, on both axes, and it clears when the composition
  fits again. Nothing is auto-shrunk.

### P2 — raster export approximates three things

All deliberate, all surfaced in the export panel: film grain is not painted (it
is a blend-mode overlay), a gradient-filled glyph gets a per-glyph gradient
rather than one spanning the line, and CSS filters other than `blur` are ignored.

### P2 — video format support varies by browser

MP4 recording exists in some builds and not others. The panel probes
`MediaRecorder.isTypeSupported` and only offers containers the browser will
actually encode, so there is no broken button — but a user on a browser with
neither gets the PNG sequence and nothing else.

### P2 — visual baselines exist only for the platforms that have run them

Font rasterisation is not portable, so screenshots are per platform. A platform
with no baseline fails on first run rather than silently accepting one. See
[TESTING.md](TESTING.md#baselines-are-per-platform).

## Planned hardening

- **File System Access API** for PNG sequences where it exists, writing frames
  straight to a directory instead of building an archive in memory at all. The
  current streaming archive is bounded; this would make it unbounded.
- **A second browser in CI.** The suite is Chromium-only. WebKit would be the
  useful addition, since it is furthest from Chromium on font metrics and on
  `MediaRecorder`.

## Future ideas

Product work, not hardening. Out of scope for the current branch.

- `IN → HOLD → OUT` phases, so a title can leave as well as arrive
- Trigger points and scroll/viewport binding
- Batch export across canvas formats in one pass
- Audio and beat sync
- Shareable project links

## Suggested issues

The maintainer may want these as tracked issues. They are listed here rather than
filed automatically.

| Title | Label | Body |
|---|---|---|
| Write PNG sequences through the File System Access API | `enhancement` `P2` | Planned hardening above. |
| Add WebKit to the browser test matrix | `test` `P2` | Planned hardening above. |
| Generate Linux visual baselines | `test` `P2` | One-time: run CI, download the `playwright-snapshots` artifact, verify the images, commit. |
