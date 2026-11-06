import type { AttemptTracker } from '../../ports/AttemptTracker.js';
import type { QuestionRecord } from '../../domain/question-record.js';
import { questionContentRevision } from '../../domain/attempts/highlights.js';
import { questionRecordSemanticRevision } from '../../domain/attempts/question-semantic-revision.js';

/** Uses the existing history, backup, sync and deletion lifecycle; no second activity store. */
export function createQuestionObservation(input: { tracker(): AttemptTracker | null; accountId(): string | null; now(): number }) {
  let current: { scope: string; questionId: string; sessionId: string; attemptId: string; visible: boolean; answered: boolean } | undefined;
  const close = () => {
    if (!current) return;
    const tracker = input.tracker(), value = current; current = undefined;
    if (tracker) {
      void tracker.record(value.scope, value.attemptId, { type: 'close' });
      tracker.closeSession(value.scope, value.sessionId, value.answered ? 'completed' : 'interrupted', input.now());
    }
  };
  const ensure = (question: QuestionRecord) => {
    const scope = input.accountId() || 'guest';
    if (current?.scope !== scope || current?.questionId !== question.i) close();
    const tracker = input.tracker();
    if (!current && tracker) {
      const tracking = tracker.beginSession(scope, 'practice', input.now(), [{ questionId: question.i,
        contentRevision: questionContentRevision(question.q, question.a), semanticRevision: questionRecordSemanticRevision(question), position: 0, exposure: 1 }], undefined, undefined, 'attentive-reading');
      current = { scope, questionId: question.i, sessionId: tracking.session.id, attemptId: tracking.attempts[0].id, visible: false, answered: false };
    }
    return current;
  };
  return {
    visible(question: QuestionRecord, visible: boolean) {
      // Hiding/cleanup must not create a new session.
      const value = visible ? ensure(question) : current;
      if (!value || value.questionId !== question.i || value.visible === visible) return;
      value.visible = visible;
      void input.tracker()?.record(value.scope, value.attemptId, { type: visible ? 'resume' : 'pause' });
    },
    checkpoint() {
      const value = current;
      if (!value?.visible || value.scope !== (input.accountId() || 'guest')) return;
      const tracker = input.tracker();
      void tracker?.record(value.scope, value.attemptId, { type: 'pause' });
      void tracker?.record(value.scope, value.attemptId, { type: 'resume' });
    },
    answer(question: QuestionRecord, optionIndex: number, correct: boolean) {
      const value = ensure(question);
      if (value) value.answered = true;
      if (value) void input.tracker()?.record(value.scope, value.attemptId, { type: 'answer', optionIndex, outcome: correct ? 'correct' : 'wrong' });
    },
    close,
  };
}
