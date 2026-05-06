/**
 * Caret offset semantics
 * ----------------------
 * The "logical text" of the editor counts each text-node character as 1 and
 * each <br> / closing </div> boundary as a single \n — exactly the same
 * accounting used by `getEditorText` in LyricPad. getCaretOffset and
 * setCaretOffset both honour this scheme so a save→rebuild→restore round
 * trip lands the caret in the same logical position.
 *
 * Before this was made consistent, hitting Enter in ghost mode would land
 * the caret at offset 0 (= start of pad) because the browser had moved the
 * caret to a non-text endContainer that the old walker silently skipped.
 */

function isContentEditableFalse(node: Node): boolean {
  return node instanceof Element && node.getAttribute('contenteditable') === 'false';
}

/** Char offset of the caret from the start of `el` (text + <br>/<div> as 1). */
export function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  const endContainer = range.endContainer;
  const endOffset = range.endOffset;

  let count = 0;
  let done = false;

  function visit(node: Node): void {
    if (done) return;

    if (node === endContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        count += endOffset;
      } else {
        const kids = node.childNodes;
        for (let i = 0; i < endOffset && i < kids.length; i++) {
          visit(kids[i]);
          if (done) return;
        }
      }
      done = true;
      return;
    }

    if (isContentEditableFalse(node)) return;

    if (node.nodeType === Node.TEXT_NODE) {
      count += node.textContent?.length ?? 0;
      return;
    }

    if (node instanceof HTMLElement && node.tagName === 'BR') {
      count += 1;
      return;
    }

    for (const child of node.childNodes) {
      visit(child);
      if (done) return;
    }

    // Closing </div> contributes a newline (mirrors getEditorText)
    if (node instanceof HTMLElement && node.tagName === 'DIV' && node !== el) {
      count += 1;
    }
  }

  visit(el);
  return count;
}

/** Restore the caret to `targetOffset` logical chars from start of `el`. */
export function setCaretOffset(el: HTMLElement, targetOffset: number): void {
  const sel = window.getSelection();
  if (!sel) return;

  let remaining = targetOffset;
  let placed = false;

  function placeBefore(node: Node) {
    const range = document.createRange();
    range.setStartBefore(node);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    placed = true;
  }
  function placeIn(node: Node, off: number) {
    const range = document.createRange();
    range.setStart(node, off);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    placed = true;
  }
  function placeAfter(node: Node) {
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    placed = true;
  }

  function visit(node: Node): void {
    if (placed) return;
    if (isContentEditableFalse(node)) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        placeIn(node, remaining);
        return;
      }
      remaining -= len;
      return;
    }

    if (node instanceof HTMLElement && node.tagName === 'BR') {
      if (remaining === 0) {
        // Caret sits just before this <br> — end of the prior visual line.
        placeBefore(node);
        return;
      }
      remaining -= 1;
      return;
    }

    for (const child of node.childNodes) {
      visit(child);
      if (placed) return;
    }

    if (node instanceof HTMLElement && node.tagName === 'DIV' && node !== el) {
      if (remaining === 0) {
        placeAfter(node);
        return;
      }
      remaining -= 1;
    }
  }

  visit(el);

  if (!placed) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/** Walk up DOM looking for the nearest ancestor that actually scrolls vertically */
export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement || null;
  while (p) {
    const s = window.getComputedStyle(p);
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
      return p;
    }
    p = p.parentElement;
  }
  return null;
}

/** Return the absolute screen position just below the caret */
export function getCaretScreenPos(): { top: number; left: number } | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  if (!rects.length) return null;
  const r = rects[0];
  return { top: r.bottom + 4, left: r.left };
}
