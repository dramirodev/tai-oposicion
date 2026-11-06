import { verifyEditorialQuestion } from '../../core/domain/question-content-proof.js';
import type { QuestionRecord } from '../../core/domain/question-record.js';

/** No Web Crypto (e.g. insecure context), digest errors or mismatches leave quarantine intact. */
export const verifyQuestionContent = (question: QuestionRecord): Promise<QuestionRecord> =>
  verifyEditorialQuestion(question, async canonical => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  });
