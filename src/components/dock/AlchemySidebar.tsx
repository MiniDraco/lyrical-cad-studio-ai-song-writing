'use client';

import TagTray from './TagTray';
import FusionSlot from '@/components/tags/FusionSlot';

/**
 * Two stacked zones:
 *   - Fusion Slot — fixed compact area at the top (drop pills here to fuse).
 *   - Tag Tray — fills the rest. The Tag Tray manages its OWN internal
 *     scroll so the bracket selector + tabs stay pinned in view while
 *     the pill list scrolls.
 */
export default function AlchemySidebar() {
  return (
    <div className="flex flex-col h-full">
      <section className="flex-shrink-0 border-b border-studio-border px-3 py-2">
        <FusionSlot />
      </section>

      <section className="flex-1 min-h-0 flex flex-col">
        <TagTray />
      </section>
    </div>
  );
}
