import { getSuffixColor } from './colors';

/** Matches any of [foo], {foo}, (foo), <foo> as a single tag.
 *  Group 1 is the label between the brackets. The opening + closing
 *  brackets don't have to match (e.g. [foo}); we accept that quirk in
 *  exchange for a much simpler parser. */
export const TAG_REGEX = /[[{(<]([^\]})>]+)[\]})>]/g;
const TAG_FULL_REGEX = /[[{(<][^\]})>]+[\]})>]/g;

/** Extract all tag labels from text (e.g. [Sad] → "Sad") */
export function extractTags(text: string): string[] {
  const tags: string[] = [];
  const re = new RegExp(TAG_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const label = m[1].trim();
    if (label) tags.push(label);
  }
  return tags;
}

/** Strip every tag (any bracket pair) from a string — used by syllable
 *  counting so the tag's label doesn't inflate the syllable count of the
 *  line it sits on. */
export function stripTags(text: string): string {
  return text.replace(new RegExp(TAG_FULL_REGEX.source, 'g'), '');
}

/**
 * parsePills: split a raw text block by newlines → array of non-empty strings.
 * Each resulting string becomes one pill label.
 */
export function parsePills(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Style-pad rendering: plain text with tag highlights only (no syllable bg).
 * For composing AI music-bot prompts where pills resolve to text.
 */
export function buildStyleHtml(text: string): string {
  const lines = text.split('\n');
  return lines
    .map((line) => {
      if (!line) return '';
      const tagRe = /([[{(<][^\]})>]+[\]})>])/g;
      const parts = line.split(tagRe);
      let out = '';
      for (const part of parts) {
        if (!part) continue;
        if (/^[[{(<]/.test(part) && /[\]})>]$/.test(part)) {
          out += `<span class="inline-tag">${escHtml(part)}</span>`;
        } else {
          out += escHtml(part);
        }
      }
      return out;
    })
    .join('<br>');
}

/**
 * Ghost camouflage: per-rhyme-point camouflage. Every word is rendered
 * with its body invisible (color matches the surrounding syllable box)
 * EXCEPT for words that sit immediately before a sentence-end punct or
 * the end of the line — those keep their last 2 alphabetic letters
 * visible (in their rhyme color). For the line:
 *   "A ledger of silver carved into cartilage, clipping feathers off
 *    a seraphim's wing."
 * the rhyme points are "cartilage" (before the comma) and "wing"
 * (before the period), so "ge" and "ng" both stay visible while every
 * other letter dissolves into the syllable boxes.
 */
export function buildGhostBottomHtml(text: string): string {
  const lines = text.split('\n');
  return lines.map((line) => (line ? camouflageLine(line) : '')).join('<br>');
}

function camouflageLine(line: string): string {
  const { tokens, rhymePoints } = tokenizeLineWithPositions(line);
  let out = '';

  for (const t of tokens) {
    if (t.kind === 'tag') {
      out += `<span class="inline-tag" style="opacity:0.35">${escHtml(t.text)}</span>`;
    } else if (t.kind === 'space') {
      out += t.text;
    } else if (t.kind === 'punct') {
      // Sentence-end punct stays faintly visible — it anchors the rhyme
      // structure for someone reading the camouflaged trace.
      out += `<span style="color:rgba(226,232,240,0.45)">${escHtml(t.text)}</span>`;
    } else {
      const cls = t.idx % 2 === 0 ? 'syl-a' : 'syl-b';
      if (rhymePoints.has(t.idx)) {
        const { before, tail, after } = splitTail(t.text);
        if (!tail) {
          out += `<span class="${cls}" style="color:transparent">${escHtml(t.text)}</span>`;
        } else {
          const tailLetters = tail.replace(/[^a-zA-Z]/g, '').toLowerCase();
          const color = getSuffixColor(tailLetters);
          out +=
            `<span class="${cls}">` +
            `<span style="color:transparent">${escHtml(before)}</span>` +
            `<span style="color:${color};font-weight:600">${escHtml(tail)}</span>` +
            `<span style="color:transparent">${escHtml(after)}</span>` +
            `</span>`;
        }
      } else {
        out += `<span class="${cls}" style="color:transparent">${escHtml(t.text)}</span>`;
      }
    }
  }
  return out;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build innerHTML for the lyric editor:
 *  - Words alternate .syl-a / .syl-b
 *  - [tag] patterns become styled .inline-tag spans (contenteditable=false)
 *  - Lines separated by <br>
 *
 * In ghost mode the caller passes an optional `lineMatch` array with one
 * entry per line ('match' | 'mismatch' | null). For matching lines we
 * tack on .syl-match (green tint) to every syllable span; mismatching
 * lines get .syl-mismatch (red tint). Both override the .syl-a/.syl-b
 * background via cascade, so the user gets per-line feedback right in
 * the typing surface — not just in the gutter.
 */
export function buildEditorHtml(
  text: string,
  options: {
    lineMatch?: ('match' | 'mismatch' | null)[];
    /** Word.toLowerCase() → background color for Datamuse probe matches. */
    wordHighlights?: Record<string, string>;
  } = {}
): string {
  const lines = text.split('\n');
  const lm = options.lineMatch;
  const wh = options.wordHighlights;
  return lines
    .map((line, i) => (line ? tokenLineToHtml(line, lm?.[i] ?? null, wh) : ''))
    .join('<br>');
}

function tokenLineToHtml(
  line: string,
  match: 'match' | 'mismatch' | null,
  wordHighlights?: Record<string, string>
): string {
  const { tokens, rhymePoints } = tokenizeLineWithPositions(line);
  const matchCls = match === 'match' ? ' syl-match' : match === 'mismatch' ? ' syl-mismatch' : '';
  let out = '';

  for (const t of tokens) {
    if (t.kind === 'tag') {
      // Preserve the original brackets — don't replace with [] — so users
      // who pick {}/()/<> see what they typed instead of having every tag
      // re-stamped to square on every rebuild.
      out += `<span class="inline-tag">${escHtml(t.text)}</span>`;
    } else if (t.kind === 'space') {
      out += t.text;
    } else if (t.kind === 'punct') {
      out += escHtml(t.text);
    } else {
      const cls = (t.idx % 2 === 0 ? 'syl-a' : 'syl-b') + matchCls;
      // Word Probe highlight (Datamuse topic match) wraps the syllable
      // span so the box still renders. Use a clean alphabetic key so
      // 'Diamond' and 'diamond,' both hit the same probe.
      const probeKey = wordHighlights
        ? t.text.replace(/[^A-Za-z]/g, '').toLowerCase()
        : '';
      const probeColor = probeKey && wordHighlights ? wordHighlights[probeKey] : undefined;
      const inner = rhymePoints.has(t.idx)
        ? renderWordWithTail(t.text, cls)
        : `<span class="${cls}">${escHtml(t.text)}</span>`;
      if (probeColor) {
        out += `<span class="word-probe" style="background:${probeColor};color:#0d0f14;padding:0 3px;border-radius:3px;">${inner}</span>`;
      } else {
        out += inner;
      }
    }
  }

  return out;
}

/* ─── Shared line tokenizer ────────────────────────────────
 * Returns position-tagged tokens plus the set of "rhyme point" word
 * indices (the last word seen before each punctuation token, plus the
 * very last word at end-of-line). Apostrophes stay inside words so
 * "don't" remains a single word; doublequote is a sentence-end punct.
 */
type LineTokPos =
  | { kind: 'tag'; text: string; start: number }
  | { kind: 'space'; text: string; start: number }
  | { kind: 'punct'; text: string; start: number }
  | { kind: 'word'; text: string; idx: number; start: number };

function tokenizeLineWithPositions(line: string): {
  tokens: LineTokPos[];
  rhymePoints: Set<number>;
} {
  const tokens: LineTokPos[] = [];
  let wordIdx = 0;

  // Order matters: closed [tag]/{tag}/(tag)/<tag> first, then ws/punct,
  // then word. The word class allows stray brackets so partial / unmatched
  // brackets (e.g. while the user is typing) still tokenize cleanly.
  const re = /([[{(<][^\]})>]+[\]})>])|(\s+)|([,.;:?!"]+)|([^\s,.;:?!"]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const start = m.index;
    if (m[1]) tokens.push({ kind: 'tag', text: m[1], start });
    else if (m[2]) tokens.push({ kind: 'space', text: m[2], start });
    else if (m[3]) tokens.push({ kind: 'punct', text: m[3], start });
    else if (m[4]) {
      tokens.push({ kind: 'word', text: m[4], idx: wordIdx, start });
      wordIdx++;
    }
  }

  const rhymePoints = new Set<number>();
  let lastWord = -1;
  for (const t of tokens) {
    if (t.kind === 'word') lastWord = t.idx;
    else if (t.kind === 'punct' && lastWord >= 0) {
      rhymePoints.add(lastWord);
      lastWord = -1;
    }
  }
  if (lastWord >= 0) rhymePoints.add(lastWord);

  return { tokens, rhymePoints };
}

/**
 * Find the last 2 alphabetic characters of a word, ignoring symbols.
 * Returns the slice indices so we can split the word into before/tail/after.
 */
function splitTail(word: string): { before: string; tail: string; after: string } {
  let tailEnd = -1;
  let tailStart = -1;
  let count = 0;
  for (let i = word.length - 1; i >= 0; i--) {
    if (/[a-zA-Z]/.test(word[i])) {
      if (tailEnd === -1) tailEnd = i + 1;
      tailStart = i;
      count++;
      if (count >= 2) break;
    }
  }
  if (tailEnd === -1) return { before: word, tail: '', after: '' };
  return {
    before: word.slice(0, tailStart),
    tail: word.slice(tailStart, tailEnd),
    after: word.slice(tailEnd),
  };
}

/**
 * Render a word with its syllable bg + last-2-letters in suffix-rhyme color.
 *
 * The DOM structure here is INTENTIONALLY identical to the camouflage
 * branch in buildGhostBottomHtml — same span wrapping, same inline
 * font-weight on the tail. Without that, the rasterized ghost snapshot
 * and the live editor rendered the same text at slightly different
 * sub-pixel positions (transparent-span before/after vs. plain text),
 * which threw the visible 2-letter tails out of alignment with the
 * snapshot boxes underneath.
 */
function renderWordWithTail(word: string, sylClass: string): string {
  const { before, tail, after } = splitTail(word);
  if (!tail) {
    return `<span class="${sylClass}">${escHtml(word)}</span>`;
  }
  const tailLetters = tail.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const color = getSuffixColor(tailLetters);
  return (
    `<span class="${sylClass}">` +
    `<span>${escHtml(before)}</span>` +
    `<span style="color:${color};font-weight:600">${escHtml(tail)}</span>` +
    `<span>${escHtml(after)}</span>` +
    `</span>`
  );
}

