'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '@/store/useStudio';

const POOL_SIZE = 5;

function pickRandom<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items.slice();
  const pool = items.slice();
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

interface Props {
  onClose: () => void;
  /** Anchor button — popover positions above (footer-anchored). */
  anchor: HTMLElement | null;
}

/**
 * Quest popover — rolls up from the 🎯 Quest button in the footer.
 *
 *   ┌──────────────────────────────┐
 *   │ 🎯 Quests           ✕        │  header
 *   ├──────────────────────────────┤
 *   │ Active                       │  ← BODY of each active quest, with
 *   │  ☑ "Open with a question…"   │     a checkbox that drops it back
 *   ├──────────────────────────────┤     to the pool.
 *   │ Pool                + Bulk + │
 *   │  ☐ first quest title         │  ← TITLE of each pool quest, with
 *   │  ☐ another title             │     a green checkbox that promotes
 *   │  …                           │     it to the Active list.
 *   └──────────────────────────────┘
 *
 * Quest input format: `BODY *: TITLE`. The text after `*:` is the
 * checkbox label; the text before is what shows in the active bubble.
 */
export default function QuestModal({ onClose, anchor }: Props) {
  const { quests, questPoints, bulkAddQuests, toggleQuestActive, removeQuest } = useStudio();
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const [addingMode, setAddingMode] = useState<null | 'single' | 'bulk'>(null);
  const [singleDraft, setSingleDraft] = useState('');
  const [bulkDraft, setBulkDraft] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  // Bumping this seed re-runs the random pool pick. Initialised once so the
  // visible pool stays stable while the popover is open until the user
  // hits the refresh icon.
  const [poolSeed, setPoolSeed] = useState(0);

  // Anchor above the button (footer is at the bottom of the screen).
  // The popover is 300px wide; clamp `left` so it never spills off-screen
  // on narrow viewports (small phones / wrapped footers).
  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const POPOVER_W = 300;
    const GUTTER = 8;
    const maxLeft = Math.max(GUTTER, window.innerWidth - POPOVER_W - GUTTER);
    const left = Math.min(Math.max(r.left, GUTTER), maxLeft);
    setPos({ left, bottom: window.innerHeight - r.top + 6 });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(t) && anchor && !anchor.contains(t)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  const submitSingle = () => {
    const line = singleDraft.trim();
    if (!line) { setAddingMode(null); return; }
    // Reuse the bulk path — it tolerates a single line and handles
    // the *: separator the same way.
    bulkAddQuests(line);
    setSingleDraft('');
    setAddingMode(null);
  };
  const submitBulk = () => {
    if (!bulkDraft.trim()) { setAddingMode(null); return; }
    bulkAddQuests(bulkDraft);
    setBulkDraft('');
    setAddingMode(null);
  };

  const active = quests.filter((q) => q.active);
  const allPool = quests.filter((q) => !q.active);
  const allPoolKey = allPool.map((q) => q.id).join('|');
  // 5 random picks from the full pool — re-rolls when poolSeed bumps
  // OR when the underlying pool's membership changes (add/remove/toggle).
  const visiblePool = useMemo(
    () => pickRandom(allPool, POOL_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [poolSeed, allPoolKey]
  );

  if (!pos) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[180] w-[300px] max-h-[70vh] flex flex-col bg-studio-panel border border-studio-border rounded-lg shadow-2xl"
      style={{ left: pos.left, bottom: pos.bottom }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-studio-border bg-studio-surface">
        <span className="text-sm font-semibold text-amber-300">🎯 Quests</span>
        <button onClick={onClose} className="text-studio-muted hover:text-studio-text text-xs">✕</button>
      </div>

      {/* Active quests — top of the popover */}
      <div className="flex-shrink-0 max-h-[28vh] overflow-y-auto px-3 py-2 border-b border-studio-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide text-studio-muted">Active</span>
          <span
            className="text-[10px] font-mono text-amber-300 tabular-nums"
            title="10 points awarded each time a quest is checked into Active"
          >
            ★ {questPoints} pts
          </span>
        </div>
        {active.length === 0 ? (
          <div className="text-xs text-studio-muted italic">
            No active quests yet. Check one in the pool below.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {active.map((q) => (
              <li
                key={q.id}
                className="flex items-start gap-2 px-2 py-1.5 rounded bg-amber-600/10 border border-amber-500/30"
              >
                <button
                  onClick={() => toggleQuestActive(q.id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-amber-400/60 bg-amber-500/30 text-amber-100 text-[10px] flex items-center justify-center hover:bg-amber-500/50"
                  title="Remove from active (return to pool)"
                >
                  ✓
                </button>
                <span className="flex-1 text-xs text-studio-text whitespace-pre-wrap break-words min-w-0">{q.body}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pool — bottom of the popover */}
      <div className="flex-1 min-h-0 flex flex-col px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide text-studio-muted">
            Pool <span className="text-studio-muted/70">— showing {visiblePool.length} of {allPool.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPoolSeed((n) => n + 1)}
              className="text-[10px] px-1.5 py-0.5 rounded border text-amber-400 hover:text-amber-300 border-transparent hover:border-amber-500/40"
              title="Re-roll the visible pool — random 5"
              disabled={allPool.length <= POOL_SIZE}
            >
              ↻
            </button>
            <button
              onClick={() => setAddingMode((m) => (m === 'single' ? null : 'single'))}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                addingMode === 'single'
                  ? 'bg-amber-600/30 text-amber-200 border-amber-500/50'
                  : 'text-amber-400 hover:text-amber-300 border-transparent'
              }`}
            >
              + Add
            </button>
            <button
              onClick={() => setAddingMode((m) => (m === 'bulk' ? null : 'bulk'))}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                addingMode === 'bulk'
                  ? 'bg-amber-600/30 text-amber-200 border-amber-500/50'
                  : 'text-amber-400 hover:text-amber-300 border-transparent'
              }`}
            >
              ⫶ Bulk
            </button>
          </div>
        </div>

        {addingMode === 'single' && (
          <div className="flex gap-1 mb-2">
            <input
              autoFocus
              value={singleDraft}
              onChange={(e) => setSingleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSingle(); if (e.key === 'Escape') setAddingMode(null); }}
              placeholder="body *: title"
              className="flex-1 bg-studio-bg border border-studio-border rounded px-2 py-1 text-xs outline-none focus:border-amber-500/50"
            />
            <button
              onClick={submitSingle}
              className="px-2 py-1 rounded text-xs bg-amber-600/30 text-amber-200 border border-amber-500/40"
            >
              Add
            </button>
          </div>
        )}
        {addingMode === 'bulk' && (
          <div className="flex flex-col gap-1 mb-2">
            <textarea
              autoFocus
              value={bulkDraft}
              onChange={(e) => setBulkDraft(e.target.value)}
              rows={5}
              placeholder={'One quest per line. Format:\nbody *: title'}
              className="w-full bg-studio-bg border border-studio-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-amber-500/50"
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setAddingMode(null)}
                className="px-2 py-1 rounded text-xs text-studio-muted hover:text-studio-text"
              >
                Cancel
              </button>
              <button
                onClick={submitBulk}
                className="px-2 py-1 rounded text-xs bg-amber-600/30 text-amber-200 border border-amber-500/40"
              >
                Add all
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {allPool.length === 0 ? (
            <div className="text-xs text-studio-muted italic py-2">
              Pool is empty. Use <span className="text-amber-400">+ Add</span> or <span className="text-amber-400">⫶ Bulk</span> to populate.
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {visiblePool.map((q) => (
                <li
                  key={q.id}
                  className="group flex items-start gap-2 px-2 py-1 rounded hover:bg-studio-hover/40"
                >
                  <button
                    onClick={() => toggleQuestActive(q.id)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-green-500/50 bg-studio-bg text-green-400 text-[10px] flex items-center justify-center hover:bg-green-500/30 hover:text-green-200"
                    title="Activate this quest"
                  >
                    ✓
                  </button>
                  <span className="flex-1 text-xs text-studio-text whitespace-pre-wrap break-words min-w-0" title={q.body}>
                    {q.title}
                  </span>
                  <button
                    onClick={() => removeQuest(q.id)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-[10px] text-red-400"
                    title="Delete from pool"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
