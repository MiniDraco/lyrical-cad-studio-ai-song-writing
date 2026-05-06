'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** localStorage wrapper that recovers from QuotaExceededError */
const safeStorage = createJSONStorage(() => {
  if (typeof window === 'undefined') {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
  return {
    getItem: (name: string) => window.localStorage.getItem(name),
    setItem: (name: string, value: string) => {
      try {
        window.localStorage.setItem(name, value);
      } catch {
        try {
          window.localStorage.removeItem(name);
          window.localStorage.setItem(name, value);
        } catch {
          /* still failing — ignore */
        }
      }
    },
    removeItem: (name: string) => window.localStorage.removeItem(name),
  };
});
import { TagCategory, TagLibrary, LineData, StyleBranch } from '@/types';
import { parsePills } from '@/lib/tagParser';

const DEFAULT_LIBRARY: TagLibrary = {
  Style: ['Verse', 'Chorus', 'Bridge', 'Intro', 'Outro', 'Pre-Chorus', 'Hook'],
  Lyrics: ['Metaphor', 'Simile', 'Repetition', 'Rhyme', 'Alliteration', 'Imagery'],
  FX: ['Echo', 'Reverb', 'Fade In', 'Fade Out', 'Build', 'Drop', 'Silence', 'Delay'],
  Mood: ['Happy', 'Sad', 'Angry', 'Peaceful', 'Nostalgic', 'Hopeful', 'Melancholic', 'Euphoric'],
  Instruments: ['Piano', 'Guitar', 'Drums', 'Bass', 'Strings', 'Synth', 'Violin', 'Brass'],
  Genre: ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Country', 'Electronic', 'Jazz', 'Soul', 'Folk'],
};

export type BracketType = 'square' | 'curly' | 'paren' | 'angle' | 'none';

export const BRACKET_PAIRS: Record<BracketType, [string, string]> = {
  square: ['[', ']'],
  curly: ['{', '}'],
  paren: ['(', ')'],
  angle: ['<', '>'],
  // 'none' injects pill labels as bare text — no surrounding brackets.
  none: ['', ''],
};

export interface CreativityFrame {
  id: string;
  name: string;
  url: string;
}

export interface RandomBank {
  id: string;
  name: string;
  words: string[];
}

export const DEFAULT_CREATIVITY_FRAMES: CreativityFrame[] = [
  { id: 'rhymezone', name: 'RhymeZone', url: 'https://www.rhymezone.com/' },
  { id: 'datamuse', name: 'Datamuse', url: 'https://www.datamuse.com/api/' },
  { id: 'wiki-random', name: 'Wiki Random', url: 'https://en.wikipedia.org/wiki/Special:Random' },
];

export const DEFAULT_RANDOM_BANKS: RandomBank[] = [
  {
    id: 'emotions',
    name: 'Emotions',
    words: ['longing', 'euphoria', 'dread', 'serenity', 'fury', 'tenderness', 'envy', 'awe', 'guilt', 'hope', 'regret', 'wonder', 'shame', 'defiance', 'grief', 'bliss'],
  },
  {
    id: 'imagery',
    name: 'Imagery',
    words: ['neon rain', 'broken glass', 'velvet sky', 'concrete heart', 'silver tongue', 'paper moon', 'iron lung', 'glass bones', 'razor wire', 'static shore'],
  },
  {
    id: 'verbs',
    name: 'Action Verbs',
    words: ['unravel', 'devour', 'whisper', 'crash', 'ignite', 'fracture', 'bloom', 'collapse', 'orbit', 'dissolve', 'electrify', 'haunt', 'sever', 'burn', 'drown'],
  },
  {
    id: 'colors',
    name: 'Colors',
    words: ['cobalt', 'crimson', 'amber', 'jade', 'obsidian', 'pearl', 'rust', 'ivory', 'violet', 'ash', 'gold', 'oxblood', 'teal', 'bone'],
  },
];

const DEFAULT_SYL_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#4ade80', 4: '#facc15', 5: '#fb923c',
  6: '#f87171', 7: '#c084fc', 8: '#22d3ee', 9: '#ec4899', 10: '#fbbf24',
};

export const DEFAULT_RHYME_PALETTE: string[] = [
  '#4A9EFF', '#FF6B6B', '#4ECB71', '#FFD93D', '#C77DFF',
  '#FF9F43', '#54A0FF', '#FF6C9D', '#26DE81', '#FD9644',
  '#A29BFE', '#74B9FF', '#FDCB6E', '#E17055', '#00CEC9',
  '#6C5CE7', '#00B894', '#E84393', '#0984E3', '#D63031',
];

export const DEFAULT_MAIN_TEXT_COLOR = '#e2e8f0';
export const DEFAULT_MAIN_CANVAS_COLOR = '#0d0f14';

export const DEFAULT_CAT_COLORS: Record<string, string> = {
  Style: '#4A9EFF',
  Lyrics: '#4ACB71',
  FX: '#9A75EA',
  Mood: '#FF6B6B',
  Instruments: '#FFD93D',
  Genre: '#FF9F43',
  discovered: '#FFA500',
  CustomBranches: '#00CEC9',
};

export interface PocketItem {
  id: string;
  text: string;          // Raw payload (selected text snippet)
  createdAt: number;
}

export interface WordProbe {
  /** Hex color used to highlight matched words. */
  color: string;
  /** Datamuse topic — empty string = unused slot. */
  topic: string;
}

export interface CustomTagCategory {
  id: string;
  /** Display label — also acts as the export header (`## Name`). */
  name: string;
  /** Single emoji or short string shown next to the name in tabs. */
  icon: string;
  /** Hex pill color — drives bg/border/text via the same scheme as built-ins. */
  color: string;
  /** Tag labels stored in this category. */
  tags: string[];
}

export interface PadGhost {
  isActive: boolean;
  savedLyric: string;
  bgImage: string | null;
  bgWidth: number;
  bgHeight: number;
  skeleton: LineData[];
}

export interface Pad {
  id: string;
  name: string;
  lyricText: string;
  styleText: string;
  /** Ghost state owned by this pad. Survives tab swaps so a pad you
   *  return to picks up exactly where you left it (trace + typing). */
  ghost?: PadGhost;
}

export interface Quest {
  id: string;
  /** Short label shown in the pool checkbox row. */
  title: string;
  /** Full body shown in the active list when the quest is checked on. */
  body: string;
  /** True = lives in the Active Quests area; false = sits in the pool. */
  active: boolean;
}

/**
 * Parse a single user-entered quest line.
 * Format: `BODY *: TITLE`
 *   - The text BEFORE `*:` becomes the body (shown when active).
 *   - The text AFTER `*:` becomes the checkbox label / title.
 * If there's no `*:` separator, the whole line is the body and the
 * title falls back to a truncated copy of the body so the checkbox
 * still has something to display.
 */
export function parseQuestLine(line: string): { body: string; title: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf('*:');
  if (idx === -1) {
    const body = trimmed;
    return { body, title: body.length > 60 ? body.slice(0, 57) + '…' : body };
  }
  const body = trimmed.slice(0, idx).trim();
  const title = trimmed.slice(idx + 2).trim();
  if (!body && !title) return null;
  return { body: body || title, title: title || (body.length > 60 ? body.slice(0, 57) + '…' : body) };
}

interface StudioStore {
  // Ghost mode
  isGhostMode: boolean;
  ghostSkeleton: LineData[];        // Frozen target snapshot (set on activation)
  ghostBgImage: string | null;      // Snapshot data URL displayed behind the editor
  ghostBgWidth: number;             // Natural pixel width of ghostBgImage
  ghostBgHeight: number;            // Natural pixel height of ghostBgImage
  savedLyric: string;               // lyricText backup taken when entering ghost mode

  // Editor data
  masterTagLibrary: TagLibrary;
  rhythmicSkeleton: LineData[];     // Live skeleton from the LyricPad
  customBranches: StyleBranch[];
  /** User-defined tag categories — each gets its own tab in the TagTray. */
  customTagCategories: CustomTagCategory[];
  discoveredTags: string[];
  bracketType: BracketType;         // Which bracket pair pills use when injected

  /** All user pads — each owns its own lyricText + styleText. */
  pads: Pad[];
  /** ID of the currently visible pad. lyricText/styleText below mirror it. */
  activePadId: string;
  /** Live mirror of the active pad's lyricText for components that read it
   *  directly (LyricPad, StudioLayout stats). Persisted as the source of
   *  truth for the active pad on disk. */
  lyricText: string;
  /** Same idea for the Style pad. */
  styleText: string;

  // Creativity / settings
  creativityFrames: CreativityFrame[];
  randomBanks: RandomBank[];
  customSylColors: Record<number, string>;
  /** Background opacity (0..1) for the syllable highlight boxes (.syl-a / .syl-b). */
  sylBgAlpha: number;
  /** Hex color used for matched-syllable boxes in ghost mode. */
  ghostMatchColor: string;
  /** Hex color used for mismatched-syllable boxes in ghost mode. */
  ghostMismatchColor: string;
  /** Background-alpha multiplier for syl-match/syl-mismatch boxes. */
  ghostMatchAlphaMul: number;
  /** Opacity (0..1) of the ghost-mode tracing-paper backdrop image. */
  ghostBgOpacity: number;
  /** Per-category pill color overrides (hex). Keys: TagCategory + 'discovered' + 'CustomBranches'. */
  catColors: Record<string, string>;
  /** Hex color used for the main editor body text (and other primary text). */
  mainTextColor: string;
  /** Hex color used as the editor canvas background. */
  mainCanvasColor: string;
  /** 20 user-controlled colors that the rhyme-suffix hash maps into. */
  rhymePalette: string[];
  /** Button shape morph — 0 = sharp rectangle, 0.5 = standard rounded, 1 = full pill. */
  buttonRadius: number;
  /** Named button shape preset (overrides buttonRadius when set). */
  buttonShape: 'free' | 'rectangle' | 'rounded25' | 'rounded50' | 'circle' | 'poly' | 'squared-up' | 'squared-down';
  /** Named pill shape preset — applied to .pill spans across the UI. */
  pillShape: 'free' | 'rectangle' | 'rounded25' | 'rounded50' | 'circle' | 'poly' | 'squared-up' | 'squared-down';
  /** Global UI scale 0.3..1.5 (drives html font-size; editor pads opt out). */
  uiScale: number;
  /** Editor font family (lyric + style + ghost pads). */
  editorFontFamily: string;
  /** Editor font size in pixels — independent of UI scale. */
  editorFontSize: number;
  editorFontBold: boolean;
  editorFontItalic: boolean;
  /** Optional chrome colors. Empty string = inherit Tailwind default. */
  chromeColors: {
    surface: string; // bg-studio-surface override (header / footer)
    panel: string;   // bg-studio-panel override (dock / aside)
    border: string;  // border-studio-border override
    muted: string;   // text-studio-muted override
  };

  /** Datamuse word probes — 20 color/topic pairs. An empty topic = inactive slot. */
  wordProbes: WordProbe[];
  /** Master toggle — when off, the live editor stops applying probe highlights. */
  probesEnabled: boolean;
  /** Runtime cache: word.toLowerCase() → probe color hex (NOT persisted). */
  wordHighlights: Record<string, string>;

  // Pocket — user-saved snippets pulled out of the pads via drag.
  pocketItems: PocketItem[];

  // Quests — user-curated writing prompts. The pool holds inactive quests;
  // checking one promotes it to the Active list (top of the popover).
  quests: Quest[];
  /** Cumulative points — every quest activation grants +10. Survives toggles. */
  questPoints: number;

  // Actions
  enableGhost: (snapshot: string | null, dims?: { width: number; height: number }) => void;
  disableGhost: () => void;
  /** While in ghost mode, promote the currently-typed text to be the new
   *  saved lyric so exiting ghost preserves the user's work. */
  exportGhostToLyric: () => void;
  setRhythmicSkeleton: (lines: LineData[]) => void;
  setLyricText: (text: string) => void;
  setStyleText: (text: string) => void;
  setBracketType: (t: BracketType) => void;

  addPad: (name?: string) => string;
  removePad: (id: string) => void;
  renamePad: (id: string, name: string) => void;
  setActivePad: (id: string) => void;

  addCreativityFrame: (f: CreativityFrame) => void;
  removeCreativityFrame: (id: string) => void;
  renameCreativityFrame: (id: string, name: string) => void;

  addRandomBank: (b: RandomBank) => void;
  updateRandomBank: (id: string, patch: Partial<Omit<RandomBank, 'id'>>) => void;
  removeRandomBank: (id: string) => void;

  setSylColor: (count: number, color: string) => void;
  resetSylColors: () => void;
  setSylBgAlpha: (a: number) => void;
  setGhostMatchColor: (c: string) => void;
  setGhostMismatchColor: (c: string) => void;
  setGhostMatchAlphaMul: (a: number) => void;
  setGhostBgOpacity: (a: number) => void;
  setCatColor: (cat: string, color: string) => void;
  resetCatColors: () => void;
  setMainTextColor: (c: string) => void;
  setMainCanvasColor: (c: string) => void;
  setRhymeColor: (idx: number, color: string) => void;
  resetRhymePalette: () => void;
  setButtonRadius: (r: number) => void;
  setButtonShape: (s: StudioStore['buttonShape']) => void;
  setPillShape: (s: StudioStore['pillShape']) => void;
  setUiScale: (s: number) => void;
  setEditorFont: (patch: Partial<{ family: string; size: number; bold: boolean; italic: boolean }>) => void;
  setChromeColor: (key: keyof StudioStore['chromeColors'], value: string) => void;
  resetChromeColors: () => void;

  setProbeColor: (idx: number, color: string) => void;
  setProbeTopic: (idx: number, topic: string) => void;
  toggleProbesEnabled: () => void;
  setWordHighlights: (h: Record<string, string>) => void;

  addTag: (tag: string, category: TagCategory) => void;
  removeTag: (tag: string, category: TagCategory) => void;
  bulkLoadTags: (category: TagCategory, text: string) => void;

  addDiscoveredTag: (tag: string) => void;
  acceptDiscoveredTag: (tag: string, category: TagCategory) => void;
  removeDiscoveredTag: (tag: string) => void;


  addCustomBranch: (branch: StyleBranch) => void;
  removeCustomBranch: (id: string) => void;
  removeTagFromBranch: (branchId: string, pillLabel: string) => void;

  addCustomTagCategory: (cat: { name: string; icon: string; color: string }) => string;
  removeCustomTagCategory: (id: string) => void;
  updateCustomTagCategory: (id: string, patch: Partial<Omit<CustomTagCategory, 'id'>>) => void;
  addTagToCustomCategory: (id: string, tag: string) => void;
  removeTagFromCustomCategory: (id: string, tag: string) => void;
  bulkLoadCustomCategoryTags: (id: string, text: string) => void;

  addPocketItem: (text: string) => void;
  removePocketItem: (id: string) => void;
  clearPocket: () => void;

  /** Replace the entire tag library — used by import to merge dedupe'd dumps. */
  setMasterTagLibrary: (lib: TagLibrary) => void;
  /** Bulk-add pocket items from a dump (dedupes against existing). */
  importPocketItems: (items: string[]) => void;
  /** Bulk-add branches from a dump (dedupes by name, replacing pills if name matches). */
  importBranches: (parsed: { name: string; pills: string[] }[]) => void;

  addQuest: (q: { title: string; body: string }) => void;
  bulkAddQuests: (text: string) => void;
  toggleQuestActive: (id: string) => void;
  removeQuest: (id: string) => void;
}

export const useStudio = create<StudioStore>()(
  persist(
    (set) => ({
      isGhostMode: false,
      ghostSkeleton: [],
      ghostBgImage: null,
      ghostBgWidth: 0,
      ghostBgHeight: 0,
      savedLyric: '',
      masterTagLibrary: DEFAULT_LIBRARY,
      rhythmicSkeleton: [],
      customBranches: [],
      customTagCategories: [],
      discoveredTags: [],
      bracketType: 'square',
      pads: [{ id: 'pad-default', name: 'Lyric Pad', lyricText: '', styleText: '' }],
      activePadId: 'pad-default',
      lyricText: '',
      styleText: '',
      creativityFrames: DEFAULT_CREATIVITY_FRAMES,
      randomBanks: DEFAULT_RANDOM_BANKS,
      customSylColors: DEFAULT_SYL_COLORS,
      sylBgAlpha: 0.12,
      ghostMatchColor: '#4ECB71',
      ghostMismatchColor: '#FF6B6B',
      ghostMatchAlphaMul: 2.4,
      ghostBgOpacity: 0.55,
      catColors: DEFAULT_CAT_COLORS,
      mainTextColor: DEFAULT_MAIN_TEXT_COLOR,
      mainCanvasColor: DEFAULT_MAIN_CANVAS_COLOR,
      rhymePalette: DEFAULT_RHYME_PALETTE,
      buttonRadius: 0.25,
      buttonShape: 'free',
      pillShape: 'circle',
      uiScale: 1,
      editorFontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      editorFontSize: 16,
      editorFontBold: false,
      editorFontItalic: false,
      chromeColors: { surface: '', panel: '', border: '', muted: '' },
      wordProbes: Array.from({ length: 20 }, (_, i) => ({
        color: DEFAULT_RHYME_PALETTE[i] ?? '#666666',
        topic: '',
      })),
      probesEnabled: false,
      wordHighlights: {},
      pocketItems: [],
      quests: [],
      questPoints: 0,

      // Single-pad ghost model: enable saves the current lyric, freezes
      // the skeleton as the rhyme target, and clears the pad so the user
      // can write new lyrics on top of the captured snapshot. disable
      // restores the saved lyric. Only one editor state — no separate
      // ghostText to keep in sync.
      enableGhost: (snapshot, dims) =>
        set((s) => {
          const ghost: PadGhost = {
            isActive: true,
            savedLyric: s.lyricText,
            bgImage: snapshot,
            bgWidth: dims?.width ?? 0,
            bgHeight: dims?.height ?? 0,
            skeleton: [...s.rhythmicSkeleton],
          };
          return {
            isGhostMode: true,
            ghostBgImage: snapshot,
            ghostBgWidth: dims?.width ?? 0,
            ghostBgHeight: dims?.height ?? 0,
            ghostSkeleton: [...s.rhythmicSkeleton],
            savedLyric: s.lyricText,
            lyricText: '',
            rhythmicSkeleton: [],
            // Mirror into the active pad so swap/reload restores ghost state.
            pads: s.pads.map((p) =>
              p.id === s.activePadId ? { ...p, lyricText: '', ghost } : p
            ),
          };
        }),

      exportGhostToLyric: () =>
        set((s) => {
          if (!s.isGhostMode) return {};
          const promoted = s.lyricText;
          // savedLyric is what the editor restores to on disableGhost.
          // Replacing it with the current typed text means "exit ghost
          // and keep what I just wrote" — the trace becomes obsolete.
          return {
            savedLyric: promoted,
            pads: s.pads.map((p) =>
              p.id === s.activePadId && p.ghost
                ? { ...p, ghost: { ...p.ghost, savedLyric: promoted } }
                : p
            ),
          };
        }),

      disableGhost: () =>
        set((s) => ({
          isGhostMode: false,
          ghostBgImage: null,
          ghostBgWidth: 0,
          ghostBgHeight: 0,
          ghostSkeleton: [],
          lyricText: s.savedLyric,
          savedLyric: '',
          pads: s.pads.map((p) =>
            p.id === s.activePadId
              ? { ...p, lyricText: s.savedLyric, ghost: undefined }
              : p
          ),
        })),

      setRhythmicSkeleton: (lines) => set({ rhythmicSkeleton: lines }),
      // Lyric/Style setters update both the live mirror AND the active pad
      // so a pad swap can read the latest content from `pads[]`.
      setLyricText: (text) =>
        set((s) => ({
          lyricText: text,
          pads: s.pads.map((p) => (p.id === s.activePadId ? { ...p, lyricText: text } : p)),
        })),
      setStyleText: (text) =>
        set((s) => ({
          styleText: text,
          pads: s.pads.map((p) => (p.id === s.activePadId ? { ...p, styleText: text } : p)),
        })),
      setBracketType: (t) => set({ bracketType: t }),

      addPad: (name) => {
        const id = `pad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => {
          const finalName = name?.trim() || `Pad ${s.pads.length + 1}`;
          return {
            pads: [
              // Capture the active pad's latest live text before pushing the
              // new one — protects against unsaved keystrokes between debounces.
              ...s.pads.map((p) =>
                p.id === s.activePadId
                  ? { ...p, lyricText: s.lyricText, styleText: s.styleText }
                  : p
              ),
              { id, name: finalName, lyricText: '', styleText: '' },
            ],
            activePadId: id,
            lyricText: '',
            styleText: '',
            rhythmicSkeleton: [],
          };
        });
        return id;
      },
      removePad: (id) =>
        set((s) => {
          if (s.pads.length <= 1) return {}; // never delete the last pad
          const idx = s.pads.findIndex((p) => p.id === id);
          if (idx === -1) return {};
          const remaining = s.pads.filter((p) => p.id !== id);
          // If we just removed the active pad, jump to its neighbour.
          if (id === s.activePadId) {
            const nextActive = remaining[Math.max(0, idx - 1)] ?? remaining[0];
            return {
              pads: remaining,
              activePadId: nextActive.id,
              lyricText: nextActive.lyricText,
              styleText: nextActive.styleText,
              rhythmicSkeleton: [],
            };
          }
          return { pads: remaining };
        }),
      renamePad: (id, name) =>
        set((s) => ({
          pads: s.pads.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
        })),
      setActivePad: (id) =>
        set((s) => {
          if (id === s.activePadId) return {};
          const target = s.pads.find((p) => p.id === id);
          if (!target) return {};
          // Capture outgoing pad's live state — text + ghost + savedLyric —
          // so swapping back restores the user's exact place.
          const outgoingGhost: PadGhost | undefined = s.isGhostMode
            ? {
                isActive: true,
                savedLyric: s.savedLyric,
                bgImage: s.ghostBgImage,
                bgWidth: s.ghostBgWidth,
                bgHeight: s.ghostBgHeight,
                skeleton: s.ghostSkeleton,
              }
            : undefined;
          const updatedPads = s.pads.map((p) =>
            p.id === s.activePadId
              ? { ...p, lyricText: s.lyricText, styleText: s.styleText, ghost: outgoingGhost }
              : p
          );
          // Hydrate from incoming pad's saved ghost state (if any).
          const g = target.ghost;
          return {
            pads: updatedPads,
            activePadId: id,
            lyricText: target.lyricText,
            styleText: target.styleText,
            rhythmicSkeleton: [],
            isGhostMode: g?.isActive ?? false,
            ghostBgImage: g?.bgImage ?? null,
            ghostBgWidth: g?.bgWidth ?? 0,
            ghostBgHeight: g?.bgHeight ?? 0,
            ghostSkeleton: g?.skeleton ?? [],
            savedLyric: g?.savedLyric ?? '',
          };
        }),

      addTag: (tag, category) =>
        set((s) => ({
          masterTagLibrary: {
            ...s.masterTagLibrary,
            [category]: [...new Set([...s.masterTagLibrary[category], tag])],
          },
        })),

      removeTag: (tag, category) =>
        set((s) => ({
          masterTagLibrary: {
            ...s.masterTagLibrary,
            [category]: s.masterTagLibrary[category].filter((t) => t !== tag),
          },
        })),

      bulkLoadTags: (category, text) => {
        const newTags = parsePills(text);
        set((s) => ({
          masterTagLibrary: {
            ...s.masterTagLibrary,
            [category]: [...new Set([...s.masterTagLibrary[category], ...newTags])],
          },
        }));
      },

      addDiscoveredTag: (tag) =>
        set((s) => {
          const allKnown = Object.values(s.masterTagLibrary).flat();
          if (allKnown.includes(tag) || s.discoveredTags.includes(tag)) return {};
          return { discoveredTags: [...s.discoveredTags, tag] };
        }),

      acceptDiscoveredTag: (tag, category) =>
        set((s) => ({
          discoveredTags: s.discoveredTags.filter((t) => t !== tag),
          masterTagLibrary: {
            ...s.masterTagLibrary,
            [category]: [...new Set([...s.masterTagLibrary[category], tag])],
          },
        })),

      removeDiscoveredTag: (tag) =>
        set((s) => ({ discoveredTags: s.discoveredTags.filter((t) => t !== tag) })),

      addCustomBranch: (branch) =>
        set((s) => ({ customBranches: [...s.customBranches, branch] })),

      removeCustomBranch: (id) =>
        set((s) => ({ customBranches: s.customBranches.filter((b) => b.id !== id) })),

      removeTagFromBranch: (branchId, pillLabel) =>
        set((s) => ({
          customBranches: s.customBranches.map((b) =>
            b.id === branchId ? { ...b, pills: b.pills.filter((p) => p !== pillLabel) } : b
          ),
        })),

      addCustomTagCategory: ({ name, icon, color }) => {
        const id = `tagcat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          customTagCategories: [
            ...s.customTagCategories,
            { id, name: name.trim() || `Category ${s.customTagCategories.length + 1}`, icon: icon || '🏷', color, tags: [] },
          ],
        }));
        return id;
      },
      removeCustomTagCategory: (id) =>
        set((s) => ({
          customTagCategories: s.customTagCategories.filter((c) => c.id !== id),
        })),
      updateCustomTagCategory: (id, patch) =>
        set((s) => ({
          customTagCategories: s.customTagCategories.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),
      addTagToCustomCategory: (id, tag) =>
        set((s) => ({
          customTagCategories: s.customTagCategories.map((c) =>
            c.id === id && !c.tags.includes(tag) ? { ...c, tags: [...c.tags, tag] } : c
          ),
        })),
      removeTagFromCustomCategory: (id, tag) =>
        set((s) => ({
          customTagCategories: s.customTagCategories.map((c) =>
            c.id === id ? { ...c, tags: c.tags.filter((t) => t !== tag) } : c
          ),
        })),
      bulkLoadCustomCategoryTags: (id, text) => {
        const newTags = parsePills(text);
        set((s) => ({
          customTagCategories: s.customTagCategories.map((c) =>
            c.id === id ? { ...c, tags: [...new Set([...c.tags, ...newTags])] } : c
          ),
        }));
      },

      setMasterTagLibrary: (lib) => set({ masterTagLibrary: lib }),
      importPocketItems: (items) =>
        set((s) => {
          const existing = new Set(s.pocketItems.map((p) => p.text));
          const fresh = items
            .filter((t) => !existing.has(t))
            .map((text, i) => ({
              id: `pkt-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
              text,
              createdAt: Date.now(),
            }));
          return { pocketItems: [...fresh, ...s.pocketItems] };
        }),
      importBranches: (parsed) =>
        set((s) => {
          // Map by name. If a branch with the same name exists, REPLACE its
          // pills with the imported (deduped) set. New names get a fresh id.
          const byName = new Map(s.customBranches.map((b) => [b.name, b]));
          const stamp = Date.now();
          let i = 0;
          for (const { name, pills } of parsed) {
            const ex = byName.get(name);
            if (ex) {
              byName.set(name, { ...ex, pills });
            } else {
              byName.set(name, {
                id: `branch-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                name,
                pills,
              });
              i++;
            }
          }
          return { customBranches: Array.from(byName.values()) };
        }),

      addCreativityFrame: (f) =>
        set((s) => ({ creativityFrames: [...s.creativityFrames, f] })),
      removeCreativityFrame: (id) =>
        set((s) => ({ creativityFrames: s.creativityFrames.filter((f) => f.id !== id) })),
      renameCreativityFrame: (id, name) =>
        set((s) => ({
          creativityFrames: s.creativityFrames.map((f) => (f.id === id ? { ...f, name } : f)),
        })),

      addRandomBank: (b) => set((s) => ({ randomBanks: [...s.randomBanks, b] })),
      updateRandomBank: (id, patch) =>
        set((s) => ({
          randomBanks: s.randomBanks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      removeRandomBank: (id) =>
        set((s) => ({ randomBanks: s.randomBanks.filter((b) => b.id !== id) })),

      setSylColor: (count, color) =>
        set((s) => ({ customSylColors: { ...s.customSylColors, [count]: color } })),
      resetSylColors: () => set({ customSylColors: DEFAULT_SYL_COLORS }),
      setSylBgAlpha: (a) => set({ sylBgAlpha: Math.max(0, Math.min(1, a)) }),
      setGhostMatchColor: (c) => set({ ghostMatchColor: c }),
      setGhostMismatchColor: (c) => set({ ghostMismatchColor: c }),
      setGhostMatchAlphaMul: (a) => set({ ghostMatchAlphaMul: Math.max(0, Math.min(5, a)) }),
      setGhostBgOpacity: (a) => set({ ghostBgOpacity: Math.max(0, Math.min(1, a)) }),
      setCatColor: (cat, color) =>
        set((s) => ({ catColors: { ...s.catColors, [cat]: color } })),
      resetCatColors: () => set({ catColors: DEFAULT_CAT_COLORS }),
      setMainTextColor: (c) => set({ mainTextColor: c }),
      setMainCanvasColor: (c) => set({ mainCanvasColor: c }),
      setRhymeColor: (idx, color) =>
        set((s) => {
          if (idx < 0 || idx >= s.rhymePalette.length) return {};
          const next = s.rhymePalette.slice();
          next[idx] = color;
          return { rhymePalette: next };
        }),
      resetRhymePalette: () => set({ rhymePalette: DEFAULT_RHYME_PALETTE }),
      setButtonRadius: (r) => set({ buttonRadius: Math.max(0, Math.min(1, r)) }),
      setButtonShape: (s) => set({ buttonShape: s }),
      setPillShape: (s) => set({ pillShape: s }),
      setUiScale: (s) => set({ uiScale: Math.max(0.3, Math.min(1.5, s)) }),
      setEditorFont: (patch) =>
        set((s) => ({
          editorFontFamily: patch.family ?? s.editorFontFamily,
          editorFontSize: patch.size != null ? Math.max(8, Math.min(48, patch.size)) : s.editorFontSize,
          editorFontBold: patch.bold ?? s.editorFontBold,
          editorFontItalic: patch.italic ?? s.editorFontItalic,
        })),
      setChromeColor: (key, value) =>
        set((s) => ({ chromeColors: { ...s.chromeColors, [key]: value } })),
      resetChromeColors: () =>
        set({ chromeColors: { surface: '', panel: '', border: '', muted: '' } }),

      setProbeColor: (idx, color) =>
        set((s) => {
          if (idx < 0 || idx >= s.wordProbes.length) return {};
          const next = s.wordProbes.slice();
          next[idx] = { ...next[idx], color };
          return { wordProbes: next };
        }),
      setProbeTopic: (idx, topic) =>
        set((s) => {
          if (idx < 0 || idx >= s.wordProbes.length) return {};
          const next = s.wordProbes.slice();
          next[idx] = { ...next[idx], topic };
          return { wordProbes: next };
        }),
      toggleProbesEnabled: () => set((s) => ({ probesEnabled: !s.probesEnabled })),
      setWordHighlights: (h) => set({ wordHighlights: h }),

      addPocketItem: (text) =>
        set((s) => {
          const trimmed = text.trim();
          if (!trimmed) return {};
          return {
            pocketItems: [
              { id: `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: trimmed, createdAt: Date.now() },
              ...s.pocketItems,
            ],
          };
        }),
      removePocketItem: (id) =>
        set((s) => ({ pocketItems: s.pocketItems.filter((p) => p.id !== id) })),
      clearPocket: () => set({ pocketItems: [] }),

      addQuest: ({ title, body }) =>
        set((s) => {
          const t = title.trim();
          const b = body.trim();
          if (!t && !b) return {};
          return {
            quests: [
              ...s.quests,
              { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: t || b, body: b || t, active: false },
            ],
          };
        }),
      bulkAddQuests: (text) =>
        set((s) => {
          const parsed = text.split('\n').map(parseQuestLine).filter(Boolean) as Array<{ body: string; title: string }>;
          if (!parsed.length) return {};
          const stamp = Date.now();
          return {
            quests: [
              ...s.quests,
              ...parsed.map((p, i) => ({
                id: `q-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                title: p.title,
                body: p.body,
                active: false,
              })),
            ],
          };
        }),
      toggleQuestActive: (id) =>
        set((s) => {
          const target = s.quests.find((q) => q.id === id);
          if (!target) return {};
          // Award 10 points only on the false→true transition. Toggling
          // a quest off does NOT subtract — points stay banked so the
          // user can't farm by repeatedly re-checking the same quest.
          const willActivate = !target.active;
          return {
            quests: s.quests.map((q) => (q.id === id ? { ...q, active: !q.active } : q)),
            questPoints: willActivate ? s.questPoints + 10 : s.questPoints,
          };
        }),
      removeQuest: (id) =>
        set((s) => ({ quests: s.quests.filter((q) => q.id !== id) })),
    }),
    {
      name: 'lyrical-cad-v1',
      storage: safeStorage,
      partialize: (state) => ({
        masterTagLibrary: state.masterTagLibrary,
        customBranches: state.customBranches,
        customTagCategories: state.customTagCategories,
        discoveredTags: state.discoveredTags,
        pads: state.pads,
        activePadId: state.activePadId,
        lyricText: state.lyricText,
        savedLyric: state.savedLyric,
        styleText: state.styleText,
        bracketType: state.bracketType,
        creativityFrames: state.creativityFrames,
        randomBanks: state.randomBanks,
        customSylColors: state.customSylColors,
        sylBgAlpha: state.sylBgAlpha,
        ghostMatchColor: state.ghostMatchColor,
        ghostMismatchColor: state.ghostMismatchColor,
        ghostMatchAlphaMul: state.ghostMatchAlphaMul,
        ghostBgOpacity: state.ghostBgOpacity,
        catColors: state.catColors,
        mainTextColor: state.mainTextColor,
        mainCanvasColor: state.mainCanvasColor,
        rhymePalette: state.rhymePalette,
        buttonRadius: state.buttonRadius,
        buttonShape: state.buttonShape,
        pillShape: state.pillShape,
        uiScale: state.uiScale,
        editorFontFamily: state.editorFontFamily,
        editorFontSize: state.editorFontSize,
        editorFontBold: state.editorFontBold,
        editorFontItalic: state.editorFontItalic,
        chromeColors: state.chromeColors,
        wordProbes: state.wordProbes,
        probesEnabled: state.probesEnabled,
        pocketItems: state.pocketItems,
        quests: state.quests,
        questPoints: state.questPoints,
      }),
      // Strip stale empty-line bloat from prior buggy rebuilds. Some
      // persisted documents reached 70k+ trailing newlines because the
      // old buildEditorHtml double-counted empty lines on every
      // round trip. Normalize on read. Also migrate the legacy
      // `ghostText` field — drop it since the new model only has
      // `lyricText` + `savedLyric`.
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<StudioStore> & {
          ghostText?: string;
        };
        const sanitize = (t: string | undefined): string => {
          if (!t) return '';
          return t.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
        };

        let lyricText = sanitize(p.lyricText);
        let savedLyric = sanitize(p.savedLyric);

        // Recovery: if the previous session ended while ghost mode was
        // active, lyricText is empty and savedLyric still holds the
        // pre-ghost content. isGhostMode/ghostBgImage are not persisted
        // (so we always boot in normal mode), which would otherwise
        // strand the saved lyric. Pull it back into lyricText.
        if (!lyricText && savedLyric) {
          lyricText = savedLyric;
          savedLyric = '';
        }
        // Legacy: if a prior version persisted ghostText and the current
        // lyricText is empty, fall back to that as the recovery source.
        if (!lyricText && p.ghostText) {
          lyricText = sanitize(p.ghostText);
        }

        const styleText = sanitize(p.styleText);

        // Migrate single-pad persisted state into the new pads[] shape.
        // First-run users (and anyone upgrading from before tabs existed)
        // get a single "Lyric Pad" pad seeded with their existing text.
        let pads = p.pads;
        let activePadId = p.activePadId;
        if (!pads || pads.length === 0) {
          const id = 'pad-default';
          pads = [{ id, name: 'Lyric Pad', lyricText, styleText }];
          activePadId = id;
        } else {
          // Sanitize each pad's text on read.
          pads = pads.map((pd) => ({
            ...pd,
            lyricText: sanitize(pd.lyricText),
            styleText: sanitize(pd.styleText),
          }));
          if (!activePadId || !pads.find((pd) => pd.id === activePadId)) {
            activePadId = pads[0].id;
          }
        }
        // Mirror the active pad's text into the live fields so the editors
        // hydrate from the correct slot on first paint.
        const active = pads.find((pd) => pd.id === activePadId)!;

        const merged = {
          ...currentState,
          ...p,
          pads,
          activePadId,
          lyricText: active.lyricText,
          styleText: active.styleText,
          savedLyric,
        };
        delete (merged as { ghostText?: string }).ghostText;
        return merged;
      },
    }
  )
);
