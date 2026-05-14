'use client';

import { useState } from 'react';
import { useStudio, BRACKET_PAIRS } from '@/store/useStudio';

export default function FusionSlot() {
  const { addTag, bracketType } = useStudio();
  const [bOpen, bClose] = BRACKET_PAIRS[bracketType];
  const [droppedPills, setDroppedPills] = useState<string[]>([]);
  const [isDragOver, setDragOver] = useState(false);

  const fusedLabel = droppedPills.join(' ');
  const fusedBracketed = `${bOpen}${fusedLabel}${bClose}`;

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/pill-label')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const label = e.dataTransfer.getData('application/pill-label');
    if (label && !droppedPills.includes(label)) {
      setDroppedPills((prev) => [...prev, label]);
    }
  };

  const removePill = (label: string) =>
    setDroppedPills((prev) => prev.filter((p) => p !== label));

  const purge = () => setDroppedPills([]);

  // Drag the fused pill out → drops as a regular pill payload (Lyric pad
  // wraps it in brackets, Style pad inserts as bracketed text). After a
  // successful drop we purge the slot so the next fusion starts clean.
  const onFusedDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/pill-label', fusedLabel);
    e.dataTransfer.setData('application/pill-category', 'CustomBranches');
    e.dataTransfer.setData('text/plain', fusedBracketed);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const saveToStyleTags = () => {
    if (droppedPills.length < 2) return;
    addTag(fusedLabel, 'Style');
    setDroppedPills([]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-studio-text text-sm">⚗ Fusion Slot</span>
        {droppedPills.length > 0 && (
          <button
            onClick={purge}
            className="px-1.5 py-0.5 rounded text-[10px] text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/10"
            title="Empty the fusion slot"
          >
            ✕ Purge
          </button>
        )}
      </div>

      <div
        className={`fusion-drop min-h-[60px] p-2 flex flex-wrap gap-1.5 rounded-lg items-start content-start ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {droppedPills.length === 0 && (
          <span className="text-xs text-studio-muted w-full text-center pt-3">
            Drop 2+ pills to fuse
          </span>
        )}
        {droppedPills.map((label) => (
          <span
            key={label}
            className="pill cat-custom text-xs flex items-center gap-1"
          >
            {label}
            <button
              className="opacity-50 hover:opacity-100 text-xs"
              onClick={() => removePill(label)}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {droppedPills.length >= 2 && (
        <div className="flex items-center gap-2">
          <span
            draggable
            onDragStart={onFusedDragStart}
            className="pill cat-custom cursor-grab active:cursor-grabbing text-xs"
            title="Drag into a pad to inject"
          >
            🔗 {fusedBracketed}
          </span>
          <button
            onClick={saveToStyleTags}
            className="ml-auto text-[10px] text-blue-400 hover:text-blue-300"
            title="Save to the Style tag library"
          >
            → Save as Style tag
          </button>
        </div>
      )}
    </div>
  );
}
