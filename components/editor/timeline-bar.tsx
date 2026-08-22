"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RotateCcwIcon,
} from "lucide-react";

import type { StageHandle } from "@/components/editor/stage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Playback controls.
 *
 * The playhead reads the GSAP timeline on an animation frame and writes to the
 * DOM through refs. Routing 60 frames a second through React state would
 * re-render the whole editor while an animation plays, which is exactly the
 * cost this app cannot afford.
 */

const RATES = [0.25, 0.5, 1, 1.5, 2] as const;

export type TimelineBarProps = {
  stage: React.RefObject<StageHandle | null>;
  loop: boolean;
  onLoopChange: (next: boolean) => void;
  /** Bumped by the editor whenever the timeline is rebuilt. */
  rebuildKey: string;
};

function format(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0.00s";
  return `${seconds.toFixed(2)}s`;
}

export function TimelineBar({ stage, loop, onLoopChange, rebuildKey }: TimelineBarProps) {
  const track = React.useRef<HTMLDivElement>(null);
  const playhead = React.useRef<HTMLDivElement>(null);
  const fill = React.useRef<HTMLDivElement>(null);
  const timeLabel = React.useRef<HTMLSpanElement>(null);
  const totalLabel = React.useRef<HTMLSpanElement>(null);
  const playIcon = React.useRef<HTMLButtonElement>(null);

  const [rate, setRate] = React.useState(1);
  const [scrubbing, setScrubbing] = React.useState(false);
  const [playing, setPlaying] = React.useState(true);

  React.useEffect(() => {
    let frame = 0;

    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const timeline = stage.current?.timeline();
      if (!timeline) {
        if (timeLabel.current) timeLabel.current.textContent = "0.00s";
        if (totalLabel.current) totalLabel.current.textContent = "0.00s";
        if (fill.current) fill.current.style.width = "0%";
        if (playhead.current) playhead.current.style.left = "0%";
        return;
      }

      const duration = timeline.duration() || 1;
      const time = timeline.time();
      const percent = Math.max(0, Math.min(100, (time / duration) * 100));

      if (fill.current) fill.current.style.width = `${percent}%`;
      if (playhead.current) playhead.current.style.left = `${percent}%`;
      if (timeLabel.current) timeLabel.current.textContent = format(time);
      if (totalLabel.current) totalLabel.current.textContent = format(timeline.duration());

      const isPlaying = !timeline.paused();
      if (playIcon.current) playIcon.current.dataset.playing = isPlaying ? "true" : "false";
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [stage, rebuildKey]);

  const seekFromPointer = (clientX: number) => {
    const node = track.current;
    const timeline = stage.current?.timeline();
    if (!node || !timeline) return;

    const rect = node.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    stage.current?.seek(ratio * timeline.duration());
  };

  React.useEffect(() => {
    if (!scrubbing) return;

    // Reads the refs directly rather than closing over a memoised callback, so
    // the listener never has to be torn down and rebuilt mid-drag.
    const move = (event: PointerEvent) => {
      const node = track.current;
      const timeline = stage.current?.timeline();
      if (!node || !timeline) return;
      const rect = node.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      stage.current?.seek(ratio * timeline.duration());
    };
    const up = () => setScrubbing(false);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [scrubbing, stage]);

  const toggle = () => {
    stage.current?.toggle();
    setPlaying((previous) => !previous);
  };

  const changeRate = (next: number) => {
    setRate(next);
    stage.current?.setRate(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-card/40 px-3 py-2">
      <div className="flex items-center gap-1">
        <Button
          ref={playIcon}
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="group"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Replay"
          onClick={() => {
            stage.current?.replay();
            setPlaying(true);
          }}
        >
          <RotateCcwIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Step back one frame"
          onClick={() => {
            stage.current?.step(-1);
            setPlaying(false);
          }}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Step forward one frame"
          onClick={() => {
            stage.current?.step(1);
            setPlaying(false);
          }}
        >
          <ChevronRightIcon />
        </Button>
        <Button
          type="button"
          variant={loop ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Loop playback"
          aria-pressed={loop}
          onClick={() => onLoopChange(!loop)}
        >
          <RepeatIcon />
        </Button>
      </div>

      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Timeline position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        onPointerDown={(event) => {
          setScrubbing(true);
          setPlaying(false);
          seekFromPointer(event.clientX);
        }}
        onKeyDown={(event) => {
          const timeline = stage.current?.timeline();
          if (!timeline) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            stage.current?.step(-1);
            setPlaying(false);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            stage.current?.step(1);
            setPlaying(false);
          }
        }}
        className="relative h-6 min-w-40 flex-1 cursor-pointer touch-none rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
          <div ref={fill} className="h-full bg-primary" style={{ width: "0%" }} />
        </div>
        <div
          ref={playhead}
          className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ring bg-white"
          style={{ left: "0%" }}
        />
      </div>

      <div className="tabular flex items-center gap-1 text-[0.7rem] text-muted-foreground">
        <span ref={timeLabel}>0.00s</span>
        <span className="text-muted-foreground/50">/</span>
        <span ref={totalLabel}>0.00s</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Label htmlFor="rate" className="sr-only">
          Playback speed
        </Label>
        <div id="rate" className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
          {RATES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rate === value}
              onClick={() => changeRate(value)}
              className={cn(
                "tabular rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                rate === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
