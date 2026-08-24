# Contributing

```bash
npm ci
npm run dev          # http://localhost:3000
npm run check        # lint, unit tests, export checks, React type-check, build
npm run test:e2e     # browser tests
```

`npm ci` installs everything the checks need. Nothing fetches a tool at run time.

## Branches

Work on a branch off `main` and open a pull request. CI has to be green.

Prefer a few comprehensible commits over one opaque one or fifty micro-commits.
A commit message should say what was wrong, not just what changed.

## The rule that shapes most reviews

**The preview and every export read the same thing.**

A template is data. `resolveStep` turns it into concrete numbers once, and the
preview builder, the source emitters and the video recorder all consume that
result. If a change makes an exporter compute its own timing, colour or geometry,
it has introduced a second source of truth and the two will drift.

The same applies to CSS: `SPLIT_PRIMITIVES_CSS` is one string. Do not add a
second copy of a `.stw-*` rule anywhere.

## Adding a template

Add a `MotionSpec` entry to `lib/templates/library.ts`. That is usually all.

- The registry-driven browser test picks it up automatically — no new spec file.
- Durations are written at the reference tempo (speed 1); `each` is a multiple of
  the project stagger, so the Motion panel scales every template the same way.
- If the reveal is about oversize scale or a seeded scatter, set
  `unmasked: true`. The mask does not bound those, it amputates them.
- Run `npm run check:exports` — it renders your template through every export
  kind against three phrases, including one with a grapheme `Array.from` would
  tear in half.

The six original templates keep hand-written builders. Do not generalise them
without a reason beyond tidiness; each encodes a decision that reads as a bug
when generalised.

## Changing the schema

A schema change owes three things:

1. A migration in `lib/persistence/versions.ts`. Migrations reshape and nothing
   else — clamping and defaulting are the readers' job, so every version goes
   through the same validation.
2. The old storage key added to `SESSION_KEYS` / `PRESET_KEYS` in
   `lib/storage.ts`. A reader that only looks at the current key abandons the
   user's project the moment the schema moves.
3. Tests in `tests/persistence.test.ts`, both directions: the new shape
   round-trips, and the old shape still opens with its content intact.

Applying a **look** must never change text, canvas or layer structure. There is a
test that says so; if you find yourself wanting to relax it, what you have is a
project file, not a look.

## Touching typography

Mask height, leading and the underline are derived from font metrics, not from
constants. A fix that only looks right in Outfit is not a fix — the app ships
fourteen faces and accepts uploads.

If you change any of that geometry, re-run the visual baselines and *look at the
images* before committing them.

## Untrusted input

Preset and project files are data the app did not write. Read every field through
`lib/persistence/readers.ts`. Colours are matched against an allowlist and
rejected rather than sanitised; remote URLs are dropped. Adding a field means
adding a reader for it.

## Accessibility

- A bare-key shortcut must not fire while a control has focus.
- Every control needs an accessible name. Watch for wrapper components that put
  the `id` on a hidden input — a `for=` label then names the input rather than
  the button the user actually presses.
- `prefers-reduced-motion: reduce` commits the resting frame rather than
  animating a shortened version of it.

## What not to send

This branch of the project is about being harder to break, not larger. Fifty more
templates, an API integration, accounts, a backend or a redesign are not small
pull requests — open an issue first.
