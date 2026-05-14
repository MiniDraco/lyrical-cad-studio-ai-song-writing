'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudio } from '@/store/useStudio';
import { dumpPocket, parsePocketDump } from '@/lib/libraryIO';
import { useIsMobile } from '@/lib/useMediaQuery';

interface Props {
  onClose: () => void;
  /** Anchor element used to position the popover. */
  anchor: HTMLElement | null;
}

export default function Pocket({ onClose, anchor }: Props) {
  const {
    pocketItems, addPocketItem, removePocketItem, clearPocket,
    addPad, setLyricText, lyricText, importPocketItems,
  } = useStudio();
  const isMobile = useIsMobile();
  const [dragOver, setDragOver] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Anchor under the trigger button on desktop. On phones we render a
  // bottom sheet instead, so the anchor calc is skipped (pos stays the
  // placeholder shape but isn't read).
  useEffect(() => {
    if (!anchor || isMobile) {
      if (isMobile) setPos({ top: 0, right: 0 });
      return;
    }
    const r = anchor.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
  }, [anchor, isMobile]);

  // Close on outside click / Escape.
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // Pocket prefers a pocket-text payload (already-pillified snippet),
    // then the bracketed pill text, then any text/plain (text dragged
    // from a pad selection).
    const text =
      e.dataTransfer.getData('application/pocket-text') ||
      e.dataTransfer.getData('text/plain');
    if (text) addPocketItem(text);
  };

  if (!pos) return null;

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-[140] bg-black/55 backdrop-blur-[2px]"
          onClick={onClose}
          aria-label="Close Pocket"
        />
      )}
    <div
      ref={popoverRef}
      className={
        isMobile
          ? 'fixed z-[150] left-0 right-0 bottom-0 max-h-[75dvh] flex flex-col bg-studio-panel border-t border-studio-border rounded-t-2xl shadow-2xl safe-bottom'
          : 'fixed z-[150] w-80 max-h-[70vh] flex flex-col bg-studio-panel border border-studio-border rounded-lg shadow-2xl'
      }
      style={isMobile ? undefined : { top: pos.top, right: pos.right }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-studio-border bg-studio-surface">
        <span className="text-sm font-semibold text-purple-300">👜 Pocket</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { addPad('Pocket dump'); setLyricText(dumpPocket(pocketItems)); }}
            className="text-[10px] text-purple-300 hover:text-purple-200"
            title="Dump pocket items into a new pad as ## Pocket / one item per line"
          >
            ↗ Export
          </button>
          <button
            onClick={() => {
              if (!lyricText.trim()) { alert('Active pad is empty — paste a pocket dump first.'); return; }
              const items = parsePocketDump(lyricText);
              if (!items.length) { alert('No items found in the active pad.'); return; }
              importPocketItems(items);
            }}
            className="text-[10px] text-purple-300 hover:text-purple-200"
            title="Parse the active pad as a pocket dump and merge in (dedupes against existing)"
          >
            ↘ Import
          </button>
          {pocketItems.length > 0 && (
            <button
              onClick={clearPocket}
              className="text-[10px] text-studio-muted hover:text-red-400"
              title="Empty the pocket"
            >
              Clear all
            </button>
          )}
          <button onClick={onClose} className="text-studio-muted hover:text-studio-text text-xs">✕</button>
        </div>
      </div>

      <div
        className={`flex-shrink-0 m-3 p-3 rounded-md border-2 border-dashed text-center text-xs transition-colors ${
          dragOver
            ? 'border-purple-400 bg-purple-500/10 text-purple-300'
            : 'border-studio-border text-studio-muted'
        }`}
        onDragOver={(e) => {
          const types = e.dataTransfer.types;
          if (types.includes('application/pocket-text') || types.includes('text/plain') || types.includes('application/pill-label')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        Drop text here — select in any pad and drag in.
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {pocketItems.length === 0 ? (
          <div className="text-xs text-studio-muted italic text-center py-4">
            Pocket is empty.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {pocketItems.map((item) => (
              <li
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/pocket-text', item.text);
                  e.dataTransfer.setData('text/plain', item.text);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="group flex items-start gap-2 px-2 py-1.5 rounded border border-studio-border bg-studio-bg/40 hover:border-purple-500/40 cursor-grab active:cursor-grabbing"
                title="Drag into a pad to inject"
              >
                <span className="flex-1 text-xs text-studio-text whitespace-pre-wrap break-words">
                  {item.text}
                </span>
                <button
                  onClick={() => removePocketItem(item.id)}
                  className="opacity-60 md:opacity-0 md:group-hover:opacity-60 hover:!opacity-100 text-base md:text-[10px] px-2 md:px-0 text-red-400"
                  title="Remove from pocket"
                  aria-label="Remove from pocket"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </>
  );
}
