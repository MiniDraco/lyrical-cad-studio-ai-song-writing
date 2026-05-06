'use client';

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { useStudio, BRACKET_PAIRS } from '@/store/useStudio';
import { countLineSyllables, extractSuffix, extractPunctuation } from '@/lib/syllables';
import { getSuffixColor } from '@/lib/colors';
import { getCaretOffset, setCaretOffset, getScrollParent } from '@/lib/caret';
import { extractTags, buildEditorHtml, buildGhostBottomHtml, stripTags } from '@/lib/tagParser';
import { LineData } from '@/types';
import IntelliSense from './IntelliSense';
import PadIO from './PadIO';
import PadTabs from './PadTabs';
import WordPill from './WordPill';

function getEditorText(el: HTMLElement): string {
  let text = '';
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
      return;
    }
    if (node instanceof HTMLElement) {
      if (node.tagName === 'BR') { text += '\n'; return; }
      for (const child of node.childNodes) walk(child);
      if (node.tagName === 'DIV') text += '\n';
    }
  }
  for (const child of el.childNodes) walk(child);
  return text;
}

/**
 * Detect "light" edits — pure letter typing inside an active word with no
 * structural chars touched. Light edits skip the innerHTML rebuild and only
 * update the store, which kills the typing-feels-laggy DOM thrash.
 *
 * Heavy chars: any whitespace, brackets, or sentence-end punctuation.
 * If those appear in the diff, we need to re-tokenize → rebuild.
 */
const STRUCTURAL_RE = /[\s\[\],.;:?!"]/;
function isLightChange(prev: string, curr: string): boolean {
  if (prev === curr) return true;
  let i = 0;
  while (i < prev.length && i < curr.length && prev[i] === curr[i]) i++;
  let pj = prev.length - 1;
  let cj = curr.length - 1;
  while (pj >= i && cj >= i && prev[pj] === curr[cj]) { pj--; cj--; }
  const removed = prev.slice(i, pj + 1);
  const added = curr.slice(i, cj + 1);
  if (STRUCTURAL_RE.test(removed) || STRUCTURAL_RE.test(added)) return false;
  return true;
}

export interface LyricPadHandle {
  toggleGhost: () => Promise<void>;
}

const LyricPad = forwardRef<LyricPadHandle>(function LyricPad(_, externalRef) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRebuildRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRef = useRef(false);
  const hydratedRef = useRef(false);
  const lastBuiltTextRef = useRef('');
  const lastInternalTextRef = useRef('');

  const [intelliPos, setIntelliPos] = useState<{ top: number; left: number } | null>(null);
  const [intelliQuery, setIntelliQuery] = useState('');
  const [intelliOpen, setIntelliOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [caretRect, setCaretRect] = useState<{ top: number; left: number; height: number } | null>(null);
  const [wordPill, setWordPill] = useState<{ word: string; x: number; y: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    setRhythmicSkeleton,
    addDiscoveredTag,
    masterTagLibrary,
    isGhostMode,
    ghostBgOpacity,
    ghostSkeleton,
    savedLyric,
    lyricText,
    setLyricText,
    enableGhost,
    disableGhost,
    exportGhostToLyric,
    bracketType,
    probesEnabled,
    wordHighlights,
    setCurrentIntelliWord,
  } = useStudio();
  const [exportFlash, setExportFlash] = useState(false);
  const [bOpen, bClose] = BRACKET_PAIRS[bracketType];

  /* ─── Custom blinking caret ────────────────────────────
   * The native caret on this dark theme is hard to spot against the colored
   * syllable boxes. We hide it (caret-color:transparent in CSS) and render
   * a brighter blinking bar overlay positioned at the collapsed selection.
   *
   * The re-entry guard exists because the probe span we insert below
   * mutates the selection in a way that triggers a synchronous
   * selectionchange in some browsers — without the guard that turns
   * into infinite recursion (probe → selectionchange → updateCaret →
   * probe …).
   */
  const updatingCaretRef = useRef(false);
  const updateCaret = useCallback(() => {
    if (updatingCaretRef.current) return;
    updatingCaretRef.current = true;
    try {
      const el = editorRef.current;
      if (!el || typeof window === 'undefined') {
        setCaretRect(null);
        return;
      }
      if (document.activeElement !== el) {
        setCaretRect(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
        setCaretRect(null);
        return;
      }
      const range = sel.getRangeAt(0);

      let rect: { top: number; left: number; height: number } | null = null;

      // Method 1: collapsed range's client rects
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const rc = rects[i];
        if (rc.height > 0) {
          rect = { top: rc.top, left: rc.left, height: rc.height };
          break;
        }
      }

      // Method 2: probe span — many browsers return empty rects for collapsed
      // ranges between two <br>s (the post-Enter case). Insert a zero-width
      // span at the caret, measure, remove. suppressRef blocks any
      // input-triggered rebuild during the brief mutation.
      if (!rect && el.contains(range.startContainer)) {
        const wasSuppressed = suppressRef.current;
        suppressRef.current = true;
        try {
          const probe = document.createElement('span');
          probe.appendChild(document.createTextNode('​'));
          range.insertNode(probe);
          const r = probe.getBoundingClientRect();
          if (r.height > 0) rect = { top: r.top, left: r.left, height: r.height };
          probe.parentNode?.removeChild(probe);
          el.normalize();
          const restored = sel.getRangeAt(0);
          restored.collapse(true);
        } catch {
          /* probe failed — fall through to method 3 */
        } finally {
          suppressRef.current = wasSuppressed;
        }
      }

      // Method 3: empty-pad fallback — anchor at the pad's content origin.
      if (!rect) {
        const editorRect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const padTop = parseFloat(cs.paddingTop) || 24;
        const padLeft = parseFloat(cs.paddingLeft) || 16;
        const lh = parseFloat(cs.lineHeight) || 32;
        rect = {
          top: editorRect.top + padTop,
          left: editorRect.left + padLeft,
          height: lh,
        };
      }

      setCaretRect(rect);
    } finally {
      updatingCaretRef.current = false;
    }
  }, []);

  // rAF-coalesced caret update — selectionchange fires on every arrow tick
  // and clicks deep in the document used to backlog 60+ updateCaret calls per
  // second. Coalescing batches them down to one per animation frame.
  const caretRafRef = useRef<number | null>(null);
  const scheduleCaret = useCallback(() => {
    if (caretRafRef.current !== null) return;
    caretRafRef.current = requestAnimationFrame(() => {
      caretRafRef.current = null;
      updateCaret();
    });
  }, [updateCaret]);

  /* ─── Keep caret in view on Enter / typing ─────────────
   * The custom Enter handler preventDefaults the native event, which also
   * skips the browser's auto-scroll-to-caret. processContent then restores
   * the saved scrollTop after every rebuild. Without this helper, typing
   * past the visible bottom leaves the cursor stranded off-screen.
   */
  const keepCaretInView = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return;

    let caretRect: DOMRect | null = null;
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      if (rects[i].height > 0) { caretRect = rects[i]; break; }
    }
    // Fallback: probe span (matches updateCaret's fallback path).
    if (!caretRect) {
      const wasSuppressed = suppressRef.current;
      suppressRef.current = true;
      try {
        const probe = document.createElement('span');
        probe.appendChild(document.createTextNode('​'));
        range.insertNode(probe);
        const r = probe.getBoundingClientRect();
        if (r.height > 0) caretRect = r;
        probe.parentNode?.removeChild(probe);
        el.normalize();
      } catch { /* ignore */ }
      finally { suppressRef.current = wasSuppressed; }
    }
    if (!caretRect) return;

    const sp = getScrollParent(el);
    if (!sp) return;
    const spRect = sp.getBoundingClientRect();
    const margin = 32;

    if (caretRect.bottom > spRect.bottom - margin) {
      sp.scrollTop += caretRect.bottom - (spRect.bottom - margin);
    } else if (caretRect.top < spRect.top + margin) {
      sp.scrollTop -= (spRect.top + margin) - caretRect.top;
    }
  }, []);

  useEffect(() => {
    const onSelChange = () => scheduleCaret();
    const onFocusOut = () => setCaretRect(null);
    document.addEventListener('selectionchange', onSelChange);
    const el = editorRef.current;
    el?.addEventListener('blur', onFocusOut);
    el?.addEventListener('focus', onSelChange);
    return () => {
      document.removeEventListener('selectionchange', onSelChange);
      el?.removeEventListener('blur', onFocusOut);
      el?.removeEventListener('focus', onSelChange);
    };
  }, [scheduleCaret]);

  useEffect(() => {
    const sp = getScrollParent(editorRef.current);
    const handler = () => scheduleCaret();
    sp?.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      sp?.removeEventListener('scroll', handler);
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [scheduleCaret]);

  /* ─── Process the editor's current content ────────── */
  const processContent = useCallback(
    (opts: { force?: boolean } = {}) => {
      const el = editorRef.current;
      if (!el || suppressRef.current) return;

      const rawText = getEditorText(el);
      const lines = rawText.split('\n');

      const skeleton: LineData[] = lines.map((line, i) => {
        const stripped = stripTags(line).trim();
        const syl = countLineSyllables(stripped);
        const suffix = extractSuffix(stripped);
        return {
          id: `ln-${i}`,
          text: line,
          syllableCount: syl,
          suffix,
          rhymeColor: getSuffixColor(suffix),
          punctuation: extractPunctuation(line),
        };
      });

      // Always update the store — this is cheap and keeps the gutter live.
      lastInternalTextRef.current = rawText;
      setLyricText(rawText);
      setRhythmicSkeleton(skeleton);

      // Harvest orphan tags
      const allKnown = new Set(Object.values(masterTagLibrary).flat());
      extractTags(rawText).forEach((tag) => {
        if (!allKnown.has(tag)) addDiscoveredTag(tag);
      });

      // FAST PATH: skip the heavy DOM rebuild when only letters changed
      // mid-word. The active word stays as plain text until a structural
      // char (space, newline, [/]/.,;:?!"') triggers the heavy path.
      if (!opts.force && isLightChange(lastBuiltTextRef.current, rawText)) {
        return;
      }
      lastBuiltTextRef.current = rawText;

      // Heavy path — rebuild innerHTML and restore the caret.
      suppressRef.current = true;
      const scrollParent = getScrollParent(el);
      const savedScrollTop = scrollParent?.scrollTop ?? 0;
      const caretPos = getCaretOffset(el);

      // In ghost mode, compare each typed line's syllable count to the
      // captured target's count for the same line index. Empty/blank
      // typed lines stay neutral so the user isn't drowning in red
      // before they've written anything.
      const lineMatch =
        isGhostMode && ghostSkeleton.length
          ? skeleton.map((line, i): 'match' | 'mismatch' | null => {
              const target = ghostSkeleton[i];
              if (!target || target.syllableCount === 0) return null;
              if (line.syllableCount === 0 && line.text.trim() === '') return null;
              return line.syllableCount === target.syllableCount ? 'match' : 'mismatch';
            })
          : undefined;

      el.innerHTML = buildEditorHtml(rawText, {
        lineMatch,
        wordHighlights: probesEnabled ? wordHighlights : undefined,
      });
      setCaretOffset(el, caretPos);

      if (scrollParent && scrollParent.scrollTop !== savedScrollTop) {
        scrollParent.scrollTop = savedScrollTop;
      }
      requestAnimationFrame(() => {
        if (scrollParent && Math.abs(scrollParent.scrollTop - savedScrollTop) > 1) {
          scrollParent.scrollTop = savedScrollTop;
        }
        // After restoring the pre-rebuild scroll position, follow the caret
        // if it ended up off-screen (e.g. user typed past the visible bottom
        // before the rebuild fired).
        keepCaretInView();
        scheduleCaret();
      });
      suppressRef.current = false;
    },
    [
      masterTagLibrary,
      setLyricText, setRhythmicSkeleton, addDiscoveredTag,
      updateCaret, keepCaretInView,
      isGhostMode, ghostSkeleton,
      probesEnabled, wordHighlights,
    ]
  );

  /* ─── Wait for Zustand persist to rehydrate ──────────
   * On first mount the store still holds default values; the persisted
   * lyricText arrives asynchronously. We can't initialize the editor's
   * innerHTML until that data lands.
   */
  const [storeHydrated, setStoreHydrated] = useState<boolean>(false);
  useEffect(() => {
    let alive = true;
    if (useStudio.persist?.hasHydrated?.()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = useStudio.persist?.onFinishHydration?.(() => {
      if (alive) setStoreHydrated(true);
    });
    const timer = setTimeout(() => {
      if (alive) setStoreHydrated(true);
    }, 300);
    return () => {
      alive = false;
      unsub?.();
      clearTimeout(timer);
    };
  }, []);

  /* ─── Hydrate on first render ───────────────────────── */
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !storeHydrated || hydratedRef.current) return;
    hydratedRef.current = true;
    if (lyricText) {
      el.innerHTML = buildEditorHtml(lyricText);
      lastBuiltTextRef.current = lyricText;
      lastInternalTextRef.current = lyricText;
      processContent({ force: true });
    } else {
      el.innerHTML = '';
      lastBuiltTextRef.current = '';
      lastInternalTextRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeHydrated]);

  /* Rebuild the editor when the Word Probe state changes — both when a
   * new scan completes (highlights map updated) AND when the master
   * toggle flips. Without the toggle-off rebuild, the previous run's
   * highlights stayed painted until the user typed something. */
  useEffect(() => {
    if (!hydratedRef.current) return;
    processContent({ force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordHighlights, probesEnabled]);

  /* ─── External lyric changes (ghost toggle) ───────────
   * When the store's lyricText changes outside of our typing flow — e.g.
   * enableGhost clears it, disableGhost restores it — we need to refresh
   * the editor's DOM. We distinguish "external" from "internal" changes
   * by comparing against `lastInternalTextRef`, which processContent
   * updates on every keystroke.
   */
  useEffect(() => {
    if (!hydratedRef.current) return;
    const el = editorRef.current;
    if (!el || suppressRef.current) return;
    if (lyricText === lastInternalTextRef.current) return;

    el.innerHTML = lyricText ? buildEditorHtml(lyricText) : '';
    lastBuiltTextRef.current = lyricText;
    lastInternalTextRef.current = lyricText;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (idleRebuildRef.current) clearTimeout(idleRebuildRef.current);
    processContent({ force: true });
    scheduleCaret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricText]);

  /* ─── Input handler (debounced + idle rebuild) ─────── */
  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      processContent();

      // Publish the word at (or just before) the caret to the store —
      // the docked IntelliPane in the footer reads `currentIntelliWord`
      // and refreshes its Datamuse suggestions when the value changes.
      // The auto-popup floating panel was removed (it covered the
      // editor and broke the writer's flow). The pane is opt-in via
      // the footer 🧠 Words button. Ctrl+right-click → Net Tap still
      // pops the floating IntelliSense for one-shot word lookups.
      const el = editorRef.current;
      if (!el) return;
      const text = getEditorText(el);
      const caret = getCaretOffset(el);
      const upToCaret = text.slice(0, caret);

      // Bail when the caret sits inside an unclosed bracket — the user
      // is composing a tag, not a regular word.
      const lastOpen = upToCaret.lastIndexOf('[');
      const lastClose = upToCaret.lastIndexOf(']');
      if (lastOpen > lastClose) { setCurrentIntelliWord(''); return; }

      // Match the word ending at the caret. Apostrophes stay inside the
      // word so "don't" / "blowin'" come through whole.
      const m = upToCaret.match(/([A-Za-z][A-Za-z']{2,})[\s.,;:!?"'-]*$/);
      const seed = m ? m[1].replace(/[^a-zA-Z']/g, '') : '';
      setCurrentIntelliWord(seed.length >= 3 ? seed : '');
    }, 220);

    // After a longer idle, force a rebuild so colors catch up even if the
    // user paused mid-word without typing a structural char.
    if (idleRebuildRef.current) clearTimeout(idleRebuildRef.current);
    idleRebuildRef.current = setTimeout(() => {
      processContent({ force: true });
    }, 900);

    scheduleCaret();
    // Follow the caret as the user types — the light-change fast path
    // skips processContent's rebuild + auto-scroll, so without this the
    // viewport stays put while the caret marches off-screen.
    keepCaretInView();
  }, [processContent, scheduleCaret, keepCaretInView, setCurrentIntelliWord]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (intelliOpen && e.key === 'Escape') setIntelliOpen(false);

      // Make Enter deterministic. Browsers in contentEditable disagree —
      // some insert <div>, some <br>, sometimes two <br>s. We always
      // insert a single <br> and park the caret right after it. The
      // 220ms input-debounced rebuild then re-tokenizes cleanly.
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const editor = editorRef.current;
        const sel = window.getSelection();
        if (!editor || !sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        range.insertNode(br);

        // The caret may sit at the visual end of the editor — i.e. there
        // are no text nodes after this <br> at any nesting level. In that
        // case the browser has nowhere to render the cursor on the new
        // line, so we append a trailing <br> directly to the editor as an
        // anchor.
        let hasFollowingTextNode = false;
        let cursor: Node | null = br;
        outer: while (cursor) {
          let sib = cursor.nextSibling;
          while (sib) {
            if (sib.nodeType === Node.TEXT_NODE && sib.textContent && sib.textContent.length > 0) {
              hasFollowingTextNode = true;
              break outer;
            }
            if (sib instanceof HTMLElement && sib.tagName === 'BR') {
              hasFollowingTextNode = true;
              break outer;
            }
            sib = sib.nextSibling;
          }
          cursor = cursor.parentNode === editor ? null : cursor.parentNode;
        }
        if (!hasFollowingTextNode) {
          editor.appendChild(document.createElement('br'));
        }

        range.setStartAfter(br);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }));
        scheduleCaret();
        keepCaretInView();
      }
    },
    [intelliOpen, scheduleCaret, keepCaretInView]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  /**
   * Find the alphabetic word under a viewport (clientX, clientY) point.
   *
   * The lyric pad renders every word inside a `.syl-a` / `.syl-b` span,
   * and `renderWordWithTail` splits the word's content into THREE inner
   * spans (before / colored-tail / after) so the rhyme color can paint
   * the last 2 letters. caretRangeFromPoint lands on whichever of those
   * inner text nodes is under the cursor, so a single-text-node walk
   * was returning fragments — right-clicking on "night" gave back "nig"
   * or "ht" depending on where you clicked. Walk up to the syllable
   * wrapper and use its full textContent instead, then strip non-alpha.
   */
  const wordAtPoint = useCallback((x: number, y: number): string | null => {
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const range = doc.caretRangeFromPoint?.(x, y);
    if (!range) return null;

    // Preferred path: the syllable wrapper holds the entire word as
    // textContent regardless of how many inner spans split the visual.
    let node: Node | null = range.startContainer;
    while (node && node !== editorRef.current) {
      if (
        node instanceof HTMLElement &&
        (node.classList.contains('syl-a') || node.classList.contains('syl-b'))
      ) {
        const word = (node.textContent ?? '').replace(/[^A-Za-z']/g, '');
        return word || null;
      }
      node = node.parentNode;
    }

    // Fallback: cursor sat on raw text (e.g. the cursor was on a tag,
    // or before any rebuild has wrapped the line yet). Walk left/right
    // through the single text node for word boundaries.
    if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
    const text = range.startContainer.textContent ?? '';
    let s = range.startOffset, e = range.startOffset;
    while (s > 0 && /[A-Za-z']/.test(text[s - 1])) s--;
    while (e < text.length && /[A-Za-z']/.test(text[e])) e++;
    const word = text.slice(s, e).replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    return word || null;
  }, []);

  /* Press-and-hold (450ms) on a word in the editor opens the WordPill
   * web. Movement or release before the timer fires cancels — same
   * gesture you'd use on mobile to "long-press" a token. Only the
   * primary (left) button arms the hold; right-clicks are reserved for
   * the IntelliSense context-menu trigger. */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    const startX = e.clientX;
    const startY = e.clientY;
    holdTimerRef.current = setTimeout(() => {
      const word = wordAtPoint(startX, startY);
      if (word) setWordPill({ word, x: startX, y: startY });
    }, 450);
  }, [wordAtPoint]);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  }, []);

  /* Right-click on a word: native context menu (spellcheck etc).
   * Ctrl/Shift + Right-click on a word: open IntelliSense for that word.
   * The earlier behavior preventDefaulted every right-click, which
   * killed the browser's spellcheck suggestions. The modifier-key
   * variant keeps both gestures available. */
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return; // let native menu show
    const word = wordAtPoint(e.clientX, e.clientY);
    if (!word) return;
    e.preventDefault();
    setIntelliQuery(word);
    setIntelliPos({ top: e.clientY + 6, left: e.clientX });
    setIntelliOpen(true);
  }, [wordAtPoint]);

  /* ─── Pill / pocket / text drag-drop ─────────────────
   * Drops land AT THE DROP POINT — focus first so the editor owns the
   * selection, then place the caret where the user released, then insert.
   * The previous el.focus() AFTER the caret-from-point was overwriting
   * the placement and dropping at the wrong line.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    // Lyric pad refuses Branch pills — those carry style-block expansions
    // and belong in the Style pad. Plain pill labels and pocket text drop fine.
    if (types.includes('application/branch-pills')) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    if (types.includes('application/pill-label') || types.includes('application/pocket-text') || types.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      editorRef.current?.classList.add('drag-target');
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    editorRef.current?.classList.remove('drag-target');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const el = editorRef.current;
    if (!el) return;
    el.classList.remove('drag-target');

    if (e.dataTransfer.types.includes('application/branch-pills')) return;

    // Resolve the payload. Priority: a tag pill (wrap in brackets), then a
    // pocket snippet (raw text), then any text/plain (e.g. text dragged
    // from another pad's selection).
    const label = e.dataTransfer.getData('application/pill-label');
    const pocketText = e.dataTransfer.getData('application/pocket-text');
    const plain = e.dataTransfer.getData('text/plain');
    const insert = label
      ? `${bOpen}${label}${bClose}`
      : pocketText || plain;
    if (!insert) return;

    // Focus the editor BEFORE setting the caret. Calling focus() afterwards
    // (as the old code did) re-anchored the selection to wherever the
    // browser's last focus position was — usually the end of the pad —
    // so the dropped pill landed there instead of at the drop point.
    el.focus();

    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    let dropRange: Range | null = null;
    if (doc.caretRangeFromPoint) {
      dropRange = doc.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(e.clientX, e.clientY);
      if (p) {
        dropRange = document.createRange();
        dropRange.setStart(p.offsetNode, p.offset);
        dropRange.collapse(true);
      }
    }
    if (dropRange && el.contains(dropRange.startContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(dropRange);
    }

    document.execCommand('insertText', false, insert);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    processContent({ force: true });
  }, [bOpen, bClose, processContent]);

  /* ─── Ghost-mode toggle ────────────────────────────────
   * Render the camouflaged lyric into a STANDALONE off-screen <div> sized
   * to the editor's visible width but allowed to grow to the natural
   * height of the rendered HTML. Cloning the captureRoot used to clip
   * past the viewport because the inner flex layout still capped the
   * lyric pad at the visible height — the standalone div has no flex
   * parent, so the rendered HTML expands freely.
   */
  const toggleGhost = useCallback(async () => {
    const el = editorRef.current;
    if (!el) return;

    if (isGhostMode) {
      disableGhost();
      return;
    }

    // Live HTML overlay — `enableGhost(null)` just stores savedLyric and
    // flips isGhostMode. The render path in this component then wraps
    // an absolute <div id="ghost-pad"> with `buildGhostBottomHtml(savedLyric)`
    // behind the live editor. Same renderer, same CSS classes, same
    // padding → pixel-for-pixel alignment with the user's typed text.
    // No html2canvas, no capture wait, no rasterization drift.
    enableGhost(null);
  }, [isGhostMode, lyricText, enableGhost, disableGhost]);

  useImperativeHandle(externalRef, () => ({ toggleGhost }), [toggleGhost]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard?.writeText?.(lyricText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  }, [lyricText]);

  /* ─── Render ───────────────────────────────────────── */
  return (
    <div className="relative flex-1 flex flex-col min-h-0" ref={wrapperRef}>
      {/* Header — pad tabs on the left, IO buttons on the right.
       * In ghost mode the header drops its solid bg so the user's chosen
       * canvas color shows through, instead of clashing with the dark
       * studio-surface tone. */}
      <div className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1 border-b border-studio-border text-xs min-w-0 ${
        isGhostMode ? 'bg-transparent' : 'bg-studio-surface'
      }`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-blue-400">📝</span>
          <div className="min-w-0 flex-1">
            <PadTabs />
          </div>
          {isGhostMode && <span className="text-purple-400 whitespace-nowrap">— ghost tracing</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isGhostMode && (
            <button
              onClick={() => {
                exportGhostToLyric();
                setExportFlash(true);
                setTimeout(() => setExportFlash(false), 1200);
              }}
              className="px-2 py-0.5 rounded text-[11px] border bg-purple-600/20 text-purple-200 border-purple-500/40 hover:bg-purple-600/30"
              title="Promote your ghost-typed text to be the saved lyric — exiting ghost will keep this content"
            >
              {exportFlash ? '✓ Exported' : '↪ Export'}
            </button>
          )}
          <PadIO filename="lyrics" text={lyricText} onLoad={(t) => setLyricText(t)} accent="blue" />
          <button
            onClick={copyToClipboard}
            className="px-2 py-0.5 rounded text-studio-muted hover:text-studio-text border border-studio-border hover:border-studio-text/30 transition-colors"
            title="Copy lyrics to clipboard"
          >
            {copied ? '✓ Copied' : '⧉ Copy'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1 min-h-0">
        {/* Ghost-mode tracing overlay — pure HTML, NOT a rasterized PNG.
         * The previous html2canvas snapshot path drifted by sub-pixels
         * because canvas text rendering doesn't perfectly match the
         * browser's native subpixel anti-aliasing. By rendering the
         * camouflage as a real HTML block (same renderer as the live
         * editor, same CSS class, same padding), the trace and the
         * user's typed text line up byte-for-byte. */}
        {isGhostMode && savedLyric && (
          <div
            data-ghost-bg="true"
            id="ghost-pad"
            className="absolute top-0 left-0 w-full pointer-events-none z-0"
            style={{ opacity: ghostBgOpacity }}
            dangerouslySetInnerHTML={{ __html: buildGhostBottomHtml(savedLyric) }}
          />
        )}
        <div
          id="lyric-pad"
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={scheduleCaret}
          onMouseDown={handleMouseDown}
          onMouseMove={cancelHold}
          onMouseUp={(e) => { cancelHold(); scheduleCaret(); void e; }}
          onClick={scheduleCaret}
          onContextMenu={handleContextMenu}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-placeholder={isGhostMode ? '' : 'Start writing your lyrics…'}
          className="relative z-10"
          style={{
            lineHeight: 'var(--line-h)',
            background: 'transparent',
            caretColor: 'transparent',
          }}
        />
      </div>

      {/* Custom blinking caret — fixed-positioned overlay */}
      {caretRect && (
        <div
          className="lyric-caret"
          style={{
            top: caretRect.top,
            left: caretRect.left,
            height: caretRect.height,
            background: isGhostMode ? '#c084fc' : '#63b3ed',
            boxShadow: isGhostMode
              ? '0 0 8px rgba(192,132,252,0.7)'
              : '0 0 8px rgba(99,179,237,0.7)',
          }}
        />
      )}

      {/* Word pill web — press-and-hold a word to open */}
      {wordPill && (
        <WordPill
          word={wordPill.word}
          position={{ x: wordPill.x, y: wordPill.y }}
          onClose={() => setWordPill(null)}
          onInsert={(replacement) => {
            // Insert at the current caret as plain text, then close.
            const el = editorRef.current;
            if (el) {
              el.focus();
              document.execCommand('insertText', false, replacement);
              processContent({ force: true });
            }
            setWordPill(null);
          }}
        />
      )}

      {/* IntelliSense */}
      {intelliOpen && intelliPos && (
        <IntelliSense
          query={intelliQuery}
          position={intelliPos}
          onSelect={(word) => {
            const sel = window.getSelection();
            if (sel?.rangeCount) {
              const range = sel.getRangeAt(0);
              range.insertNode(document.createTextNode(word + ' '));
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
            setIntelliOpen(false);
            processContent({ force: true });
          }}
          onClose={() => setIntelliOpen(false)}
        />
      )}

    </div>
  );
});

export default LyricPad;
