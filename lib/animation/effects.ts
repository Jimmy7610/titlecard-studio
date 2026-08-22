import { glyphSequence } from "@/lib/glyphs";
import { gsap } from "@/lib/gsap";
import { mulberry32 } from "@/lib/random";
import {
  boxes,
  flashesOf,
  glyphsOf,
  realsOf,
  type CharUnit,
  type TemplateContext,
} from "@/lib/animation/units";

/**
 * Effects shared by the hand-written templates and the spec interpreter.
 *
 * Nothing here uses `Math.random`: every "random" quantity comes from a seeded
 * `mulberry32`, so the server and client render identical markup and a replay
 * reproduces the exact same motion.
 */

/** Seeded `inset()` slabs converging on a fully visible glyph. */
export function glitchFrames(index: number): string[] {
  const rand = mulberry32(index * 2654435761 + 101);
  const frames: string[] = [];

  for (let step = 0; step < 4; step += 1) {
    const top = Math.round(rand() * 52);
    const bottom = Math.round(rand() * (90 - top));
    const left = Math.round(rand() * 38);
    const right = Math.round(rand() * (86 - left));
    frames.push(`inset(${top}% ${right}% ${bottom}% ${left}%)`);
  }

  frames.push("inset(0% 0% 0% 0%)");
  return frames;
}

/** Sub-pixel horizontal jitter — stays well inside the character footprint. */
export function glitchOffset(index: number, amount = 3): number {
  const rand = mulberry32(index * 40503 + 7);
  return Math.round((rand() * 2 - 1) * amount);
}

/**
 * Every template starts from the same baseline, so switching templates can
 * never leave a stale transform, filter, clip-path or glyph overlay behind.
 */
export function baseline(timeline: gsap.core.Timeline, context: TemplateContext) {
  const { units, words, debris, underline, cursor } = context;

  timeline.set(
    boxes(units),
    {
      xPercent: 0,
      yPercent: 0,
      x: 0,
      y: 0,
      rotate: 0,
      skewX: 0,
      scale: 1,
      opacity: 1,
      filter: "none",
      clipPath: "none",
      transformOrigin: "0% 100%",
    },
    0,
  );

  timeline.set(glyphsOf(units), { opacity: 0, yPercent: 0, x: 0 }, 0);
  timeline.set(realsOf(units), { opacity: 1, yPercent: 0, x: 0 }, 0);

  const flashes = flashesOf(words);
  if (flashes.length) {
    timeline.set(flashes, { opacity: 0, clipPath: "inset(0% 0% 0% 0%)" }, 0);
  }
  if (debris.length) timeline.set(debris, { opacity: 0, scale: 0.5 }, 0);
  if (underline) {
    timeline.set(underline, { scaleX: 0, opacity: 1, transformOrigin: "0% 50%" }, 0);
  }
  if (cursor) timeline.set(cursor, { opacity: 0 }, 0);
}

/**
 * Cycles one unit through a pre-rolled glyph sequence.
 *
 * The tween drives a plain number and the glyph is derived from it, so the
 * rendered character is a pure function of timeline progress — scrubbing
 * backwards or restarting reproduces the decode exactly, which picking a glyph
 * inside `onUpdate` would not.
 */
export function scramble(
  timeline: gsap.core.Timeline,
  unit: CharUnit,
  options: { at: number; duration: number; pool: string; rate: number },
) {
  const steps = Math.max(3, Math.round(options.duration * options.rate));
  const sequence = glyphSequence(options.pool, steps, unit.index + 1);
  const driver = { progress: 0 };

  timeline.fromTo(
    driver,
    { progress: 0 },
    {
      progress: 1,
      duration: options.duration,
      ease: "none",
      onUpdate: () => {
        const step = Math.min(steps - 1, Math.floor(driver.progress * steps));
        unit.glyph.textContent = sequence[step];
      },
    },
    options.at,
  );
}

/** A reel of glyphs rolling down through a slot before the real text lands. */
export function reel(
  timeline: gsap.core.Timeline,
  unit: CharUnit,
  options: { at: number; reels: number; step: number; pool: string },
) {
  const sequence = glyphSequence(options.pool, options.reels, unit.index + 5);
  // No unit argument: `yPercent` is already a percentage, and passing "%" makes
  // quickSetter emit "-47%" where GSAP expects the bare number — which fails
  // silently and leaves the reel parked.
  const setY = gsap.quickSetter(unit.glyph, "yPercent") as (value: number) => void;
  const driver = { position: 0 };

  timeline.fromTo(
    driver,
    { position: 0 },
    {
      position: options.reels,
      duration: options.step * options.reels,
      ease: "none",
      onUpdate: () => {
        const index = Math.min(options.reels - 1, Math.floor(driver.position));
        unit.glyph.textContent = sequence[index];
        setY(-100 + (driver.position - index) * 100);
      },
    },
    options.at,
  );
}

/** Blinks the block cursor for `span` seconds, then retires it. */
export function blinkCursor(
  timeline: gsap.core.Timeline,
  cursor: HTMLElement | null,
  span: number,
  speed: number,
  beat = 0.26,
) {
  if (!cursor) return;

  const interval = beat / speed;
  const repeats = Math.max(1, Math.ceil(span / interval) - 1);

  timeline
    .set(cursor, { opacity: 1 }, 0)
    .to(
      cursor,
      { opacity: 0, duration: interval, ease: "steps(1)", repeat: repeats, yoyo: true },
      0,
    )
    .to(cursor, { opacity: 0, duration: 0.22 / speed, ease: "power2.out" }, span + 0.1);
}

export function sprinkleDebris(
  timeline: gsap.core.Timeline,
  debris: HTMLElement[],
  speed: number,
  stepped: boolean,
) {
  if (!debris.length) return;

  timeline
    .fromTo(
      debris,
      { opacity: 0, scale: 0.5 },
      {
        opacity: 1,
        scale: 1,
        duration: (stepped ? 0.06 : 0.075) / speed,
        ease: "steps(1)",
        repeat: stepped ? 5 : 3,
        yoyo: true,
        stagger: { each: stepped ? 0.022 : 0.03, from: "random" },
      },
      0,
    )
    .to(
      debris,
      {
        opacity: 0,
        scale: 0.35,
        duration: 0.32 / speed,
        ease: stepped ? "steps(3)" : "power2.in",
        stagger: { each: 0.02, from: "random" },
      },
      0.55 / speed,
    );
}

/** The gradient rule that sweeps under the line and retracts. */
export function underlineSweep(
  timeline: gsap.core.Timeline,
  underline: HTMLElement | null,
  options: { at: number; duration: number; hold: number; ease: string },
) {
  if (!underline) return;

  timeline
    .to(
      underline,
      { scaleX: 1, duration: options.duration, ease: options.ease },
      options.at,
    )
    .set(underline, { transformOrigin: "100% 50%" }, options.at + options.hold)
    .to(
      underline,
      { scaleX: 0, duration: options.duration * 0.85, ease: "power3.inOut" },
      options.at + options.hold,
    );
}
