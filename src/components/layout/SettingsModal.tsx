'use client';

import { useEffect, useRef, useState } from 'react';
import {
  useStudio,
  DEFAULT_CAT_COLORS,
  DEFAULT_RHYME_PALETTE,
  DEFAULT_MAIN_TEXT_COLOR,
  DEFAULT_MAIN_CANVAS_COLOR,
} from '@/store/useStudio';
import { TagCategory } from '@/types';
import { DEFAULT_SYL_PALETTE } from '@/lib/colors';
import IconPicker from './IconPicker';
import BulkEditModal from '@/components/tags/BulkEditModal';
import {
  dumpTags, mergeTagsFromDump,
  dumpBranches, parseBranchesDump,
} from '@/lib/libraryIO';

const TAG_CATS: TagCategory[] = ['Style', 'Lyrics', 'FX', 'Mood', 'Instruments', 'Genre'];

/** Curated common font families. Power users can still type a custom CSS
 *  font-family stack via the Custom… option. The label = what the user
 *  sees in the dropdown; the value = the actual CSS font-family value. */
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Mono — JetBrains',     value: "'JetBrains Mono', 'Fira Code', Consolas, monospace" },
  { label: 'Mono — Fira Code',     value: "'Fira Code', 'Cascadia Code', monospace" },
  { label: 'Mono — Source',        value: "'Source Code Pro', 'Consolas', monospace" },
  { label: 'Mono — System',        value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  { label: 'Sans — System',        value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { label: 'Sans — Inter',         value: "'Inter', system-ui, sans-serif" },
  { label: 'Sans — Helvetica',     value: "Helvetica, Arial, sans-serif" },
  { label: 'Serif — Iowan',        value: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif" },
  { label: 'Serif — Georgia',      value: "Georgia, 'Times New Roman', serif" },
  { label: 'Serif — Charter',      value: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif" },
  { label: 'Display — Courier',    value: "'Courier New', Courier, monospace" },
  { label: 'Display — Cursive',    value: "'Brush Script MT', 'Lucida Handwriting', cursive" },
];

/** Collapsible section header — click the bar to expand/collapse the body. */
function Section({
  title,
  subtitle,
  defaultOpen = false,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-studio-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-studio-hover/30 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-studio-text">{title}</div>
          {subtitle && <div className="text-xs text-studio-muted truncate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {right}
          <span className="text-xs text-studio-muted">{open ? '▾' : '▸'}</span>
        </div>
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </section>
  );
}

const CAT_LABELS: { key: string; label: string }[] = [
  { key: 'Style', label: '🎼 Style' },
  { key: 'Lyrics', label: '✍️ Lyrics' },
  { key: 'FX', label: '🎚 FX' },
  { key: 'Mood', label: '🌡 Mood' },
  { key: 'Instruments', label: '🎸 Instruments' },
  { key: 'Genre', label: '🎭 Genre' },
  { key: 'discovered', label: '🔍 Discovered' },
  { key: 'CustomBranches', label: '🌿 Branches' },
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    customSylColors, setSylColor, resetSylColors,
    sylBgAlpha, setSylBgAlpha,
    ghostMatchColor, setGhostMatchColor,
    ghostMismatchColor, setGhostMismatchColor,
    ghostMatchAlphaMul, setGhostMatchAlphaMul,
    ghostBgOpacity, setGhostBgOpacity,
    catColors, setCatColor, resetCatColors,
    mainTextColor, setMainTextColor,
    mainCanvasColor, setMainCanvasColor,
    rhymePalette, setRhymeColor, resetRhymePalette,
    buttonRadius, setButtonRadius,
    wordProbes, setProbeColor, setProbeTopic, probesEnabled, toggleProbesEnabled,
    customTagCategories, addCustomTagCategory, removeCustomTagCategory, updateCustomTagCategory,
    uiScale, setUiScale,
    editorFontFamily, editorFontSize, editorFontBold, editorFontItalic, setEditorFont,
    chromeColors, setChromeColor, resetChromeColors,
    buttonShape, setButtonShape,
    pillShape, setPillShape,
    masterTagLibrary, setMasterTagLibrary,
    customBranches, importBranches,
    bulkLoadCustomCategoryTags,
    addPad, setLyricText, lyricText,
  } = useStudio();
  const [bulkCategory, setBulkCategory] = useState<TagCategory | null>(null);
  // Bulk Edit dropdown selection inside Settings.
  const [bulkPickerCat, setBulkPickerCat] = useState<TagCategory>('Style');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷');
  const [newCatColor, setNewCatColor] = useState('#22d3ee');
  const fileRef = useRef<HTMLInputElement>(null);

  /** Dump the entire persisted store as a JSON file the user can keep / share. */
  const exportSettings = () => {
    const raw = window.localStorage.getItem('lyrical-cad-v1');
    if (!raw) return;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyricalcad-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Replace the persisted store with the contents of a file. Page reloads
   *  so every component re-hydrates from the imported state. */
  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        // Validate JSON shape before clobbering localStorage.
        JSON.parse(text);
        window.localStorage.setItem('lyrical-cad-v1', text);
        window.location.reload();
      } catch {
        alert('Invalid settings file — could not parse JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /** Wipe persisted state, clear runtime caches, and reload to defaults. */
  const masterReset = () => {
    if (!confirm('Master Reset will wipe ALL settings AND content (pads, tags, branches, pocket, quests). Continue?')) return;
    if (!confirm('This cannot be undone. Are you absolutely sure?')) return;
    window.localStorage.removeItem('lyrical-cad-v1');
    window.location.reload();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass rounded-lg shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-studio-border">
          <span className="font-semibold text-studio-text">⚙️ Settings</span>
          <button onClick={onClose} className="text-studio-muted hover:text-studio-text text-sm">✕</button>
        </div>

        {/* Top action bar — Import / Export / Master Reset */}
        <div className="flex items-center gap-2 px-4 py-2 bg-studio-bg/40 border-b border-studio-border text-xs">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-2 py-1 text-blue-300 border border-blue-500/30 hover:bg-blue-600/20"
            title="Load settings from a JSON file (replaces current state)"
          >
            ↘ Import
          </button>
          <button
            onClick={exportSettings}
            className="px-2 py-1 text-blue-300 border border-blue-500/30 hover:bg-blue-600/20"
            title="Save all settings + content to a JSON file"
          >
            ↗ Export
          </button>
          <button
            onClick={masterReset}
            className="ml-auto px-2 py-1 text-red-300 border border-red-500/40 hover:bg-red-600/20"
            title="Wipe everything and start fresh — requires confirm"
          >
            ⚠ Master Reset
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={onImport}
            className="hidden"
          />
        </div>

        <Section title="General" subtitle="Editor font, text color, and global UI scale.">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
              <span className="text-xs text-studio-muted w-20">Font family</span>
              <select
                value={
                  FONT_OPTIONS.some((f) => f.value === editorFontFamily) ? editorFontFamily : '__custom__'
                }
                onChange={(e) => {
                  if (e.target.value === '__custom__') return;
                  setEditorFont({ family: e.target.value });
                }}
                className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs outline-none"
                style={{ fontFamily: editorFontFamily }}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
                <option value="__custom__">Custom… (use the input below)</option>
              </select>
              <button
                onClick={() => setEditorFont({ family: "'JetBrains Mono', 'Fira Code', Consolas, monospace" })}
                className="text-[10px] text-studio-muted hover:text-studio-text"
                title="Reset"
              >
                ↺
              </button>
            </label>

            {/* Custom font input — only relevant when the user picked
             * a family that isn't in the dropdown. Keeps power-user
             * access (CSS font-family stack) without cluttering. */}
            {!FONT_OPTIONS.some((f) => f.value === editorFontFamily) && (
              <input
                type="text"
                value={editorFontFamily}
                onChange={(e) => setEditorFont({ family: e.target.value })}
                placeholder="e.g. 'Iowan Old Style', Georgia, serif"
                className="bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none"
              />
            )}

            <label className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
              <span className="text-xs text-studio-muted w-20">Text color</span>
              <input
                type="color"
                value={mainTextColor}
                onChange={(e) => setMainTextColor(e.target.value)}
                className="h-6 w-9 border border-studio-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={mainTextColor}
                onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setMainTextColor(e.target.value); }}
                className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none"
              />
              <button
                onClick={() => setMainTextColor(DEFAULT_MAIN_TEXT_COLOR)}
                className="text-[10px] text-studio-muted hover:text-studio-text"
                title="Reset"
              >
                ↺
              </button>
            </label>

            <div className="flex items-center gap-3 px-2 py-2 rounded border border-studio-border bg-studio-bg/40">
              <span className="text-xs text-studio-muted whitespace-nowrap w-20">Font size</span>
              <input
                type="range"
                min={8}
                max={48}
                step={1}
                value={editorFontSize}
                onChange={(e) => setEditorFont({ size: parseInt(e.target.value, 10) })}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs font-mono text-studio-text tabular-nums w-12 text-right">
                {editorFontSize}px
              </span>
            </div>

            <div className="flex items-center gap-3 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
              <span className="text-xs text-studio-muted whitespace-nowrap w-20">Style</span>
              <button
                onClick={() => setEditorFont({ bold: !editorFontBold })}
                className={`px-3 py-0.5 text-xs border ${editorFontBold ? 'bg-blue-600/30 text-blue-200 border-blue-500/50' : 'text-studio-muted border-studio-border'}`}
                style={{ fontWeight: 700 }}
              >
                B
              </button>
              <button
                onClick={() => setEditorFont({ italic: !editorFontItalic })}
                className={`px-3 py-0.5 text-xs border ${editorFontItalic ? 'bg-blue-600/30 text-blue-200 border-blue-500/50' : 'text-studio-muted border-studio-border'}`}
                style={{ fontStyle: 'italic' }}
              >
                I
              </button>
            </div>

            <div className="flex items-center gap-3 px-2 py-2 rounded border border-studio-border bg-studio-bg/40">
              <span className="text-xs text-studio-muted whitespace-nowrap w-20">UI scale</span>
              <input
                type="range"
                min={0.3}
                max={1.5}
                step={0.05}
                value={uiScale}
                onChange={(e) => setUiScale(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500"
                title="Scales the entire UI typography. Editor pad font stays fixed (set above)."
              />
              <span className="text-xs font-mono text-studio-text tabular-nums w-12 text-right">
                {Math.round(uiScale * 100)}%
              </span>
              <button
                onClick={() => setUiScale(1)}
                className="text-[10px] text-studio-muted hover:text-studio-text"
                title="Reset to 100%"
              >
                ↺
              </button>
            </div>
          </div>
        </Section>

        <Section title="Syllable Colors" subtitle="Hue per syllable count in the gutter & legend.">
          <div className="flex items-center justify-end -mt-1">
            <button onClick={resetSylColors} className="text-xs text-blue-400 hover:text-blue-300">
              Reset to defaults
            </button>
          </div>

          <div className="flex items-center gap-3 px-2 py-2 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted whitespace-nowrap">Box opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sylBgAlpha}
              onChange={(e) => setSylBgAlpha(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500"
              title="Background transparency for syllable highlight boxes"
            />
            <span className="text-xs font-mono text-studio-text tabular-nums w-10 text-right">
              {(sylBgAlpha * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setSylBgAlpha(0.12)}
              className="text-[10px] text-studio-muted hover:text-studio-text"
              title="Reset to default 12%"
            >
              ↺
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const color = customSylColors[n] ?? DEFAULT_SYL_PALETTE[n];
              return (
                <label
                  key={n}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40"
                >
                  <span className="font-mono text-xs w-8 text-studio-muted">
                    {n === 10 ? '10+' : n}
                  </span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setSylColor(n, e.target.value)}
                    className="h-6 w-10 rounded border border-studio-border bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setSylColor(n, v);
                    }}
                    className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none focus:border-blue-500/50"
                  />
                </label>
              );
            })}
          </div>
        </Section>

        <Section title="Ghost Mode" subtitle="Match / mismatch colors and tracing-paper opacity." defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
              <span className="text-xs text-studio-muted w-16">Match</span>
              <input
                type="color"
                value={ghostMatchColor}
                onChange={(e) => setGhostMatchColor(e.target.value)}
                className="h-6 w-10 rounded border border-studio-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={ghostMatchColor}
                onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setGhostMatchColor(e.target.value); }}
                className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none"
              />
            </label>
            <label className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
              <span className="text-xs text-studio-muted w-16">Mismatch</span>
              <input
                type="color"
                value={ghostMismatchColor}
                onChange={(e) => setGhostMismatchColor(e.target.value)}
                className="h-6 w-10 rounded border border-studio-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={ghostMismatchColor}
                onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setGhostMismatchColor(e.target.value); }}
                className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 px-2 py-2 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted whitespace-nowrap w-24">Match opacity</span>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={ghostMatchAlphaMul}
              onChange={(e) => setGhostMatchAlphaMul(parseFloat(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <span className="text-xs font-mono text-studio-text tabular-nums w-10 text-right">
              {ghostMatchAlphaMul.toFixed(1)}×
            </span>
          </div>

          <div className="flex items-center gap-3 px-2 py-2 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted whitespace-nowrap w-24">Trace opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={ghostBgOpacity}
              onChange={(e) => setGhostBgOpacity(parseFloat(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <span className="text-xs font-mono text-studio-text tabular-nums w-10 text-right">
              {(ghostBgOpacity * 100).toFixed(0)}%
            </span>
          </div>
        </Section>

        <Section
          title="Pill Colors"
          subtitle="One hex per category — drives bg, border, and text shade."
          defaultOpen={false}
          right={
            <button
              onClick={(e) => { e.stopPropagation(); resetCatColors(); }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {CAT_LABELS.map(({ key, label }) => {
              const color = catColors[key] ?? DEFAULT_CAT_COLORS[key];
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40"
                >
                  <span className="text-xs text-studio-muted w-24 truncate">{label}</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setCatColor(key, e.target.value)}
                    className="h-6 w-10 rounded border border-studio-border bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setCatColor(key, e.target.value); }}
                    className="flex-1 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none min-w-0"
                  />
                </label>
              );
            })}
          </div>
        </Section>

        <Section title="Button Shape" subtitle="Morph every button — rectangle ↔ pill." defaultOpen={false}>
          <div className="flex items-center gap-3 px-2 py-2 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted whitespace-nowrap w-16">Radius</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={buttonRadius}
              onChange={(e) => setButtonRadius(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-xs font-mono text-studio-text tabular-nums w-10 text-right">
              {(buttonRadius * 100).toFixed(0)}%
            </span>
          </div>

          <div className="flex items-center gap-1 justify-center flex-wrap">
            {[
              { v: 'free' as const,         glyph: '〰', label: 'Free (slider)' },
              { v: 'rectangle' as const,    glyph: '▭',  label: 'Rectangle' },
              { v: 'rounded25' as const,    glyph: '▢',  label: 'Rounded 25%' },
              { v: 'rounded50' as const,    glyph: '⬭',  label: 'Rounded 50%' },
              { v: 'circle' as const,       glyph: '⬬',  label: 'Circle / pill' },
              { v: 'poly' as const,         glyph: '⬢',  label: 'Polygon' },
              { v: 'squared-up' as const,   glyph: '⌒',  label: 'Squared up (top round, bottom flat)' },
              { v: 'squared-down' as const, glyph: '⌒̥',  label: 'Squared down (top flat, bottom round)' },
            ].map(({ v, glyph, label }) => (
              <button
                key={v}
                onClick={() => setButtonShape(v)}
                className={`px-3 py-1 text-base border transition-all ${
                  buttonShape === v
                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                    : 'text-studio-muted hover:text-studio-text border-studio-border hover:border-studio-text/30'
                }`}
                title={label}
              >
                {glyph}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Pill Shape" subtitle="Same shape vocabulary, applied to every .pill (tags, branches, fusion, etc.)." defaultOpen={false}>
          <div className="flex items-center gap-1 justify-center flex-wrap">
            {[
              { v: 'rectangle' as const,    glyph: '▭',  label: 'Rectangle' },
              { v: 'rounded25' as const,    glyph: '▢',  label: 'Rounded 25%' },
              { v: 'rounded50' as const,    glyph: '⬭',  label: 'Rounded 50%' },
              { v: 'circle' as const,       glyph: '⬬',  label: 'Circle / pill (default)' },
              { v: 'poly' as const,         glyph: '⬢',  label: 'Polygon' },
              { v: 'squared-up' as const,   glyph: '⌒',  label: 'Squared up' },
              { v: 'squared-down' as const, glyph: '⌒̥',  label: 'Squared down' },
            ].map(({ v, glyph, label }) => (
              <button
                key={v}
                onClick={() => setPillShape(v)}
                className={`px-3 py-1 text-base border transition-all ${
                  pillShape === v
                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/50'
                    : 'text-studio-muted hover:text-studio-text border-studio-border hover:border-studio-text/30'
                }`}
                title={label}
              >
                {glyph}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="Chrome Colors"
          subtitle="Override surface, panel, border, and muted-text shades. Empty = use the default theme."
          right={
            <button
              onClick={(e) => { e.stopPropagation(); resetChromeColors(); }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          }
        >
          {/* Canvas color sits up here with the other skin overrides
           * since it's the same family of choice — picking the page
           * background is a sibling decision to surface/panel. The
           * editor's TEXT color lives in the General section near the
           * font controls, where the user picks how their writing looks. */}
          <label className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted w-24">Canvas bg</span>
            <input
              type="color"
              value={mainCanvasColor}
              onChange={(e) => setMainCanvasColor(e.target.value)}
              className="h-6 w-9 border border-studio-border bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={mainCanvasColor}
              onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setMainCanvasColor(e.target.value); }}
              className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none"
            />
            <button
              onClick={() => setMainCanvasColor(DEFAULT_MAIN_CANVAS_COLOR)}
              className="text-[10px] text-studio-muted hover:text-studio-text"
              title="Reset"
            >
              ↺
            </button>
          </label>

          {([
            { key: 'surface', label: 'Surface', placeholder: 'bg-studio-surface' },
            { key: 'panel',   label: 'Panel',   placeholder: 'bg-studio-panel' },
            { key: 'border',  label: 'Border',  placeholder: 'border-studio-border' },
            { key: 'muted',   label: 'Muted text', placeholder: 'text-studio-muted' },
          ] as const).map(({ key, label, placeholder }) => {
            const v = chromeColors[key];
            return (
              <label
                key={key}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40"
              >
                <span className="text-xs text-studio-muted w-24">{label}</span>
                <input
                  type="color"
                  value={v || '#000000'}
                  onChange={(e) => setChromeColor(key, e.target.value)}
                  className="h-6 w-9 border border-studio-border bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={v}
                  onChange={(e) => setChromeColor(key, e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs font-mono outline-none"
                />
                {v && (
                  <button
                    onClick={() => setChromeColor(key, '')}
                    className="text-[10px] text-studio-muted hover:text-red-400"
                    title="Clear override"
                  >
                    ✕
                  </button>
                )}
              </label>
            );
          })}
        </Section>

        <Section
          title="Rhyme Palette"
          subtitle="20 slots — the 2-letter suffix of each rhyme word hashes into one of these."
          defaultOpen={false}
          right={
            <button
              onClick={(e) => { e.stopPropagation(); resetRhymePalette(); }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          }
        >
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 20 }, (_, i) => i).map((i) => {
              const color = rhymePalette[i] ?? DEFAULT_RHYME_PALETTE[i];
              return (
                <label
                  key={i}
                  className="flex items-center gap-1 px-1.5 py-1 rounded border border-studio-border bg-studio-bg/40"
                >
                  <span className="font-mono text-[10px] w-5 text-studio-muted tabular-nums text-right">
                    {i + 1}
                  </span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setRhymeColor(i, e.target.value)}
                    className="h-5 w-7 rounded border border-studio-border bg-transparent cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        </Section>

        <Section
          title="Word Probes"
          subtitle="Each slot = one Datamuse topic. Words in the lyric pad matching a topic get its highlight."
          defaultOpen={false}
          right={
            <label
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={probesEnabled}
                onChange={toggleProbesEnabled}
                className="accent-blue-500"
              />
              <span className={probesEnabled ? 'text-blue-300' : 'text-studio-muted'}>
                {probesEnabled ? 'On' : 'Off'}
              </span>
            </label>
          }
        >
          <div className="grid grid-cols-2 gap-1.5">
            {wordProbes.map((p, i) => (
              <label
                key={i}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-studio-border bg-studio-bg/40"
              >
                <span className="font-mono text-[10px] w-5 text-studio-muted tabular-nums text-right">
                  {i + 1}
                </span>
                <input
                  type="color"
                  value={p.color}
                  onChange={(e) => setProbeColor(i, e.target.value)}
                  className="h-5 w-7 rounded border border-studio-border bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={p.topic}
                  onChange={(e) => setProbeTopic(i, e.target.value)}
                  placeholder="topic"
                  className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs outline-none focus:border-blue-500/50"
                />
              </label>
            ))}
          </div>
        </Section>

        <Section
          title="Custom Categories"
          subtitle="Add your own tag categories — name, icon, color. Each becomes a tab in the Tag Tray."
        >
          {customTagCategories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {customTagCategories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40"
                >
                  <IconPicker
                    value={c.icon}
                    onChange={(v) => updateCustomTagCategory(c.id, { icon: v })}
                  />
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateCustomTagCategory(c.id, { name: e.target.value })}
                    className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs outline-none"
                  />
                  <input
                    type="color"
                    value={c.color}
                    onChange={(e) => updateCustomTagCategory(c.id, { color: e.target.value })}
                    className="h-6 w-9 border border-studio-border bg-transparent cursor-pointer"
                  />
                  <span className="text-[10px] text-studio-muted tabular-nums w-8 text-right">
                    {c.tags.length}
                  </span>
                  <button
                    onClick={() => {
                      if (c.tags.length > 0 && !confirm(`Remove "${c.name}" and its ${c.tags.length} tag${c.tags.length === 1 ? '' : 's'}?`)) return;
                      removeCustomTagCategory(c.id);
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300"
                    title="Delete this category"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-dashed border-studio-border bg-studio-bg/20">
            <IconPicker value={newCatIcon} onChange={setNewCatIcon} />
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name"
              className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs outline-none"
            />
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="h-6 w-9 border border-studio-border bg-transparent cursor-pointer"
            />
            <button
              onClick={() => {
                if (!newCatName.trim()) return;
                addCustomTagCategory({ name: newCatName.trim(), icon: newCatIcon || '🏷', color: newCatColor });
                setNewCatName('');
                setNewCatIcon('🏷');
                setNewCatColor('#22d3ee');
              }}
              className="px-2 py-0.5 text-xs text-blue-300 border border-blue-500/40 hover:bg-blue-600/20"
            >
              + Add
            </button>
          </div>
        </Section>

        <Section
          title="Tag Library Tools"
          subtitle="Bulk edit a built-in category, and import/export the whole library through a pad."
        >
          {/* Bulk Edit — pick a category, click Open. */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted w-20">Bulk edit</span>
            <select
              value={bulkPickerCat}
              onChange={(e) => setBulkPickerCat(e.target.value as TagCategory)}
              className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs outline-none"
            >
              {TAG_CATS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={() => setBulkCategory(bulkPickerCat)}
              className="px-2 py-0.5 text-xs text-blue-300 border border-blue-500/40 hover:bg-blue-600/20"
            >
              Open
            </button>
          </div>

          {/* Tags export/import — round-trips through the active pad. */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted w-20">Tags</span>
            <button
              onClick={() => {
                const dump = dumpTags(masterTagLibrary, customTagCategories);
                addPad('Tags dump');
                setLyricText(dump);
                onClose();
              }}
              className="px-2 py-0.5 text-xs text-blue-300 border border-blue-500/40 hover:bg-blue-600/20"
              title="Dump every category (built-in + custom) into a new pad"
            >
              ↗ Export
            </button>
            <button
              onClick={() => {
                if (!lyricText.trim()) { alert('Active pad is empty — paste a tags dump first.'); return; }
                const result = mergeTagsFromDump(
                  masterTagLibrary,
                  lyricText,
                  customTagCategories.map((c) => c.name)
                );
                setMasterTagLibrary(result.library);
                for (const c of result.customAdds) {
                  const id = addCustomTagCategory({ name: c.name, icon: c.icon, color: c.color });
                  if (c.tags.length) bulkLoadCustomCategoryTags(id, c.tags.join('\n'));
                }
                onClose();
              }}
              className="px-2 py-0.5 text-xs text-blue-300 border border-blue-500/40 hover:bg-blue-600/20"
              title="Parse the active pad as a tags dump and merge in"
            >
              ↘ Import
            </button>
          </div>

          {/* Branches export/import — same pattern. */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40">
            <span className="text-xs text-studio-muted w-20">Branches</span>
            <button
              onClick={() => { addPad('Branches dump'); setLyricText(dumpBranches(customBranches)); onClose(); }}
              className="px-2 py-0.5 text-xs text-blue-300 border border-blue-500/40 hover:bg-blue-600/20"
              title="Dump branches into a new pad"
            >
              ↗ Export
            </button>
            <button
              onClick={() => {
                if (!lyricText.trim()) { alert('Active pad is empty — paste a branches dump first.'); return; }
                const parsed = parseBranchesDump(lyricText);
                if (!parsed.length) { alert('No ## sections found in the active pad.'); return; }
                importBranches(parsed);
                onClose();
              }}
              className="px-2 py-0.5 text-xs text-blue-300 border border-blue-500/40 hover:bg-blue-600/20"
            >
              ↘ Import
            </button>
          </div>
        </Section>
      </div>
      {bulkCategory && (
        <BulkEditModal
          category={bulkCategory}
          onClose={() => setBulkCategory(null)}
        />
      )}
    </div>
  );
}
