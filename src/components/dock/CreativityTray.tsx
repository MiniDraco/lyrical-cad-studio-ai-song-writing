'use client';

import { useState } from 'react';
import { useStudio } from '@/store/useStudio';

export default function CreativityTray() {
  const { creativityFrames, addCreativityFrame, removeCreativityFrame, renameCreativityFrame } = useStudio();
  const [activeId, setActiveId] = useState<string | null>(creativityFrames[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const active = creativityFrames.find((f) => f.id === activeId) ?? creativityFrames[0] ?? null;

  const submitNew = () => {
    const url = draftUrl.trim();
    const name = draftName.trim() || url.replace(/^https?:\/\//, '').slice(0, 24);
    if (!url) return;
    const id = `frame-${Date.now()}`;
    addCreativityFrame({ id, name, url: /^https?:\/\//.test(url) ? url : `https://${url}` });
    setActiveId(id);
    setDraftName('');
    setDraftUrl('');
    setAdding(false);
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) renameCreativityFrame(renamingId, renameDraft.trim());
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <div className="flex flex-col h-full bg-studio-panel">
      <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-studio-border bg-studio-surface overflow-x-auto">
        {creativityFrames.map((f) => (
          <div
            key={f.id}
            className={`group flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap border transition-all ${
              active?.id === f.id
                ? 'bg-pink-600/25 text-pink-200 border-pink-500/50'
                : 'text-studio-muted hover:text-studio-text border-transparent hover:border-studio-border'
            }`}
          >
            {renamingId === f.id ? (
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setRenamingId(null); setRenameDraft(''); }
                }}
                className="bg-studio-bg border border-studio-border rounded px-1 text-xs w-24 outline-none"
              />
            ) : (
              <button
                onClick={() => setActiveId(f.id)}
                onDoubleClick={() => { setRenamingId(f.id); setRenameDraft(f.name); }}
                title="Double-click to rename"
              >
                {f.name}
              </button>
            )}
            <button
              onClick={() => {
                removeCreativityFrame(f.id);
                if (active?.id === f.id) {
                  const next = creativityFrames.find((x) => x.id !== f.id);
                  setActiveId(next?.id ?? null);
                }
              }}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-[10px]"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => setAdding((a) => !a)}
          className="ml-1 px-2 py-0.5 rounded text-xs text-pink-300 border border-pink-500/30 hover:bg-pink-600/20 whitespace-nowrap"
        >
          + Frame
        </button>
      </div>

      {adding && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-studio-border bg-studio-bg/40">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Name (optional)"
            className="bg-studio-bg border border-studio-border rounded px-2 py-1 text-xs w-32 outline-none focus:border-pink-500/50"
          />
          <input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
            placeholder="https://example.com"
            className="bg-studio-bg border border-studio-border rounded px-2 py-1 text-xs flex-1 outline-none focus:border-pink-500/50"
          />
          <button
            onClick={submitNew}
            className="px-2 py-1 rounded text-xs bg-pink-600/30 text-pink-200 border border-pink-500/40 hover:bg-pink-600/40"
          >
            Add
          </button>
          <button
            onClick={() => setAdding(false)}
            className="px-2 py-1 rounded text-xs text-studio-muted hover:text-studio-text"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 relative bg-black/30">
        {active ? (
          <>
            <iframe
              key={active.id}
              src={active.url}
              title={active.name}
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
            <a
              href={active.url}
              target="_blank"
              rel="noreferrer"
              className="absolute top-1 right-1 z-10 text-[10px] px-1.5 py-0.5 rounded bg-studio-bg/80 text-studio-muted hover:text-studio-text border border-studio-border"
              title="Some sites block embedding — open in new tab if blank"
            >
              ↗ Open
            </a>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-studio-muted">
            No frame selected. Add one with <span className="text-pink-300 mx-1">+ Frame</span>.
          </div>
        )}
      </div>
    </div>
  );
}
