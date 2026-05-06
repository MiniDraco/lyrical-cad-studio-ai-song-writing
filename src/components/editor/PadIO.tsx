'use client';

import { useRef } from 'react';

interface Props {
  /** Filename stem used when saving (without extension). */
  filename: string;
  /** Current text — saved as the file's payload. */
  text: string;
  /** Called with the loaded text after the user picks a file. */
  onLoad: (text: string) => void;
  /** Tailwind color name used for the buttons (e.g. "blue", "teal"). */
  accent?: 'blue' | 'teal';
}

/**
 * Save = download the current pad text as a UTF-8 .txt file.
 * Load = open the OS file picker; the chosen file's text replaces the pad.
 */
export default function PadIO({ filename, text, onLoad, accent = 'blue' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const accentCls =
    accent === 'teal'
      ? 'text-teal-300 hover:text-teal-200 border-teal-500/30 hover:border-teal-400/50'
      : 'text-blue-300 hover:text-blue-200 border-blue-500/30 hover:border-blue-400/50';

  const save = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `${filename}-${ts}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      onLoad(result);
    };
    reader.readAsText(file);
    // Allow loading the same file twice in a row.
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={save}
        className={`px-2 py-0.5 rounded text-[11px] border bg-studio-bg/40 transition-colors ${accentCls}`}
        title="Save pad to a .txt file"
      >
        💾 Save
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className={`px-2 py-0.5 rounded text-[11px] border bg-studio-bg/40 transition-colors ${accentCls}`}
        title="Load a .txt file into this pad (replaces current text)"
      >
        📂 Load
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,text/plain"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}
