# Typography

Every reveal happens inside the word's own bounding box. No character travels
across the stage. That one constraint is what the rest of this document is
about, because everything hard here follows from it.

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

## Fonts

The unit of font loading is a **face** — a family, a weight and a style — not a
family. `FontRequest` in `lib/fonts.ts` is that triple, and the load cache is
keyed by all three.

This matters because the mask height is measured from real font metrics. Loading
keyed by family alone meant selecting Poppins 600 and then Poppins 400 returned
the cached 600 promise, and the timeline could be built against a variant that
was not measurable yet — a stale box height parks every glyph outside its own
mask and the line renders blank.

`projectFontRequests(project)` collects every face a project actually renders:

- the project default typography
- every layer's resolved typography, so an override wins the way it does on screen
- every per-word weight, because a heavy word shares a line with its neighbours

Each request is normalised onto a weight the face actually ships before it is
deduplicated, so two layers asking for 550 and 600 of a single-weight face are
one request rather than two that can never resolve.

### Uploaded fonts

A `.woff2` holds one weight and one style. A custom family is therefore a set of
**variants**, each carrying its own weight, style and bytes, registered with
explicit `FontFace` descriptors and exported as its own `@font-face`.

The picker offers exactly the variants that were uploaded. Offering 100–900 for
a single Regular file invites picking a weight the browser can only synthesise,
and a synthesised weight is not reproducible by the raster exporters — the export
panel warns when a project is asking for one.

The weight and style are guessed from the filename and confirmed by the user.
Reading them out of the binary would mean shipping a font parser, which is a
large dependency for a guess that the user can correct in one control.

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
