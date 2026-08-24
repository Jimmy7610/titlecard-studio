"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Base UI sliders hand back `number | number[]` depending on the value shape. */
function firstValue(value: number | readonly number[]): number {
  return Array.isArray(value) ? value[0] : (value as number);
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  action,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

export function SliderField({
  id,
  label,
  hint,
  value,
  display,
  range,
  onValueChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  display: string;
  range: { min: number; max: number; step: number };
  onValueChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        <span className="tabular text-[0.7rem] text-muted-foreground">{display}</span>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={range.min}
        max={range.max}
        step={range.step}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => onValueChange(firstValue(next))}
      />
      {hint ? <p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: React.ReactNode;
  hint?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  // The switch renders a hidden checkbox that takes the `id`, so a `for=` label
  // names *that* rather than the button the user actually focuses and presses.
  // Pointing the button at the label element is what gives it a name at all.
  const labelId = `${id}-label`;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label id={labelId} htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        {hint ? (
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">{hint}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        aria-labelledby={labelId}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

/**
 * A colour control.
 *
 * The native swatch is the picker — reimplementing a colour wheel would be a
 * worse one — with a hex field beside it so a brand value can be pasted rather
 * than hunted for. The text field only commits on a valid value, so a
 * half-typed `#f2` never repaints the stage mid-keystroke.
 */
export function ColorField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  // Adjusting state during render rather than in an effect: the draft is a
  // copy of a prop, and re-syncing it in an effect would paint the stale value
  // for a frame first.
  const [lastValue, setLastValue] = React.useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  const commit = (next: string) => {
    setDraft(next);
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(next.trim())) onChange(next.trim());
  };

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        <label
          className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
          style={{ background: value }}
        >
          <span className="sr-only">{label} colour picker</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={id}
          value={draft}
          spellCheck={false}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setDraft(value)}
          className="h-8 font-mono text-xs"
        />
      </div>
    </Field>
  );
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  const [lastValue, setLastValue] = React.useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(String(value));
  }

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    // Snap to the control's step so a typed 1279.4 does not survive as one.
    const snapped = step > 0 ? Math.round(clamped / step) * step : clamped;
    onChange(Number(snapped.toFixed(4)));
  };

  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className={cn("h-8 tabular text-xs", suffix && "pr-8")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-[0.7rem] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

/** A compact set of mutually exclusive choices. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: React.ReactNode; title?: string }[];
  onChange: (next: T) => void;
  columns?: number;
}) {
  return (
    <Field label={label}>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-0.5 rounded-lg bg-muted/50 p-0.5"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border/70 bg-background/40 p-2.5 text-[0.7rem] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
