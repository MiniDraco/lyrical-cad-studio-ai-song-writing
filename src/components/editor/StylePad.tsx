'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useStudio, BRACKET_PAIRS } from '@/store/useStudio';
import { getCaretOffset, setCaretOffset, getScrollParent } from '@/lib/caret';
import { buildStyleHtml } from '@/lib/tagParser';

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

const STRUCTURAL_RE = /[\s\[\]\{\}\(\)<>,.;:?!"]/;
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

/**
 * StylePad — contenteditable pad for AI-music-bot style prompts.
 * Behaves like LyricPad: pills resolve to [tag] text on drop/inject.
 * No syllable analysis, just tag styling.
 */
export default function StylePad() {
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRebuildRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRef = useRef(false);
  const hydratedRef = useRef(false);
  const lastBuiltTextRef = useRef('');

  const { styleText, setStyleText, bracketType } = useStudio();
  const [bOpen, bClose] = BRACKET_PAIRS[bracketType];
  const lastInternalTextRef = useRef('');

  const processContent = useCallback(
    (opts: { force?: boolean } = {}) => {
      const el = editorRef.current;
      if (!el || suppressRef.current) return;

      const rawText = getEditorText(el);
      // Always update store (cheap)
      lastInternalTextRef.current = rawText;
      setStyleText(rawText);

      // Light-change fast path — skip rebuild + caret restore for letter-only
      // edits. Tag-bracket boundaries / whitespace / punct trigger heavy.
      if (!opts.force && isLightChange(lastBuiltTextRef.current, rawText)) {
        return;
      }
      lastBuiltTextRef.current = rawText;

      suppressRef.current = true;
      const scrollParent = getScrollParent(el);
      const savedScrollTop = scrollParent?.scrollTop ?? 0;
      const caretPos = getCaretOffset(el);

      el.innerHTML = buildStyleHtml(rawText);
      setCaretOffset(el, caretPos);

      if (scrollParent && scrollParent.scrollTop !== savedScrollTop) {
        scrollParent.scrollTop = savedScrollTop;
      }
      requestAnimationFrame(() => {
        if (scrollParent && Math.abs(scrollParent.scrollTop - savedScrollTop) > 1) {
          scrollParent.scrollTop = savedScrollTop;
        }
      });
      suppressRef.current = false;
    },
    [setStyleText]
  );

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (editorRef.current && styleText) {
      editorRef.current.innerHTML = buildStyleHtml(styleText);
      lastBuiltTextRef.current = styleText;
      lastInternalTextRef.current = styleText;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* External styleText changes — e.g. PadIO file load. Refresh the DOM
   * when the store value diverges from what we last typed. */
  useEffect(() => {
    if (!hydratedRef.current) return;
    const el = editorRef.current;
    if (!el || suppressRef.current) return;
    if (styleText === lastInternalTextRef.current) return;
    el.innerHTML = styleText ? buildStyleHtml(styleText) : '';
    lastBuiltTextRef.current = styleText;
    lastInternalTextRef.current = styleText;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (idleRebuildRef.current) clearTimeout(idleRebuildRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleText]);

  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => processContent(), 220);
    if (idleRebuildRef.current) clearTimeout(idleRebuildRef.current);
    idleRebuildRef.current = setTimeout(() => processContent({ force: true }), 900);
  }, [processContent]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (
      types.includes('application/pill-label') ||
      types.includes('application/branch-pills') ||
      types.includes('application/pocket-text') ||
      types.includes('text/plain')
    ) {
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

    // Resolve payload: branch (expand to bracketed list) > pill (single
    // bracketed tag) > pocket snippet (raw text) > text/plain fallback.
    let insert: string | null = null;
    const branchData = e.dataTransfer.getData('application/branch-pills');
    if (branchData) {
      try {
        const pills = JSON.parse(branchData) as string[];
        insert = pills.map((p) => `${bOpen}${p}${bClose}`).join(' ');
      } catch { /* malformed — ignore */ }
    }
    if (!insert) {
      const label = e.dataTransfer.getData('application/pill-label');
      if (label) insert = `${bOpen}${label}${bClose}`;
    }
    if (!insert) {
      insert = e.dataTransfer.getData('application/pocket-text') ||
               e.dataTransfer.getData('text/plain') || null;
    }
    if (!insert) return;

    // Focus BEFORE setting the caret — otherwise the focus event re-anchors
    // the selection to the pad's last cursor position and the drop lands
    // there instead of at the drop point.
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

  return (
    <div className="relative h-full">
      <div
        id="style-pad"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        spellCheck={false}
        data-placeholder="Style notes for AI music bots — [Genre] [Mood] [Instruments] tags drop in as text…"
        style={{ caretColor: '#5eead4', fontSize: '0.95rem' }}
      />

    </div>
  );
}
