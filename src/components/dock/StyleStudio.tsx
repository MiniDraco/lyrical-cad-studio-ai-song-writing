'use client';

import { useState, useCallback } from 'react';
import { useStudio } from '@/store/useStudio';
import { StyleBranch } from '@/types';
import StylePad from '@/components/editor/StylePad';
import PadIO from '@/components/editor/PadIO';

export default function StyleStudio() {
  const {
    addCustomBranch,
    customBranches,
    styleText,
    setStyleText,
  } = useStudio();

  const [copied, setCopied] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const copyText = useCallback(() => {
    navigator.clipboard?.writeText?.(styleText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  }, [styleText]);

  const saveAsBranch = useCallback(() => {
    const trimmed = styleText.trim();
    if (!trimmed) return;
    // Avoid creating an exact duplicate of the most recent branch.
    if (customBranches[customBranches.length - 1]?.name === trimmed) return;
    const branch: StyleBranch = {
      id: `branch-${Date.now()}`,
      name: trimmed,
      pills: [trimmed],
    };
    addCustomBranch(branch);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  }, [styleText, customBranches, addCustomBranch]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center border-b border-studio-border px-2 py-1 gap-2">
        <span className="text-xs text-teal-400 font-medium">✎ Style</span>
        <button
          onClick={saveAsBranch}
          disabled={!styleText.trim()}
          className="ml-auto px-2 py-0.5 rounded text-xs border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 border-teal-500/40"
          title="Save the current style block as a branch pill in the Tag Tray"
        >
          {savedFlash ? '✓ Saved' : '🌿 → Branch'}
        </button>
        <PadIO filename="style" text={styleText} onLoad={(t) => setStyleText(t)} accent="teal" />
        <button
          onClick={copyText}
          className="px-2 py-0.5 rounded text-xs text-studio-muted hover:text-studio-text border border-studio-border hover:border-studio-text/30 transition-colors"
          title="Copy style notes"
        >
          {copied ? '✓ Copied' : '⧉ Copy'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <StylePad />
      </div>
    </div>
  );
}
