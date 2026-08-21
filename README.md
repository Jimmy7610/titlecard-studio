# titlecard

A title card is an animated wordmark that opens something. This generates them.

Bounded, mask-based typography animations built with **Next.js 16**, **TypeScript**,
**Tailwind v4**, **GSAP 3** and **shadcn/ui**.

Every reveal happens *inside the word's own bounding box*. No character ever
travels across the stage.

---

## The constraint

The DOM every template animates against:

```html
<span class="stw-word">           <!-- overflow: hidden — the mask box -->
  <span class="stw-flash"></span> <!-- colour slab, behind the glyphs -->
  <span class="stw-char">         <!-- the transformed element -->
    <span class="stw-glyph"></span>  <!-- scramble overlay, absolute -->
    <span class="stw-real">A</span>  <!-- always holds the layout -->
  </span>
</span>
```

Two relationships carry the whole system.

**The mask.** `.stw-word` is exactly `--stw-mask` em tall. A character parked at
`translateY(110%)` sits `1.1 ×` that height down — fully clear of the mask, with
headroom left over for the 5° rotation. `--stw-mask` is pinned at `1.25`, the
height of Outfit's own content area; measured below that, the tail of a `g` is
clipped at rest.

**Leading is not the mask.** The leading slider sets the strut and a *negative
margin-bottom* on the word. An inline-block contributes its margin box to the
line box, so lines pull as tight as `0.85` while the box the glyphs are clipped
against never shrinks. Tight display leading and intact descenders, both.

**The overlay.** `.stw-real` never leaves the flow, so substituting a full-width
`█` for an `i` during a decode cannot reflow the line — the overlay is painted
on top of a slot that is already the right size.

`lib/split.ts` produces this structure. It splits with `Array.from` so
astral-plane characters are not torn into surrogate halves, and it flags the
trailing digit run of the final word (`Agent 3` → `3`) for the
`background-clip: text` gradient.

## Templates

| Template | Family | Motion |
|---|---|---|
| **Agent Reveal** | mask | `translateY(110%) rotate(5deg)` → `0` on a sharp `CustomEase`. Colour resolves hot → ink, a gradient rule sweeps and retracts, pixel debris strobes. |
| **Weightless Blur** | mask | Characters surface from the lower half of the mask out of an 11px defocus. The blur halo is clipped by the mask — that clipping *is* the soft edge. |
| **Glitch Mask** | mask | Four seeded `inset()` clip paths per character, stepped rather than eased. Colour and jitter run on the same stepped clock. |
| **Ribbon Wipe** | mask | An accent ribbon sweeps each word and leaves the letters behind it. Glyphs are tinted to the canvas colour under the ribbon, so they read as knocked out of the block. |
| **Glyph Decode** | terminal | TUI scramble. Each slot cycles the glyph pool at ~22 swaps a second, then locks with a stepped colour flash. A block cursor blinks until the last slot resolves. |
| **Odometer Roll** | terminal | A reel of glyphs rolls down through each slot before the real character lands. The mask is what clips the reel — the template that shows most directly why it exists. |

Add one by appending a `TemplateDefinition` to `lib/templates.ts`. Each receives a
`gsap.core.Timeline` plus resolved character, word, debris, underline and cursor
nodes, the live canvas palette, and the active glyph pool.

### Determinism

Nothing visual uses `Math.random`. Glitch clip paths, jitter, debris positions
and every scramble sequence come from a seeded `mulberry32` (`lib/random.ts`).

The scramble templates go further: the tween drives a plain number and the glyph
on screen is *derived* from it. The rendered character is therefore a pure
function of timeline progress — scrubbing backwards or restarting reproduces the
decode exactly, which picking a glyph inside `onUpdate` would not.

## Semantic engine

`lib/semantic-engine.ts` matches **whole normalised words** against a lexicon —
never substrings, so `technique` does not trigger the `tech` rule. The template
with the most hits wins; ties break toward the earliest match. When nothing
matches, the manual selection is used.

| Group | Forces | Tokens |
|---|---|---|
| Authoritative | Agent Reveal | agent, corporate, premium, enterprise, studio, launch, flagship, `3` |
| Atmospheric | Weightless Blur | calm, smooth, breathe, soft, slow, quiet, drift, gentle, flow |
| Machinic | Glitch Mask | tech, build, glitch, hack, code, system, protocol, render, compile |
| Terminal | Glyph Decode | terminal, decode, boot, init, scan, cipher, signal, loading, shell |
| Numeric | Odometer Roll | counter, ticker, count, score, stats, metrics, index, total |
| Editorial | Ribbon Wipe | headline, feature, highlight, brand, bold, editorial, reveal |

## Palettes

Six ramps in `lib/palettes.ts`, each with light and dark canvas tones: **Agent**
(sampled from the reference clip), **Terminal**, **Plasma**, **Ice**, **Ember**,
**Mono**. They are written as inline custom properties on the stage, so a swap is
one style update rather than a cascade of selectors — and because colour tweens
read their targets back off the live canvas, switching palette retints the
animation rather than fighting it.

## Export

| Output | What you get |
|---|---|
| **Standalone page** `.html` | A complete document — markup, CSS, GSAP from CDN. Opens with a double-click. |
| **React component** `.tsx` | Drop-in client component with the CSS inlined. Needs `gsap` and `@gsap/react`. |
| **Preset** `.json` | Just the settings, for sharing a look. |
| **Copy GSAP timeline** | The timeline code on its own, to the clipboard. Runs against the exported markup. |

All four bake in the current phrase, template, palette and every slider value.
The generated timelines are real, runnable code rather than illustrative
snippets — `lib/export.ts` owns the codegen so `lib/templates.ts` stays about
motion.

> The `.stw-*` CSS in `lib/export.ts` is a deliberate copy of the rules in
> `app/globals.css`: an exported file has to stand alone with no build step, and
> a stylesheet cannot be imported into TypeScript as a string. Keep the two in
> step when the split primitives change.

## GSAP lifecycle

`useGSAP` from `@gsap/react` is the cleanup mechanism — a `useLayoutEffect`
wrapped in a `gsap.context`, so every tween created inside it reverts on unmount.
Three details matter:

- **`revertOnUpdate: true`.** `useGSAP` reverts on unmount but *not* on
  dependency change unless told to. Without it, switching templates leaves a
  stale `filter` or `clip-path` on a character.
- **Glyph overlays are cleared by hand.** `revert` restores inline styles, not
  `textContent`. The stage empties every overlay before and after each build.
- **Deferred unhide.** The markup renders with the finished text in the DOM. The
  visual layer stays `visibility: hidden` until the timeline's initial state is
  committed inside the layout effect — before the browser paints — so the
  resting text is never flashed. The accessible phrase sits outside that wrapper
  and is always exposed.

`prefers-reduced-motion: reduce` skips timeline construction entirely and commits
the resting state instead of animating a shortened version.

## Known limitations

These are measured, not suspected. Read them before adopting the export.

**The mask height is calibrated to one typeface.** `--stw-mask: 1.25` is Outfit's
content area. Other faces measure differently — Inter 1.21, Playfair 1.33,
Poppins 1.40, Noto Sans Thai 1.51, Noto Sans Arabic 2.11. Below the required
height a font's descenders are clipped at rest; Poppins clips visibly. The fix
is known and not yet applied: `line-height: normal` plus
`margin-bottom: calc(var(--stw-leading) * 1em - 1lh)` derives the box per font
in pure CSS, with no measurement and no flash-of-unstyled-text window.

**Right-to-left scripts do not work, in two independent ways.** With Arabic the
mask is far shorter than the content area, so `translateY(110%)` no longer hides
the glyph and the text is visible before the animation starts — the core premise
fails. Separately, wrapping each character in its own inline-block breaks the
shaping run: `مرحبا` renders as `ابحرم`, reversed and 33% wider, because atomic
inline boxes cannot be bidi-reordered. `Intl.Segmenter` does not fix this. RTL
needs whole-word animation instead of per-character.

**Per-character splitting costs kerning and ligatures.** Measured in Outfit:
`Toy` is 8.5% wider than unsplit text, `LTA` 9.9%, and the `fi` ligature never
forms. The effect is font-dependent — faces without kern pairs are unaffected.

**Grapheme clusters are split by code point.** `lib/split.ts` uses `Array.from`,
which tears emoji ZWJ sequences, combining diacritics, Devanagari clusters and
Thai into fragments. `Intl.Segmenter` with `granularity: "grapheme"` fixes all of
these.

**The React export ships no `@font-face`.** It sets `font-family: Outfit` but
loads nothing, so it silently falls back to `system-ui` and does not match the
preview. The standalone HTML export does load the font correctly.

**The variable font axis is discarded.** `Outfit()` declares four discrete
weights that all resolve to the same variable `woff2`. Declaring
`font-weight: 100 900` instead would expose `wght` as a continuously animatable
axis — arguably the most interesting unexploited axis for this kind of work.

**Everything plays on mount.** There is no trigger model — no ScrollTrigger, no
in-view, no hover, no scrub — and no exit or reverse timeline. The handle exposes
`replay()` only.

**The glyph pools fall outside the loaded subset.** The Blocks and Katakana pools
are outside `latin`, and Outfit has no such glyphs, so scramble characters render
in a fallback face with a different baseline before locking back to Outfit.

## Running it

```bash
npm run dev
```

Requires Node 20+ (Tailwind v4). Press <kbd>R</kbd> anywhere outside a field to
replay.

## Layout

```
app/            layout (fonts, theme), page (state), globals.css
components/     animation-stage, control-panel, split-text, ui/ (shadcn)
hooks/          use-split-text  (React wrapper over lib/split)
lib/            templates, semantic-engine, palettes, glyphs, export,
                split, settings, debris, random, gsap
```
