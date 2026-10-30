import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { quizService } = vi.hoisted(() => ({ quizService: { addHighlight: vi.fn() } }));
vi.mock('../../src/shared/ui/study-services.js', () => ({ useStudyService: () => quizService }));

import { useQuizInteractions } from '../../src/features/quiz/useQuizInteractions.ts';

describe('quiz text selection', () => {
  let root;

  beforeEach(() => {
    document.body.innerHTML = '<div class="enun">Primer enunciado</div>';
    root = { current: document.body };
  });

  afterEach(() => {
    cleanup();
    window.getSelection()?.removeAllRanges();
    vi.clearAllMocks();
  });

  it('clears the browser selection when the next question replaces the prompt', () => {
    const snapshot = { highlights: [], feedback: true, paused: false, options: [] };
    const firstPrompt = { id: 'question-1', options: [], contentRevision: 'revision-1' };
    const nextPrompt = { id: 'question-2', options: [], contentRevision: 'revision-2' };
    const { rerender, result } = renderHook(({ prompt }) => useQuizInteractions({
      root, snapshot, prompt, moveNext: vi.fn(), movePrevious: vi.fn(), markBlank: vi.fn(),
    }), { initialProps: { prompt: firstPrompt } });

    const text = document.querySelector('.enun').firstChild;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 6);
    window.getSelection()?.addRange(range);
    expect(window.getSelection()?.toString()).toBe('Primer');
    act(() => document.dispatchEvent(new Event('selectionchange')));
    expect(result.current.selection).toBe(true);

    rerender({ prompt: nextPrompt });

    expect(window.getSelection()?.isCollapsed).toBe(true);
    expect(result.current.selection).toBe(false);
  });
});
