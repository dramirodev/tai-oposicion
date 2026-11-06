import { approvedQuestionHashes } from './approved-question-hashes.js';
import type { QuestionRecord } from './question-record.js';

const proof = Symbol('approved editorial content');
type ProvenQuestion = QuestionRecord & { [proof]?: string };
const verifiedIds = new Set<string>();

/** All JSON fields are bound, including context, explanation, citation and explicit np.
 * Undefined fields match JSON transport; symbols never enter JSON or a DTO. */
export function canonicalQuestionContent(question: QuestionRecord): string {
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
      .filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .map(key => [key, sorted((value as Record<string, unknown>)[key])]));
    return value;
  };
  return JSON.stringify(sorted(question));
}
export function hasApprovedQuestionContent(question: QuestionRecord): boolean {
  if (question.np === 1) return false;
  const signature = (question as ProvenQuestion)[proof];
  if (!signature) return false;
  try { return signature === canonicalQuestionContent(question); } catch { return false; }
}
/** Hints for ID-only selection, never authority to grade a question. */
export const hasVerifiedEditorialId = (id: string): boolean => verifiedIds.has(id);

/** The adapter supplies a SHA-256 port; only the bundled allowlist may issue a proof.
 * Capture before awaiting and compare afterwards to reject an in-flight mutation. */
export async function verifyEditorialQuestion(
  question: QuestionRecord,
  sha256: (canonical: string) => Promise<string>,
): Promise<QuestionRecord> {
  const expected = approvedQuestionHashes[question.i];
  if (!expected) return question;
  verifiedIds.delete(question.i);
  question = { ...question };
  delete (question as ProvenQuestion)[proof];
  try {
    if (question.np === 1) return question;
    const canonical = canonicalQuestionContent(question);
    if (await sha256(canonical) !== expected || canonical !== canonicalQuestionContent(question)) return question;
    verifiedIds.add(question.i);
    return { ...question, [proof]: canonical } as ProvenQuestion;
  } catch { return question; }
}
