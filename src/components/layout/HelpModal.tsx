'use client';

import { useEffect } from 'react';

const KBD_BASE =
  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 ' +
  'border border-studio-border bg-studio-bg/60 font-mono text-[10px] tabular-nums';

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={KBD_BASE}>{children}</kbd>;
}

const SHORTCUTS: { keys: React.ReactNode; what: string }[] = [
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>G</Kbd></>,            what: 'Toggle Ghost Mode' },
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd></>,            what: 'Save active pad to .txt' },
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>,</Kbd></>,            what: 'Open Settings' },
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>B</Kbd></>,            what: 'Open Pocket' },
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>N</Kbd></>, what: 'New pad (tab)' },
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>1</Kbd>…<Kbd>9</Kbd></>, what: 'Jump to pad N' },
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>'</Kbd></>,            what: 'Cycle bracket type ([ → { → ( → < → ø)' },
  { keys: <><Kbd>Ctrl</Kbd>+<Kbd>?</Kbd></>,            what: 'Open this cheatsheet' },
  { keys: <><Kbd>Esc</Kbd></>,                          what: 'Close any open popover / modal' },
];

const GESTURES: { gesture: string; what: string }[] = [
  { gesture: 'Right-click word', what: 'Native menu (spellcheck etc)' },
  { gesture: 'Ctrl + Right-click word', what: 'Open IntelliSense for that word (Net Tap dropdown — 7 modes)' },
  { gesture: 'Long-press word (~½s)', what: 'Open the Word Pill — orbit web of related words' },
  { gesture: 'Right-click satellite pill', what: 'Insert that pill into the editor at the caret' },
  { gesture: 'Click satellite pill', what: 'Promote it to the center of the Word Pill' },
  { gesture: 'Drag pill → Pocket', what: 'Save selection / pill into the Pocket' },
  { gesture: 'Drag from Pocket → Pad', what: 'Insert the saved snippet at drop point' },
  { gesture: 'Drop branch on Style pad', what: 'Expand all of its tags as a block' },
  { gesture: 'Tab in IntelliSense', what: 'Commit the highlighted suggestion' },
  { gesture: 'Double-click pad tab', what: 'Rename that pad' },
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
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
      <div className="glass shadow-2xl w-[520px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-studio-border">
          <span className="font-semibold text-studio-text">❓ Quick Reference</span>
          <button onClick={onClose} className="text-studio-muted hover:text-studio-text text-sm">✕</button>
        </div>

        <section className="p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-studio-muted">Keyboard</div>
          <ul className="flex flex-col gap-1.5">
            {SHORTCUTS.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 w-44 flex-shrink-0">{s.keys}</span>
                <span className="text-studio-text">{s.what}</span>
              </li>
            ))}
          </ul>
          <div className="text-[10px] text-studio-muted italic pt-1">
            On macOS, <Kbd>⌘</Kbd> works in place of <Kbd>Ctrl</Kbd>.
          </div>
        </section>

        <section className="p-4 space-y-2 border-t border-studio-border">
          <div className="text-xs font-semibold uppercase tracking-wide text-studio-muted">Mouse / Drag</div>
          <ul className="flex flex-col gap-1.5">
            {GESTURES.map((g, i) => (
              <li key={i} className="flex items-start gap-3 text-xs">
                <span className="text-studio-text font-medium w-44 flex-shrink-0">{g.gesture}</span>
                <span className="text-studio-muted">{g.what}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-4 space-y-2 border-t border-studio-border text-xs text-studio-muted">
          <div>
            Stuck? Most options live in <span className="text-blue-400">⚙ Settings</span> — collapsible
            sections for syllable colors, ghost colors, pill colors, canvas, button shape, rhyme
            palette, and word probes. Top of Settings has Import / Export / Master Reset.
          </div>
        </section>
      </div>
    </div>
  );
}
