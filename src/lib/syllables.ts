const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;

  let count = 0;
  let prevVowel = false;

  for (const ch of w) {
    const isV = VOWELS.has(ch);
    if (isV && !prevVowel) count++;
    prevVowel = isV;
  }

  // Silent trailing -e
  if (w.endsWith('e') && count > 1) count--;

  // -ed / -es that don't add a syllable (except after t/d)
  if (w.endsWith('ed') && !w.endsWith('ted') && !w.endsWith('ded') && count > 1) count--;
  if (w.endsWith('es') && !w.endsWith('ses') && !w.endsWith('xes') && !w.endsWith('zes') && count > 1) count--;

  return Math.max(1, count);
}

export function countLineSyllables(line: string): number {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, token) => {
      const word = token.replace(/[^a-zA-Z']/g, '');
      return sum + countSyllables(word);
    }, 0);
}

export function extractSuffix(line: string): string {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const last = words[words.length - 1].replace(/[^a-zA-Z]/g, '').toLowerCase();
  return last.length >= 2 ? last.slice(-2) : last;
}

export function extractPunctuation(line: string): string[] {
  return Array.from(line).filter(ch => ',.:;?!'.includes(ch));
}

/** Tokenize a line for highlighting: returns words/spaces/tags */
export interface Token {
  type: 'word' | 'space' | 'tag';
  text: string;
}

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  const tagRe = /(\[[^\]]+\])/g;
  const parts = line.split(tagRe);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('[') && part.endsWith(']')) {
      tokens.push({ type: 'tag', text: part });
    } else {
      const segRe = /(\s+|[^\s]+)/g;
      let m: RegExpExecArray | null;
      while ((m = segRe.exec(part)) !== null) {
        tokens.push({ type: /^\s/.test(m[0]) ? 'space' : 'word', text: m[0] });
      }
    }
  }

  return tokens;
}
