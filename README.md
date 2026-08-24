# Titlecard

**A motion typography studio in the browser.** Type a phrase, pick a template,
and export it as a standalone page, a React component, GSAP source, a video or a
PNG sequence.

**Live demo:** https://titlecard-studio.vercel.app/

<!-- A recording of the editor belongs here. Repo-owned, not hotlinked. -->
<!-- ![Titlecard](docs/media/titlecard.gif) -->

Every reveal happens inside the word's own bounding box — nothing travels across
the stage — and the box is the font's own line box, so a descender is never
clipped and a tight leading never shrinks the mask. That single constraint is
what the rest of the design follows from.

## What it does

| | |
|---|---|
| **28 templates** | Six categories, from restrained reveals to seeded scatter. All data-driven from one `MotionSpec`. |
| **Typography** | 14 curated faces plus your own uploads, per weight and per style. Size, tracking, leading, case, italic, and the animated unit. |
| **Layers** | Each with its own text, template, timing, position and typography. Anchor to any of nine points, then nudge — the offset is a share of the canvas, so the same value moves a subtitle and a headline by the same distance. |
| **Word styling** | Colour, gradient, weight, size, glow, opacity and entrance delay, per word. |
| **Canvas** | YouTube, TikTok, square, portrait, cinema, or a custom size, with safe-zone guides. If a layer stops fitting, the canvas says so rather than quietly cropping it — and it never shrinks type you chose. |
| **Looks** | Palette, type, motion and background in one click. Applying one never touches your words. |
| **Smart Suggest** | Reads the phrase against an English and Swedish lexicon and *proposes*. It never locks the picker. |

## Exports

| Format | What you get |
|---|---|
| **Standalone page** | One `.html` that opens with a double-click. Loads GSAP and web fonts from the network — the file says so at the top. |
| **React component** | A `.tsx` client component that type-checks in a strict project. |
| **GSAP timeline** | The animation code alone, with your actual timing and easing. |
| **Titlecard project** | `.titlecard.json` — every layer, phrase and word style. |
| **Look** | `.titlecard-look.json` — the style, and none of your words. |
| **Video / PNG** | WebM or MP4 where the browser supports it, or a PNG sequence with alpha. |

## Run it

```bash
npm ci
npm run dev
```

Then open <http://localhost:3000>. Node 20+. Nothing else to configure — no API
keys, no backend, no accounts. Everything runs in the browser and the project
lives in `localStorage`.

## Tests

```bash
npm run check      # lint, unit tests, export checks, React type-check, build
npm run test:e2e   # browser tests, including the visual baselines
```

CI runs both on every push and pull request. See
[docs/TESTING.md](docs/TESTING.md).

## How it is built

Next.js 16, React 19, TypeScript, GSAP 3, Tailwind v4 and Base UI. No backend.

The rule the codebase is organised around: **the preview and every export read
the same thing.** A template is data (`MotionSpec`); the preview builds a GSAP
timeline from it, the code exporters print GSAP source from it, and the video
exporter records the timeline the preview built. The `.stw-*` CSS primitives are
one exported string that the editor injects and every export inlines. An exported
file cannot quote a different number from the one on screen.

Deeper detail:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the module map, the spec system, the stage
- [docs/TYPOGRAPHY.md](docs/TYPOGRAPHY.md) — the mask, the leading, the underline geometry, font loading
- [docs/EXPORTS.md](docs/EXPORTS.md) — what each format contains and what "standalone" means
- [docs/PRESETS-AND-PROJECTS.md](docs/PRESETS-AND-PROJECTS.md) — the three file formats, migration, untrusted input
- [docs/TESTING.md](docs/TESTING.md) — the test layers and how the visual baselines work
- [docs/ROADMAP.md](docs/ROADMAP.md) — known limitations and what is planned
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to add a template, and what a schema change owes

## Keyboard

| | |
|---|---|
| `Space` | Play / pause |
| `R` | Replay |
| `L` | Toggle loop |
| `←` `→` | Step one frame (`Shift` for ten) |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |

Bare-key shortcuts never fire while a control has focus, so `Space` still presses
the button you tabbed to and `R` still types an R.

## Accessibility

The split spans are hidden from assistive tech and the untouched phrase is
exposed once, so a screen reader announces "MOTION STUDIO" rather than thirteen
disconnected letters. Every control is labelled, the transport slider reports its
position, dialogs trap focus and close on `Escape`, and
`prefers-reduced-motion: reduce` commits the resting frame instead of animating.

## Deploying

The app is a static Next.js build with no server requirements.

```bash
npm run build
npm run start
```

The public deployment is available at https://titlecard-studio.vercel.app/.

On Vercel: import the repository, framework preset **Next.js**, build command
`npm run build`, no environment variables. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#deploying) for the detail.

## Licence

MIT. See [LICENSE](LICENSE).

The vendored test fonts in `e2e/fixtures/fonts/` are Outfit, under the SIL Open
Font License — see the licence note beside them.
