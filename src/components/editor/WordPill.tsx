'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchByMode, NetTapMode, NET_TAP_LABELS } from '@/lib/datamuse';

interface Props {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
  /** Called when the user clicks "insert" — returns the pill the user picked. */
  onInsert?: (replacement: string) => void;
}

const SATELLITE_RADIUS = 110;
const RELATED_MODES: NetTapMode[] = ['adjectives', 'synonym', 'rhyme'];

/**
 * Press-and-hold word visualization. White pill = the focal word. Blue
 * pills orbit around it with related words pulled from a Datamuse mix
 * (adjectives, synonyms, rhymes). Clicking a satellite "promotes" it to
 * the center and re-fetches its own satellites — a hand-rolled little
 * web that doesn't pull in d3.
 */
export default function WordPill({ word, position, onClose, onInsert }: Props) {
  const [center, setCenter] = useState(word);
  const [satellites, setSatellites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftCenter, setDraftCenter] = useState(word);
  const overlayRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (w: string) => {
    setLoading(true);
    // Mix three modes, dedupe, take 8 around the center.
    const lists = await Promise.all(
      RELATED_MODES.map((m) => fetchByMode(m, w))
    );
    const seen = new Set<string>([w.toLowerCase()]);
    const picks: string[] = [];
    let i = 0;
    while (picks.length < 8 && (lists[0][i] || lists[1][i] || lists[2][i])) {
      for (const list of lists) {
        const item = list[i];
        if (!item) continue;
        const k = item.word.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        picks.push(item.word);
        if (picks.length >= 8) break;
      }
      i++;
    }
    setSatellites(picks);
    setLoading(false);
  }, []);

  useEffect(() => { load(center); }, [center, load]);
  useEffect(() => { setDraftCenter(center); }, [center]);

  // Outside-click + Escape to close.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Anchor: clamp so the bubble stays on-screen.
  const x = Math.max(SATELLITE_RADIUS + 16, Math.min(window.innerWidth - SATELLITE_RADIUS - 16, position.x));
  const y = Math.max(SATELLITE_RADIUS + 16, Math.min(window.innerHeight - SATELLITE_RADIUS - 16, position.y));

  return (
    <div
      ref={overlayRef}
      className="fixed z-[160] pointer-events-none"
      style={{
        left: x - SATELLITE_RADIUS - 50,
        top: y - SATELLITE_RADIUS - 50,
        width: (SATELLITE_RADIUS + 50) * 2,
        height: (SATELLITE_RADIUS + 50) * 2,
      }}
    >
      <div
        className="relative w-full h-full rounded-full bg-black/40 backdrop-blur-sm border border-studio-border pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Center pill — editable */}
        <input
          type="text"
          value={draftCenter}
          onChange={(e) => setDraftCenter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setCenter(draftCenter.trim() || center); }
            if (e.key === 'Escape') onClose();
          }}
          onBlur={() => setCenter(draftCenter.trim() || center)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-black font-semibold rounded-full px-3 py-1 text-sm text-center outline-none w-32 shadow-lg"
        />

        {/* Satellites — equally-spaced around the center. Each satellite
         * is a label (click → promote to center) with a hover-revealed
         * "+" button (click → insert into pad). Right-click works as a
         * shortcut for the same insert action. */}
        {satellites.map((s, i) => {
          const angle = (i / Math.max(satellites.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const sx = Math.cos(angle) * SATELLITE_RADIUS;
          const sy = Math.sin(angle) * SATELLITE_RADIUS;
          return (
            <div
              key={s + i}
              className="group absolute flex items-center"
              style={{
                left: `calc(50% + ${sx}px)`,
                top: `calc(50% + ${sy}px)`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <button
                onClick={() => setCenter(s)}
                onContextMenu={(e) => { e.preventDefault(); onInsert?.(s); }}
                className="bg-blue-500/80 text-white text-xs px-2 py-0.5 hover:bg-blue-400 transition-colors max-w-[90px] truncate"
                title={`Click to promote "${s}" to the center`}
              >
                {s}
              </button>
              <button
                onClick={() => onInsert?.(s)}
                className="ml-0.5 px-1 py-0.5 bg-green-500/90 text-white text-[10px] font-bold leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Insert "${s}" into the pad`}
              >
                +
              </button>
            </div>
          );
        })}

        {loading && (
          <div className="absolute left-1/2 bottom-3 -translate-x-1/2 text-[10px] text-studio-muted">
            …
          </div>
        )}

        {/* Footer hint */}
        <div className="absolute left-1/2 -bottom-7 -translate-x-1/2 text-[10px] text-studio-muted whitespace-nowrap">
          Click pill = dive · Hover for + insert · Esc closes
        </div>
      </div>

      {/* Show which Datamuse modes feed the satellites */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1.5 text-[10px] text-studio-muted">
        {RELATED_MODES.map((m) => (
          <span key={m} title={NET_TAP_LABELS[m].name}>
            {NET_TAP_LABELS[m].icon}
          </span>
        ))}
      </div>
    </div>
  );
}
