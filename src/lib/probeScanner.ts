import { fetchTopicWords } from './datamuse';
import { WordProbe } from '@/store/useStudio';

/* In-memory cache of fetched topic word-sets. Keyed by topic name; each
 * entry is the lowercased word set returned by Datamuse. Survives across
 * scan() calls but resets on hard reload (which is fine — the topic
 * vocabulary is stable enough that re-fetching once per session is a
 * negligible cost). */
const topicCache = new Map<string, Set<string>>();
const inflight = new Map<string, Promise<Set<string>>>();

async function getTopicSet(topic: string): Promise<Set<string>> {
  const key = topic.toLowerCase().trim();
  if (!key) return new Set();
  const cached = topicCache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = fetchTopicWords(key).then((set) => {
    topicCache.set(key, set);
    inflight.delete(key);
    return set;
  });
  inflight.set(key, p);
  return p;
}

/**
 * Run all enabled probes against the editor text and build a
 *   word.toLowerCase() → color
 * map. The first matching probe wins (so earlier slots take priority).
 */
export async function scanWordProbes(
  text: string,
  probes: WordProbe[]
): Promise<Record<string, string>> {
  const enabled = probes.filter((p) => p.topic.trim().length > 0);
  if (!enabled.length) return {};

  // Pull all topic sets in parallel — cached calls resolve instantly.
  const sets = await Promise.all(
    enabled.map((p) => getTopicSet(p.topic).then((s) => ({ probe: p, set: s })))
  );

  const out: Record<string, string> = {};
  // Walk every word in the text once. For each, check probes in order
  // and assign the first hit's color. Words that don't appear in any
  // topic set are simply not added to the map.
  const wordRe = /[A-Za-z][A-Za-z']*/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = wordRe.exec(text)) !== null) {
    const w = m[0].toLowerCase();
    if (seen.has(w)) continue;
    seen.add(w);
    for (const { probe, set } of sets) {
      if (set.has(w)) {
        out[w] = probe.color;
        break;
      }
    }
  }
  return out;
}

/** Wipe the cached topic vocabularies — used when the user changes a topic value. */
export function invalidateProbeTopic(topic: string) {
  topicCache.delete(topic.toLowerCase().trim());
}
