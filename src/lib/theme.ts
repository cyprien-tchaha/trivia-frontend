/**
 * Shared visual language.
 *
 * Every page used to declare its own local `const C = {...}` with the same
 * keys and slightly drifting values (three different values for `bg` alone).
 * They all import this instead now, so a palette change lands everywhere at
 * once.
 *
 * The keys are deliberately unchanged from those local objects so existing
 * `C.surface` / `C.muted` usages keep working — only the values moved.
 */

export const C = {
  /** Page background. Set on <body> in globals.css; pages inherit it. */
  bg: "#5B21C6",
  /** Cards and panels. Deep indigo so white text stays readable on top of
   *  the bright page gradient without needing a per-element colour flip. */
  surface: "#2E1065",
  surface2: "#3B1A87",
  border: "rgba(255,255,255,0.16)",
  /** Gold. Primary calls to action. */
  accent: "#FFC21E",
  /** Mint. Secondary highlights, "ready" states. */
  accent2: "#00E0C6",
  danger: "#FF3B5C",
  success: "#2BD576",
  text: "#FFFFFF",
  /** Secondary text. Light enough to pass on indigo and on the gradient. */
  muted: "#C9BEEA",
};

/** The page-wide gradient, also mirrored in globals.css for <body>. */
export const BG_GRADIENT =
  "linear-gradient(160deg, #7B2FF7 0%, #9D28D9 40%, #F107A3 100%)";

/**
 * Answer-tile identity, by position.
 *
 * Each slot owns a colour AND a shape. The shape is what makes the tiles
 * usable for players who can't separate red from green — roughly 1 in 12 men
 * — so it is not decoration and should not be dropped to save space.
 * `shadow` is the darker shade used for the tile's bottom edge, which is what
 * gives the buttons their physical, pressable look.
 */
export const TILES = [
  // `text` is per-tile, not a global white: white on the yellow measures
  // 2.38:1, well under the 4.5:1 minimum, so yellow carries near-black
  // instead. Green is darkened from Kahoot's #26890C (4.50:1, exactly on the
  // line) to #1D7A08 (5.47:1) for margin at our 17px weight.
  { color: "#E21B3C", shadow: "#A5122B", text: "#FFFFFF", glyph: "▲", name: "triangle" },
  { color: "#1368CE", shadow: "#0D4791", text: "#FFFFFF", glyph: "◆", name: "diamond" },
  { color: "#D89E00", shadow: "#9B7200", text: "#2A1A00", glyph: "●", name: "circle" },
  { color: "#1D7A08", shadow: "#135405", text: "#FFFFFF", glyph: "■", name: "square" },
] as const;

export function tile(i: number) {
  return TILES[i % TILES.length];
}

/** Display face (headings, the logo, answer text). */
export const DISPLAY = "var(--font-display), 'Fredoka', system-ui, sans-serif";
/** Body face. */
export const BODY = "var(--font-body), 'Nunito', system-ui, sans-serif";

/**
 * A chunky button with a solid bottom edge instead of a blur shadow — the
 * detail that reads as "game" rather than "form". Pair with
 * `activeDepth` on :active to make it physically depress.
 */
export function chunky(color: string, edge: string) {
  return {
    background: color,
    boxShadow: `0 6px 0 ${edge}, 0 10px 20px rgba(23,4,56,0.35)`,
    border: "none",
    borderRadius: "18px",
    color: "#FFFFFF",
    fontFamily: DISPLAY,
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.08s ease, box-shadow 0.08s ease, filter 0.15s ease",
  } as const;
}
