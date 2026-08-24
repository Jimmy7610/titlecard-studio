# Testing

```bash
npm run check      # lint, unit tests, export checks, React type-check, build
npm run test:e2e   # browser tests, including the visual baselines
```

CI runs both on every push and pull request.

## The layers

**Unit** (`tests/`, `node:test` via `tsx`) — the pure halves. Segmentation,
persistence and migration, font request resolution, word-style remapping, the
export model, the ZIP writer and the memory budget.

**Codegen** (`scripts/check-exports.ts`) — every template times every export kind
times three phrases. Asserts the generated source contains its runtime prelude,
that the HTML body actually parses through `new Function`, and that a project
round-trips while a look never carries the words.

The bug this exists to prevent: the React export once omitted the runtime prelude
entirely, so every generated component referenced ~17 undefined identifiers. It
type-checked and shipped, because a string containing broken JavaScript is still
a valid string.

**Generated components** (`scripts/check-react.ts`) — writes real `.tsx` files
into the tree and runs the project's own `tsc` over them. "It is a valid string"
is not the bar; it has to compile in someone else's strict project.

**Browser** (`e2e/`, Playwright) — boot, all 28 templates, playback, editor
controls, persistence and migration, exports, keyboard behaviour, a small set of
accessibility invariants, and the three things only a layout engine can answer:
typography geometry (`typography.spec.ts`), layer position (`position.spec.ts`)
and the canvas overflow warning (`overflow.spec.ts`).

Anything measuring where type *sits* measures it at the resting frame, through
`freezeAtRest`. A running template deliberately puts glyphs outside their mask,
so a rectangle read mid-flight describes the animation rather than the layout —
which is the same distinction the overflow check itself is built on.

`e2e/a11y.spec.ts` is not a WCAG audit. It asserts the handful of properties that
have already regressed once each: every operable control has an accessible name,
the export dialog traps focus and closes on `Escape`, the transport slider is
keyboard-operable and reports its position, every settings slider is announced
by name rather than as an anonymous "slider", the split spans stay hidden from
assistive tech, and `prefers-reduced-motion` commits the resting frame.

## Why there is a browser suite at all

Nothing about "the glyph is inside its mask", "the rule clears the descenders" or
"the transport agrees with the timeline" is reachable without a browser, and
those are the bugs this project keeps having.

`e2e/templates.spec.ts` drives the template *registry* rather than clicking
twenty-eight gallery cards. A template added tomorrow is covered the moment it
lands, and one deleted stops being tested without anyone remembering to remove a
file.

## The visual suite

Eight screenshots. Deliberately few: a screenshot is the most expensive kind of
assertion to maintain, and a suite of forty is one nobody re-baselines honestly.

Determinism comes from three places:

1. **Fonts are served from a fixture.** `e2e/fixtures/fonts/` holds two Outfit
   subsets (SIL OFL), and `stubWebFonts` answers every Google Fonts request with
   them. A screenshot that depends on the network is a screenshot that fails on a
   bad day for reasons unrelated to the code.
2. **The timeline is parked on an exact time** through `StageHandle.settled()`
   and `seek`, not left running and hoped at.
3. **CSS animation is paused** before the shot, and the viewport is pinned in
   `playwright.config.ts`.

### Baselines are per platform

Font rasterisation is not portable, so Playwright suffixes baselines with the
platform (`-chromium-win32.png`, `-chromium-linux.png`). The repository carries
the ones that have been generated so far.

On a platform with no baseline, the visual specs write one and **fail** — that is
Playwright's behaviour and it is the right one, because silently accepting a new
baseline is how a visual suite stops meaning anything.

To add a platform's baselines:

```bash
npm run test:e2e:update   # writes them, then commit
```

In CI, a run on a platform without baselines uploads the generated snapshots as
the `playwright-snapshots` artifact. Download it, check the images actually look
right, and commit them once.

## Adding a test

- **A schema change needs a migration test.** Both directions: that the new shape
  round-trips, and that the old shape still opens.
- **A template needs nothing.** The registry-driven spec picks it up.
- **An export change needs a parity assertion**, not a snapshot of the output.
  What matters is that the preview and the export agree.
- **A geometry change needs a browser test at the resting frame.** Measuring
  while a template is playing is how a passing assertion ends up describing the
  animation instead of the layout.
