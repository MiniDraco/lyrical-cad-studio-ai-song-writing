'use client';

import { useEffect, useRef, useState } from 'react';
import { scanWordProbes } from '@/lib/probeScanner';
import { useIsMobile } from '@/lib/useMediaQuery';
import AlchemySidebar from '@/components/dock/AlchemySidebar';
import LyricPad, { LyricPadHandle } from '@/components/editor/LyricPad';
import SyllableGutter from '@/components/gutter/SyllableGutter';
import StyleStudio from '@/components/dock/StyleStudio';
import CreativityTray from '@/components/dock/CreativityTray';
import RandomGen from '@/components/dock/RandomGen';
import Pocket from '@/components/dock/Pocket';
import SettingsModal from '@/components/layout/SettingsModal';
import QuestModal from '@/components/layout/QuestModal';
import HelpModal from '@/components/layout/HelpModal';
import type { BracketType } from '@/store/useStudio';

const BRACKET_CYCLE: BracketType[] = ['square', 'curly', 'paren', 'angle', 'none'];
import { useStudio } from '@/store/useStudio';
import {
  DEFAULT_SYL_PALETTE,
  hexToRgbTriplet,
  setRhymePalette,
  setSyllablePalette,
} from '@/lib/colors';

export default function StudioLayout() {
  const isMobile = useIsMobile();
  const [dockOpen, setDockOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);
  const [creativityOpen, setCreativityOpen] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [pocketOpen, setPocketOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [questOpen, setQuestOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const pocketBtnRef = useRef<HTMLButtonElement>(null);
  const questBtnRef = useRef<HTMLButtonElement>(null);

  // First time we detect we're on a phone, collapse the side dock and
  // the bottom Style Pad so the editor isn't crushed into a 100px strip.
  // The user can re-open them via the toolbar; we only auto-collapse on
  // the *transition* into mobile, not every render.
  const wasMobile = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasMobile.current === null) {
      wasMobile.current = isMobile;
      if (isMobile) {
        setDockOpen(false);
        setStyleOpen(false);
      }
      return;
    }
    if (!wasMobile.current && isMobile) {
      setDockOpen(false);
      setStyleOpen(false);
      setRandomOpen(false);
      setCreativityOpen(false);
    }
    wasMobile.current = isMobile;
  }, [isMobile]);

  // On mobile, drawers shouldn't stack on top of each other — opening
  // one auto-closes the other side drawers and the Style Pad. Desktop
  // keeps the existing free-form multi-panel behavior.
  const openDrawer = (which: 'dock' | 'random' | 'creativity' | 'style') => {
    if (!isMobile) {
      if (which === 'dock')       setDockOpen((o) => !o);
      if (which === 'random')     setRandomOpen((o) => !o);
      if (which === 'creativity') setCreativityOpen((o) => !o);
      if (which === 'style')      setStyleOpen((o) => !o);
      return;
    }
    const next = {
      dock:       which === 'dock'       ? !dockOpen       : false,
      random:     which === 'random'     ? !randomOpen     : false,
      creativity: which === 'creativity' ? !creativityOpen : false,
      style:      which === 'style'      ? !styleOpen      : false,
    };
    setDockOpen(next.dock);
    setRandomOpen(next.random);
    setCreativityOpen(next.creativity);
    setStyleOpen(next.style);
  };
  const closeAllDrawers = () => {
    setDockOpen(false);
    setRandomOpen(false);
    setCreativityOpen(false);
  };
  const anyDrawerOpen = isMobile && (dockOpen || randomOpen || creativityOpen);
  const {
    isGhostMode, rhythmicSkeleton, lyricText, customSylColors, pocketItems, addPocketItem,
    sylBgAlpha, ghostMatchColor, ghostMismatchColor, ghostMatchAlphaMul, catColors,
    mainTextColor, mainCanvasColor, rhymePalette, buttonRadius,
    wordProbes, probesEnabled, setWordHighlights,
    ghostBgOpacity, setGhostBgOpacity,
    addPad, bracketType, setBracketType,
    pads, setActivePad,
    uiScale, editorFontFamily, editorFontSize, editorFontBold, editorFontItalic,
    chromeColors, buttonShape,
  } = useStudio();

  /* UI scale — sets `html { font-size }` so Tailwind's rem-based classes
   * cascade through the whole UI. The editor font is opted out via its
   * own pixel-based CSS variable in globals.css. */
  useEffect(() => {
    const prev = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = `${16 * uiScale}px`;
    return () => { document.documentElement.style.fontSize = prev; };
  }, [uiScale]);

  /* Global keyboard shortcuts. Skipped when the user is typing inside an
   * <input> / <textarea> / contenteditable to avoid stealing keystrokes
   * meant for the editor. Modifier-based combos (Ctrl/Cmd + key) are
   * never typed by accident, so we accept them everywhere except the
   * single-letter shortcuts that would clobber normal text. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // The single-character shortcuts are mod-prefixed, so they're safe
      // even inside the contenteditable editor.
      const k = e.key.toLowerCase();
      if (k === 'g') {
        e.preventDefault();
        padRef.current?.toggleGhost();
      } else if (k === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (k === 'b') {
        e.preventDefault();
        setPocketOpen((o) => !o);
      } else if (k === 'n' && e.shiftKey) {
        e.preventDefault();
        addPad();
      } else if (k === "'") {
        e.preventDefault();
        const idx = BRACKET_CYCLE.indexOf(bracketType);
        const next = BRACKET_CYCLE[(idx + 1) % BRACKET_CYCLE.length];
        setBracketType(next);
      } else if (k === '/' && e.shiftKey) {
        // Ctrl+? (Ctrl+Shift+/) opens the help cheatsheet.
        e.preventDefault();
        setHelpOpen(true);
      } else if (k === 's') {
        // Ctrl+S downloads the active pad's lyric text as a .txt file —
        // matches what most text editors do for "save".
        e.preventDefault();
        const active = pads.find((p) => p.id === useStudio.getState().activePadId);
        if (!active) return;
        const blob = new Blob([active.lyricText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const stem = (active.name || 'lyrics').replace(/[^A-Za-z0-9_-]/g, '-');
        a.download = `${stem}-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (/^[1-9]$/.test(e.key) && !e.shiftKey && !e.altKey) {
        // Ctrl+1..9 jumps to that pad index (1-based). No-op if out of range.
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < pads.length) {
          e.preventDefault();
          setActivePad(pads[idx].id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracketType, pads]);

  /* Word Probes scan — debounced. Whenever the lyric text or any
   * configured probe changes, run a topic scan in the background and
   * push the resulting word→color map into the store. The scan reuses
   * an in-memory topic-vocabulary cache so subsequent text changes are
   * cheap (no extra API calls unless a new topic is added). */
  const [probesScanning, setProbesScanning] = useState(false);
  useEffect(() => {
    if (!probesEnabled) {
      setWordHighlights({});
      setProbesScanning(false);
      return;
    }
    const handle = setTimeout(() => {
      let cancelled = false;
      setProbesScanning(true);
      scanWordProbes(lyricText, wordProbes).then((map) => {
        if (cancelled) return;
        setWordHighlights(map);
        setProbesScanning(false);
      });
      return () => { cancelled = true; };
    }, 400);
    return () => clearTimeout(handle);
  }, [lyricText, wordProbes, probesEnabled, setWordHighlights]);
  const activeProbeCount = wordProbes.filter((p) => p.topic.trim().length > 0).length;
  // Map slider 0..1 → CSS radius. 0 = sharp, 0.5 ≈ standard rounded,
  // 1 = full pill (large enough to hit any button height).
  // Named presets override the slider — they emit shorthand radii so we
  // can do per-corner shapes (squared up/down) too.
  const btnRadiusCss = (() => {
    switch (buttonShape) {
      case 'rectangle':    return '0';
      case 'rounded25':    return '0.25rem';
      case 'rounded50':    return '0.5rem';
      case 'circle':       return '9999px';
      case 'poly':         return '25% / 50%';        // squashed-ellipse
      case 'squared-up':   return '9999px 9999px 0 0'; // top-only round
      case 'squared-down': return '0 0 9999px 9999px'; // bottom-only round
      case 'free':
      default:
        return buttonRadius >= 0.99 ? '9999px' : `${buttonRadius * 1}rem`;
    }
  })();
  // Push the rhyme palette into the lib singleton so getSuffixColor()
  // returns the user's choices for new rebuilds (and stays cached).
  setRhymePalette(rhymePalette);

  // Push persisted custom syllable colors into the lib singleton so
  // getSyllableColor() (called in the gutter) returns the current palette.
  // Done synchronously during render so callers in the same render cycle
  // see fresh values; the useEffect would lag by one frame.
  setSyllablePalette(customSylColors);
  const legend = Array.from({ length: 10 }, (_, i) => ({
    count: i + 1,
    color: customSylColors[i + 1] ?? DEFAULT_SYL_PALETTE[i + 1],
  }));

  const padRef = useRef<LyricPadHandle>(null);
  const handleGhostClick = () => { padRef.current?.toggleGhost(); };

  const totalSyllables = rhythmicSkeleton.reduce((s, l) => s + l.syllableCount, 0);
  const lineCount = rhythmicSkeleton.filter((l) => l.text.trim()).length;
  const charCount = lyricText.length;

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        ['--syl-bg-alpha' as string]: String(sylBgAlpha),
        ['--syl-match-rgb' as string]: hexToRgbTriplet(ghostMatchColor),
        ['--syl-mismatch-rgb' as string]: hexToRgbTriplet(ghostMismatchColor),
        ['--syl-match-alpha-mul' as string]: String(ghostMatchAlphaMul),
        ['--main-text-color' as string]: mainTextColor,
        ['--main-canvas-color' as string]: mainCanvasColor,
        ['--btn-radius' as string]: btnRadiusCss,
        ['--editor-font-family' as string]: editorFontFamily,
        ['--editor-font-size' as string]: `${editorFontSize}px`,
        ['--editor-font-weight' as string]: editorFontBold ? '700' : '400',
        ['--editor-font-style' as string]: editorFontItalic ? 'italic' : 'normal',
        background: mainCanvasColor,
        color: mainTextColor,
      }}
    >
      {/* Per-category pill color overrides — emitted as a dynamic style
       * block so settings changes take effect instantly without touching
       * every Pill component. Uses the user's chosen color for bg
       * (low alpha), border (mid alpha), and text (mixed with white). */}
      <style>{Object.entries(catColors).map(([cat, hex]) => {
        const rgb = hexToRgbTriplet(hex);
        const cls = `cat-${cat === 'CustomBranches' ? 'custom' : cat.toLowerCase()}`;
        return `.${cls}{background:rgba(${rgb},0.18);border-color:rgba(${rgb},0.3);color:color-mix(in srgb, ${hex} 40%, white);}`;
      }).join('\n')}</style>

      {/* Chrome color overrides — empty string = inherit Tailwind theme.
       * Emitted as a dynamic <style> with !important so they win against
       * the per-class utility rules. */}
      <style>{[
        chromeColors.surface && `.bg-studio-surface{background-color:${chromeColors.surface}!important;}`,
        chromeColors.panel   && `.bg-studio-panel{background-color:${chromeColors.panel}!important;}`,
        chromeColors.border  && `.border-studio-border{border-color:${chromeColors.border}!important;}`,
        chromeColors.muted   && `.text-studio-muted{color:${chromeColors.muted}!important;}`,
      ].filter(Boolean).join('\n')}</style>
      {/* ─── Top Bar ───────────────────────────────────── */}
      <header className="flex-shrink-0 flex flex-wrap md:flex-nowrap items-center gap-1.5 md:gap-3 px-2 md:px-4 py-2 border-b border-studio-border bg-studio-surface safe-top">
        <div className="flex items-center gap-2 mr-1 md:mr-2">
          <span className="text-blue-400 font-bold text-base md:text-lg tracking-tight">LyricalCAD</span>
          <span className="hidden sm:inline text-studio-muted text-xs font-mono bg-studio-panel px-1.5 py-0.5 rounded">
            Studio
          </span>
        </div>

        <button
          onClick={() => openDrawer('dock')}
          className="p-2 md:p-1.5 rounded text-studio-muted hover:text-studio-text hover:bg-studio-hover transition-colors"
          title={dockOpen ? 'Collapse dock' : 'Expand dock'}
          aria-label={dockOpen ? 'Collapse dock' : 'Expand dock'}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
            {dockOpen ? <path d="M6 2H2v12h4V2zm2 0v12h6V2H8z" opacity=".6" />
                     : <path d="M2 2h12v12H2V2zm2 2v8h8V4H4z" opacity=".6" />}
          </svg>
        </button>

        <button
          onClick={() => openDrawer('style')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 md:py-1 rounded text-xs font-medium transition-all border ${
            styleOpen
              ? 'bg-teal-600/20 text-teal-300 border-teal-500/40'
              : 'text-studio-muted hover:text-studio-text border-studio-border hover:border-studio-text/30'
          }`}
          title="Toggle Style Studio pad"
          aria-label="Toggle Style Studio pad"
        >
          <span>✦</span>
          <span className="hidden sm:inline">Style Pad</span>
        </button>

        <div className="hidden md:block h-5 w-px bg-studio-border mx-1" />

        <button
          onClick={handleGhostClick}
          className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-1 rounded text-sm font-medium transition-all ${
            isGhostMode
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-studio-muted hover:text-studio-text border border-studio-border hover:border-studio-text/30'
          }`}
          title={isGhostMode ? 'Exit Ghost — restore lyrics' : 'Ghost Mode — snapshot trace the current flow'}
          aria-label={isGhostMode ? 'Exit Ghost Mode' : 'Enter Ghost Mode'}
        >
          <span>{isGhostMode ? '👻' : '🔓'}</span>
          <span className="hidden sm:inline">{isGhostMode ? 'Ghost Active' : 'Ghost Mode'}</span>
        </button>

        {isGhostMode && (
          <>
            <span className="hidden md:inline text-xs text-purple-400 animate-pulse">
              Tracing
            </span>
            <label className="hidden md:flex items-center gap-1.5 text-[10px] text-studio-muted">
              <span>Trace</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={ghostBgOpacity}
                onChange={(e) => setGhostBgOpacity(parseFloat(e.target.value))}
                className="w-20 accent-purple-500"
                title="Tracing-paper backdrop opacity"
              />
              <span className="font-mono tabular-nums w-7 text-right">
                {(ghostBgOpacity * 100).toFixed(0)}%
              </span>
            </label>
          </>
        )}

        <button
          ref={pocketBtnRef}
          onClick={() => setPocketOpen((o) => !o)}
          onDragOver={(e) => {
            const types = e.dataTransfer.types;
            if (
              types.includes('text/plain') ||
              types.includes('application/pill-label') ||
              types.includes('application/pocket-text')
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (!pocketOpen) setPocketOpen(true);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            // Pocket-text > raw pill label as text > text/plain. The button
            // itself is now the drop target so the user doesn't have to
            // open the popover or hit the small drop zone first.
            const text =
              e.dataTransfer.getData('application/pocket-text') ||
              e.dataTransfer.getData('application/pill-label') ||
              e.dataTransfer.getData('text/plain');
            if (text) addPocketItem(text);
            setPocketOpen(true);
          }}
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 md:py-1 rounded text-xs font-medium transition-all border ${
            pocketOpen
              ? 'bg-purple-600/25 text-purple-200 border-purple-500/50'
              : 'text-studio-muted hover:text-studio-text border-studio-border hover:border-studio-text/30'
          }`}
          title="Pocket — drag selected text or pills here to keep them; drag back into a pad to inject"
          aria-label="Open Pocket"
        >
          <span>👜</span>
          <span className="hidden sm:inline">Pocket</span>
          {pocketItems.length > 0 && (
            <span className="bg-purple-500 text-white text-[10px] rounded-full px-1.5 leading-4 min-w-[18px] text-center">
              {pocketItems.length}
            </span>
          )}
        </button>

        {probesEnabled && activeProbeCount > 0 && (
          <span
            className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] border ${
              probesScanning
                ? 'text-blue-300 border-blue-500/40 bg-blue-600/10 animate-pulse'
                : 'text-studio-muted border-studio-border'
            }`}
            title={probesScanning
              ? `Probing ${activeProbeCount} topic${activeProbeCount === 1 ? '' : 's'}…`
              : `${activeProbeCount} probe${activeProbeCount === 1 ? '' : 's'} active`}
          >
            <span>🛰</span>
            <span className="font-mono tabular-nums">{activeProbeCount}</span>
          </span>
        )}

        <button
          onClick={() => setHelpOpen(true)}
          className="p-2 md:p-1.5 text-studio-muted hover:text-studio-text hover:bg-studio-hover"
          title="Quick reference (Ctrl+?)"
          aria-label="Help"
        >
          ❓
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 md:p-1.5 rounded text-studio-muted hover:text-studio-text hover:bg-studio-hover"
          title="Settings (Ctrl+,)"
          aria-label="Settings"
        >
          ⚙️
        </button>

        <button
          className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded border border-studio-border bg-studio-bg/50 hover:border-studio-text/30 transition-colors"
          title="Each line's syllable count is colored by this scale — click to open settings"
          onClick={() => setSettingsOpen(true)}
        >
          <span className="text-[10px] text-studio-muted uppercase tracking-wide mr-1">Syllables</span>
          {legend.map(({ count, color }) => (
            <span
              key={count}
              className="text-xs font-mono font-bold tabular-nums"
              style={{ color }}
              title={`${count} syllable${count === 1 ? '' : 's'}`}
            >
              {count === 10 ? '10+' : count}
            </span>
          ))}
          <span className="ml-1 text-[10px] text-studio-muted opacity-70" title="Click to open Settings">⌨</span>
        </button>

        {/* Stats — full strip on lg+, compact 3-icon strip on md, hidden on phone */}
        <div className="hidden lg:flex items-center gap-4 text-xs text-studio-muted font-mono">
          <span>Lines: <span className="text-studio-text">{lineCount}</span></span>
          <span>Syllables: <span className="text-studio-text">{totalSyllables}</span></span>
          <span>Chars: <span className="text-studio-text">{charCount}</span></span>
        </div>
        <div
          className="hidden md:flex lg:hidden items-center gap-2 text-[10px] text-studio-muted font-mono"
          title={`${lineCount} lines · ${totalSyllables} syllables · ${charCount} chars`}
        >
          <span>L<span className="text-studio-text ml-0.5">{lineCount}</span></span>
          <span>S<span className="text-studio-text ml-0.5">{totalSyllables}</span></span>
          <span>C<span className="text-studio-text ml-0.5">{charCount}</span></span>
        </div>
      </header>

      {/* ─── Main Layout ───────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Mobile drawer backdrop. Tap to close all drawers. */}
        {anyDrawerOpen && (
          <div
            className="mobile-drawer-backdrop"
            onClick={closeAllDrawers}
            aria-label="Close panels"
          />
        )}

        {/* Alchemy dock — inline column on md+, slide-in drawer on phone. */}
        <aside
          className={
            isMobile
              ? `mobile-drawer left bg-studio-panel transition-transform duration-200 ${
                  dockOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : 'flex-shrink-0 border-r border-studio-border bg-studio-panel overflow-hidden transition-all duration-200'
          }
          style={isMobile ? undefined : { width: dockOpen ? 300 : 0 }}
        >
          <div
            style={isMobile ? { width: '100%' } : { width: 300 }}
            className="h-full overflow-y-auto"
          >
            <AlchemySidebar />
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div
            className="relative flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            data-capture-root="true"
          >
            <div className="flex-1 flex flex-col min-w-0 relative z-10">
              <LyricPad ref={padRef} />
            </div>
            {/* Gutter is an absolute-positioned overlay on the right edge
             * of the captureRoot — z-0 so editor text (z-10) flows over
             * it on long lines. pointer-events:none keeps it from
             * stealing clicks. Width matches the SyllableGutter (40px). */}
            <div
              className="absolute top-0 right-0 z-0 pointer-events-none"
              style={{ width: 40, height: '100%' }}
            >
              <SyllableGutter />
            </div>
          </div>

          {styleOpen && (
            <div
              className="flex-shrink-0 border-t border-studio-border bg-studio-panel relative"
              style={{ height: isMobile ? '45%' : '32%' }}
            >
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-studio-border bg-studio-surface">
                  <span className="text-xs font-semibold text-teal-400">✦ Style Studio Pad</span>
                  <button
                    onClick={() => setStyleOpen(false)}
                    className="p-2 md:p-0 text-studio-muted hover:text-studio-text text-xs"
                    title="Close pad"
                    aria-label="Close Style Pad"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <StyleStudio />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Random generator — inline column on md+, right-slide drawer on phone. */}
        <aside
          className={
            isMobile
              ? `mobile-drawer right bg-studio-panel transition-transform duration-200 ${
                  randomOpen ? 'translate-x-0' : 'translate-x-full'
                }`
              : 'flex-shrink-0 border-l border-studio-border bg-studio-panel overflow-hidden transition-all duration-200'
          }
          style={isMobile ? undefined : { width: randomOpen ? 280 : 0 }}
        >
          <div
            style={isMobile ? { width: '100%' } : { width: 280 }}
            className="h-full overflow-y-auto"
          >
            {(randomOpen || !isMobile) && <RandomGen />}
          </div>
        </aside>

        {/* Creativity tray — wider drawer on phone (iframes need room).
         * iframes only mount while open so they don't fetch in the background. */}
        <aside
          className={
            isMobile
              ? `mobile-drawer right wide bg-studio-panel transition-transform duration-200 ${
                  creativityOpen ? 'translate-x-0' : 'translate-x-full'
                }`
              : 'flex-shrink-0 border-l border-studio-border bg-studio-panel overflow-hidden transition-all duration-200'
          }
          style={isMobile ? undefined : { width: creativityOpen ? 480 : 0 }}
        >
          <div
            style={isMobile ? { width: '100%' } : { width: 480 }}
            className="h-full overflow-y-auto"
          >
            {creativityOpen && <CreativityTray />}
          </div>
        </aside>
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {questOpen && (
        <QuestModal onClose={() => setQuestOpen(false)} anchor={questBtnRef.current} />
      )}
      {pocketOpen && (
        <Pocket onClose={() => setPocketOpen(false)} anchor={pocketBtnRef.current} />
      )}

      <footer className="flex-shrink-0 flex flex-wrap items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1.5 md:py-1 border-t border-studio-border bg-studio-surface text-xs text-studio-muted safe-bottom">
        <button
          ref={questBtnRef}
          onClick={() => setQuestOpen((o) => !o)}
          className={`flex items-center gap-1 px-2 py-1 md:py-0.5 rounded border transition-colors ${
            questOpen
              ? 'bg-amber-600/30 text-amber-200 border-amber-400/60'
              : 'text-amber-300 border-amber-500/30 hover:bg-amber-600/20 hover:border-amber-400/50'
          }`}
          title="Quest log — saved writing constraints"
          aria-label="Toggle Quest log"
        >
          🎯 <span className="hidden sm:inline">Quest</span>
        </button>

        <button
          onClick={() => openDrawer('creativity')}
          className={`flex items-center gap-1 px-2 py-1 md:py-0.5 rounded border transition-colors ${
            creativityOpen
              ? 'bg-pink-600/30 text-pink-200 border-pink-400/60'
              : 'text-pink-300 border-pink-500/30 hover:bg-pink-600/20 hover:border-pink-400/50'
          }`}
          title="Toggle Creativity Tray (web frames)"
          aria-label="Toggle Creativity tray"
        >
          🌐 <span className="hidden sm:inline">Creativity</span>
        </button>

        <button
          onClick={() => openDrawer('random')}
          className={`flex items-center gap-1 px-2 py-1 md:py-0.5 rounded border transition-colors ${
            randomOpen
              ? 'bg-amber-600/30 text-amber-200 border-amber-400/60'
              : 'text-amber-300 border-amber-500/30 hover:bg-amber-600/20 hover:border-amber-400/50'
          }`}
          title="Toggle Random Generator"
          aria-label="Toggle Random generator"
        >
          🎲 <span className="hidden sm:inline">Random</span>
        </button>

        <span className="hidden md:inline text-studio-border">|</span>
        <span className="hidden md:inline">LyricalCAD Studio v1.0</span>
        {/* Phone-only condensed stats — replaces the version string with
         * the at-a-glance counts the desktop header shows in full. */}
        <span
          className="md:hidden flex items-center gap-2 text-[10px] font-mono ml-1"
          title={`${lineCount} lines · ${totalSyllables} syllables · ${charCount} chars`}
        >
          <span>L<span className="text-studio-text ml-0.5">{lineCount}</span></span>
          <span>S<span className="text-studio-text ml-0.5">{totalSyllables}</span></span>
        </span>
        <span className="ml-auto hidden md:inline">
          Syl-A <span className="inline-block w-3 h-3 rounded-sm syl-a align-middle" />
          &nbsp;Syl-B <span className="inline-block w-3 h-3 rounded-sm syl-b align-middle" />
          &nbsp;· Tags{' '}
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(255,165,0,0.3)' }} />
        </span>
      </footer>
    </div>
  );
}
