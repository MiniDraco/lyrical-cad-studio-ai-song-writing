'use client';

import { useStudio } from '@/store/useStudio';
import { getSyllableColor } from '@/lib/colors';

/**
 * Compact gutter — one pill per line. The syllable count text lives
 * INSIDE the rhyme-color tag (no separate count + swatch column),
 * which lets the gutter fit in ~40px instead of the old 80px and
 * stops it from looking like a chunky sidebar parked on the right.
 *
 * Placeholders are gone — when the editor is empty the gutter renders
 * nothing at all, so you don't see a phantom column of empty rows.
 */
export default function SyllableGutter() {
  const { rhythmicSkeleton, isGhostMode, ghostSkeleton, customSylColors } = useStudio();
  void customSylColors; // re-render trigger when the user tweaks the palette

  if (!rhythmicSkeleton.length) return null;

  return (
    <div
      className="select-none"
      style={{ width: 40, lineHeight: 'var(--line-h)' }}
    >
      {/* Header offset matches the LyricPad header (~26px) + pad top padding (1.5rem) */}
      <div style={{ height: 'calc(26px + 1.5rem)' }} />

      {rhythmicSkeleton.map((line, i) => {
        const ghost = ghostSkeleton[i];
        const baseCountColor = line.syllableCount > 0 ? getSyllableColor(line.syllableCount) : '#3f4659';
        let countColor = baseCountColor;
        let glow = '';

        if (isGhostMode && ghost) {
          if (line.syllableCount === 0 && line.text.trim() === '') {
            countColor = '#3f4659';
          } else if (line.syllableCount === ghost.syllableCount) {
            countColor = '#4ECB71';
            glow = '0 0 6px rgba(78,203,113,0.8)';
          } else {
            countColor = '#FF6B6B';
            glow = '0 0 6px rgba(255,107,107,0.8)';
          }
        }

        const hasContent = line.syllableCount > 0;
        const hasSuffix = !!line.suffix;
        // When a rhyme suffix exists we paint the rhyme-color pill behind
        // the digits and force a dark text color so the number reads on
        // any saturated palette hue. Without a rhyme color we just float
        // the colored digits on transparent so the gutter blends in.
        const bg = hasSuffix ? line.rhymeColor : 'transparent';
        const textColor = hasSuffix ? '#0d0f14' : countColor;

        return (
          <div
            key={line.id}
            className="flex items-center justify-end gap-1 pr-1"
            style={{ height: 'var(--line-h)' }}
          >
            {isGhostMode && ghost && ghost.syllableCount > 0 && (
              <span
                className="text-[10px] text-studio-muted tabular-nums opacity-60"
                title={`Target: ${ghost.syllableCount} syllables`}
              >
                /{ghost.syllableCount}
              </span>
            )}

            <span
              className="rounded inline-flex items-center justify-center font-mono font-semibold tabular-nums"
              style={{
                minWidth: 22,
                height: 18,
                padding: '0 5px',
                background: bg,
                color: textColor,
                fontSize: '0.72rem',
                boxShadow: hasSuffix ? `0 0 6px ${line.rhymeColor}80` : 'none',
                textShadow: glow || undefined,
              }}
              title={hasSuffix ? `Suffix: "${line.suffix}"` : undefined}
            >
              {hasContent ? line.syllableCount : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
