'use client';

import { useState } from 'react';
import { TagCategory } from '@/types';
import { useStudio } from '@/store/useStudio';

interface Props {
  category: TagCategory;
  onClose: () => void;
}

export default function BulkEditModal({ category, onClose }: Props) {
  const { masterTagLibrary, bulkLoadTags } = useStudio();
  const [text, setText] = useState(masterTagLibrary[category].join('\n'));

  const handleSave = () => {
    bulkLoadTags(category, text);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass rounded-xl p-5 w-[480px] max-h-[80vh] flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-studio-text">
            Bulk Edit — <span className="text-blue-400">{category}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-studio-muted hover:text-studio-text text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-studio-muted">
          One tag per line. Paste a list and click Save — each line becomes a pill.
        </p>

        <textarea
          className="flex-1 min-h-[300px] bg-studio-bg border border-studio-border rounded-lg p-3 text-sm text-studio-text font-mono resize-none outline-none focus:border-blue-500 transition-colors"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Enter ${category.toLowerCase()} tags, one per line…`}
          autoFocus
        />

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-studio-muted hover:text-studio-text border border-studio-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Save Tags
          </button>
        </div>
      </div>
    </div>
  );
}
