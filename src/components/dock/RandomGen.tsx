'use client';

import { useState } from 'react';
import { useStudio, RandomBank } from '@/store/useStudio';

const COMBO_PRESETS: { label: string; pick: (banks: RandomBank[]) => string }[] = [
  {
    label: '1 word',
    pick: (banks) => pickFrom(flatten(banks), 1).join(' '),
  },
  {
    label: '3 words',
    pick: (banks) => pickFrom(flatten(banks), 3).join(' '),
  },
  {
    label: 'Emotion + Image',
    pick: (banks) => `${pick1(banks, 'emotions')} ${pick1(banks, 'imagery')}`,
  },
  {
    label: 'Verb the Color',
    pick: (banks) => `${pick1(banks, 'verbs')} the ${pick1(banks, 'colors')}`,
  },
];

function flatten(banks: RandomBank[]): string[] {
  return banks.flatMap((b) => b.words);
}

function pick1(banks: RandomBank[], id: string): string {
  const b = banks.find((x) => x.id === id) ?? banks[0];
  if (!b || !b.words.length) return '';
  return b.words[Math.floor(Math.random() * b.words.length)];
}

function pickFrom(words: string[], n: number): string[] {
  const out: string[] = [];
  if (!words.length) return out;
  const pool = [...words];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export default function RandomGen() {
  const { randomBanks, addRandomBank, updateRandomBank, removeRandomBank } = useStudio();
  const [activeBankId, setActiveBankId] = useState<string | null>(randomBanks[0]?.id ?? null);
  const [history, setHistory] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [showNew, setShowNew] = useState(false);

  const activeBank = randomBanks.find((b) => b.id === activeBankId) ?? randomBanks[0] ?? null;

  const generate = (label: string, value: string) => {
    if (!value) return;
    setHistory((h) => [`${label}: ${value}`, ...h].slice(0, 30));
  };

  const generateFromBank = () => {
    if (!activeBank || !activeBank.words.length) return;
    const word = activeBank.words[Math.floor(Math.random() * activeBank.words.length)];
    generate(activeBank.name, word);
  };

  const startEdit = () => {
    if (!activeBank) return;
    setEditing(activeBank.id);
    setEditText(activeBank.words.join('\n'));
  };

  const saveEdit = () => {
    if (!editing) return;
    const words = editText.split(/[\n,]/).map((w) => w.trim()).filter(Boolean);
    updateRandomBank(editing, { words });
    setEditing(null);
  };

  /** Bank tab click: swap active bank. If we're currently editing, the
   *  edit focus follows — pending edits commit to the outgoing bank, then
   *  the editor loads the new bank's words so the user can keep working
   *  without losing their place. */
  const switchBank = (id: string) => {
    if (editing) {
      const words = editText.split(/[\n,]/).map((w) => w.trim()).filter(Boolean);
      updateRandomBank(editing, { words });
      const next = randomBanks.find((b) => b.id === id);
      setEditing(id);
      setEditText(next ? next.words.join('\n') : '');
    }
    setActiveBankId(id);
  };

  const submitNewBank = () => {
    const name = newBankName.trim();
    if (!name) return;
    const id = `bank-${Date.now()}`;
    addRandomBank({ id, name, words: [] });
    setActiveBankId(id);
    setNewBankName('');
    setShowNew(false);
    setEditing(id);
    setEditText('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="flex flex-col h-full bg-studio-panel text-studio-text">
      <div className="flex-shrink-0 px-3 py-2 border-b border-studio-border bg-studio-surface flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-400">🎲 Random Generator</span>
        <button
          onClick={() => setHistory([])}
          className="text-[10px] text-studio-muted hover:text-studio-text"
          disabled={!history.length}
        >
          Clear log
        </button>
      </div>

      <div className="flex-shrink-0 p-3 border-b border-studio-border space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-studio-muted">Quick combos</div>
        <div className="flex flex-wrap gap-1.5">
          {COMBO_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => generate(p.label, p.pick(randomBanks))}
              className="px-2 py-1 rounded text-xs bg-amber-600/20 text-amber-200 border border-amber-500/40 hover:bg-amber-600/30"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 p-3 border-b border-studio-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-studio-muted">Banks</span>
          <button
            onClick={() => setShowNew((s) => !s)}
            className="text-[10px] text-amber-400 hover:text-amber-300"
          >
            + New bank
          </button>
        </div>

        {showNew && (
          <div className="flex gap-1">
            <input
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNewBank()}
              autoFocus
              placeholder="Bank name"
              className="flex-1 bg-studio-bg border border-studio-border rounded px-2 py-1 text-xs outline-none focus:border-amber-500/50"
            />
            <button
              onClick={submitNewBank}
              className="px-2 py-1 rounded text-xs bg-amber-600/30 text-amber-200 border border-amber-500/40"
            >
              Add
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {randomBanks.map((b) => (
            <button
              key={b.id}
              onClick={() => switchBank(b.id)}
              className={`px-2 py-0.5 rounded text-xs border transition-all ${
                activeBank?.id === b.id
                  ? 'bg-amber-600/25 text-amber-200 border-amber-500/50'
                  : 'text-studio-muted hover:text-studio-text border-studio-border hover:border-studio-text/30'
              }`}
            >
              {b.name} <span className="opacity-60">({b.words.length})</span>
            </button>
          ))}
        </div>

        {activeBank && (
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={generateFromBank}
              className="px-2 py-1 rounded text-xs bg-amber-600/30 text-amber-100 border border-amber-500/50 hover:bg-amber-600/40"
            >
              Roll {activeBank.name}
            </button>
            <button
              onClick={startEdit}
              className="px-2 py-1 rounded text-xs text-studio-muted hover:text-studio-text border border-studio-border"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove bank "${activeBank.name}"?`)) {
                  removeRandomBank(activeBank.id);
                  setActiveBankId(randomBanks.find((b) => b.id !== activeBank.id)?.id ?? null);
                }
              }}
              className="ml-auto text-[10px] text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          </div>
        )}

        {editing && (
          <div className="space-y-1 pt-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              placeholder="One word per line, or comma-separated"
              className="w-full bg-studio-bg border border-studio-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-amber-500/50"
            />
            <div className="flex gap-1">
              <button
                onClick={saveEdit}
                className="px-2 py-1 rounded text-xs bg-amber-600/30 text-amber-200 border border-amber-500/40"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-2 py-1 rounded text-xs text-studio-muted hover:text-studio-text"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="text-[10px] uppercase tracking-wide text-studio-muted mb-1">Log</div>
        {history.length === 0 ? (
          <div className="text-xs text-studio-muted italic">Roll something to start.</div>
        ) : (
          <ul className="space-y-1">
            {history.map((line, i) => {
              const [, value] = line.split(/:\s(.+)/);
              return (
                <li
                  key={i}
                  className="group flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-studio-hover/40"
                >
                  <span className="flex-1 font-mono">{line}</span>
                  <button
                    onClick={() => copyToClipboard(value ?? line)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-amber-400 hover:text-amber-300"
                    title="Copy value"
                  >
                    Copy
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
