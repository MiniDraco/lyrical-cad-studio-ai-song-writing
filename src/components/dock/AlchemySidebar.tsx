'use client';

import TagTray from './TagTray';
import FusionSlot from '@/components/tags/FusionSlot';

export default function AlchemySidebar() {
  return (
    <div className="flex flex-col h-full">
      {/* Alchemy — top 25% */}
      <section
        className="flex-shrink-0 border-b border-studio-border p-3 overflow-y-auto"
        style={{ height: '25%' }}
      >
        <FusionSlot />
      </section>

      {/* Tag Tray — bottom 75% */}
      <section className="flex-1 min-h-0 p-3 overflow-y-auto">
        <TagTray />
      </section>
    </div>
  );
}
