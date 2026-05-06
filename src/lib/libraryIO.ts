import { TagCategory, TagLibrary, StyleBranch } from '@/types';
import type { CustomTagCategory } from '@/store/useStudio';

const KNOWN_CATEGORIES: TagCategory[] = ['Style', 'Lyrics', 'FX', 'Mood', 'Instruments', 'Genre'];

/**
 * Shared dump format — used for tags, pocket, and branches:
 *
 *   ## Category Name
 *   item one
 *   item two
 *
 *   ## Other Category
 *   ...
 *
 * Empty lines are ignored. Lines beginning with `##` open a new section
 * (whatever follows the `##` is the category/branch name). Anything
 * else is an item in the current section.
 */
export interface DumpSection {
  name: string;
  items: string[];
}

export function parseDump(text: string): DumpSection[] {
  const sections: DumpSection[] = [];
  let current: DumpSection | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('##')) {
      const name = line.slice(2).trim();
      if (!name) continue;
      current = { name, items: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      // Items before any `##` header land in an unnamed bucket so callers
      // can still recover them (e.g. importing into Pocket without headers).
      current = { name: '', items: [] };
      sections.push(current);
    }
    current.items.push(line);
  }
  return sections;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    if (!seen.has(i)) { seen.add(i); out.push(i); }
  }
  return out;
}

/* ─── Tags ─────────────────────────────────────────────── */

/**
 * Dump the full tag library — built-in categories first, then user-defined
 * custom categories with a `!custom icon=… color=…` marker so the
 * importer can recreate them on the other side.
 */
export function dumpTags(library: TagLibrary, customCats: CustomTagCategory[] = []): string {
  const builtIns = KNOWN_CATEGORIES.map((cat) => {
    const items = library[cat] ?? [];
    return [`## ${cat}`, ...items].join('\n');
  });
  const custom = customCats.map((c) =>
    [`## ${c.name}`, `!custom icon=${c.icon} color=${c.color}`, ...c.tags].join('\n')
  );
  return [...builtIns, ...custom].join('\n\n');
}

/**
 * Parse a dump and return both:
 *   - merged: TagLibrary with built-in categories augmented (dedupe'd)
 *   - customAdds: an array of custom-category specs ready for the store's
 *     addCustomTagCategory + bulk-load actions.
 */
export interface MergedTagsResult {
  library: TagLibrary;
  customAdds: { name: string; icon: string; color: string; tags: string[] }[];
}

export function mergeTagsFromDump(
  library: TagLibrary,
  text: string,
  existingCustomNames: string[] = []
): MergedTagsResult {
  const merged: TagLibrary = {
    Style: [...library.Style],
    Lyrics: [...library.Lyrics],
    FX: [...library.FX],
    Mood: [...library.Mood],
    Instruments: [...library.Instruments],
    Genre: [...library.Genre],
  };
  const customAdds: MergedTagsResult['customAdds'] = [];
  const existingLower = new Set(existingCustomNames.map((n) => n.toLowerCase()));

  for (const sec of parseDump(text)) {
    // A leading `!custom icon=… color=…` line on the section's first item
    // marks this as a user-defined category. Anything else is treated as
    // either a built-in match (case-insensitive) or skipped.
    const marker = sec.items[0]?.startsWith('!custom') ? sec.items[0] : null;
    const tags = marker ? sec.items.slice(1) : sec.items;

    if (marker) {
      const iconMatch = marker.match(/icon=([^\s]+)/);
      const colorMatch = marker.match(/color=(#?[0-9a-fA-F]{3,8})/);
      // Skip if a custom category by this name already exists — the
      // import is purely additive for new categories so we don't
      // clobber the user's tweaks to an existing one.
      if (!existingLower.has(sec.name.toLowerCase())) {
        customAdds.push({
          name: sec.name,
          icon: iconMatch?.[1] ?? '🏷',
          color: colorMatch?.[1] ?? '#22d3ee',
          tags: dedupe(tags),
        });
      }
      continue;
    }

    const cat = KNOWN_CATEGORIES.find((c) => c.toLowerCase() === sec.name.toLowerCase());
    if (!cat) continue;
    merged[cat] = dedupe([...merged[cat], ...tags]);
  }
  return { library: merged, customAdds };
}

/* ─── Pocket ───────────────────────────────────────────── */

export function dumpPocket(items: { text: string }[]): string {
  return ['## Pocket', ...items.map((i) => i.text)].join('\n');
}

/** Returns the parsed snippets (caller decides how to add to store). */
export function parsePocketDump(text: string): string[] {
  const sections = parseDump(text);
  if (!sections.length) return [];
  // Accept either an explicit `## Pocket` header or any-header-ignored mode.
  const flat = sections.flatMap((s) => s.items);
  return dedupe(flat);
}

/* ─── Branches ─────────────────────────────────────────── */

export function dumpBranches(branches: StyleBranch[]): string {
  return branches
    .map((b) => [`## ${b.name}`, ...b.pills].join('\n'))
    .join('\n\n');
}

/** Each `## Header` becomes a new branch; following lines = pills. */
export function parseBranchesDump(text: string): { name: string; pills: string[] }[] {
  return parseDump(text)
    .filter((s) => s.name && s.items.length)
    .map((s) => ({ name: s.name, pills: dedupe(s.items) }));
}
