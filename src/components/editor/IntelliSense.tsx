'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchByMode, NET_TAP_LABELS, NetTapMode, DatamuseWord } from '@/lib/datamuse';

interface Props {
  query: string;
  position: { top: number; left: number };
  onSelect: (word: string) => void;
  onClose: () => void;
}

const MODE_ORDER: NetTapMode[] = [
  'rhyme',
  'synonym',
  'adjectives',
  'nouns',
  'soundsLike',
  'context',
  'thematic',
];

/**
 * Net Tap dropdown — 7 Datamuse query presets in a single picker.
 * The hint line on the bottom rewrites itself as the user changes mode,
 * with [W] swapped for the current query word so the hint actually
 * reads like a sentence about what the API will return.
 */
export default function IntelliSense({ query, position, onSelect, onClose }: Props) {
  const [items, setItems] = useState<DatamuseWord[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mode, setMode] = useState<NetTapMode>('rhyme');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const load = useCallback(async () => {
    if (!query) return;
    setLoading(true);
    const results = await fetchByMode(mode, query, mode === 'thematic' ? topic : undefined);
    setItems(results);
    setActiveIdx(0);
    setLoading(false);
  }, [query, mode, topic]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (items[activeIdx]) onSelect(items[activeIdx].word);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [items, activeIdx, onSelect, onClose]);

  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIdx]);

  const style: React.CSSProperties = {
    top: Math.min(position.top, window.innerHeight - 320),
    left: Math.min(position.left, window.innerWidth - 340),
  };

  // Always render the menu chrome so the user can switch modes even
  // when the current mode produced 0 results (e.g. nothing rhymes).
  const meta = NET_TAP_LABELS[mode];
  const hint = meta.hint.replace('[W]', `“${query}”`);

  return (
    <div className="intellisense" style={style}>
      {/* Mode picker — current mode visible, click to expand */}
      <div className="border-b border-studio-border text-xs">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-studio-text hover:bg-studio-hover/40"
          title="Pick a Datamuse query type"
        >
          <span className="flex items-center gap-1.5">
            <span>{meta.icon}</span>
            <span className="font-medium">{meta.name}</span>
          </span>
          <span className="text-[10px] text-studio-muted">{pickerOpen ? '▴' : '▾'}</span>
        </button>
        {pickerOpen && (
          <div className="grid grid-cols-2 gap-px bg-studio-border/50">
            {MODE_ORDER.map((m) => {
              const ml = NET_TAP_LABELS[m];
              const active = m === mode;
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setPickerOpen(false); }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] ${
                    active
                      ? 'bg-blue-600/25 text-blue-200'
                      : 'bg-studio-panel text-studio-muted hover:text-studio-text'
                  }`}
                  title={ml.hint.replace('[W]', `“${query}”`)}
                >
                  <span>{ml.icon}</span>
                  <span className="truncate">{ml.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {mode === 'thematic' && (
          <div className="px-3 py-1.5 border-t border-studio-border">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="topic (e.g. love, money)"
              className="w-full bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs outline-none focus:border-blue-500/50"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="intellisense-item text-studio-muted justify-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="intellisense-item text-studio-muted justify-center text-xs">
          No matches for “{query}”
        </div>
      ) : (
        <ul ref={listRef}>
          {items.map((item, i) => (
            <li
              key={item.word}
              className={`intellisense-item ${i === activeIdx ? 'active' : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => onSelect(item.word)}
            >
              <span>{item.word}</span>
              {item.numSyllables && (
                <span className="text-xs text-studio-muted">{item.numSyllables}syl</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-studio-border px-3 py-1 text-[10px] text-studio-muted leading-tight">
        <div className="italic mb-0.5">{hint}</div>
        <div className="flex gap-3">
          <span>↑↓ nav</span>
          <span>Tab pick</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
