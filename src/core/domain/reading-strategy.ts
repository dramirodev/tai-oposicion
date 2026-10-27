/** Whether a question asks for the false, incorrect, or exceptional option. */
export function asksForNegativeOption(text: string): boolean {
  return /\b(INCORRECT[OA]S?|FALS[OA]S?|EXCEPTO|SALVO|NO)\b/i.test(text)
    || /\bno (es|son|se|forma|corresponde|pertenece|permite)\b/i.test(text);
}

/** A conservative reading time estimate for a question and its answers, in seconds. */
export function minimumReadingSeconds(question: { context?: string; statement: string; options?: readonly string[] }): number {
  const text = [question.context, question.statement, ...(question.options || [])].filter(Boolean).join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.min(30, Math.round(words / 3.3)));
}

export interface ReadingWordEvaluation {
  hit: number;
  missed: number;
  extra: number;
  total: number;
  claimedNone: boolean;
}

/** Scores selected key words without changing the user's selection. */
export function evaluateReadingWords(
  tokens: readonly { key: boolean }[],
  selectedIndices: readonly number[],
  claimedNone = false,
): ReadingWordEvaluation {
  const keyIndices = new Set(tokens.flatMap((token, index) => token.key ? [index] : []));
  const selected = new Set(selectedIndices);
  return {
    hit: claimedNone ? 0 : [...selected].filter(index => keyIndices.has(index)).length,
    missed: claimedNone ? keyIndices.size : [...keyIndices].filter(index => !selected.has(index)).length,
    extra: claimedNone ? 0 : [...selected].filter(index => !keyIndices.has(index)).length,
    total: keyIndices.size,
    claimedNone,
  };
}
