import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyseScript,
  applyTextTransform,
  graphemeCount,
  graphemes,
  resolveGranularity,
} from "../lib/segment";
import { splitText } from "../lib/split";

/**
 * Segmentation is the highest-risk logic in the app: get it wrong and the text
 * on screen is not the text the user typed. These are the cases that actually
 * broke before — `Array.from` tearing emoji, and per-character boxes destroying
 * a shaping run.
 */

test("keeps emoji whole", () => {
  assert.deepEqual(graphemes("a✨b"), ["a", "✨", "b"]);
  assert.equal(graphemeCount("🔥 BUILD 🔥"), 9);
  // A ZWJ sequence is one grapheme, not four.
  assert.equal(graphemeCount("👨‍👩‍👧"), 1);
  // A flag is a regional-indicator pair.
  assert.equal(graphemeCount("🇸🇪"), 1);
});

test("keeps Swedish and accented characters whole", () => {
  assert.deepEqual(graphemes("RÄKSMÖRGÅS").length, 10);
  assert.deepEqual(graphemes("Éj"), ["É", "j"]);
  // Combining acute must not become its own animated box.
  assert.equal(graphemeCount("é"), 1);
});

test("keeps symbols and arrows whole", () => {
  assert.deepEqual(graphemes("AI → FUTURE").filter((g) => g !== " ").length, 9);
});

test("detects scripts that cannot be split per character", () => {
  assert.equal(analyseScript("Hello").safeGranularity, "char");
  assert.equal(analyseScript("Hello").direction, "ltr");

  const arabic = analyseScript("مرحبا");
  assert.equal(arabic.rtl, true);
  assert.equal(arabic.direction, "rtl");
  assert.equal(arabic.safeGranularity, "word");

  const hebrew = analyseScript("שלום");
  assert.equal(hebrew.rtl, true);
  assert.equal(hebrew.safeGranularity, "word");

  const devanagari = analyseScript("नमस्ते");
  assert.equal(devanagari.complex, true);
  assert.equal(devanagari.safeGranularity, "word");

  const thai = analyseScript("สวัสดี");
  assert.equal(thai.complex, true);
});

test("clamps a requested granularity upward, never downward", () => {
  assert.equal(resolveGranularity("Hello", "char").granularity, "char");
  assert.equal(resolveGranularity("Hello", "word").granularity, "word");

  const arabic = resolveGranularity("مرحبا", "char");
  assert.equal(arabic.granularity, "word");
  assert.equal(arabic.downgraded, true);

  // A coarser request is always honoured as-is.
  assert.equal(resolveGranularity("مرحبا", "line").granularity, "line");
});

test("applies case transforms with locale rules", () => {
  assert.equal(applyTextTransform("räksmörgås", "uppercase"), "RÄKSMÖRGÅS");
  assert.equal(applyTextTransform("ÅÄÖ", "lowercase"), "åäö");
  assert.equal(applyTextTransform("As Typed", "none"), "As Typed");
});

/* ------------------------------------------------------------------ *
 * splitText
 * ------------------------------------------------------------------ */

test("splits into lines, words and units", () => {
  const result = splitText("HELLO WORLD");
  assert.equal(result.lines.length, 1);
  assert.equal(result.words.length, 2);
  assert.equal(result.charCount, 10);
  assert.equal(result.words[0].characters.map((c) => c.char).join(""), "HELLO");
});

test("honours explicit line breaks", () => {
  const result = splitText("WHAT IF\nAI COULD");
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].words.length, 2);
  assert.equal(result.lines[1].words.length, 2);
  // Word indices stay unique across lines, so per-word styling survives them.
  assert.deepEqual(result.words.map((w) => w.index), [0, 1, 2, 3]);
});

test("marks the trailing digits of the final word, and only those", () => {
  const on = splitText("Agent 3");
  assert.equal(on.gradientCount, 1);
  assert.equal(on.words[1].characters[0].isGradient, true);

  const off = splitText("Agent 3", { gradientDigits: false });
  assert.equal(off.gradientCount, 0);

  // Digits that are not trailing must not be picked up.
  assert.equal(splitText("3 Agent").gradientCount, 0);
  assert.equal(splitText("Agent 30").gradientCount, 2);
});

test("word granularity produces one animated box per word", () => {
  const result = splitText("HELLO WORLD", { granularity: "word" });
  assert.equal(result.words.length, 2);
  assert.equal(result.charCount, 2);
  assert.equal(result.words[0].characters[0].char, "HELLO");
});

test("line granularity produces one box for the whole line", () => {
  const result = splitText("HELLO WORLD", { granularity: "line" });
  assert.equal(result.charCount, 1);
  assert.equal(result.words[0].characters[0].char, "HELLO WORLD");
});

test("a complex script is widened to word boxes automatically", () => {
  const result = splitText("مرحبا بالعالم", { granularity: "char" });
  assert.equal(result.granularity, "word");
  assert.equal(result.downgraded, true);
  assert.equal(result.profile.rtl, true);
  // The visible text must survive intact, not be reordered into fragments.
  assert.equal(result.words.map((w) => w.text).join(" "), "مرحبا بالعالم");
});

test("collapses whitespace without eating line breaks or content", () => {
  const result = splitText("  A   B  \n\n  C  ");
  assert.equal(result.lines.length, 2);
  assert.deepEqual(result.words.map((w) => w.text), ["A", "B", "C"]);
});

test("empty input is empty, not a crash", () => {
  const result = splitText("   ");
  assert.equal(result.words.length, 0);
  assert.equal(result.charCount, 0);
});
