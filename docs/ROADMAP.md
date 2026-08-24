# Roadmap

What is knowingly wrong, what is planned, and what is only an idea. Nothing here
is hidden in a comment or a commit message.

Ranked P0 (correctness a user will hit) → P2 (nice to have).

## Known limitations

### P1 — a scaled word does not share the line's baseline

A word with a size multiplier sits about `0.1em` off the baseline of its
neighbours. It was most of an ascender before the mask box was bottom-aligned;
what remains is the difference in descent between the two sizes.

CSS cannot express a font's descent, and an inline-block that clips takes its
bottom margin edge as its baseline, so it cannot be baseline-aligned at all.

*Fix:* an inner mask element inside `.stw-word`, letting the outer box be
baseline-aligned. That is a markup change across three renderers plus the video
layout capture, so it needs its own change with its own visual baselines.

### P1 — the position offset is a percentage of the text block

`Offset X/Y` is a `translate()` percentage, which CSS resolves against the
element's own size. At the `±50%` the slider allows, a short line cannot be moved
far enough to clear another one, so layers can only really be separated with the
nine-point anchor.

The offset is also inconsistent between layers: the same value moves a large
headline further than a small one.

*Fix:* express the offset against the canvas. `cqh` would do it but needs
`container-type: size` on the canvas, which interacts with the `aspect-ratio`
sizing — worth doing, worth testing carefully, and it changes the composition of
every existing project, so it needs a migration.

### P1 — text larger than the canvas is clipped, with no warning

Size is explicitly canvas-relative (`cqw`), so a long phrase at a large size
overflows and `overflow: hidden` cuts it. That is the control behaving as
documented, but nothing says so at the moment it happens.

*Fix:* detect the overflow and surface it in the canvas panel. Auto-shrinking
would fight an explicit control and is the wrong answer.

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

- **Overflow warning** for text larger than the canvas (P1 above).
- **Canvas-relative offsets**, with a migration (P1 above).
- **An inner mask element**, to put scaled words on the shared baseline (P1 above).
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
| Scaled words sit ~0.1em off the shared baseline | `bug` `typography` `P1` | The P1 section above, with the inner-mask fix. |
| Position offsets are relative to the text block, not the canvas | `bug` `P1` | The P1 section above; note the migration requirement. |
| Warn when text overflows the canvas | `enhancement` `P1` | The P1 section above. |
| Write PNG sequences through the File System Access API | `enhancement` `P2` | Planned hardening above. |
| Add WebKit to the browser test matrix | `test` `P2` | Planned hardening above. |
| Generate Linux visual baselines | `test` `P2` | One-time: run CI, download the `playwright-snapshots` artifact, verify the images, commit. |
