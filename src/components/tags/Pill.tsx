'use client';

import { PillData } from '@/types';
import { CAT_COLORS } from '@/lib/colors';
import { useStudio, BRACKET_PAIRS } from '@/store/useStudio';

interface Props {
  pill: PillData;
  onRemove?: () => void;
  draggable?: boolean;
  compact?: boolean;
}

export default function Pill({ pill, onRemove, draggable = true, compact = false }: Props) {
  const { customBranches, bracketType } = useStudio();
  const colorClass = CAT_COLORS[pill.category] ?? 'cat-style';
  const [bOpen, bClose] = BRACKET_PAIRS[bracketType];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/pill-id', pill.id);
    e.dataTransfer.setData('application/pill-label', pill.label);
    e.dataTransfer.setData('application/pill-category', pill.category);

    // Branch pills carry their expansion (the list of contained tag labels).
    // Drop targets that understand branches (Style pad) expand to the joined
    // bracketed list; targets that don't (Lyric pad) reject branch drops
    // entirely so the user can't accidentally inject a long style block
    // into the lyrics.
    if (pill.category === 'CustomBranches') {
      const branch = customBranches.find((b) => b.id === pill.id);
      if (branch) {
        e.dataTransfer.setData('application/branch-pills', JSON.stringify(branch.pills));
        const expanded = branch.pills.map((p) => `${bOpen}${p}${bClose}`).join(' ');
        e.dataTransfer.setData('text/plain', expanded);
      }
    } else {
      e.dataTransfer.setData('text/plain', `${bOpen}${pill.label}${bClose}`);
    }

    e.dataTransfer.effectAllowed = 'copy';
    (e.currentTarget as HTMLElement).classList.add('dragging');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('dragging');
  };

  return (
    <div
      className={`pill ${colorClass} ${compact ? 'text-xs py-0.5 px-2' : ''}`}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={`${pill.category}: ${pill.label}\nDrag into a pad or the Fusion slot`}
    >
      <span>{pill.label}</span>

      {onRemove && (
        <button
          className="ml-1 opacity-50 hover:opacity-100 text-xs leading-none"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove pill"
        >
          ×
        </button>
      )}
    </div>
  );
}
