# Projects, looks and the session

Titlecard reads and writes three documents. They used to be one format doing all
three jobs, which is why applying a saved "preset" could replace your canvas and
why every phrase was stored twice.

| | What it is | Applying it |
|---|---|---|
| **Project** `.titlecard.json` | The whole document | Replaces the canvas. Asks first. |
| **Look** `.titlecard-look.json` | Style only | Never touches words, canvas or layers |
| **Session** `localStorage` | A project file | Restored on load |

## Project files

Everything the editor is showing: the canvas, every layer with its own text,
template, timing, position, typography overrides and word styling, plus the
project-wide type, motion, colour and background — and which layer was active.

There is **one copy of each phrase**, on its layer. v2 kept a second copy under
`text.layers[]`, which is what forced an `as unknown as` at the serialisation
boundary to make the two agree.

Layer ids are minted per session and are not stored. A file references the active
layer by position, and a crafted file cannot collide two layers onto one identity.

## Looks

A look is palette, typography, motion, colour, background, and the template that
carries them. It carries no words, no canvas and no layer structure.

Only the **active** layer takes the template. Stamping one motion idea across
every layer of a composed scene would be a document edit wearing a preset's
clothes.

Looks written by v1 and v2 could carry a phrase. It is offered separately, never
applied.

## What the session persists

Deciding this explicitly is the point; persisting everything is how an editor
ends up restoring a half-finished drag.

**Document state — persisted.** Canvas, layers, every phrase, positions,
templates, timing, word styling, typography, colour, background, and which layer
was active.

**Editor preferences — persisted.** Semantic suggestion settings, reduced preview
motion. They belong to the user rather than the document, but restoring them is
what makes the editor feel like the one they left.

**Transient UI — not persisted.** Playhead position, playback rate, which panel
is open, which word is selected, an open popover, a drag in progress, export
progress. None of it describes the work; restoring it would be restoring a moment
rather than a project.

## Migration

Version detection and shape migrations live in `lib/persistence/versions.ts` and
are pure. A migration reshapes one document into the next version's field layout
and nothing more — clamping, defaulting and rejecting are the readers' job, so a
v1 file and a v3 file go through exactly the same validation.

- **v1** was a flat settings dump with a `phrase` and a light/dark `canvas`
  string. It carried the user's only copy of the words, so it opens as a project.
- **v2** stored the phrases twice and lived under different storage keys. Where
  the two copies disagree the layer wins.
- **v3** is the split above.
- **v4** did not change the shape at all.

<a id="version-4"></a>

### Version 4: same fields, different meaning

`position.x` and `position.y` used to be a percentage of a layer's own rendered
text block. They are a percentage of the canvas now — see the P1 note in
[ROADMAP.md](ROADMAP.md#closed-in-10) for why the old reading could not work.

A version is for exactly this: the bytes are identical and the picture is not.
So the number is **carried across untouched** and the reader says so.

There is no honest conversion. The old unit was a percentage of the rendered
text block, and no file records that block's size — it falls out of the phrase,
the face, the weight, the tracking and the canvas, none of which the number
knows about. A factor tuned against one project would be wrong for every other
one, and would be wrong silently. Carrying the value over and naming the change
is the only version of this that does not quietly rewrite someone's work.

What actually happens when a v1–v3 file is opened:

- The anchor is untouched. A layer anchored bottom-right is still bottom-right.
- A layer whose offset was `0` — most of them — is pixel-identical.
- A layer that used an offset **may have moved**, and the file opens with a
  warning saying so in those words. In practice it moves further in the
  direction it was already going, which is usually what the value was reaching
  for: the old unit could not move a short line far enough to clear another
  layer at any setting the slider allowed.
- Looks are unaffected. A look carries no positions, so v4 is a version bump
  and nothing else for them.

Storage keys walk **backwards** through the versions they know. A reader that
only looked at the current key would abandon a project the moment the schema
moved: the old entry is still there, still readable, and the user would open the
app to an empty canvas. A migration writes forward first and drops the old copy
second, so a crash in between leaves the original where it was.

## Untrusted input

A preset or project file is data the app did not write. Every field is read
through `lib/persistence/readers.ts`, which answers with something usable rather
than throwing — only input that is not a document at all is rejected.

- Colours are matched against a narrow allowlist. Anything that could carry a
  `url()` or close a declaration is **rejected**, not sanitised.
- Remote background images are dropped; only inline `data:` images survive, so
  opening a file cannot fetch on the user's behalf.
- Every numeric clamp is the control's own range. A file carrying a value no
  slider can reach would otherwise import intact and leave that control pinned at
  its end stop, describing a project it does not have.
- Layer count is bounded.
- Layer ids from a file are discarded.
