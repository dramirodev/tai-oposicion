import { saveExportFile } from '../shared/ui/download-file.js';
import type { SettingsServices, SettingsSnapshot, StudyServices } from '../shared/ui/study-services.js';
import { questionNotice, sourceHtml } from '../shared/presentation/legacy-study.js';
import { VERIFIED_SOURCES } from '../adapters/http/verified-sources.js';
import * as sync from '../adapters/firebase/sync-facade.js';
import * as store from '../adapters/local/legacy-store.js';
import { localProgressRepository } from '../adapters/local/progress-repository.js';
import { localGuestQuestionHistoryRepository } from '../adapters/local/guest-question-history.js';
import { localReadingQuestionHistoryRepository } from '../adapters/local/reading-question-history.js';
import { percentage as pct } from '../shared/presentation/format.js';
import { richHtml, hiliteHtml } from '../shared/presentation/study-text.js';
import { FAILURE_REASONS as MOTIVOS_FALLO } from '../shared/presentation/study-labels.js';
import { normalizeUiPreferences } from '../shared/presentation/ui-preferences.js';
import { calculateExamScore as nota } from '../core/domain/scoring.js';
import { randomStudyOrder as shuffle } from '../shared/ui/study-random.js';
import { swipeDirection, studyKeyAction } from '../shared/ui/study-input.js';
import { calculateStudyStreak } from '../core/domain/study-analytics.js';
import { summarizeReadingSpeedFailures } from '../core/domain/question-performance.js';
import { previewBackupImport } from '../core/application/settings/backup-preview.js';
import { META, getIndex, getMeta, getMetaIndex, temaOf, idsOfTema, getTema, getSup, temaName, now, byIds, fetchJson } from '../adapters/http/legacy-data.js';
import { $, L, toast, ask } from '../shared/ui/legacy-dom.js';
import { showMenu } from '../shared/ui/dialog-actions.js';
import { BLOQUES, ORIGEN, TRAMPAS } from '../shared/presentation/labels.js';
import { APP_VERSION, APP_BUILD } from './build-info.js';
import { isFull, isOwner, accessLevel, GUEST_ROUTES } from '../adapters/legacy/access.js';
import { subscribe as subscribeEngine, configureSessionStateStore, getCurrentRun, getLastResult, clearActiveRun, createRun, resumeRun, tickCurrentRun, currentSecondsRemaining, answerCurrentQuestion, answerCurrentDeferred, revealCurrentSolution, finishCurrentRun, setQuestionIndex, toggleReviewQuestion, setRunPaused, toggleDeferredBlank, startCurrentQuestion, setAttemptTrackingVisible, flushAttemptTracking, quickItems, repasoItems, trapTest, falladasIds, dueQuestionIds, selectQuestionsForTopics, selectWeightedSimulationQuestions, setCurrentConfidence, toggleCurrentDiscardedOption, addCurrentHighlight, removeCurrentHighlight } from './composition/study/study-engine-composition.js';
import { sessionStatePort } from './session-state-store.js';
import { clearRun, pendingRun, saveRun } from './composition/study/pending-run-composition.js';
import { createTopicMasteryComposition } from './composition/topics/topic-mastery-composition.js';
import { createTopicProgressComposition } from './composition/topics/topic-progress-composition.js';
import { formatPendingRunPrompt } from '../shared/presentation/pending-run.ts';
import { createAccountRecovery } from '../core/application/recover-account.js';
import type { Origin, QuestionStats, StudyReviewMode, TrainingActivity, TrainingPreferences } from '../core/domain/entities.js';
import { buildDailyTrainingPlan, normalizeTrainingPreferences } from '../core/domain/study-training-plan.js';
import { createHighlight, questionContentRevision, resolveHighlight } from '../core/domain/attempts/highlights.js';
import { canonicalText, paintTextHighlight, selectedTextAnchor } from '../shared/ui/text-highlights.js';
import { findLegacyCodeExplanation } from './composition/explanations/explanation-composition.js';
import { explanationMapper } from '../features/explanations/explanation-mapper.js';
import { renderCodeExplanation } from '../features/explanations/legacy-view.js';
import { loadQuestionEvolution, loadStrategyReportForPeriod } from './composition/stats/strategy-composition.js';
import { createStatsServices } from './composition/stats/stats-composition.js';
import { createExamCatalog } from './composition/simulations/exam-catalog-composition.js';
import { createSimulationAnalysisView } from './composition/simulations/simulation-analysis-composition.js';
import { createStudyRunController } from './composition/study/study-run-controller.js';
import { createStudySessionLaunchController } from './composition/study/study-session-launch-controller.js';
import { createStudyMenuGroups } from './composition/navigation/study-menu-composition.js';
import { toSettingsSnapshot } from '../features/settings/settings-mapper.js';
import { configureBankSource } from './composition/bank-source-composition.js';
import { createFailuresComposition } from './composition/failures/failures-composition.js';
import { createLightningComposition } from './composition/trainers/lightning-composition.js';
import { createTrapsComposition } from './composition/trainers/traps-composition.js';
import { createQuizServices } from './composition/quiz/quiz-composition.js';
import { renderStrategyReport } from '../features/stats/strategy-view.js';
import { createManualAiExport, deleteManualStudyHistory, listManualExportSessions } from './composition/exports/ai-study-export-composition.js';
import { inspectOffline, downloadOffline, prefetchQuestionBank } from '../adapters/offline/cache.js';
import { devMode, setDevMode, devRevealed, revealDev } from '../adapters/legacy/access.js';
import { notifyAccessChange } from './access-events.js';
import { exportAttemptArchive } from '../core/application/attempts/export-attempt-archive.js';
import { importAttemptArchive } from '../core/application/attempts/import-attempt-archive.js';
import type { AttemptArchive } from '../core/domain/attempts/archive.js';
import { localAttemptRepository } from '../adapters/local/attempt-repository.js';
import { attemptArchiveMapper } from '../adapters/local/mappers/attempt-archive.js';
import { cleanCfg } from '../adapters/local/config.js';
import { hashPath } from './router/paths.js';
import { bootAppServices as startAppBootstrap } from './app-bootstrap.js';
import { createAppUpdateController } from './composition/updates/app-update-controller.js';
import { createCardsComposition } from './composition/cards/cards-composition.js';
import { createTrainingSessionComposition } from './composition/trainers/training-session-composition.js';
import { getHomeProgressSummary } from '../core/application/stats/get-home-progress-summary.js';
import type { QuestionRecord as Question } from '../core/domain/question-record.js';
import { createReadingComposition } from './composition/trainers/reading-composition.js';
import { readingTokens, mixReadingIds } from '../features/trainers/reading-controller.js';
import type { TestConfiguration, ScenarioChoice, SimulationConfiguration, SimulationTab, SimulationExam, SimulationExamGroups, ResultServices } from '../shared/ui/study-services.js';

// ───────── router ─────────
configureBankSource();
configureSessionStateStore(sessionStatePort);
let navigate: (h: string, refresh?: boolean) => void = h => { location.hash = h; };
export function configureAppNavigation(fn: (h: string, refresh?: boolean) => void): void { navigate = fn; }
function go(h: string) { navigate(h); }
const appUpdates = createAppUpdateController({
  currentBuild: APP_BUILD,
  saveRun,
  flushProgress: () => store.flushNow(),
  getRegistration: () => navigator.serviceWorker?.getRegistration(),
  reload: () => location.reload(),
  onUpdateReady: () => toast('Hay una versión nueva.', { label: 'Actualizar', fn: () => appUpdates.applyUpdate() }),
});
const recover = createAccountRecovery(store.accountId, () => store.recover());
const dominioTemas = createTopicMasteryComposition({ progressRepository: localProgressRepository, accountId: store.accountId, questionIdsForTopic: topicId => META._by[topicId], now });
const progressPorTema = createTopicProgressComposition({ progressRepository: localProgressRepository, accountId: store.accountId, questionIdsForTopic: topicId => META._by[topicId] });
const trainingSession = createTrainingSessionComposition({ accountId: store.accountId, now });
let routeReady: () => void;
const firstReactRouteReady = new Promise<void>(resolve => { routeReady = resolve; });
const studyRunController = createStudyRunController({
  createRun: configuration => createRun(configuration) !== null,
  getPendingRun: fullAccess => pendingRun(fullAccess),
  isFullAccess: isFull,
  currentAccount: store.accountId,
  ask,
  resume: pending => resumeRun(pending) !== null,
  clearPendingRun: clearRun,
  navigateToQuiz: () => go(hashPath('quiz')),
  showEmptyRunMessage: () => toast('No hay preguntas puntuables en esta selección. Puedes consultarlas en modo estudio.'),
  resumePrompt: pending => formatPendingRunPrompt({ title: pending.saved.titulo, index: pending.saved.idx, itemCount: pending.items.length, seconds: pending.saved.secs, limitMinutes: pending.saved.limit, timeLimited: pending.saved.pt }),
});
const { startRun, resumeSaved } = studyRunController;
const studySessionLaunch = createStudySessionLaunchController({
  currentAccount: store.accountId,
  fullAccess: isFull,
  quickSelection: full => quickItems(full, localGuestQuestionHistoryRepository),
  reviewSelection: repasoItems,
  startRun,
  showEmptyQuickSelection: full => toast(full ? 'No hay preguntas nuevas ni repasos con esos filtros.' : 'No hay preguntas disponibles ahora mismo.'),
  showEmptyReviewSelection: () => toast('No tienes repasos pendientes hoy.'),
});
const { startQuickSession: quickSession, startDueReview: startRepaso } = studySessionLaunch;
// saludo con el nombre de la cuenta de Google (se recuerda en el dispositivo; sin cuenta, solo «Hola»)
function saludo() {
  const u = sync.status.user; let n = '';
  try {
    if (u) { const raw = u.name && !u.name.includes('@') ? u.name.trim().split(/\s+/)[0] : ''; n = raw; localStorage.setItem('tai.name', n); }
    else if (sync.status.state === 'sin sesión') localStorage.removeItem('tai.name');
    else n = localStorage.getItem('tai.name') || '';
  } catch (e) {}
  return n ? `Hola, ${n}` : 'Hola';
}
// ───────── menú general ─────────
async function openMenu() {
  if ($('#menuov')) return;
  const account = store.accountId();
  await getMeta();
  const due = (await dueQuestionIds()).length, nCards = Object.values(store.getCards()).filter(r => r[3] >= 0 && r[4] <= now()).length;
  const statistics = await localProgressRepository.getStats().catch((): Readonly<Record<string, QuestionStats>> => ({}));
  if (account !== store.accountId()) return;
  const speed = summarizeReadingSpeedFailures(Object.entries(statistics).map(([id, record]) => ({ id, lastOutcome: record.lastResult ?? -1, lastReasonCode: record.errorReason })));
  const nErr = Object.values(store.getReports()).filter(r => r.st === 'abierto').length;
  const aqui = location.hash || hashPath('home');
  const groups = createStudyMenuGroups({
    fullAccess: isFull(), owner: isOwner(), pendingQuestions: due, pendingCards: nCards,
    readingSpeedFailures: speed.count, openReports: nErr, seenTopics: store.getSeen().length,
    failedQuestions: falladasIds().length, accessRequests: sync.status.reqs.length,
    updateAvailable: !!appUpdates.getAvailableUpdate(), actions: { quickSession, startReview: startRepaso },
  });
  await showMenu(groups, aqui, go);
}

// ───────── mis trampas ─────────
let SIMCFG: any = null;
let reviewScenarioQuestions = new Map<string, Question[]>();
let reviewScenarioTexts = new Map<string, string>();
let reviewScenarioAccount: string | null = null;
async function simParte1(idx: any, org: any, N: any, only: any) {
  const temas = idx.temas.filter((t: any) => !only || only.has(t.id));
  return selectWeightedSimulationQuestions(temas.map((topic: any) => ({ id: topic.id, weight: topic.w })), org, N);
}
// Parte 2 tras la parte 1: ofrece 2 supuestos
// Las pantallas comparten navegación y limpieza; cada módulo conserva su estado de sesión.
const cardsComposition = createCardsComposition({
  loadQuestionMetadata: getMeta,
  failedCardQuestionIds: () => Object.keys(store.getCards()).filter(id => id.startsWith('FC-Q-')).map(id => id.slice(5)),
  loadQuestionsById: ids => byIds(ids),
  loadJson: fetchJson,
  verifiedSources: VERIFIED_SOURCES,
  readPreferences: () => store.getCfg().cardsc,
  savePreferences: preferences => store.setCfg('cardsc', preferences),
  accountId: store.accountId, getCards: store.getCards, getSeen: store.getSeen, getRecord: store.cardRec,
  now, day: store.DAY, topicName: temaName, grade: store.gradeCard, remove: store.removeCard,
  getReport: id => store.getReports()[id],
  saveReport: (card, reason, note) => store.addReport(card.id, card.t, reason, note),
});
const { services: cardsServices, loadAllCards: allCards } = cardsComposition;
let settingsIndex: Awaited<ReturnType<typeof getIndex>> | null = null;
let settingsOffline: SettingsSnapshot['offline'] = null;
let settingsProgressQuestionCount = 0;
let settingsProgressRead = 0;
async function refreshSettingsProgressQuestionCount(): Promise<void> {
  const request = ++settingsProgressRead, account = store.accountId();
  try {
    const statistics = await localProgressRepository.getStats();
    if (request !== settingsProgressRead || account !== store.accountId()) return;
    const count = Object.keys(statistics).length;
    if (count !== settingsProgressQuestionCount) { settingsProgressQuestionCount = count; notifySettings(); }
  } catch { /* Progress summary is optional; the settings page remains usable. */ }
}
const settingsServices = {
  accountId: store.accountId,
  getSnapshot(): SettingsSnapshot {
    return toSettingsSnapshot({
      sync: { state: sync.status.state, user: sync.status.user, configured: sync.status.configured, lastSync: sync.status.lastSync, error: sync.status.error, detail: sync.status.detail, host: sync.status.host, authDomain: sync.status.authDomain, accessError: sync.status.accessErr, requests: sync.status.reqs },
      full: isFull(), level: accessLevel(), devMode: devMode(), devRevealed: devRevealed(),
      uiPreferences: store.getCfg().ui, trainingPreferences: store.getCfg().training,
      progress: { questions: settingsProgressQuestionCount, topics: store.getSeen().length, sessions: store.getSessions().length, openReports: Object.values(store.getReports()).filter(report => report.st === 'abierto').length },
      exam: store.getCfg().exam, version: APP_VERSION, build: APP_BUILD.split('+')[1] || APP_BUILD, update: appUpdates.getAvailableUpdate()?.version || null,
      offline: settingsOffline, index: settingsIndex ? { questions: settingsIndex.n, scenarios: settingsIndex.nsup, topics: settingsIndex.temas.map(topic => ({ id: topic.id, name: topic.nombre })) } : null,
    });
  },
  subscribe(listener: () => void) {
    const offStore = store.onChange(listener), offSync = sync.onStatus(listener);
    return () => { offStore(); offSync(); };
  },
  async load() {
    settingsIndex = await getIndex();
    settingsOffline = await inspectOffline(settingsIndex).catch(() => null);
    await refreshSettingsProgressQuestionCount();
    notifySettings();
  },
  setPreference(key: 'theme' | 'size' | 'lectura', value: string | number) {
    const current = normalizeUiPreferences(store.getCfg().ui);
    store.setCfg('ui', { ...current, [key]: key === 'theme' ? value : Number(value) });
  },
  setTrainingPreferences(value: TrainingPreferences) { store.setCfg('training', normalizeTrainingPreferences(value)); },
  setExam(value: string) { if (/^\d{4}-\d\d-\d\d$/.test(value)) store.setCfg('exam', value); },
  setDevMode(value: string | null) { setDevMode(value); notifyAccessChange(); notifySettings(); },
  revealDev() { revealDev(); notifySettings(); },
  async requestAccess() { return await sync.requestAccess(); },
  async login() { return await sync.login(); },
  async logout() { return await sync.logout(); },
  async retrySync() { return await sync.retry(); },
  async checkUpdate() {
    const result = await appUpdates.checkUpdate();
    notifySettings();
    return result === undefined ? undefined : result?.version || null;
  },
  applyUpdate: appUpdates.applyUpdate,
  async downloadOffline(progress: (done: number, total: number) => void, isCurrent: () => boolean) {
    const index = settingsIndex || await getIndex(); settingsIndex = index;
    settingsOffline = await downloadOffline(index, progress, isCurrent);
    notifySettings(); return settingsOffline;
  },
  async exportAnki() {
    const cards = await allCards(), clean = (value: unknown) => String(value).replace(/[\t\r\n]+/g, ' ');
    return '#separator:tab\n#html:false\n#tags column:4\n' + cards.map(card => [clean(card.q), clean(card.a), clean(card.ref || ''), clean((card.t || '').replace('.', '_') + ' ' + (card.tipo || ''))].join('\t')).join('\n');
  },
  async exportBackup() {
    const account = store.accountId() || 'guest';
    const archive = await exportAttemptArchive(localAttemptRepository, account, Date.now());
    const backup = JSON.parse(store.exportAll()); backup.attemptHistory = attemptArchiveMapper.toDto(archive);
    return JSON.stringify(backup);
  },
  previewBackup(text: string) {
    return previewBackupImport(text, {
      cleanStats: store.cleanStats,
      cleanSessions: store.cleanSessions,
      cleanCards: store.cleanCards,
      cleanReports: store.cleanReports,
      cleanSeen: store.cleanSeen,
      cleanConfig: cleanCfg,
      getStats: store.getStats,
      getQuestionStats: store.rec,
      needsSync: store.needsSync,
      attemptArchive: attemptArchiveMapper,
    });
  },
  async importBackup(serialized: string, attemptArchive?: unknown) {
    const account = store.accountId();
    store.importAll(serialized);
    if (attemptArchive) await importAttemptArchive(localAttemptRepository, account || 'guest', attemptArchive as AttemptArchive);
    if (store.accountId() !== account) throw new Error('La cuenta cambió durante la importación. Comprueba el progreso antes de continuar.');
  },
  resetAll: () => store.resetAll(),
  findAiSessions: (from: number, to: number, modes: readonly ('practice' | 'simulation')[]) => listManualExportSessions(from, to, [...modes]),
  buildAiExport: (input: Parameters<SettingsServices['buildAiExport']>[0]) => createManualAiExport({ ...input, modes: [...input.modes], sessionIds: [...input.sessionIds] }),
  deleteAiHistory: deleteManualStudyHistory,
};
function notifySettings() { settingsListeners.forEach(listener => listener()); }
const settingsListeners = new Set<() => void>();
// Reuse the stores' subscriptions and notify route-local consumers after asynchronous settings work.
const settingsServicesWithSubscription = {
  ...settingsServices,
  subscribe(listener: () => void) {
    settingsListeners.add(listener);
    const onStoreChange = () => { listener(); void refreshSettingsProgressQuestionCount(); };
    const offStore = store.onChange(onStoreChange), offSync = sync.onStatus(listener);
    return () => { settingsListeners.delete(listener); offStore(); offSync(); };
  },
};
const statsServices = createStatsServices({ go, startRun, startRepaso, trapTest });
const quizServices = createQuizServices(go, hashPath('home'), hashPath('result'));



const failuresServices = createFailuresComposition({
  accountId: store.accountId,
  progressRepository: localProgressRepository,
  loadQuestionMetadata: getMeta,
  loadQuestionIndex: getIndex,
  loadQuestionsById: ids => byIds(ids),
  failedQuestionIds: falladasIds,
  setReviewed: (id, topicId, reviewed) => store.setReviewed(id, topicId, reviewed),
  topicName: temaName,
  sourceFallbacks: VERIFIED_SOURCES,
  shuffle,
  createPractice: (items, title) => !!createRun({ kind: 'test', feedback: true, items, titulo: title }),
  notify: toast,
  navigateToQuiz: () => go(hashPath('quiz')),
});
const lightningServices = createLightningComposition({
  loadQuestionMetadata: getMeta,
  readQuestionStats: () => localProgressRepository.getStats(),
  loadDueQuestionIds: dueQuestionIds,
  knownQuestionIds: () => Object.keys(META).filter(id => id !== '_by'),
  shuffle,
  loadQuestionsById: ids => byIds(ids),
  sourceFallbacks: VERIFIED_SOURCES,
  recordAnswer: (questionId, topicId, correct, seconds) => store.record(questionId, topicId, correct ? 1 : 0, now(), seconds),
  topicName: temaName,
});
const trapsServices = createTrapsComposition({
  accountId: store.accountId,
  loadQuestionMetadata: getMeta,
  readQuestionStats: () => localProgressRepository.getStats(),
  eligibleQuestionIds: () => Object.keys(META).filter(id => id !== '_by' && (META[id][3] || []).length > 0),
  loadQuestionsById: ids => byIds(ids),
  trapIds: Object.keys(TRAMPAS).map(Number),
  shuffle,
  sourceFallbacks: VERIFIED_SOURCES,
  topicName: temaName,
  readDetectionStats: () => (store.getCfg().tdet || {}) as unknown as Record<string, readonly [number, number]>,
  writeDetectionStats: stats => store.setCfg('tdet', stats),
});
const readingServices = createReadingComposition({
  accountId: store.accountId,
  onAccountChange: store.onAccountChange,
  loadQuestionMetadata: getMeta,
  readQuestionStats: () => localProgressRepository.getStats(),
  fastQuestionIds: stats => summarizeReadingSpeedFailures(Object.entries(stats).map(([id, record]) => ({ id, lastOutcome: record.lastResult ?? -1, lastReasonCode: record.errorReason }))).questionIds,
  recentQuestionIds: accountId => localReadingQuestionHistoryRepository.readRecentQuestionIds(accountId),
  rememberQuestion: (accountId, questionId) => localReadingQuestionHistoryRepository.rememberQuestion(accountId, questionId),
  availableQuestionIds: () => Object.keys(META).filter(id => id !== '_by' && !!META[id]),
  loadQuestionsById: ids => byIds(ids),
  mixQuestionIds: mixReadingIds,
  shuffle,
  tokenize: readingTokens,
  sourceFallbacks: VERIFIED_SOURCES,
  recordAnswer: (questionId, topicId, correct, timestamp, seconds) => store.record(questionId, topicId, correct ? 1 : 0, timestamp, seconds),
  now,
  currentTime: Date.now,
});


// ───────── arranque ─────────
export function bootAppServices(): () => void {
  return startAppBootstrap({
    onAccountChange: store.onAccountChange,
    goHome: () => go(hashPath('home')),
    recover,
    setAttemptTrackingVisible,
    flushStore: () => { store.flushNow(); },
    flushAttemptTracking,
    saveRun,
    routeReady: firstReactRouteReady,
    resumeSaved: () => resumeSaved().catch(() => {}),
    prefetchBank: prefetchBanco,
    watchUpdates: appUpdates.watchUpdates,
    checkUpdate: appUpdates.checkUpdate,
    announceUpdate: version => toast(`Hay una versión nueva (${version}).`, { label: 'Actualizar', fn: () => appUpdates.applyUpdate() }),
    applyUpdate: appUpdates.applyUpdate,
    loadMetadataAndInitializeSync: async () => {
      try { await getMeta(); } catch (error) { console.error(error); }
      try { await sync.init({ temaOf, idsOfTema }, store); } catch (error) { console.error(error); }
    },
  });
}

// Descarga el banco en segundo plano (2 a la vez) para que Test, Simulacro y Repaso arranquen sin esperar a la red
async function prefetchBanco() { await prefetchQuestionBank(await getIndex()); }

/** Temporary composition only: the React views own rendering and events. */
export const studyServices: StudyServices = {
  result: {
    getSnapshot() {
      const last = getLastResult(); if (!last) return null;
      const { ses, items, ans, studyStates = [], highlights = [], confidences = [], discardedOptions = [] } = last;
      return { score: ses.nota, correct: ses.a, wrong: ses.f, blank: ses.b, consulted: studyStates.filter(state => state === 'revealed').length,
        accuracy: ses.a + ses.f ? pct(ses.a, ses.a + ses.f) : null, seconds: ses.secs, title: ses.titulo || '', interrupted: !!ses.interrupted, kind: ses.kind,
        porTiempo: !!ses.porTiempo, analysis: last.limit && !ses.porTiempo ? createSimulationAnalysisView({ correctIndices: last.items.map(question => question.c), answers: last.ans, answerSeconds: last.times, timeLimitMinutes: last.limit, elapsedSeconds: ses.secs }) : '',
        secondPartAvailable: (ses.titulo || '').includes('Parte 1') && !!SIMCFG?.parte2,
        topics: Object.entries(ses.temas).sort(([left], [right]) => left.localeCompare(right)).map(([id, [correct, total]]) => ({ id, name: temaName(id), correct, total })),
        items: items.map((question, index) => {
          const answer = ans[index], revealed = studyStates[index] === 'revealed';
          return { id: question.i, topicId: question.t, topicName: temaName(question.t), statement: question.q, options: question.a, correctIndex: question.c,
            ...(answer !== undefined ? { answer } : {}), outcome: revealed ? 'revealed' : answer === undefined || answer === -1 ? 'blank' : answer === question.c ? 'correct' : 'wrong',
            notice: questionNotice(question), source: sourceHtml(question, VERIFIED_SOURCES), ...(question.u ? { citation: question.u } : {}), ...(question.n ? { note: question.n } : {}),
            ...(confidences[index] ? { confidence: confidences[index] } : {}), discardedOptions: discardedOptions[index] || [], highlights: highlights[index] || [],
            contentRevision: questionContentRevision(question.q, question.a) };
        }) };
    },
    subscribe(listener) { const offEngine = subscribeEngine(listener), offStore = store.onChange(listener); return () => { offEngine(); offStore(); }; },
    continuePartTwo() { go(hashPath('simulationReview')); },
    repeatFailures() {
      const last = getLastResult(); if (!last) return false;
      return startRun({ kind: 'rev', feedback: true, items: shuffle(last.items.filter((question, index) => last.ans[index] !== question.c)), titulo: 'Repetición de falladas' });
    },
    goHome() { go(hashPath('home')); },
    async loadStrategy() { return renderStrategyReport(await loadStrategyReportForPeriod(365)); },
    async loadExplanation(item) {
      const result = await findLegacyCodeExplanation(item.id, item.statement, [...item.options]);
      if (result.status === 'current') return { status: 'current', content: renderCodeExplanation(explanationMapper.toViewModel(result.explanation)) };
      return { status: result.status };
    },
    getReport(id) { const report = store.getReports()[id]; return report ? { reason: report.motivo, note: report.nota, state: report.st } : undefined; },
    saveReport(id, topicId, reason, note) { store.addReport(id, topicId, reason, note); },
  },
  simulation: {
    getTab() { const value = store.getCfg().simtab; return value === 'examen' || value === 'tema' ? value : 'completo'; },
    setTab(tab) { store.setCfg('simtab', tab); },
    getConfiguration() {
      const saved = store.getCfg().sim || {};
      return { count: saved.n === 40 ? 40 : 80, minutes: ([45, 60, 90, 120].includes(saved.min ?? 0) ? saved.min : 90) as SimulationConfiguration['minutes'],
        scope: saved.scope === 'todos' ? 'todos' : 'vistos', origins: saved.o || ['O', 'G'], includeSecondPart: saved.parte2 !== false };
    },
    saveConfiguration(configuration) {
      store.setCfg('sim', { n: configuration.count, min: configuration.minutes, o: [...configuration.origins], parte2: configuration.includeSecondPart, scope: configuration.scope });
    },
    seenTopics: store.getSeen,
    async loadExamGroups(): Promise<SimulationExamGroups> {
      await getMetaIndex();
      const lists = createExamCatalog(META, temaName), sessions = store.getSessions();
      const map = (entries: { k: string; ids: string[]; nombre: string }[]): SimulationExam[] => entries.map(entry => {
        const attempts = sessions.filter(session => session.titulo === entry.nombre);
        return { id: entry.k, name: entry.nombre, questionCount: entry.ids.length, attempts: attempts.length,
          latest: attempts[0]?.nota ?? null, best: attempts.length ? Math.max(...attempts.map(session => session.nota)) : null };
      });
      return { official: map(lists.ofi), academy: map(lists.sims), topicTests: map(lists.tests) };
    },
    getSelectedExam() { return store.getCfg().exsel || null; },
    selectExam(id) { store.setCfg('exsel', id); },
    async startConfigured(configuration) {
      const account = store.accountId(), index = await getIndex(); await getMeta();
      const seen = store.getSeen(), only = configuration.scope !== 'todos' && seen.length ? new Set(seen) : null;
      const origins = new Set(configuration.origins);
      const items = await simParte1(index, origins, configuration.count, only);
      if (account !== store.accountId()) return 'account-changed';
      if (!items.length) return 'empty';
      SIMCFG = { parte2: configuration.includeSecondPart, org: [...origins], min2: Math.round(configuration.minutes * 0.45) };
      return startRun({ kind: 'sim', feedback: false, items, limit: configuration.minutes, titulo: 'Simulacro · Parte 1' }) ? 'started' : 'empty';
    },
    async startExam(id, mode) {
      const account = store.accountId(); await getMeta();
      const lists = createExamCatalog(META, temaName), selected = [...lists.ofi, ...lists.sims, ...lists.tests].find(exam => exam.k === id);
      if (!selected) return 'empty';
      const items = (await byIds(selected.ids)).filter(question => !(question as Question & { s?: unknown }).s);
      if (account !== store.accountId()) return 'account-changed';
      if (!items.length) return 'empty';
      const started = mode === 'exam'
        ? startRun({ kind: 'sim', feedback: false, items, limit: 90, titulo: selected.nombre })
        : startRun({ kind: 'test', feedback: true, items, titulo: selected.nombre });
      return started ? 'started' : 'empty';
    },
    openExams() { store.setCfg('simtab', 'examen'); go(hashPath('simulation')); },
  },
  simulationReview: {
    async loadChoices(): Promise<ScenarioChoice[]> {
      const scenarios = await getSup();
      const available = (Object.entries(scenarios) as [string, { q: Question[]; texto: string; conv?: string }][])
        .filter(([, scenario]) => scenario.q.filter(question => !(question as Question & { r?: unknown }).r && question.np !== 1).length >= 18 && /libre/i.test(scenario.conv || '') && !/2018/.test(scenario.conv || ''));
      const chosen = shuffle(available).slice(0, 2);
      reviewScenarioQuestions = new Map(chosen.map(([id, scenario]) => [id, scenario.q.filter(question => !(question as Question & { r?: unknown }).r && question.np !== 1).slice(0, 20)]));
      reviewScenarioTexts = new Map(chosen.map(([id, scenario]) => [id, scenario.texto]));
      reviewScenarioAccount = store.accountId();
      return chosen.map(([id, scenario], index) => ({ id, text: scenario.texto.slice(0, 700) + (scenario.texto.length > 700 ? '…' : '') }));
    },
    start(id) {
      const items = reviewScenarioQuestions.get(id);
      if (!items?.length || reviewScenarioAccount !== store.accountId()) return 'unavailable';
      const started = startRun({ kind: 'sim', feedback: false, items, limit: SIMCFG?.min2 || 40, supTexto: reviewScenarioTexts.get(id), titulo: 'Simulacro · Parte 2 (supuesto)' });
      return started ? 'started' : 'unavailable';
    },
  },
  test: {
    async loadTopics() {
      const index = await getIndex(); await getMeta();
      const summaries = await progressPorTema(index.temas.map(topic => ({ id: topic.id, name: topic.nombre, total: topic.n })));
      return summaries.map(({ id, name, total, attempted, correct, answerCount }) => ({ id, name, total, attempted, correct, answerCount }));
    },
    getConfiguration() {
      const saved = store.getCfg().test || {};
      return { all: typeof saved.all === 'boolean' ? saved.all : !(saved.sel || []).length, selected: saved.sel || [], count: ([10, 15, 25, 40].includes(saved.n ?? 0) ? saved.n : 15) as TestConfiguration['count'],
        mode: (['nuevas', 'aleatorio', 'falladas', 'dudosas', 'trampas'].includes(saved.mode ?? '') ? saved.mode : 'nuevas') as TestConfiguration['mode'], origins: saved.o || ['O', 'A', 'G'], timed: !!saved.pt,
        minutes: ([10, 20, 30, 45, 60].includes(saved.min ?? 0) ? saved.min : 20) as TestConfiguration['minutes'] };
    },
    saveConfiguration(configuration) {
      store.setCfg('test', { all: configuration.all, sel: [...configuration.selected], n: configuration.count, mode: configuration.mode,
        o: [...configuration.origins], pt: configuration.timed ? 1 : 0, min: configuration.minutes });
    },
    seenTopics: store.getSeen,
    async start(configuration) {
      const account = store.accountId();
      const selected = [...configuration.selected];
      const topics = configuration.all ? (await getIndex()).temas.map(topic => topic.id) : selected;
      if (configuration.mode === 'trampas') {
        const result = await trapTest(configuration.timed ? 300 : configuration.count, undefined, selected.length ? selected : undefined);
        if (account !== store.accountId()) return 'account-changed';
        if (!result.items.length) return 'empty';
        return startRun({ kind: 'test', feedback: true, items: result.items, titulo: 'Mis trampas · ' + result.targets.map(key => TRAMPAS[key] || key).join(', '), ...(configuration.timed ? { limit: configuration.minutes, porTiempo: true } : {}) }) ? 'started' : 'empty';
      }
      const items = await selectQuestionsForTopics({ topics, origins: new Set(configuration.origins), mode: configuration.mode, count: configuration.timed ? 300 : configuration.count });
      if (account !== store.accountId()) return 'account-changed';
      if (!items.length) return 'empty';
      return startRun({ kind: 'test', feedback: true, items, titulo: selected.length === 1 ? temaName(selected[0]) + (configuration.timed ? ` · ${configuration.minutes} min` : '') : 'Test' + (configuration.timed ? ` · ${configuration.minutes} min` : ''), ...(configuration.timed ? { limit: configuration.minutes, porTiempo: true } : {}) }) ? 'started' : 'empty';
    },
  },
  cards: cardsServices,
  failures: failuresServices,
  lightning: lightningServices,
  traps: trapsServices,
  reading: readingServices,
  quiz: quizServices,
  stats: statsServices,
  settings: settingsServicesWithSubscription,
  errors: {
    getFilter() { return String(store.getCfg().errf || 'abierto'); },
    getReports() { return Object.entries(store.getReports()).map(([id, report]) => ({ id, ts: report.ts, tema: report.tema, motivo: report.motivo, nota: report.nota, state: report.st })); },
    subscribe: store.onChange,
    setFilter(filter) { store.setCfg('errf', filter); },
    async loadContent(ids) {
      const requestedIds = new Set(ids);
      const questionIds = ids.filter(id => !id.startsWith('FC-'));
      const questions = (await byIds(questionIds)).map(question => ({ id: question.i, origin: ORIGEN[question.o], statement: question.q, options: question.a.map((text, index) => ({ label: L[index], text, correct: index === question.c })), reference: question.u, traps: (question.x || []).map(trap => TRAMPAS[trap] || String(trap)) }));
      const cards = ids.some(id => id.startsWith('FC-')) ? (await allCards()).filter(card => requestedIds.has(card.id)).map(card => ({ id: card.id, question: card.q, answer: card.a, reference: card.ref || null })) : [];
      return { questions, cards };
    },
    setState(id, state) { store.setReportState(id, state); },
    async exportData() {
      const reports = Object.entries(store.getReports()).filter(([, report]) => report.st !== 'quitado').sort(([, first], [, second]) => second.ts - first.ts);
      const ids = reports.map(([id]) => id);
      const questionIds = ids.filter(id => !id.startsWith('FC-'));
      const questions = new Map((await byIds(questionIds)).map(question => [question.i, question]));
      const cards = ids.some(id => id.startsWith('FC-')) ? new Map((await allCards()).map(card => [card.id, card])) : new Map();
      const errors = reports.map(([id, report]) => {
        const question = questions.get(id), card = cards.get(id);
        return { id, tarjeta: card ? { pregunta: card.q, respuesta: card.a, ref: card.ref || null } : undefined,
          tema: report.tema, estado: report.st, motivo: report.motivo, nota: report.nota,
          origen: question ? ORIGEN[question.o] : null, enunciado: question?.q, opciones: question?.a,
          correcta: question ? L[question.c] : null, cita: question?.u || null,
          trampas: (question?.x || []).map(trap => TRAMPAS[trap] || trap) };
      });
      return JSON.stringify({ generado: new Date().toISOString(), errores: errors }, null, 1);
    },
  },
  access: {
    accountId: store.accountId, subscribe(listener) { const offSync = sync.onStatus(listener), offStore = store.onChange(listener); return () => { offSync(); offStore(); }; },
    async load() { await recover(); return { owner: isOwner(), error: sync.status.accessErr || undefined, requests: sync.status.reqs, grants: sync.status.grants }; },
    approve: async member => await sync.approve(member), reject: async uid => await sync.reject(uid), revoke: async uid => await sync.revoke(uid), confirm: ask, notify: toast,
  },
  markReady: () => routeReady(),
  home: {
    accountId: store.accountId,
    authResolved() { return sync.status.authResolved; },
    getActiveStudy() { const run = getCurrentRun(); return run ? { title: run.titulo || 'Test', position: run.idx, total: run.items.length } : null; },
    getAccess() { return { full: isFull(), level: accessLevel(), greeting: saludo(), state: sync.status.state, configured: sync.status.configured, signedIn: !!sync.status.user, pendingRequests: sync.status.access === 'propietario' ? sync.status.reqs.length : 0 }; },
    subscribe(listener) { const offStore = store.onChange(listener), offSync = sync.onStatus(listener), offEngine = subscribeEngine(listener); return () => { offStore(); offSync(); offEngine(); }; },
    async loadOverview() {
      await recover(); const account = store.accountId(); const index = await getIndex(); await getMeta();
      const progress = await getHomeProgressSummary(localProgressRepository);
      if (account !== store.accountId()) throw new Error('La cuenta cambió mientras se cargaba el resumen de inicio.');
      const due = (await dueQuestionIds()).length;
      const cardDueCount = Object.values(store.getCards()).filter(record => record[3] >= 0 && record[4] <= now()).length;
      const failureCount = falladasIds().length;
      const streak = calculateStudyStreak(progress.answerTimestamps, Date.now());
      const exam = store.getCfg().exam;
      const daysToExam = exam ? Math.max(0, Math.ceil((+new Date(exam + 'T09:00:00') - Date.now()) / 86400000)) : null;
      const mastery = await dominioTemas(index);
      const trainingPreferences = normalizeTrainingPreferences(store.getCfg().training);
      const weakTopics = mastery.filter(topic => topic.est === 'r').sort((left, right) => left.score - right.score);
      const studiedTopicIds = new Set(store.getSeen());
      const trainingPlan = buildDailyTrainingPlan({ preferences: trainingPreferences, weekday: new Date().getDay(), dueCount: due, cardDueCount, failureCount, weakTopicCount: weakTopics.length, weakTopicIds: weakTopics.map(topic => topic.id),
        topicReviewEvidence: mastery.map(topic => ({ topicId: topic.id, topicName: topic.nombre, hasStudyMarker: studiedTopicIds.has(topic.id), distinctQuestionsAttempted: topic.seen, questionCoverageOfTarget: topic.cob, latestAnswerAccuracy: topic.seen ? topic.prec : null, daysSinceLastQuestionAttempt: topic.dias })) });
      return { seen: progress.seen, total: index.n, answers: progress.answers, streak, daysToExam, due,
        completedSessions: store.getSessions().length,
        blocks: BLOQUES.map(([code, name]) => {
          const topics = mastery.filter(topic => topic.id.startsWith(code));
          return { name, total: topics.length, mastered: topics.filter(topic => topic.est === 'g').length,
            assessed: topics.filter(topic => topic.est !== 'n').length };
        }),
        cardsDue: cardDueCount,
        quickCount: progress.quickCount, slowCount: progress.slowCount, failures: failureCount,
        studiedTopics: store.getSeen().length, topicCount: index.temas.length,
        assessedTopics: mastery.filter(topic => topic.est !== 'n').length,
        weakTopics: mastery.filter(topic => topic.est === 'r').length,
        masteredTopics: mastery.filter(topic => topic.est === 'g').length, trainingPlan, trainingSession: trainingSession.getSession(),
      };
    },
    startTrainingSession(plan) { return trainingSession.start(plan); },
    startTrainingActivity() { return trainingSession.startCurrentActivity(); },
    completeTrainingActivity(activity: TrainingActivity) { return trainingSession.completeActivity(activity); },
    setTrainingReviewMode(topicId: string, mode: StudyReviewMode | null) {
      const preferences = normalizeTrainingPreferences(store.getCfg().training);
      const reviewModesByTopic = { ...preferences.reviewModesByTopic };
      if (mode) reviewModesByTopic[topicId] = mode;
      else delete reviewModesByTopic[topicId];
      store.setCfg('training', { ...preferences, reviewModesByTopic });
    },
    quickSession, startReview: startRepaso, openMenu,
    login: sync.login, requestAccess: async () => await sync.requestAccess(), notify: toast,
  },
  topics: {
    accountId: store.accountId, getStudied: store.getSeen,
    setStudied(ids) { store.setSeen(ids); }, subscribe: store.onChange,
    async loadTopics() {
      await recover(); const index = await getIndex(); await getMeta();
      const summaries = await progressPorTema(index.temas.map(topic => ({ id: topic.id, name: topic.nombre, total: topic.n })));
      return summaries.map(({ id, name, total, answered, accuracy }) => ({ id, name, total, answered, accuracy }));
    },
  },
};
