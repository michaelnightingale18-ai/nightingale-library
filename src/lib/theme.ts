/**
 * Nightingale Library — Design Tokens
 *
 * Single source of truth for the dark-wood library aesthetic.
 * All visual decisions live here. Components import and compose these.
 */

// ── Colour palette ─────────────────────────────────────────────────────────

export const wood = {
  deep:     "#0A0500",   // page background
  dark:     "#17110B",   // base surface (spec)
  mid:      "#2B160B",   // raised surface (spec)
  elevated: "#3D2010",   // cards, modals
  plank:    "#5A3519",   // shelf plank top edge (spec)
  grain:    "#9A6530",   // shelf plank highlight (spec)
} as const;

export const gold = {
  bright:    "#F3C75B",   // spec primary gold
  warm:      "#FFD86B",   // spec gold glow
  dimBorder: "rgba(243,199,91,0.40)",
  glow:      "rgba(255,216,107,0.55)",
  subtle:    "rgba(243,199,91,0.08)",
} as const;

// ── Book state system ──────────────────────────────────────────────────────

export type BookState = "unread" | "reading" | "completed";

/** All visual differences between book states live here, not in components. */
export const bookStates: Record<BookState, {
  width:   number;
  height:  number;
  filter:  string;
  shadow:  string;
  outline?: string;
  lift:    number;   // translateY in px (negative = up)
}> = {
  unread: {
    width:  78,
    height: 112,
    filter: "grayscale(100%) brightness(0.38)",
    shadow: "0 4px 18px rgba(0,0,0,0.9), inset -2px 0 6px rgba(0,0,0,0.4)",
    lift:   0,
  },
  reading: {
    width:  96,
    height: 138,
    filter: "none",
    shadow: `0 0 28px ${gold.glow}, 0 0 56px rgba(255,180,0,0.2), 0 14px 36px rgba(0,0,0,0.95)`,
    lift:   -10,
  },
  completed: {
    width:  78,
    height: 112,
    filter: "none",
    shadow: `0 0 10px rgba(243,199,91,0.30), 0 6px 18px rgba(0,0,0,0.80)`,
    outline: gold.dimBorder,
    lift:   0,
  },
};

// ── Series colour palettes ─────────────────────────────────────────────────

export interface SeriesPalette {
  bg:     string;
  border: string;
  accent: string;
}

export const seriesPalettes: SeriesPalette[] = [
  { bg: "#2D0606", border: "#A01E1E", accent: "#FF7070" },  // crimson
  { bg: "#061E0A", border: "#1E8A2E", accent: "#60FF80" },  // forest
  { bg: "#060625", border: "#1E2E9A", accent: "#7090FF" },  // navy
  { bg: "#1E0628", border: "#7A1E9A", accent: "#CC70FF" },  // violet
  { bg: "#261404", border: "#A06010", accent: "#FFB860" },  // amber
  { bg: "#062020", border: "#1A8080", accent: "#60FFEE" },  // teal
  { bg: "#100625", border: "#501E9A", accent: "#A870FF" },  // purple
  { bg: "#250612", border: "#9A1A50", accent: "#FF70B0" },  // rose
];

// ── Deterministic lookups ──────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h;
}

export function paletteFor(seriesName: string): SeriesPalette {
  return seriesPalettes[hashString(seriesName) % seriesPalettes.length];
}

const COVER_COLORS = [
  "#6B1A1A", "#1A5A1A", "#1A1A6B", "#4A1A6B",
  "#6B4A1A", "#1A4A4A", "#6B1A4A", "#2A1A6B",
];

export function coverColorFor(title: string): string {
  return COVER_COLORS[hashString(title) % COVER_COLORS.length];
}

// ── Gamification ──────────────────────────────────────────────────────────

export const BOOKS_PER_LEVEL = 5;

export function levelFor(totalRead: number) {
  const level    = Math.floor(totalRead / BOOKS_PER_LEVEL) + 1;
  const progress = totalRead % BOOKS_PER_LEVEL;
  const toNext   = BOOKS_PER_LEVEL - progress;
  return { level, progress, toNext, fraction: progress / BOOKS_PER_LEVEL };
}
