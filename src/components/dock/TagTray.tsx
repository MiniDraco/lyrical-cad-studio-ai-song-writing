'use client';

import { useState } from 'react';
import { TagCategory } from '@/types';
import { useStudio, BracketType, BRACKET_PAIRS } from '@/store/useStudio';
import Pill from '@/components/tags/Pill';
import BulkEditModal from '@/components/tags/BulkEditModal';

const STANDARD_CATEGORIES: TagCategory[] = ['Style', 'Lyrics', 'FX', 'Mood', 'Instruments', 'Genre'];
/** Tab identifier — standard category names, the literal 'Branches', or a
 *  custom-category tab encoded as `custom:<id>`. */
type TabId = string;

const STANDARD_ICONS: Record<string, string> = {
  Style: '🎼',
  Lyrics: '✍️',
  FX: '🎚',
  Mood: '🌡',
  Instruments: '🎸',
  Genre: '🎭',
  Branches: '🌿',
};

const BRACKET_ORDER: BracketType[] = ['square', 'curly', 'paren', 'angle', 'none'];

const BRACKET_LABEL: Record<BracketType, string> = {
  square: '[]',
  curly: '{}',
  paren: '()',
  angle: '<>',
  none: 'ø',
};

export default function TagTray() {
  const {
    masterTagLibrary, removeTag,
    discoveredTags, acceptDiscoveredTag, removeDiscoveredTag,
    customBranches, removeCustomBranch,
    bracketType, setBracketType,
    customTagCategories, bulkLoadCustomCategoryTags,
    removeTagFromCustomCategory,
  } = useStudio();
  const [customTagDraft, setCustomTagDraft] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('Style');
  // Compose the tab list dynamically: standard 6 + Branches + custom.
  const ALL_TABS: TabId[] = [
    ...STANDARD_CATEGORIES,
    'Branches',
    ...customTagCategories.map((c) => `custom:${c.id}`),
  ];
  const [bulkCategory, setBulkCategory] = useState<TagCategory | null>(null);
  const [discoveredDragOver, setDiscoveredDragOver] = useState<TagCategory | null>(null);

  const handleCatDragOver = (e: React.DragEvent, cat: TagCategory) => {
    if (e.dataTransfer.types.includes('application/discovered-tag')) {
      e.preventDefault();
      setDiscoveredDragOver(cat);
    }
  };

  const handleCatDrop = (e: React.DragEvent, cat: TagCategory) => {
    e.preventDefault();
    setDiscoveredDragOver(null);
    const tag = e.dataTransfer.getData('application/discovered-tag');
    if (tag) acceptDiscoveredTag(tag, cat);
  };

  const isStandardCat = activeTab !== 'Branches' && !activeTab.startsWith('custom:');
  // The custom-category tab id format is `custom:<categoryId>`, so we
  // can mix them into the existing `activeTab` string state without
  // breaking the standard-tab type guard above.
  const activeCustomCat = activeTab.startsWith('custom:')
    ? customTagCategories.find((c) => c.id === activeTab.slice(7))
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky header — title + bracket selector + bulk edit */}
      <div className="sticky top-0 -mx-3 px-3 -mt-3 pt-3 pb-2 bg-studio-panel z-10 border-b border-studio-border/50 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-studio-text text-sm">🏷 Tag Tray</span>
          <span className="text-[10px] text-studio-muted italic">
            Bulk / IO live in ⚙ Settings → Tag Library Tools
          </span>
        </div>

        {/* Bracket-type selector — controls which bracket pair pills use
            when injected into the editor. Saved across sessions. */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-studio-muted mr-1">Brackets:</span>
          {BRACKET_ORDER.map((t) => {
            const active = bracketType === t;
            const [a, b] = BRACKET_PAIRS[t];
            const label = BRACKET_LABEL[t];
            return (
              <button
                key={t}
                onClick={() => setBracketType(t)}
                className={`px-1.5 py-0.5 rounded font-mono text-xs transition-all border ${
                  active
                    ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                    : 'text-studio-muted hover:text-studio-text border-studio-border hover:border-studio-text/30'
                }`}
                title={t === 'none' ? 'Inject pill labels with no brackets' : `Use ${a}…${b} for pills`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1">
          {ALL_TABS.map((tab) => {
            const isStandardTab = tab !== 'Branches' && !tab.startsWith('custom:');
            const customCat = tab.startsWith('custom:')
              ? customTagCategories.find((c) => c.id === tab.slice(7))
              : undefined;
            const icon = customCat ? customCat.icon : (STANDARD_ICONS[tab] ?? '🏷');
            const label = customCat ? customCat.name : tab;
            const count = customCat
              ? customCat.tags.length
              : tab === 'Branches'
                ? customBranches.length
                : (masterTagLibrary[tab as TagCategory] ?? []).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                onDragOver={isStandardTab ? (e) => handleCatDragOver(e, tab as TagCategory) : undefined}
                onDragLeave={isStandardTab ? () => setDiscoveredDragOver(null) : undefined}
                onDrop={isStandardTab ? (e) => handleCatDrop(e, tab as TagCategory) : undefined}
                className={`px-2 py-0.5 rounded text-xs transition-all ${
                  activeTab === tab
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'text-studio-muted hover:text-studio-text border border-transparent hover:border-studio-border'
                } ${discoveredDragOver === tab ? 'border-orange-400 bg-orange-500/10' : ''}`}
                style={customCat && activeTab === tab
                  ? { background: `${customCat.color}33`, borderColor: `${customCat.color}80`, color: customCat.color }
                  : undefined}
              >
                {icon} {label}
                {count > 0 && <span className="ml-1 text-studio-muted opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline "+" input for adding tags to a custom category. Hidden
       * for the standard categories which already have a Bulk Edit modal. */}
      {activeCustomCat && (
        <div className="flex items-center gap-1">
          <input
            value={customTagDraft}
            onChange={(e) => setCustomTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customTagDraft.trim()) {
                bulkLoadCustomCategoryTags(activeCustomCat.id, customTagDraft);
                setCustomTagDraft('');
              }
            }}
            placeholder="add tag — newline / comma to bulk add"
            className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded px-2 py-0.5 text-xs outline-none"
            style={{ borderColor: `${activeCustomCat.color}55` }}
          />
          <button
            onClick={() => {
              if (!customTagDraft.trim()) return;
              bulkLoadCustomCategoryTags(activeCustomCat.id, customTagDraft);
              setCustomTagDraft('');
            }}
            className="px-2 py-0.5 text-xs"
            style={{ color: activeCustomCat.color, borderWidth: 1, borderColor: `${activeCustomCat.color}55` }}
          >
            +
          </button>
        </div>
      )}

      {/* Pills for active category */}
      <div className="flex flex-wrap gap-1.5 min-h-[60px]">
        {activeCustomCat ? (
          activeCustomCat.tags.length === 0 ? (
            <p className="text-xs text-studio-muted italic">
              No tags yet — type a name above and hit Enter (or use commas / newlines for bulk).
            </p>
          ) : (
            activeCustomCat.tags.map((tag) => (
              <span
                key={`${activeCustomCat.id}-${tag}`}
                className="pill text-xs flex items-center gap-1"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/pill-label', tag);
                  e.dataTransfer.setData('application/pill-id', `${activeCustomCat.id}-${tag}`);
                  e.dataTransfer.setData('application/pill-category', 'CustomTagCategory');
                  e.dataTransfer.setData('text/plain', `[${tag}]`);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                style={{
                  background: `${activeCustomCat.color}30`,
                  border: `1px solid ${activeCustomCat.color}55`,
                  color: activeCustomCat.color,
                }}
              >
                {tag}
                <button
                  onClick={() => removeTagFromCustomCategory(activeCustomCat.id, tag)}
                  className="ml-1 opacity-50 hover:opacity-100 text-xs leading-none"
                  title="Remove from this category"
                >
                  ×
                </button>
              </span>
            ))
          )
        ) : isStandardCat ? (
          masterTagLibrary[activeTab as TagCategory].length === 0 ? (
            <p className="text-xs text-studio-muted italic">
              No tags yet.{' '}
              <button
                className="text-blue-400 hover:underline"
                onClick={() => setBulkCategory(activeTab as TagCategory)}
              >
                Bulk add →
              </button>
            </p>
          ) : (
            masterTagLibrary[activeTab as TagCategory].map((tag) => (
              <Pill
                key={`${activeTab}-${tag}`}
                pill={{ id: `${activeTab}-${tag}`, label: tag, category: activeTab as TagCategory }}
                onRemove={() => removeTag(tag, activeTab as TagCategory)}
                compact
              />
            ))
          )
        ) : customBranches.length === 0 ? (
          <p className="text-xs text-studio-muted italic">
            No branches yet. Use the <span className="text-teal-400">→ Branch</span> button
            on the Style Pad to save a style block as a reusable pill.
          </p>
        ) : (
          customBranches.map((branch) => (
            <Pill
              key={branch.id}
              pill={{ id: branch.id, label: branch.name, category: 'CustomBranches' }}
              onRemove={() => removeCustomBranch(branch.id)}
              compact
            />
          ))
        )}
      </div>

      {/* Discovered Tags Drawer */}
      {discoveredTags.length > 0 && (
        <div className="mt-2 border-t border-studio-border pt-3">
          <div className="text-xs font-semibold text-orange-400 mb-2">
            🔍 Discovered ({discoveredTags.length})
            <span className="text-studio-muted font-normal ml-1">— drag to a category tab</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {discoveredTags.map((tag) => (
              <div
                key={tag}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/discovered-tag', tag);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="pill cat-discovered text-xs flex items-center gap-1 cursor-grab"
              >
                {tag}
                <button
                  className="opacity-50 hover:opacity-100"
                  onClick={() => removeDiscoveredTag(tag)}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {bulkCategory && (
        <BulkEditModal
          category={bulkCategory}
          onClose={() => setBulkCategory(null)}
        />
      )}
    </div>
  );
}
