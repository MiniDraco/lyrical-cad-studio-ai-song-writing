'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '@/store/useStudio';
import { fetchByMode, NET_TAP_LABELS, NetTapMode, DatamuseWord } from '@/lib/datamuse';

interface Props {
  onClose: () => void;
  /** Anchor button — popover positions above (footer-anchored). */
  anchor: HTMLElement | null;
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
 * IntelliPane — docked, persistent version of the IntelliSense popup.
 *
 * The original IntelliSense floated at the caret, which covered the
 * writer's text and broke flow. This pane lives above the 🧠 Words
 * footer button (same anchored-popover pattern as Quest) and reads
 * `currentIntelliWord` from the store. The LyricPad publishes that
 * value on every typing burst, so the pane refreshes its Datamuse
 * suggestions automatically without ever stealing screen real estate.
 *
 * Clicking a suggestion inserts the word at the caret WITHOUT taking
 * focus from the editor — onMouseDown.preventDefault() blocks the
 * blur, then document.execCommand('insertText') drops the word in.
 */
export default function IntelliPane({ onClose, anchor }: Props) {
  const { currentIntelliWord } = useStudio();
  const word = currentIntelliWord;

  const [items, setItems] = useState<DatamuseWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<NetTapMode>('rhyme');
  const [topic, setTopic] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Anchor above the footer button.
  useEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
  }, [anchor]);

  // Re-fetch when the word, mode, or topic changes. An empty word
  // clears the list instead of firing a useless API call.
  useEffect(() => {
    let cancelled = false;
    if (!word || word.length < 3) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchByMode(mode, word, mode === 'thematic' ? topic : undefined).then((results) => {
      if (cancelled) return;
      setItems(results);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [word, mode, topic]);

  // Esc closes; outside click does NOT (this is a sticky panel — the
  // user clicks back into the editor constantly while it's open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const meta = NET_TAP_LABELS[mode];
  const hint = useMemo(
    () => meta.hint.replace('[W]', word ? `"${word}"` : '<word at caret>'),
    [meta, word]
  );

  // Insert WITHOUT stealing focus from the editor — preventDefault on
  // mousedown blocks the blur, then execCommand drops text at the caret.
  // Prepend a space if the char before the caret isn't already whitespace
  // so suggestions don't slam into the previous word ("friendmend").
  const insert = (w: string) => {
    const sel = window.getSelection();
    let needsLeadingSpace = false;
    if (sel && sel.rangeCount && sel.isCollapsed) {
      const r = sel.getRangeAt(0);
      const node = r.startContainer;
      const offset = r.startOffset;
      if (node.nodeType === Node.TEXT_NODE && offset > 0) {
        const prev = node.textContent?.[offset - 1] ?? '';
        if (prev && !/\s/.test(prev)) needsLeadingSpace = true;
      }
    }
    document.execCommand('insertText', false, (needsLeadingSpace ? ' ' : '') + w + ' ');
  };

  if (!pos) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[60] glass rounded-lg shadow-2xl flex flex-col text-xs"
      style={{ left: pos.left, bottom: pos.bottom, width: 320, maxHeight: 360 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header — current word + close */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-studio-border">
        <span className="flex items-center gap-1.5">
          <span>🧠</span>
          <span className="font-medium text-studio-text">Words</span>
          {word ? (
            <span className="text-studio-muted">· "{word}"</span>
          ) : (
            <span className="text-studio-muted italic">type 3+ letters</span>
          )}
        </span>
        <button
          onClick={onClose}
          className="text-studio-muted hover:text-studio-text px-1"
          title="Hide pane"
        >
          ✕
        </button>
      </div>

      {/* Mode picker */}
      <div className="border-b border-studio-border">
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
                  title={ml.hint.replace('[W]', word ? `"${word}"` : '<word>')}
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
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="topic (e.g. love, money)"
              className="w-full bg-studio-bg border border-studio-border rounded px-1.5 py-0.5 text-xs outline-none focus:border-blue-500/50"
            />
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!word ? (
          <div className="px-3 py-3 text-studio-muted text-center">
            Place the caret in a word — suggestions appear here.
          </div>
        ) : loading ? (
          <div className="px-3 py-3 text-studio-muted text-center">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-3 text-studio-muted text-center">
            No matches for "{word}"
          </div>
        ) : (
          <ul>
            {items.map((item) => (
              <li
                key={item.word}
                onClick={() => insert(item.word)}
                className="flex items-center justify-between px-3 py-1 cursor-pointer text-studio-text hover:bg-blue-600/15"
                title={`Insert "${item.word}" at the caret`}
              >
                <span>{item.word}</span>
                {item.numSyllables && (
                  <span className="text-studio-muted">{item.numSyllables}syl</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-studio-border px-3 py-1 text-[10px] text-studio-muted leading-tight italic">
        {hint}
      </div>
    </div>
  );
}
