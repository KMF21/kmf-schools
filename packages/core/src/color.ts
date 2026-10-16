/**
 * Turns a school's single brand colour into a full, accessible palette.
 *
 * Schools pick any colour they like. Some (light yellow, pale blue) would make
 * unreadable buttons, so we derive shades and pick the strongest shade that
 * still passes WCAG AA contrast against white for buttons and links.
 */

export const DEFAULT_BRAND_HEX = "#1a8754"; // Academica green — the KMF Schools default

type RGB = [number, number, number];

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  let v = m[1];
  if (v.length === 3) v = v.split("").map((c) => c + c).join("");
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(rgb: RGB): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

export type BrandPalette = {
  /** The colour the school chose (normalised hex). */
  base: string;
  /** Solid colour for buttons, active states and the sidebar — always readable with white text. */
  solid: string;
  /** Slightly darker solid, for hover and pressed states. */
  solidHover: string;
  /** Darkest shade, for text links and headings on light backgrounds. */
  strong: string;
  /** Pale tint for pill badges and icon tiles. */
  soft: string;
  /** Very pale wash for page sections. */
  wash: string;
  /** Border tint. */
  line: string;
  /** Text colour to use on top of `solid`. */
  onSolid: string;
};

/**
 * Darkens a colour step by step until it reaches the target contrast with white.
 */
function darkenUntilReadable(rgb: RGB, target: number): RGB {
  let current = rgb;
  for (let i = 0; i < 40 && contrastRatio(current, WHITE) < target; i++) {
    current = mix(current, BLACK, 0.06);
  }
  return current;
}

export function brandPalette(hex: string | null | undefined): BrandPalette {
  const base = parseHex(hex ?? "") ?? parseHex(DEFAULT_BRAND_HEX)!;
  const solid = darkenUntilReadable(base, 4.5);
  const solidHover = mix(solid, BLACK, 0.14);
  const strong = darkenUntilReadable(base, 7);
  return {
    base: toHex(base),
    solid: toHex(solid),
    solidHover: toHex(solidHover),
    strong: toHex(strong),
    soft: toHex(mix(solid, WHITE, 0.88)),
    wash: toHex(mix(solid, WHITE, 0.95)),
    line: toHex(mix(solid, WHITE, 0.75)),
    onSolid: "#ffffff",
  };
}

/**
 * CSS custom properties consumed by the design system. Only the solid shades are
 * emitted; tints are derived in CSS so they adapt to light and dark mode.
 */
export function brandCssVars(hex: string | null | undefined): Record<string, string> {
  const p = brandPalette(hex);
  return {
    "--brand": p.solid,
    "--brand-hover": p.solidHover,
    "--brand-strong": p.strong,
    "--brand-on": p.onSolid,
  };
}
