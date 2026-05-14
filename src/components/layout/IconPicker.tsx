'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Small popover for picking a category icon. Curated set of writing-
 * related emojis grouped roughly by theme. Click the trigger to open,
 * click an emoji to commit, click outside or Esc to dismiss.
 *
 * The user can also type a custom emoji into the trigger directly —
 * the popover is just a discovery aid, not a constraint.
 */

const ICONS = [
  // Music
  '🎵','🎶','🎼','🎤','🎧','🎷','🎸','🎹','🎺','🎻','🥁','🪕','🪗','📯',
  // Mood / Vibe
  '💖','💔','✨','🔥','⚡','💫','🌟','🌈','☀','🌙','⭐','🌌','🌠','❤',
  // Nature
  '🌳','🍃','🌊','🏔','🌋','🌵','🌹','🌻','🍀','🌸','🍂','❄','🌷','🌿',
  // Tools / craft
  '🏷','🎯','🎨','🎭','🎬','🎪','✏','📝','📚','📖','✒','🖊','🖋','📜',
  // Action
  '🚀','⚔','🛡','🎲','🃏','🎰','🎳','⚽','🏀','🥊','🏃','🕯',
  // Symbols
  '⚙','🛠','🔧','🔨','⛓','🔗','🪙','💎','🔑','🗝','⌛','⏳','🧭','🪐',
  // Animals
  '🐺','🦁','🐻','🦅','🐍','🦋','🐉','🐢','🦊','🐈','🐕','🦉',
  // People-ish / abstract
  '👁','🌀','♾','♥','♦','♣','♠','☯','✴','⚜','☄','🛸',
];

interface Props {
  value: string;
  onChange: (icon: string) => void;
  className?: string;
}

export default function IconPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Open below the trigger, but flip up if it would clip the bottom.
    const POP_W = 280;
    const POP_H = 240;
    const left = Math.max(8, Math.min(window.innerWidth - POP_W - 8, r.left));
    const top = r.bottom + POP_H + 8 < window.innerHeight ? r.bottom + 4 : r.top - POP_H - 4;
    setPos({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-9 h-7 flex items-center justify-center bg-studio-bg border border-studio-border hover:border-studio-text/30 ${className ?? ''}`}
        title="Pick an icon"
      >
        <span className="text-base leading-none">{value || '🏷'}</span>
      </button>

      {open && pos && (
        <div
          ref={popRef}
          className="fixed z-[210] w-[280px] max-h-[240px] overflow-y-auto p-2 bg-studio-panel border border-studio-border shadow-2xl"
          style={{ left: pos.left, top: pos.top }}
        >
          <div className="grid grid-cols-8 gap-1">
            {ICONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => { onChange(g); setOpen(false); }}
                className={`w-7 h-7 flex items-center justify-center text-base hover:bg-studio-hover/40 ${
                  value === g ? 'bg-blue-600/30' : ''
                }`}
                title={g}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
