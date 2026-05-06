'use client';

import { useState } from 'react';
import { useStudio } from '@/store/useStudio';

/**
 * Tab strip for the Lyric pad. Each tab is a self-contained pad
 * (lyric + style text). Click to switch — switching saves the
 * current pad's text and loads the new one. Double-click to rename.
 * The 「+」 button creates a fresh empty pad.
 */
export default function PadTabs() {
  const { pads, activePadId, addPad, removePad, renamePad, setActivePad } = useStudio();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const startRename = (id: string, current: string) => {
    setRenamingId(id);
    setRenameDraft(current);
  };
  const commitRename = () => {
    if (renamingId && renameDraft.trim()) renamePad(renamingId, renameDraft.trim());
    setRenamingId(null);
    setRenameDraft('');
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {pads.map((pad) => {
        const active = pad.id === activePadId;
        const isRenaming = renamingId === pad.id;
        return (
          <div
            key={pad.id}
            className={`group flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap border transition-all cursor-pointer ${
              active
                ? 'bg-blue-600/25 text-blue-200 border-blue-500/50 font-semibold'
                : 'text-studio-muted hover:text-studio-text border-transparent hover:border-studio-border'
            }`}
            onClick={() => !isRenaming && setActivePad(pad.id)}
            title={active ? 'Active pad — double-click to rename' : `Switch to ${pad.name}`}
          >
            {isRenaming ? (
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                className="bg-studio-bg border border-studio-border rounded px-1 text-xs w-28 outline-none"
              />
            ) : (
              <span onDoubleClick={(e) => { e.stopPropagation(); startRename(pad.id, pad.name); }}>
                {pad.name}
              </span>
            )}
            {pads.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Close pad "${pad.name}"? Its content will be lost.`)) {
                    removePad(pad.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-[10px] leading-none text-red-400"
                title="Close this pad"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={() => addPad()}
        className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs text-blue-300 border border-blue-500/30 hover:bg-blue-600/20 leading-none"
        title="New pad"
      >
        +
      </button>
    </div>
  );
}
