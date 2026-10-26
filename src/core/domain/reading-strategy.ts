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
