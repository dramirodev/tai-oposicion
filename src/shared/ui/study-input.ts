/** Maps touch movement and key presses to actions understood by study screens. */
export function swipeDirection(deltaX: number, deltaY: number, minimum = 70): 'next' | 'prev' | null {
  const horizontal = Math.abs(deltaX), vertical = Math.abs(deltaY);
  if (horizontal < minimum || horizontal < vertical * 1.6 || vertical > 90) return null;
  return deltaX < 0 ? 'next' : 'prev';
}

export type StudyKeyAction = { type: 'option'; index: number } | { type: 'next' | 'previous' | 'blank' | 'flag' | 'pause' };

export function studyKeyAction(event: { key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, optionCount = 4): StudyKeyAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = String(event.key || '').toLowerCase();
  if (/^[1-9]$/.test(key) && +key <= optionCount) return { type: 'option', index: +key - 1 };
  if (/^[a-i]$/.test(key) && key.charCodeAt(0) - 97 < optionCount && !'bfp'.includes(key)) {
    return { type: 'option', index: key.charCodeAt(0) - 97 };
  }
  if (key === 'enter' || key === 'arrowright' || key === ' ') return { type: 'next' };
  if (key === 'arrowleft') return { type: 'previous' };
  if (key === 'b') return { type: 'blank' };
  if (key === 'f') return { type: 'flag' };
  if (key === 'p') return { type: 'pause' };
  return null;
}
