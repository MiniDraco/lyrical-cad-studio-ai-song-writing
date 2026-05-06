export interface DatamuseWord {
  word: string;
  score: number;
  numSyllables?: number;
}

/* The IntelliSense single-fetch helpers share an AbortController so a new
 * keystroke cancels the in-flight rhyme/context lookup. The Word Probes
 * helper below uses its own controller-per-call so concurrent topic
 * fetches don't kill each other. */
let ctrl: AbortController | null = null;

async function dmFetch(url: string): Promise<DatamuseWord[]> {
  ctrl?.abort();
  ctrl = new AbortController();
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    return (await res.json()) as DatamuseWord[];
  } catch {
    return [];
  }
}

async function dmFetchUnshared(url: string): Promise<DatamuseWord[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as DatamuseWord[];
  } catch {
    return [];
  }
}

/* ─── IntelliSense mode helpers (Net Tap presets) ─────── */
export type NetTapMode =
  | 'rhyme'      // rel_rhy — words that rhyme
  | 'synonym'    // ml      — means-like (synonyms)
  | 'adjectives' // rel_jjb — adjectives that describe a noun
  | 'nouns'      // rel_jja — nouns described by an adjective
  | 'soundsLike' // sl      — words that sound like
  | 'context'    // lc      — words that often follow
  | 'thematic';  // ml + topics — synonyms biased by a theme

export const NET_TAP_LABELS: Record<NetTapMode, { icon: string; name: string; hint: string }> = {
  rhyme:      { icon: '🎵', name: 'Rhyme',      hint: 'Words that rhyme with [W]' },
  synonym:    { icon: '≡',  name: 'Synonym',    hint: 'Means-like — close synonyms of [W]' },
  adjectives: { icon: '🎨', name: 'Adjectives', hint: 'Adjectives often used to describe [W]' },
  nouns:      { icon: '🧱', name: 'Nouns',      hint: 'Nouns often described by [W]' },
  soundsLike: { icon: '🔊', name: 'Sounds Like', hint: 'Words that sound like [W]' },
  context:    { icon: '➡',  name: 'Context',    hint: 'Words that often follow [W]' },
  thematic:   { icon: '🌌', name: 'Thematic',   hint: 'Synonyms of [W] biased by a theme' },
};

export function fetchByMode(
  mode: NetTapMode,
  word: string,
  topic?: string
): Promise<DatamuseWord[]> {
  const w = encodeURIComponent(word);
  const t = encodeURIComponent(topic ?? '');
  switch (mode) {
    case 'rhyme':      return dmFetch(`https://api.datamuse.com/words?rel_rhy=${w}&max=12`);
    case 'synonym':    return dmFetch(`https://api.datamuse.com/words?ml=${w}&max=12`);
    case 'adjectives': return dmFetch(`https://api.datamuse.com/words?rel_jjb=${w}&max=12`);
    case 'nouns':      return dmFetch(`https://api.datamuse.com/words?rel_jja=${w}&max=12`);
    case 'soundsLike': return dmFetch(`https://api.datamuse.com/words?sl=${w}&max=12`);
    case 'context':    return dmFetch(`https://api.datamuse.com/words?lc=${w}&max=12`);
    case 'thematic':   return dmFetch(`https://api.datamuse.com/words?ml=${w}${topic ? `&topics=${t}` : ''}&max=12`);
  }
}

// Legacy callers — keep working.
export function fetchRhymes(word: string): Promise<DatamuseWord[]> {
  return fetchByMode('rhyme', word);
}
export function fetchContextPhrases(lastWord: string): Promise<DatamuseWord[]> {
  return fetchByMode('context', lastWord);
}

/* ─── Word Probes ──────────────────────────────────────
 * Builds a vocabulary set for a topic by merging two Datamuse queries:
 *   rel_trg=<topic>  — words statistically triggered by the topic
 *                      (associations, e.g. luxury → yacht, hotel, watches)
 *   ml=<topic>       — words means-like the topic (synonyms / near-synonyms)
 * Datamuse's `topics=` parameter ALONE returns nothing — it's a bias
 * applied to a primary query. The trg+ml union gives the broadest
 * concept network for probe matching with a single fetch pair. */
export async function fetchTopicWords(topic: string): Promise<Set<string>> {
  const t = encodeURIComponent(topic);
  const [trg, ml] = await Promise.all([
    dmFetchUnshared(`https://api.datamuse.com/words?rel_trg=${t}&max=300`),
    dmFetchUnshared(`https://api.datamuse.com/words?ml=${t}&max=300`),
  ]);
  const out = new Set<string>([topic.toLowerCase()]);
  for (const r of trg) out.add(r.word.toLowerCase());
  for (const r of ml)  out.add(r.word.toLowerCase());
  return out;
}
