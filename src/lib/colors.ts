/** Convert "#RRGGBB" → "R, G, B" (the form CSS rgba() can splice in via var()). */
export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '0, 0, 0';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Default 20-slot rhyme palette. Cloned (not referenced) so callers can't
// mutate the defaults. The active palette is a runtime singleton that the
// useStudio store mirrors via setRhymePalette(); see below.
const DEFAULT_PALETTE = [
  '#4A9EFF', '#FF6B6B', '#4ECB71', '#FFD93D', '#C77DFF',
  '#FF9F43', '#54A0FF', '#FF6C9D', '#26DE81', '#FD9644',
  '#A29BFE', '#74B9FF', '#FDCB6E', '#E17055', '#00CEC9',
  '#6C5CE7', '#00B894', '#E84393', '#0984E3', '#D63031',
];

let activeRhymePalette = DEFAULT_PALETTE.slice();

export function setRhymePalette(p: string[]) {
  if (!Array.isArray(p) || p.length === 0) {
    activeRhymePalette = DEFAULT_PALETTE.slice();
    return;
  }
  activeRhymePalette = p.slice();
  cache.clear();
}

const cache = new Map<string, string>();

export function getSuffixColor(suffix: string): string {
  if (!suffix) return '#4a5568';
  if (cache.has(suffix)) return cache.get(suffix)!;
  let h = 0;
  for (let i = 0; i < suffix.length; i++) {
    h = (Math.imul(h, 31) + suffix.charCodeAt(i)) | 0;
  }
  const color = activeRhymePalette[Math.abs(h) % activeRhymePalette.length];
  cache.set(suffix, color);
  return color;
}

/* ─── Syllable-count colors ─────────────────────────────
 * Each count 1..10 maps to a distinct hue so a glance at the gutter
 * tells you the rhythm of a line. Defaults can be overridden by the
 * user via the Settings panel; see useStudio.customSylColors.
 */
export const DEFAULT_SYL_PALETTE: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#4ade80', 4: '#facc15', 5: '#fb923c',
  6: '#f87171', 7: '#c084fc', 8: '#22d3ee', 9: '#ec4899', 10: '#fbbf24',
};

let activePalette: Record<number, string> = { ...DEFAULT_SYL_PALETTE };

export function setSyllablePalette(p: Record<number, string>) {
  activePalette = { ...DEFAULT_SYL_PALETTE, ...p };
}

export function getSyllableColor(count: number): string {
  if (count <= 0) return '#3f4659';
  return activePalette[Math.min(count, 10)] ?? '#94a3b8';
}

export function getSyllableLegend(): { count: number; color: string }[] {
  return Array.from({ length: 10 }, (_, i) => ({
    count: i + 1,
    color: activePalette[i + 1],
  }));
}

// Legacy export — preserved for any caller that still imports the
// constant array. Reflects the *default* legend, not user overrides.
export const SYL_COUNT_LEGEND: { count: number; color: string }[] =
  Array.from({ length: 10 }, (_, i) => ({ count: i + 1, color: DEFAULT_SYL_PALETTE[i + 1] }));

export const CAT_COLORS: Record<string, string> = {
  Style: 'cat-style',
  Lyrics: 'cat-lyrics',
  FX: 'cat-fx',
  Mood: 'cat-mood',
  Instruments: 'cat-instruments',
  Genre: 'cat-genre',
  discovered: 'cat-discovered',
  CustomBranches: 'cat-custom',
};
