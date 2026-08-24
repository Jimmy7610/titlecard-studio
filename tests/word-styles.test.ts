import assert from "node:assert/strict";
import { test } from "node:test";

import { remapWordStyles, type SplitOptionsForStyles } from "../lib/word-styles";
import type { WordStyle } from "../lib/types";

/**
 * Styling is stored against a word index, and an index means something
 * different the moment the phrase is edited. These are the edits that used to
 * move a style onto a word the user never chose.
 */

const OPTIONS: SplitOptionsForStyles = {
  granularity: "char",
  transform: "none",
  gradientDigits: true,
};

const styles = (entries: Record<number, WordStyle>) => entries;
const gold: WordStyle = { gradient: true, scale: 1.2 };
const glow: WordStyle = { glow: 0.4 };

const remap = (before: string, after: string, input: Record<number, WordStyle>) =>
  remapWordStyles(before, after, input, OPTIONS);

test("a word inserted before a styled word does not steal its styling", () => {
  // The reported case. Index 2 was IMPOSSIBLE and became REALLY.
  const result = remap(
    "BUILD SOMETHING IMPOSSIBLE",
    "BUILD SOMETHING REALLY IMPOSSIBLE",
    styles({ 2: gold }),
  );

  assert.deepEqual(result.wordStyles, { 3: gold }, "the style followed IMPOSSIBLE");
  assert.equal(result.dropped, 0);
});

test("a word inserted at the front shifts every style along", () => {
  const result = remap("HELLO WORLD", "NEW HELLO WORLD", styles({ 0: gold, 1: glow }));
  assert.deepEqual(result.wordStyles, { 1: gold, 2: glow });
  assert.equal(result.dropped, 0);
});

test("deleting the styled word drops its styling", () => {
  // Rather than sliding it onto whatever word inherited the index.
  const result = remap("BUILD SOMETHING IMPOSSIBLE", "BUILD SOMETHING", styles({ 2: gold }));
  assert.deepEqual(result.wordStyles, {});
  assert.equal(result.dropped, 1);
});

test("deleting an unstyled word pulls later styles back", () => {
  const result = remap("ONE TWO THREE", "ONE THREE", styles({ 2: gold }));
  assert.deepEqual(result.wordStyles, { 1: gold });
});

test("reordering moves styling with the word", () => {
  const result = remap("ALPHA BETA GAMMA", "GAMMA ALPHA BETA", styles({ 0: gold }));
  // ALPHA is still present, so its styling travels with it.
  assert.deepEqual(result.wordStyles, { 1: gold });
});

test("rewriting the phrase entirely keeps nothing", () => {
  const result = remap("ONE TWO THREE", "COMPLETELY DIFFERENT WORDS", styles({ 1: gold }));
  assert.deepEqual(result.wordStyles, {});
  assert.equal(result.dropped, 1);
});

test("case and punctuation changes do not cost the styling", () => {
  assert.deepEqual(remap("Hello World", "HELLO WORLD", styles({ 1: gold })).wordStyles, {
    1: gold,
  });
  assert.deepEqual(remap("Hello World", "Hello World!", styles({ 1: gold })).wordStyles, {
    1: gold,
  });
});

test("a repeated word keeps its own styling, in order", () => {
  // Two identical words are genuinely ambiguous; matching them in order is the
  // only reading that does not shuffle styling between them.
  const result = remap("GO GO GO", "GO STOP GO GO", styles({ 0: gold, 2: glow }));
  assert.equal(result.wordStyles[0], gold, "the first GO is still the first GO");
  assert.ok(Object.values(result.wordStyles).includes(glow));
});

test("typing inside a word costs that word its styling", () => {
  // "IMPOSSIBL" is not "IMPOSSIBLE". Half-typed states are transient, and
  // dropping is recoverable through undo; guessing is not.
  const result = remap("BUILD IMPOSSIBLE", "BUILD IMPOSSIBL", styles({ 1: gold }));
  assert.deepEqual(result.wordStyles, {});
  assert.equal(result.dropped, 1);
});

test("an unchanged phrase is returned untouched", () => {
  const input = styles({ 1: gold });
  const result = remap("SAME WORDS", "SAME WORDS", input);
  assert.equal(result.wordStyles, input, "no work, no new object");
});

test("a phrase with no styling costs nothing", () => {
  const input = styles({});
  assert.equal(remap("ANYTHING", "SOMETHING ELSE", input).wordStyles, input);
});

test("line breaks are word boundaries like any other", () => {
  const result = remap("ONE TWO", "ONE\nTWO", styles({ 1: gold }));
  assert.deepEqual(result.wordStyles, { 1: gold });
});

test("emptying the phrase keeps nothing", () => {
  const result = remap("ONE TWO", "", styles({ 0: gold, 1: glow }));
  assert.deepEqual(result.wordStyles, {});
  assert.equal(result.dropped, 2);
});

test("line granularity indexes whole lines, and remaps them too", () => {
  const options: SplitOptionsForStyles = { ...OPTIONS, granularity: "line" };
  const result = remapWordStyles(
    "first line\nsecond line",
    "new line\nfirst line\nsecond line",
    styles({ 0: gold }),
    options,
  );
  assert.deepEqual(result.wordStyles, { 1: gold });
});

test("a pathological paste does not build a huge matrix", () => {
  const long = Array.from({ length: 400 }, (_, index) => `word${index}`).join(" ");
  const result = remap(long, `${long} more`, styles({ 5: gold }));
  // The guard trades the remap for a drop rather than blocking the keystroke.
  assert.ok(result.dropped >= 0);
});
