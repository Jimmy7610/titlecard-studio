import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_PROJECT } from "../lib/project";
import { applyLook, direct, matchWord, normaliseWord, suggest, surprise } from "../lib/semantic/engine";
import { MOODS } from "../lib/semantic/lexicon";
import { hasTemplate } from "../lib/templates";

/**
 * The engine's job changed in v2: it proposes, it never decides. The tests that
 * matter most here are the negative ones — that applying a look cannot touch
 * the phrase, and that nothing in the module mutates the project it is handed.
 */

test("normalises words without destroying non-ASCII letters", () => {
  assert.equal(normaliseWord("Långsam!"), "långsam");
  assert.equal(normaliseWord("RÄKSMÖRGÅS"), "räksmörgås");
  assert.equal(normaliseWord("Agent,"), "agent");
  assert.equal(normaliseWord("...*..."), "");
});

test("matches English tokens", () => {
  assert.equal(matchWord("calm")?.moodId, "calm");
  assert.equal(matchWord("terminal")?.moodId, "terminal");
  assert.equal(matchWord("luxury")?.moodId, "luxury");
  assert.equal(matchWord("future")?.moodId, "future");
});

test("matches Swedish tokens", () => {
  assert.equal(matchWord("lugn")?.moodId, "calm");
  assert.equal(matchWord("långsam")?.moodId, "calm");
  assert.equal(matchWord("andas")?.moodId, "calm");
  assert.equal(matchWord("framtid")?.moodId, "future");
  assert.equal(matchWord("exklusiv")?.moodId, "luxury");
  assert.equal(matchWord("kraft")?.moodId, "energetic");
  assert.equal(matchWord("maskin")?.moodId, "machinic");
  assert.equal(matchWord("bygg")?.moodId, "machinic");
});

test("matches Swedish inflections through stems", () => {
  // "lansering" is listed explicitly; "lanserat" is not, and only the stem
  // "lanser" can reach it. That distinction is the point of the stem list.
  assert.equal(matchWord("lansering")?.kind, "token");

  const inflected = matchWord("lanserat");
  assert.equal(inflected?.moodId, "authoritative");
  assert.equal(inflected?.kind, "stem");

  assert.equal(matchWord("lanserar")?.moodId, "authoritative");
  assert.equal(matchWord("framtiden")?.moodId, "future");
  assert.equal(matchWord("exklusivt")?.moodId, "luxury");
});

test("does not match substrings of unrelated words", () => {
  // The classic failure: "technique" must not trigger the "tech" rule.
  assert.equal(matchWord("technique"), null);
  assert.equal(matchWord("scandal"), null);
  assert.equal(matchWord("codeine"), null);
});

test("short words never reach the stem matcher", () => {
  assert.equal(matchWord("kod")?.kind, "token");
  assert.equal(matchWord("byg"), null);
});

test("suggests the mood with the most hits", () => {
  const calm = suggest("Breathe slowly and stay calm");
  assert.equal(calm?.mood.id, "calm");
  assert.ok(calm!.hits.length >= 2);
  assert.ok(hasTemplate(calm!.templateId));
});

test("returns nothing when nothing matches", () => {
  assert.equal(suggest("zzz qqq"), null);
  assert.equal(suggest(""), null);
  assert.equal(suggest("   "), null);
});

test("regenerating walks the mood's ranked templates", () => {
  const first = suggest("terminal", 0);
  const second = suggest("terminal", 1);
  assert.ok(first && second);
  assert.notEqual(first.templateId, second.templateId);
  assert.equal(first.mood.id, second.mood.id);
});

test("applying a look never changes the text", () => {
  const before = structuredClone(DEFAULT_PROJECT);
  const suggestion = suggest("luxury atelier")!;
  const after = applyLook(before, suggestion.look, suggestion.templateId);

  assert.equal(after.layers[0].text, DEFAULT_PROJECT.layers[0].text);
  assert.equal(after.layers[0].templateId, suggestion.templateId);
  // And the input is untouched — nothing here mutates.
  assert.deepEqual(before, DEFAULT_PROJECT);
});

test("applying a look leaves the canvas and word styles alone", () => {
  const project = {
    ...DEFAULT_PROJECT,
    canvas: { ...DEFAULT_PROJECT.canvas, width: 1080, height: 1920, formatId: "tiktok" },
    layers: [{ ...DEFAULT_PROJECT.layers[0], wordStyles: { 0: { scale: 2 } } }],
  };
  const suggestion = suggest("terminal boot")!;
  const after = applyLook(project, suggestion.look, suggestion.templateId);

  assert.deepEqual(after.canvas, project.canvas);
  assert.deepEqual(after.layers[0].wordStyles, { 0: { scale: 2 } });
});

test("a scoped look only changes what was asked for", () => {
  const suggestion = suggest("calm")!;
  const after = applyLook(DEFAULT_PROJECT, suggestion.look, suggestion.templateId, {
    animation: true,
    palette: false,
    typography: false,
    motion: false,
    background: false,
  });

  assert.equal(after.paletteId, DEFAULT_PROJECT.paletteId);
  assert.deepEqual(after.typography, DEFAULT_PROJECT.typography);
  assert.equal(after.layers[0].templateId, suggestion.templateId);
});

test("the director blends the top two moods and always returns a valid look", () => {
  const result = direct("Calm futuristic announcement about artificial intelligence");
  assert.equal(result.fallback, false);
  assert.ok(result.matched.length >= 2);
  assert.ok(hasTemplate(result.templateId));
  assert.ok(result.look.speed > 0);

  const empty = direct("qqq zzz");
  assert.equal(empty.fallback, true);
  assert.ok(hasTemplate(empty.templateId));
});

test("surprise stays inside one style family", () => {
  for (let seed = 0; seed < 60; seed += 1) {
    const result = surprise(seed);
    assert.ok(hasTemplate(result.templateId), `bad template for seed ${seed}`);
    // The template must come from the mood it claims, not from the whole set.
    assert.ok(
      result.mood.look.templates.includes(result.templateId),
      `seed ${seed} left its family`,
    );
    assert.ok(result.look.speed > 0.2 && result.look.speed < 4);
    assert.ok(result.look.stagger >= 0 && result.look.stagger < 0.3);
  }
});

test("surprise is deterministic for a seed", () => {
  assert.deepEqual(surprise(42).look, surprise(42).look);
  assert.equal(surprise(42).templateId, surprise(42).templateId);
});

test("every mood points at templates that exist", () => {
  for (const mood of MOODS) {
    for (const id of mood.look.templates) {
      assert.ok(hasTemplate(id), `${mood.id} references unknown template ${id}`);
    }
    assert.ok(mood.tokens.en.length > 0, `${mood.id} has no English tokens`);
    assert.ok(mood.tokens.sv.length > 0, `${mood.id} has no Swedish tokens`);
  }
});

test("no token is claimed by two different moods", () => {
  // A word may legitimately appear in both language lists of one mood — plenty
  // of them are spelled the same in English and Swedish. What must never
  // happen is one word pulling two different moods, because then the
  // suggestion depends on iteration order rather than on meaning.
  const seen = new Map<string, string>();
  for (const mood of MOODS) {
    for (const token of [...mood.tokens.en, ...mood.tokens.sv]) {
      const key = normaliseWord(token);
      const owner = seen.get(key);
      if (owner !== undefined && owner !== mood.id) {
        assert.fail(`"${token}" is claimed by both ${owner} and ${mood.id}`);
      }
      seen.set(key, mood.id);
    }
  }
});
