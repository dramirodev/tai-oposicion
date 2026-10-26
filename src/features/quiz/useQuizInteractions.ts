import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { resolveHighlight } from '../../core/domain/attempts/highlights.js';
import { canonicalText, paintTextHighlight, selectedTextAnchor } from '../../shared/ui/text-highlights.js';
import { studyKeyAction, swipeDirection } from '../../shared/ui/study-input.js';
import { useStudyServices, type QuizPrompt, type QuizSnapshot } from '../../shared/ui/study-services.js';

type HighlightMark = { questionId: string; id: string | null };

export function useQuizInteractions({ root, snapshot, prompt, moveNext, movePrevious, markBlank }: {
  root: RefObject<HTMLDivElement | null>;
  snapshot: QuizSnapshot | null;
  prompt: QuizPrompt | undefined;
  moveNext: () => void;
  movePrevious: () => void;
  markBlank: () => void;
}) {
  const { quiz } = useStudyServices();
  const [selection, setSelection] = useState(false);
  const [highlightMark, setHighlightMark] = useState<HighlightMark>({ questionId: '', id: null });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const markBlankFromKeyboard = useEffectEvent(markBlank);
  const addMark = (category: 'key' | 'doubt') => {
    const anchor = root.current && selectedTextAnchor(root.current);
    if (anchor && quiz.addHighlight(anchor, category)) {
      window.getSelection()?.removeAllRanges();
      setSelection(false);
    }
  };

  useEffect(() => {
    const container = root.current;
    if (!container || !snapshot?.highlights || !prompt?.contentRevision) return;
    let stale = false;
    snapshot.highlights.forEach(mark => {
      const host = mark.field === 'statement' ? container.querySelector('.enun') : container.querySelector(`.opt[data-i="${Number(mark.field.slice(7))}"] .pre`);
      if (!host) return;
      const resolved = resolveHighlight(mark, canonicalText(host), prompt.contentRevision);
      if (resolved.stale) { stale = true; return; }
      paintTextHighlight(host, resolved.start, resolved.end, mark.category, mark.id);
    });
    const note = container.querySelector<HTMLElement>('#stale-highlight');
    if (note) note.hidden = !stale;
  }, [prompt?.contentRevision, prompt?.id, snapshot?.highlights, root]);

  useEffect(() => {
    if (!snapshot || !prompt) return;
    const host = root.current;
    if (!host) return;
    const syncSelection = () => {
      const anchor = selectedTextAnchor(host);
      setSelection(!!anchor);
      const mark = anchor && snapshot.highlights.find(item => item.field === anchor.field && item.start < anchor.end && item.end > anchor.start);
      setHighlightMark({ questionId: prompt.id, id: mark?.id || null });
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target as HTMLElement : null;
      if (!target) return;
      const textRoot = target.closest('.enun, .opt .pre') || target.closest('.opt')?.querySelector('.pre');
      if (textRoot && !target.closest('.opt') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); return; }
      if (textRoot && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        moveTextSelection(event, textRoot);
        syncSelection();
        return;
      }
      if (['Enter', ' '].includes(event.key) && target.closest('button,a,[role="button"]')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const action = studyKeyAction(event, prompt.options.length);
      if (!action) return;
      event.preventDefault();
      if (action.type === 'option') quiz.answer(action.index);
      else if (action.type === 'next') moveNext();
      else if (action.type === 'previous') movePrevious();
      else if (action.type === 'blank') { if (snapshot.feedback) markBlankFromKeyboard(); else quiz.toggleBlank(); }
      else if (action.type === 'flag') quiz.toggleFlag();
      else if (action.type === 'pause') quiz.setPaused(!snapshot.paused);
    };
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0], target = event.target as HTMLElement;
      touchStart.current = event.touches.length === 1 && touch.clientX > 24 && touch.clientX < innerWidth - 24 && !target.closest('details,input,textarea,button,.opt') ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = event.changedTouches[0], direction = swipeDirection(touch.clientX - touchStart.current.x, touch.clientY - touchStart.current.y);
      touchStart.current = null;
      if (direction === 'next') moveNext();
      else if (direction === 'prev') movePrevious();
    };
    document.addEventListener('selectionchange', syncSelection);
    document.addEventListener('keyup', syncSelection);
    host.addEventListener('mouseup', syncSelection);
    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('selectionchange', syncSelection);
      document.removeEventListener('keyup', syncSelection);
      host.removeEventListener('mouseup', syncSelection);
      host.removeEventListener('touchstart', onTouchStart);
      host.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('keydown', onKey);
    };
  }, [markBlank, moveNext, movePrevious, prompt, quiz, root, snapshot]);

  return { selection, highlightMark, setHighlightMark, addMark };
}

function moveTextSelection(event: KeyboardEvent, textRoot: Element) {
  const currentSelection = window.getSelection();
  if (currentSelection && (!currentSelection.anchorNode || !textRoot.contains(currentSelection.anchorNode))) {
    const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) {
      const range = document.createRange();
      range.setStart(first, 0);
      range.collapse(true);
      currentSelection.removeAllRanges();
      currentSelection.addRange(range);
    }
  }
  const modify = (currentSelection as (Selection & { modify?: (action: string, direction: string, granularity: string) => void }) | null)?.modify;
  if (currentSelection && modify) {
    event.preventDefault();
    const backwards = ['ArrowLeft', 'ArrowUp'].includes(event.key);
    const vertical = ['ArrowUp', 'ArrowDown'].includes(event.key);
    modify.call(currentSelection, event.shiftKey ? 'extend' : 'move', backwards ? 'backward' : 'forward', vertical ? 'line' : 'character');
  }
}
