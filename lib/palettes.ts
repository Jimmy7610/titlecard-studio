export type PaletteId =
  | "agent"
  | "terminal"
  | "plasma"
  | "ice"
  | "ember"
  | "mono";

export type CanvasTones = {
  bg: string;
  ink: string;
  line: string;
};

export type PaletteDefinition = {
  id: PaletteId;
  name: string;
  note: string;
  /** Accent ramp. `hot` leads, `sun` closes the gradient. */
  hot: string;
  warm: string;
  sun: string;
  light: CanvasTones;
  dark: CanvasTones;
};

export const PALETTES: readonly PaletteDefinition[] = [
  {
    id: "agent",
    name: "Agent",
    note: "Sampled from the reference clip",
    hot: "#f2560a",
    warm: "#f69625",
    sun: "#ffc53d",
    light: { bg: "#e7e7e7", ink: "#04152f", line: "rgb(4 21 47 / 0.07)" },
    dark: { bg: "#0b0f16", ink: "#f1f4f8", line: "rgb(255 255 255 / 0.06)" },
  },
  {
    id: "terminal",
    name: "Terminal",
    note: "Phosphor green, CRT bias",
    hot: "#00e07a",
    warm: "#4ade80",
    sun: "#bef264",
    light: { bg: "#e6ebe6", ink: "#08200f", line: "rgb(8 32 15 / 0.08)" },
    dark: { bg: "#04100a", ink: "#d4ffe4", line: "rgb(0 224 122 / 0.1)" },
  },
  {
    id: "plasma",
    name: "Plasma",
    note: "Magenta into violet",
    hot: "#e5308a",
    warm: "#a855f7",
    sun: "#6366f1",
    light: { bg: "#ece7f1", ink: "#1a0b2e", line: "rgb(26 11 46 / 0.07)" },
    dark: { bg: "#0d0618", ink: "#f3e8ff", line: "rgb(168 85 247 / 0.1)" },
  },
  {
    id: "ice",
    name: "Ice",
    note: "Cyan into pale blue",
    hot: "#06b6d4",
    warm: "#38bdf8",
    sun: "#a5f3fc",
    light: { bg: "#e3ecf0", ink: "#06202e", line: "rgb(6 32 46 / 0.07)" },
    dark: { bg: "#04121a", ink: "#e0f7ff", line: "rgb(56 189 248 / 0.1)" },
  },
  {
    id: "ember",
    name: "Ember",
    note: "Deep red into amber",
    hot: "#dc2626",
    warm: "#f97316",
    sun: "#fbbf24",
    light: { bg: "#efe7e4", ink: "#200a06", line: "rgb(32 10 6 / 0.07)" },
    dark: { bg: "#150705", ink: "#ffeae2", line: "rgb(249 115 22 / 0.1)" },
  },
  {
    id: "mono",
    name: "Mono",
    note: "No accent — pure contrast",
    hot: "#71717a",
    warm: "#a1a1aa",
    sun: "#d4d4d8",
    light: { bg: "#e9e9e9", ink: "#0a0a0a", line: "rgb(10 10 10 / 0.07)" },
    dark: { bg: "#0a0a0a", ink: "#f5f5f5", line: "rgb(255 255 255 / 0.07)" },
  },
] as const;

const PALETTE_INDEX = new Map(PALETTES.map((p) => [p.id, p]));

/**
 * Falls back to the first palette rather than throwing. This id can arrive from
 * a saved preset written against an older build, and an unknown name should
 * degrade to a default look — not take the whole page down.
 */
export function getPalette(id: PaletteId): PaletteDefinition {
  return PALETTE_INDEX.get(id) ?? PALETTES[0];
}

export function gradientOf(palette: PaletteDefinition): string {
  return `linear-gradient(96deg, ${palette.hot} 0%, ${palette.warm} 54%, ${palette.sun} 100%)`;
}

/** The CSS custom properties the stage and every template read from. */
export function paletteVars(
  palette: PaletteDefinition,
  inverted: boolean,
): Record<string, string> {
  const tones = inverted ? palette.dark : palette.light;
  return {
    "--stw-hot": palette.hot,
    "--stw-warm": palette.warm,
    "--stw-sun": palette.sun,
    "--stw-gradient": gradientOf(palette),
    "--stage-bg": tones.bg,
    "--stage-ink": tones.ink,
    "--stage-line": tones.line,
  };
}
