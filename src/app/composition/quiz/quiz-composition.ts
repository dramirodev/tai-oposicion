import { getCurrentRun, subscribe as subscribeEngine, startCurrentQuestion, tickCurrentRun, currentSecondsRemaining, setQuestionIndex, answerCurrentQuestion, answerDeferred, toggleReviewQuestion, setCurrentConfidence, setCurrentSelfAssessment, toggleCurrentDiscardedOption, revealCurrentSolution, toggleDeferredBlank, setRunPaused, finishCurrentRun, clearActiveRun, addCurrentHighlight, removeCurrentHighlight, studyQuestionCatalog } from '../study/study-engine-composition.js';
import { clearRun, saveRun } from '../study/pending-run-composition.js';
import { createHighlight, questionContentRevision } from '../../../core/domain/attempts/highlights.js';
import { minimumReadingSeconds } from '../../../core/domain/reading-strategy.js';
import { normalizeUiPreferences } from '../../../shared/presentation/ui-preferences.js';
import { questionNotice, sourceHtml } from '../../../shared/presentation/study-content.js';
import { VERIFIED_SOURCES } from '../../../adapters/http/verified-sources.js';
import { ask, toast } from '../../../shared/ui/dialog-actions.js';
import { findCodeExplanation } from '../explanations/explanation-composition.js';
import type { QuizServices } from '../../../shared/ui/study-services.js';
import type { ExplanationLookup } from '../../../core/domain/explanations.js';
import type { QuizProgressGateway } from '../../../core/ports/QuizProgressGateway.js';

export function createQuizServices(go: (path: string) => void, homePath: string, resultPath: string | (() => string), progress: QuizProgressGateway): QuizServices {
  let closing = false;
  let endConfirmation: AbortController | null = null;
  return {
    getSnapshot() {
      const run = getCurrentRun(); if (!run) return null;
      if (run.idx >= run.items.length) return null;
      const question = run.items[run.idx], record = progress.getQuestionStats(question.i), state = run.studyStates?.[run.idx] || 'unseen';
      const revision = questionContentRevision(question.q, question.a);
      const failureReason = record?.errorReason ?? null;
      const report = progress.getErrorReport(question.i), confidence = run.confidences?.[run.idx] || undefined;
      const readingWaitSeconds = minimumReadingSeconds({ context: question.cp, statement: question.q, options: question.a });
      return { fixedDeadline: !!run.officialExam, title: run.officialExam ? `${run.titulo} · ${run.idx < 80 ? 'Conocimientos' : 'Supuesto práctico'}` : run.titulo || 'Práctica', index: run.idx, count: run.items.length, questionIds: run.items.map(item => item.i), seconds: run.secs, timeLimitSeconds: run.limit ? run.limit * 60 : null, remainingSeconds: run.limit ? currentSecondsRemaining() : null, readingWaitSeconds, readingGateUntil: run.qT0 ? run.qT0 + readingWaitSeconds * 1000 : 0, feedback: run.feedback, timed: !!run.porTiempo, paused: run.paused,
        readingMode: normalizeUiPreferences(progress.getUiPreferences()).lectura, prompt: { nonScoring: question.np === 1, id: question.i, topicId: question.t, topicName: studyQuestionCatalog.getTopicName(question.t), origin: question.o, ...(question.y ? { year: question.y } : {}), statement: question.q, options: question.a, correctIndex: question.c, ...(question.cp ? { context: question.cp } : {}), ...(question.supTexto ? { assumptionText: question.supTexto } : {}), hasAssumption: !!question.s,
          notice: run.officialExam ? '' : questionNotice(question), ...(question.u ? { citation: question.u } : {}), source: sourceHtml(question, VERIFIED_SOURCES), traps: (question.x || []).map(id => String(id)), provisional: !run.officialExam && !!question.p, mayExpire: !!question.w, variant: question.o === 'G' && !!question.v, contentRevision: revision },
        ...(run.ans[run.idx] !== undefined ? { answer: run.ans[run.idx] } : {}), studyState: state, review: run.review || [], answers: run.ans, studyStates: run.studyStates || [], ...(confidence ? { confidence } : {}), ...(run.selfAssessments?.[run.idx] ? { selfAssessment: run.selfAssessments[run.idx] } : {}), discarded: run.discardedOptions?.[run.idx] || [], highlights: run.highlights?.[run.idx] || [], scoreByLuck: run.luck?.[run.idx] ?? null,
        recentAnswer: run.fast?.[run.idx] || null, flagged: !!record?.doubtful, failureReason, ...(report ? { report: { reason: report.reason, note: report.note, state: report.state } } : {}), cardExists: progress.hasFailureCard(question.i) };
    },
    subscribe(listener) { const offEngine = subscribeEngine(listener), offStore = progress.subscribe(listener); return () => { offEngine(); offStore(); }; },
    startCurrentQuestion,
    persist: saveRun,
    tick() { tickCurrentRun(); },
    setIndex(index) { setQuestionIndex(index); },
    answer(index) { const run = getCurrentRun(), question = run?.items[run.idx]; if (!run || !question) return; if (!run.feedback) { answerDeferred(run, index); return; } const state = run.studyStates?.[run.idx] || 'unseen'; if (state === 'answered' || state === 'revealed') return; answerCurrentQuestion(index, minimumReadingSeconds({ context: question.cp, statement: question.q, options: question.a })); },
    toggleReview() { toggleReviewQuestion(); }, setConfidence(value) { setCurrentConfidence(value); }, async setSelfAssessment(value, retryHistory = false) {
      const before = getCurrentRun();
      const alreadyRecorded = before?.selfAssessments?.[before.idx] === value;
      const historySaved = alreadyRecorded && !retryHistory ? true : await setCurrentSelfAssessment(value, retryHistory);
      const checkpointSaved = saveRun();
      return { historySaved, checkpointSaved };
    }, toggleDiscard(index) { toggleCurrentDiscardedOption(index); }, reveal: revealCurrentSolution,
    markBlank() { const run = getCurrentRun(); if (!run || run.ans[run.idx] !== undefined) return; this.answer(-1); if (run.idx < run.items.length - 1) this.setIndex(run.idx + 1); },
    toggleBlank() { toggleDeferredBlank(); }, setPaused(paused) { setRunPaused(paused); },
    async finish(reason = 'complete') {
      const run = getCurrentRun(); if (!run || closing && reason !== 'timeout') return 'cancelled';
      if (reason === 'timeout') endConfirmation?.abort();
      const missing = run.items.filter((_, index) => run.ans[index] === undefined).length;
      if (reason === 'complete' && !run.feedback && missing) {
        closing = true; endConfirmation = new AbortController();
        const accepted = await ask(`Quedan ${missing} preguntas sin responder. ¿Terminar y guardar la sesión como interrumpida?`, 'Terminar', false, endConfirmation.signal);
        endConfirmation = null; closing = false;
        if (!accepted || getCurrentRun()?.sessionKey !== run.sessionKey) return 'cancelled';
        reason = 'interrupted';
      }
      if (!finishCurrentRun(reason)) { toast('Se acabó el tiempo sin contestar ninguna pregunta.'); go(homePath); return 'empty'; }
      go(typeof resultPath === 'function' ? resultPath() : resultPath); return 'finished';
    },
    async exit() {
      const run = getCurrentRun(); if (!run || closing) return;
      closing = true; endConfirmation = new AbortController();
      const accepted = await ask('¿Salir? Lo respondido se guardará como sesión interrumpida.', 'Salir', false, endConfirmation.signal);
      endConfirmation = null; closing = false;
      if (!accepted || getCurrentRun()?.sessionKey !== run.sessionKey) return;
      if (run.ans.some(value => value !== undefined)) { await this.finish('interrupted'); }
      else { clearRun(); clearActiveRun(); go(homePath); }
    },
    cancelConfirmation() { endConfirmation?.abort(); endConfirmation = null; closing = false; },
    toggleFlag() { const run = getCurrentRun(), question = run?.items[run.idx]; if (question) progress.toggleFlag(question.i, question.t); },
    setFailureReason(reason) { const run = getCurrentRun(), question = run?.items[run.idx]; if (question) progress.setFailureReason(question.i, question.t, reason); },
    markDoubt() { const run = getCurrentRun(), question = run?.items[run.idx]; if (question) progress.markDoubt(question.i, question.t); }, markLuck() { const run = getCurrentRun(), question = run?.items[run.idx]; if (question) progress.markLucky(question.i, question.t); },
    toggleCard() { const run = getCurrentRun(), question = run?.items[run.idx]; if (question) progress.toggleFailureCard(question.i); },
    addHighlight(anchor, category) {
      const run = getCurrentRun(), question = run?.items[run.idx]; if (!run || !question) return false;
      const existing = (run.highlights?.[run.idx] || []).find(mark => mark.field === anchor.field && mark.start < anchor.end && mark.end > anchor.start);
      if (existing) return false;
      const state = run.studyStates?.[run.idx]; const answer = run.ans[run.idx];
      const timing = state === 'revealed' ? 'after-reveal' : typeof answer === 'number' && answer >= 0 ? 'after-answer' : 'before-answer';
      const created = createHighlight({ id: globalThis.crypto?.randomUUID?.() || `mark-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...anchor, category, contentRevision: questionContentRevision(question.q, question.a), createdAt: Date.now(), timing });
      return created.ok && addCurrentHighlight(created.value);
    },
    removeHighlight(id) { removeCurrentHighlight(id); },
    saveReport(reason, note) { const run = getCurrentRun(), question = run?.items[run.idx]; if (question) progress.saveErrorReport(question.i, question.t, reason, note.trim()); },
    async loadExplanation(): Promise<ExplanationLookup> { const run = getCurrentRun(), question = run?.items[run.idx]; if (!question) return { status: 'missing' }; return findCodeExplanation(question.i, question.q, question.a); },
  };
}
