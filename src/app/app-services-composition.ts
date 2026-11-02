import type { SettingsServices, SettingsSnapshot, StudyServices } from '../shared/ui/study-services.js';
import { questionNotice, sourceHtml } from '../shared/presentation/study-content.js';
import { VERIFIED_SOURCES } from '../adapters/http/verified-sources.js';
import * as sync from '../adapters/firebase/sync-facade.js';
import * as progressStore from '../adapters/local/local-progress-store.js';
import { localCardProgressGateway, localProgressRepository, localQuizProgressGateway, localStudyProgressGateway } from '../adapters/local/progress-repository.js';
import { localGuestQuestionHistoryRepository } from '../adapters/local/guest-question-history.js';
import { localReadingQuestionHistoryRepository } from '../adapters/local/reading-question-history.js';
import { percentage as pct } from '../shared/presentation/format.js';
import { normalizeUiPreferences } from '../shared/presentation/ui-preferences.js';
import { randomStudyOrder as shuffle } from '../shared/ui/study-random.js';
import { calculateStudyStreak } from '../core/domain/study-analytics.js';
import { summarizeReadingSpeedFailures } from '../core/domain/question-performance.js';
import { previewBackupImport } from '../core/application/settings/backup-preview.js';
import { fetchJson } from '../adapters/http/study-question-catalog.js';
import { ask, toast } from '../shared/ui/dialog-actions.js';
import { showMenu } from '../shared/ui/dialog-actions.js';
import { BLOQUES, LETRAS_OPCION, ORIGEN, TRAMPAS } from '../shared/presentation/labels.js';
import { APP_VERSION, APP_BUILD } from './build-info.js';
import { isFull, isOwner, accessLevel, devMode, setDevMode, devRevealed, revealDev } from './composition/access-composition.js';
import { subscribe as subscribeEngine, configureSessionStateStore, getCurrentRun, getLastResult, createRun, resumeRun, startImmediateRetryFromLastResult, setAttemptTrackingVisible, flushAttemptTracking, quickItems, repasoItems, trapTest, falladasIds, dueQuestionIds, selectQuestionsForTopics, selectWeightedSimulationQuestions, studyQuestionCatalog } from './composition/study/study-engine-composition.js';
import { sessionStatePort } from './session-state-store.js';
import { clearRun, pendingRun, saveRun } from './composition/study/pending-run-composition.js';
import { createTopicMasteryComposition } from './composition/topics/topic-mastery-composition.js';
import { createTopicProgressComposition } from './composition/topics/topic-progress-composition.js';
import { createAcademyStudyProgressComposition } from './composition/topics/academy-study-progress-composition.js';
import { formatPendingRunPrompt } from '../shared/presentation/pending-run.ts';
import { createAccountRecovery } from '../core/application/recover-account.js';
import type { Origin, QuestionStats, StudyReviewMode, TrainingActivity, TrainingCalendarEvent, TrainingPreferences } from '../core/domain/entities.js';
import type { TrainingActivityReference } from '../core/domain/study-training-session.js';
import type { PaperRecallRating } from '../core/domain/paper-recall-assessment.js';
import { daysUntilStudyDate, isStudyDateKey } from '../core/domain/study-training-calendar.js';
import { latestPaperRecallByTopic, needsPaperRecallFollowUp } from '../core/domain/paper-recall-assessment.js';
import { buildDailyTrainingPlan, normalizeTrainingPreferences, selectNextAcademyTopic } from '../core/domain/study-training-plan.js';
import { buildTrainingCalendarEvent } from '../core/domain/study-training-events.js';
import { localTrainingDateKey } from '../core/domain/study-training-session.js';
import { filterTopicMasteryToSeen } from '../core/domain/topic-mastery.js';
import { questionContentRevision } from '../core/domain/attempts/highlights.js';
import { findCodeExplanation } from './composition/explanations/explanation-composition.js';
import { loadStrategyReportForPeriod } from './composition/stats/strategy-composition.js';
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

let trainingEventSequence = 0;
function createTrainingCalendarEvent(input: Omit<TrainingCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): TrainingCalendarEvent | null {
  const now = Date.now();
  let randomId = '';
  try { randomId = globalThis.crypto?.randomUUID?.() ?? ''; } catch { /* fallback local id below */ }
  const id = randomId ? `event-${randomId}` : `event-${now}-${trainingEventSequence++}`;
  return buildTrainingCalendarEvent(input, id, now);
}
import { createManualAiExport, deleteManualStudyHistory, listManualExportSessions } from './composition/exports/ai-study-export-composition.js';
import { inspectOffline, downloadOffline, prefetchQuestionBank } from '../adapters/offline/cache.js';
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
import { createPaperRecallComposition } from './composition/trainers/paper-recall-composition.js';
import { createTrainingCalendarComposition } from './composition/trainers/training-calendar-composition.js';
import { createWeeklyStudyAgendaComposition } from './composition/trainers/weekly-study-agenda-composition.js';
import { findMatchingPlannedAgendaItem } from '../core/domain/study-weekly-agenda.js';
import { getHomeProgressSummary } from '../core/application/stats/get-home-progress-summary.js';
import type { QuestionRecord as Question } from '../core/domain/question-record.js';
import { createReadingComposition } from './composition/trainers/reading-composition.js';
import { readingTokens, mixReadingIds } from '../features/trainers/reading-controller.js';
import type { TestConfiguration, ScenarioChoice, SimulationConfiguration, SimulationExam, SimulationExamGroups } from '../shared/ui/study-services.js';

const { getIndex } = studyQuestionCatalog;
const getMeta = studyQuestionCatalog.getMetadata;

// ───────── router ─────────
configureBankSource();
configureSessionStateStore(sessionStatePort);
let navigate: (h: string, refresh?: boolean) => void = h => { location.hash = h; };
export function configureAppNavigation(fn: (h: string, refresh?: boolean) => void): void { navigate = fn; }
function go(h: string) { navigate(h); }
const appUpdates = createAppUpdateController({
  currentBuild: APP_BUILD,
  saveRun,
  flushProgress: () => progressStore.flushNow(),
  getRegistration: () => navigator.serviceWorker?.getRegistration(),
  reload: () => location.reload(),
});
const recover = createAccountRecovery(localStudyProgressGateway.accountId, () => progressStore.recover());
const dominioTemas = createTopicMasteryComposition({ progressRepository: localProgressRepository, accountId: localStudyProgressGateway.accountId, questionIdsForTopic: topicId => studyQuestionCatalog.getMetadataSnapshot()?._by[topicId] || [], now: studyQuestionCatalog.now });
const progressPorTema = createTopicProgressComposition({ progressRepository: localProgressRepository, accountId: localStudyProgressGateway.accountId, questionIdsForTopic: topicId => studyQuestionCatalog.getMetadataSnapshot()?._by[topicId] || [] });
const trainingSession = createTrainingSessionComposition({ accountId: localStudyProgressGateway.accountId, now: studyQuestionCatalog.now, push: session => { void sync.pushTrainingSession(session); } });
const paperRecall = createPaperRecallComposition({ accountId: localStudyProgressGateway.accountId, now: studyQuestionCatalog.now, push: () => { void sync.pushPaperRecallAssessments(); } });
const weeklyStudyAgenda = createWeeklyStudyAgendaComposition({
  accountId: localStudyProgressGateway.accountId,
  now: studyQuestionCatalog.now,
  push: () => { void sync.pushWeeklyStudyAgenda(); },
});
const academyStudyProgress = createAcademyStudyProgressComposition({
  accountId: localStudyProgressGateway.accountId,
  now: studyQuestionCatalog.now,
  onAccountChange: localStudyProgressGateway.onAccountChange,
  pushMaterialSelection: selection => { void sync.pushAcademyMaterialSelection(selection); },
  pushSectionEvent: event => { void sync.pushAcademySectionStudyEvent(event); },
});
const trainingCalendar = createTrainingCalendarComposition({
  accountId: localStudyProgressGateway.accountId,
  now: studyQuestionCatalog.now,
  getSeenTopics: localStudyProgressGateway.getSeenTopics,
  getPreferences: () => normalizeTrainingPreferences(localStudyProgressGateway.getPreferences().training),
  push: activities => { void sync.pushTrainingCalendar(activities); },
});
let routeReady: () => void;
const firstReactRouteReady = new Promise<void>(resolve => { routeReady = resolve; });
const studyRunController = createStudyRunController({
  createRun: (configuration, reference, activity) => {
    const run = createRun(configuration, reference?.sessionId);
    if (run && reference) {
      run.trainingActivityReference = reference;
      if (activity) run.trainingActivity = activity;
      if (run.attemptSessionId) trainingSession.attachAttemptSession(run.attemptSessionId, reference);
    }
    return run !== null;
  },
  getPendingRun: fullAccess => pendingRun(fullAccess),
  isFullAccess: isFull,
  currentAccount: localStudyProgressGateway.accountId,
  ask,
  resume: pending => {
    const run = resumeRun(pending);
    if (!run) return false;
    const reference = run.trainingActivityReference;
    const current = trainingSession.getCurrentActivityReference();
    if (reference && current?.sessionId === reference.sessionId && current.activityId === reference.activityId) {
      trainingSession.startCurrentActivity();
    }
    return true;
  },
  clearPendingRun: clearRun,
  navigateToQuiz: (dailyTrainingActivity, reference) => {
    const params = new URLSearchParams();
    if (dailyTrainingActivity) params.set('dailyTraining', dailyTrainingActivity);
    if (reference) { params.set('trainingSessionId', reference.sessionId); params.set('trainingActivityId', reference.activityId); }
    go(hashPath('quiz') + (params.size ? `?${params}` : ''));
  },
  showEmptyRunMessage: () => toast('No hay preguntas puntuables en esta selección. Puedes consultarlas en modo estudio.'),
  resumePrompt: pending => formatPendingRunPrompt({ title: pending.saved.titulo, index: pending.saved.idx, itemCount: pending.items.length, seconds: pending.saved.secs, limitMinutes: pending.saved.limit, timeLimited: pending.saved.pt }),
});
const { startRun, resumeSaved } = studyRunController;
const studySessionLaunch = createStudySessionLaunchController({
  currentAccount: localStudyProgressGateway.accountId,
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
  } catch {}
  return n ? `Hola, ${n}` : 'Hola';
}
// ───────── menú general ─────────
async function openMenu() {
  if (document.getElementById('menuov')) return;
  const account = localStudyProgressGateway.accountId();
  await getMeta();
  const [due, statistics, cards, reports] = await Promise.all([
    dueQuestionIds().then(ids => ids.length), localProgressRepository.getStats().catch((): Readonly<Record<string, QuestionStats>> => ({})),
    localProgressRepository.getCardReviews(), localProgressRepository.getReports(),
  ]);
  const nCards = Object.values(cards).filter(card => card.dueAt <= studyQuestionCatalog.now()).length;
  if (account !== localStudyProgressGateway.accountId()) return;
  const speed = summarizeReadingSpeedFailures(Object.entries(statistics).map(([id, record]) => ({ id, lastOutcome: record.lastResult ?? -1, lastReasonCode: record.errorReason })));
  const nErr = Object.values(reports).filter(report => report.state === 'abierto').length;
  const aqui = location.hash || hashPath('home');
  const groups = createStudyMenuGroups({
    fullAccess: isFull(), owner: isOwner(), pendingQuestions: due, pendingCards: nCards,
    readingSpeedFailures: speed.count, openReports: nErr, seenTopics: localStudyProgressGateway.getSeenTopics().length,
    failedQuestions: falladasIds().length, accessRequests: sync.status.reqs.length,
    updateAvailable: !!appUpdates.getAvailableUpdate(), actions: { quickSession, startReview: startRepaso },
  });
  await showMenu(groups, aqui, go);
}

// ───────── mis trampas ─────────
interface SimulationRunConfiguration { includeSecondPart: boolean; secondPartMinutes: number }
let simulationRunConfiguration: SimulationRunConfiguration | null = null;
let reviewScenarioQuestions = new Map<string, Question[]>();
let reviewScenarioTexts = new Map<string, string>();
let reviewScenarioAccount: string | null = null;
async function selectSimulationQuestions(index: Awaited<ReturnType<typeof getIndex>>, origins: ReadonlySet<Origin>, count: number, onlyTopics: ReadonlySet<string> | null, optionsPerQuestion?: number) {
  const topics = index.temas.filter(topic => !onlyTopics || onlyTopics.has(topic.id));
  return selectWeightedSimulationQuestions(topics.map(topic => ({ id: topic.id, weight: topic.w })), origins, count, Math.random, question => optionsPerQuestion === undefined || question.a.length === optionsPerQuestion);
}
// Parte 2 tras la parte 1: ofrece 2 supuestos
// Las pantallas comparten navegación y limpieza; cada módulo conserva su estado de sesión.
const cardsComposition = createCardsComposition({
  loadQuestionMetadata: getMeta,
  failedCardQuestionIds: () => Object.keys(localCardProgressGateway.getCardReviews()).filter(id => id.startsWith('FC-Q-')).map(id => id.slice(5)),
  loadQuestionsById: ids => studyQuestionCatalog.getQuestions(ids),
  loadJson: fetchJson,
  verifiedSources: VERIFIED_SOURCES,
  readPreferences: () => localStudyProgressGateway.getPreferences().cardsc,
  savePreferences: preferences => localStudyProgressGateway.updatePreferences(current => ({ ...current, cardsc: preferences })),
  accountId: localStudyProgressGateway.accountId, progress: localCardProgressGateway,
  now: studyQuestionCatalog.now, day: 86_400_000, topicName: studyQuestionCatalog.getTopicName,
  getReport: id => { const report = localStudyProgressGateway.getErrorReport(id); return report && { ts: report.reportedAt, tema: report.topicId, motivo: report.reason, nota: report.note, st: report.state }; },
  saveReport: (card, reason, note) => localStudyProgressGateway.saveErrorReport({ questionId: card.id, topicId: card.t, reason, note, state: 'abierto', reportedAt: Date.now() }),
});
const { services: cardsServices, loadAllCards: allCards } = cardsComposition;
let settingsIndex: Awaited<ReturnType<typeof getIndex>> | null = null;
let settingsOffline: SettingsSnapshot['offline'] = null;
let settingsProgressQuestionCount = 0;
let settingsProgressRead = 0;
async function refreshSettingsProgressQuestionCount(): Promise<void> {
  const request = ++settingsProgressRead, account = localStudyProgressGateway.accountId();
  try {
    const statistics = await localProgressRepository.getStats();
    if (request !== settingsProgressRead || account !== localStudyProgressGateway.accountId()) return;
    const count = Object.keys(statistics).length;
    if (count !== settingsProgressQuestionCount) { settingsProgressQuestionCount = count; notifySettings(); }
  } catch { /* Progress summary is optional; the settings page remains usable. */ }
}
const settingsServices = {
  accountId: localStudyProgressGateway.accountId,
  getSnapshot(): SettingsSnapshot {
    const preferences = localStudyProgressGateway.getPreferences();
    return toSettingsSnapshot({
      sync: { state: sync.status.state, user: sync.status.user, configured: sync.status.configured, lastSync: sync.status.lastSync, error: sync.status.error, detail: sync.status.detail, host: sync.status.host, authDomain: sync.status.authDomain, accessError: sync.status.accessErr, requests: sync.status.reqs },
      full: isFull(), level: accessLevel(), devMode: devMode(), devRevealed: devRevealed(),
      uiPreferences: preferences.ui, trainingPreferences: preferences.training,
      progress: { questions: settingsProgressQuestionCount, topics: localStudyProgressGateway.getSeenTopics().length, sessions: localStudyProgressGateway.getSessions().length, openReports: Object.values(localStudyProgressGateway.getErrorReports()).filter(report => report.state === 'abierto').length },
      exam: preferences.exam, version: APP_VERSION, build: APP_BUILD.split('+')[1] || APP_BUILD, update: appUpdates.getAvailableUpdate()?.version || null,
      offline: settingsOffline, index: settingsIndex ? { questions: settingsIndex.n, scenarios: settingsIndex.nsup, topics: settingsIndex.temas.map(topic => ({ id: topic.id, name: topic.nombre })) } : null,
    });
  },
  subscribe(listener: () => void) {
    const offStore = localProgressRepository.subscribe(listener), offSync = sync.onStatus(listener);
    return () => { offStore(); offSync(); };
  },
  async load() {
    settingsIndex = await getIndex();
    settingsOffline = await inspectOffline(settingsIndex).catch(() => null);
    await refreshSettingsProgressQuestionCount();
    notifySettings();
  },
  setPreference(key: 'theme' | 'size' | 'lectura', value: string | number) {
    localStudyProgressGateway.updatePreferences(current => {
      const ui = normalizeUiPreferences(current.ui);
      return { ...current, ui: { ...ui, [key]: key === 'theme' ? value : Number(value) } };
    });
  },
  setTrainingPreferences(value: TrainingPreferences) {
    localStudyProgressGateway.updatePreferences(current => ({ ...current, training: normalizeTrainingPreferences(value) }));
  },
  createTrainingCalendarEvent,
  setExam(value: string) {
    if (isStudyDateKey(value)) localStudyProgressGateway.updatePreferences(current => ({ ...current, exam: value }));
  },
  setDevMode(value: string | null) { setDevMode(value); notifyAccessChange(); notifySettings(); },
  revealDev() { const revealed = revealDev(); if (revealed) notifySettings(); return revealed; },
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
    const account = localStudyProgressGateway.accountId() || 'guest';
    const archive = await exportAttemptArchive(localAttemptRepository, account, Date.now());
    const backup = JSON.parse(progressStore.exportAll()); backup.attemptHistory = attemptArchiveMapper.toDto(archive);
    return JSON.stringify(backup);
  },
  previewBackup(text: string) {
    return previewBackupImport(text, {
      cleanStats: progressStore.cleanStats,
      cleanSessions: progressStore.cleanSessions,
      cleanCards: progressStore.cleanCards,
      cleanReports: progressStore.cleanReports,
      cleanSeen: progressStore.cleanSeen,
      cleanConfig: cleanCfg,
      getStats: progressStore.getStats,
      getQuestionStats: progressStore.rec,
      needsSync: progressStore.needsSync,
      attemptArchive: attemptArchiveMapper,
    });
  },
  async importBackup(serialized: string, attemptArchive?: unknown) {
    const account = localStudyProgressGateway.accountId();
    progressStore.importAll(serialized);
    if (attemptArchive) await importAttemptArchive(localAttemptRepository, account || 'guest', attemptArchive as AttemptArchive);
    if (localStudyProgressGateway.accountId() !== account) throw new Error('La cuenta cambió durante la importación. Comprueba el progreso antes de continuar.');
  },
  resetAll: () => progressStore.resetAll(),
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
    const offStore = localProgressRepository.subscribe(onStoreChange), offSync = sync.onStatus(listener);
    return () => { settingsListeners.delete(listener); offStore(); offSync(); };
  },
};
const statsServices = createStatsServices({ go, startRun, startRepaso, trapTest }, localProgressRepository, localStudyProgressGateway);
const quizServices = createQuizServices(go, hashPath('home'), () => {
  const current = new URLSearchParams(location.hash.split('?')[1] || '');
  const activity = current.get('dailyTraining');
  const params = new URLSearchParams();
  if (activity && ['activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews'].includes(activity)) params.set('dailyTraining', activity);
  const sessionId = current.get('trainingSessionId'), activityId = current.get('trainingActivityId');
  if (sessionId && activityId) { params.set('trainingSessionId', sessionId); params.set('trainingActivityId', activityId); }
  return hashPath('result') + (params.size ? `?${params}` : '');
}, localQuizProgressGateway);



const failuresServices = createFailuresComposition({
  accountId: localStudyProgressGateway.accountId,
  progressRepository: localProgressRepository,
  loadQuestionMetadata: getMeta,
  loadQuestionIndex: getIndex,
  loadQuestionsById: ids => studyQuestionCatalog.getQuestions(ids),
  failedQuestionIds: falladasIds,
  seenTopics: localStudyProgressGateway.getSeenTopics,
  setReviewed: localStudyProgressGateway.setSyllabusReviewed,
  topicName: studyQuestionCatalog.getTopicName,
  sourceFallbacks: VERIFIED_SOURCES,
  shuffle,
  createPractice: (items, title) => !!createRun({ kind: 'test', feedback: true, items, titulo: title }),
  notify: toast,
  navigateToQuiz: dailyTrainingActivity => go(hashPath('quiz') + (dailyTrainingActivity ? `?dailyTraining=${dailyTrainingActivity}` : '')),
});
const lightningServices = createLightningComposition({
  loadQuestionMetadata: getMeta,
  readQuestionStats: () => localProgressRepository.getStats(),
  loadDueQuestionIds: dueQuestionIds,
  knownQuestionIds: () => Object.keys(studyQuestionCatalog.getMetadataSnapshot() || {}).filter(id => id !== '_by'),
  shuffle,
  loadQuestionsById: ids => studyQuestionCatalog.getQuestions(ids),
  sourceFallbacks: VERIFIED_SOURCES,
  recordAnswer: (questionId, topicId, correct, seconds) => localStudyProgressGateway.recordAnswer(questionId, topicId, correct ? 1 : 0, studyQuestionCatalog.now(), seconds),
  topicName: studyQuestionCatalog.getTopicName,
});
const trapsServices = createTrapsComposition({
  accountId: localStudyProgressGateway.accountId,
  loadQuestionMetadata: getMeta,
  readQuestionStats: () => localProgressRepository.getStats(),
  eligibleQuestionIds: () => { const metadata = studyQuestionCatalog.getMetadataSnapshot(); return metadata ? Object.keys(metadata).filter(id => id !== '_by' && (metadata[id][3] || []).length > 0) : []; },
  loadQuestionsById: ids => studyQuestionCatalog.getQuestions(ids),
  trapIds: Object.keys(TRAMPAS).map(Number),
  shuffle,
  sourceFallbacks: VERIFIED_SOURCES,
  topicName: studyQuestionCatalog.getTopicName,
  readDetectionStats: () => Object.fromEntries(Object.entries(localStudyProgressGateway.getPreferences().tdet || {}).flatMap(([id, value]) => value.length === 2
    ? [[id, [value[0], value[1]] as const]] : [])),
  writeDetectionStats: stats => localStudyProgressGateway.updatePreferences(current => ({ ...current, tdet: Object.fromEntries(Object.entries(stats).map(([id, value]) => [id, [...value]])) })),
});
const readingServices = createReadingComposition({
  accountId: localStudyProgressGateway.accountId,
  onAccountChange: localStudyProgressGateway.onAccountChange,
  loadQuestionMetadata: getMeta,
  readQuestionStats: () => localProgressRepository.getStats(),
  fastQuestionIds: stats => summarizeReadingSpeedFailures(Object.entries(stats).map(([id, record]) => ({ id, lastOutcome: record.lastResult ?? -1, lastReasonCode: record.errorReason }))).questionIds,
  recentQuestionIds: accountId => localReadingQuestionHistoryRepository.readRecentQuestionIds(accountId),
  rememberQuestion: (accountId, questionId) => localReadingQuestionHistoryRepository.rememberQuestion(accountId, questionId),
  availableQuestionIds: () => Object.keys(studyQuestionCatalog.getMetadataSnapshot() || {}).filter(id => id !== '_by'),
  loadQuestionsById: ids => studyQuestionCatalog.getQuestions(ids),
  mixQuestionIds: mixReadingIds,
  shuffle,
  tokenize: readingTokens,
  sourceFallbacks: VERIFIED_SOURCES,
  recordAnswer: (questionId, topicId, correct, timestamp, seconds) => localStudyProgressGateway.recordAnswer(questionId, topicId, correct ? 1 : 0, timestamp, seconds),
  now: studyQuestionCatalog.now,
  currentTime: Date.now,
});


// ───────── arranque ─────────
export function bootAppServices(): () => void {
  return startAppBootstrap({
    onAccountChange: localStudyProgressGateway.onAccountChange,
    goHome: () => go(hashPath('home')),
    recover,
    setAttemptTrackingVisible,
    flushStore: () => { progressStore.flushNow(); },
    flushAttemptTracking,
    saveRun,
    pauseTrainingSession: () => { trainingSession.pauseCurrentActivity(); },
    routeReady: firstReactRouteReady,
    resumeSaved: () => resumeSaved().catch(() => {}),
    prefetchBank: prefetchBanco,
    loadMetadataAndInitializeSync: async () => {
      try { await getMeta(); } catch (error) { console.error(error); }
      try { await sync.init({ temaOf: studyQuestionCatalog.getTopicForQuestion, idsOfTema: studyQuestionCatalog.getAllQuestionIdsForTopic }, progressStore, trainingSession, paperRecall, trainingCalendar, weeklyStudyAgenda, academyStudyProgress); } catch (error) { console.error(error); }
    },
  });
}

// Descarga el banco en segundo plano (2 a la vez) para que Test, Simulacro y Repaso arranquen sin esperar a la red
async function prefetchBanco() { await prefetchQuestionBank(await getIndex()); }

/** Temporary composition only: the React views own rendering and events. */
export const studyServices: StudyServices = {
  academyStudyProgress: {
    accountId: localStudyProgressGateway.accountId,
    subscribe: academyStudyProgress.subscribe,
    async loadTopicProgress(topicId) {
      const account = localStudyProgressGateway.accountId();
      const snapshot = academyStudyProgress.getTopicProgress(topicId);
      if (account !== localStudyProgressGateway.accountId()) throw new Error('La cuenta cambió al cargar el progreso del apartado.');
      return snapshot;
    },
    selectMaterials(topicId, materials) { return !!academyStudyProgress.selectMaterials(topicId, materials); },
    record(event) { return !!academyStudyProgress.record(event); },
  },
  result: {
    getSnapshot() {
      const last = getLastResult(); if (!last) return null;
      const { ses, items, ans, studyStates = [], highlights = [], confidences = [], discardedOptions = [], attemptIds = [] } = last;
      return { score: ses.scorePending ? null : ses.nota, scorePending: !!ses.scorePending, ...(last.scoringPolicy ? { scoringPolicy: last.scoringPolicy } : {}), correct: ses.a, wrong: ses.f, blank: ses.b, consulted: studyStates.filter(state => state === 'revealed').length,
        accuracy: ses.a + ses.f ? pct(ses.a, ses.a + ses.f) : null, seconds: ses.secs, title: ses.titulo || '', interrupted: !!ses.interrupted, kind: ses.kind,
        ...(last.exposureKind ? { exposureKind: last.exposureKind } : {}),
        porTiempo: !!ses.porTiempo, analysis: last.limit && !ses.porTiempo ? createSimulationAnalysisView({ correctIndices: last.items.map(question => question.c), answers: last.ans, answerSeconds: last.times, timeLimitMinutes: last.limit, elapsedSeconds: ses.secs, scoringPolicy: last.scoringPolicy }) : '',
        secondPartAvailable: (ses.titulo || '').includes('Parte 1') && !!simulationRunConfiguration?.includeSecondPart,
        topics: Object.entries(ses.temas).sort(([left], [right]) => left.localeCompare(right)).map(([id, [correct, total]]) => ({ id, name: studyQuestionCatalog.getTopicName(id), correct, total })),
        items: items.map((question, index) => {
          const answer = ans[index], revealed = studyStates[index] === 'revealed';
          return { id: question.i, ...(attemptIds[index] ? { attemptId: attemptIds[index] } : {}), topicId: question.t, topicName: studyQuestionCatalog.getTopicName(question.t), statement: question.q, options: question.a, correctIndex: question.c,
            ...(answer !== undefined ? { answer } : {}), outcome: revealed ? 'revealed' : answer === undefined || answer === -1 ? 'blank' : answer === question.c ? 'correct' : 'wrong',
            notice: questionNotice(question), source: sourceHtml(question, VERIFIED_SOURCES), ...(question.u ? { citation: question.u } : {}), ...(question.n ? { note: question.n } : {}),
            ...(confidences[index] ? { confidence: confidences[index] } : {}), discardedOptions: discardedOptions[index] || [], highlights: highlights[index] || [],
            contentRevision: questionContentRevision(question.q, question.a),
            retryAvailable: last.feedback === true && last.exposureKind !== 'immediate-retry' && !ses.interrupted
              && !!attemptIds[index] && (studyStates[index] === 'answered' || studyStates[index] === 'revealed')
              && !question.np && (Boolean(question.u?.trim()) || Boolean(sourceHtml(question, VERIFIED_SOURCES)))
              && Number.isInteger(question.c) && question.c >= 0 && question.c < question.a.length && question.a.length >= 2 };
        }) };
    },
    subscribe(listener) { const offEngine = subscribeEngine(listener), offStore = localProgressRepository.subscribe(listener); return () => { offEngine(); offStore(); }; },
    continuePartTwo() { go(hashPath('simulationReview')); },
    retryImmediately(questionId: string) {
      const question = getLastResult()?.items.find(item => item.i === questionId);
      const sourceAvailable = !!question && Boolean(question.u?.trim() || sourceHtml(question, VERIFIED_SOURCES));
      if (!sourceAvailable || !startImmediateRetryFromLastResult(questionId, sourceAvailable)) return false;
      go(hashPath('quiz'));
      return true;
    },
    repeatFailures() {
      const last = getLastResult(); if (!last) return false;
      return startRun({ kind: 'rev', feedback: true, items: shuffle(last.items.filter((question, index) => last.ans[index] !== question.c)), titulo: 'Repetición de falladas' });
    },
    goHome() { go(hashPath('home')); },
    async loadStrategy() { return renderStrategyReport(await loadStrategyReportForPeriod(365)); },
    async loadExplanation(item) {
      return findCodeExplanation(item.id, item.statement, [...item.options]);
    },
    getReport(id) { const report = localStudyProgressGateway.getErrorReport(id); return report && { reason: report.reason, note: report.note, state: report.state }; },
    saveReport(id, topicId, reason, note) { localStudyProgressGateway.saveErrorReport({ questionId: id, topicId, reason, note, state: 'abierto', reportedAt: Date.now() }); },
  },
  simulation: {
    getTab() { const value = localStudyProgressGateway.getPreferences().simtab; return value === 'examen' || value === 'tema' ? value : 'completo'; },
    setTab(tab) { localStudyProgressGateway.updatePreferences(current => ({ ...current, simtab: tab })); },
    getConfiguration() {
      const saved = localStudyProgressGateway.getPreferences().sim || {};
      return { count: saved.n === 40 ? 40 : 80, minutes: ([45, 60, 90, 120].includes(saved.min ?? 0) ? saved.min : 90) as SimulationConfiguration['minutes'],
        scope: saved.scope === 'todos' ? 'todos' : 'vistos', origins: saved.o || ['O', 'G'], includeSecondPart: saved.parte2 !== false };
    },
    saveConfiguration(configuration) {
      localStudyProgressGateway.updatePreferences(current => ({ ...current, sim: { n: configuration.count, min: configuration.minutes, o: [...configuration.origins], parte2: configuration.includeSecondPart, scope: configuration.scope } }));
    },
    seenTopics: localStudyProgressGateway.getSeenTopics,
    async loadExamGroups(): Promise<SimulationExamGroups> {
      const metadata = await studyQuestionCatalog.getMetadataIndex();
      const lists = createExamCatalog(metadata, studyQuestionCatalog.getTopicName), sessions = localStudyProgressGateway.getSessions();
      const map = (entries: { k: string; ids: string[]; nombre: string }[]): SimulationExam[] => entries.map(entry => {
        const attempts = sessions.filter(session => session.title === entry.nombre);
        return { id: entry.k, name: entry.nombre, questionCount: entry.ids.length, attempts: attempts.length,
          latest: attempts[0]?.score ?? null, best: attempts.length ? Math.max(...attempts.map(session => session.score)) : null };
      });
      return { official: map(lists.ofi), academy: map(lists.sims), topicTests: map(lists.tests) };
    },
    getSelectedExam() { return localStudyProgressGateway.getPreferences().exsel || null; },
    selectExam(id) { localStudyProgressGateway.updatePreferences(current => ({ ...current, exsel: id })); },
    async startConfigured(configuration, milestone) {
      const account = localStudyProgressGateway.accountId(), index = await getIndex(); await getMeta();
      const seen = localStudyProgressGateway.getSeenTopics(), only = configuration.scope !== 'todos' && seen.length ? new Set(seen) : null;
      if (milestone && !seen.length) return 'empty';
      const origins = new Set(configuration.origins);
      const items = await selectSimulationQuestions(index, origins, configuration.count, only, milestone?.optionsPerQuestion);
      if (account !== localStudyProgressGateway.accountId()) return 'account-changed';
      if (!items.length || (milestone && items.length < configuration.count)) return 'empty';
      simulationRunConfiguration = { includeSecondPart: configuration.includeSecondPart, secondPartMinutes: Math.round(configuration.minutes * 0.45) };
      return startRun({ kind: 'sim', feedback: false, items, limit: configuration.minutes, titulo: milestone ? `Hito · ${milestone.title}` : 'Simulacro · Parte 1', ...(milestone ? { scoringPolicy: milestone.scoringPolicy, milestoneEventId: milestone.eventId } : {}) }) ? 'started' : 'empty';
    },
    async startExam(id, mode) {
      const account = localStudyProgressGateway.accountId(), metadata = await studyQuestionCatalog.getMetadata();
      const lists = createExamCatalog(metadata, studyQuestionCatalog.getTopicName), selected = [...lists.ofi, ...lists.sims, ...lists.tests].find(exam => exam.k === id);
      if (!selected) return 'empty';
      const items = (await studyQuestionCatalog.getQuestions(selected.ids)).filter(question => !(question as Question & { s?: unknown }).s);
      if (account !== localStudyProgressGateway.accountId()) return 'account-changed';
      if (!items.length) return 'empty';
      const started = mode === 'exam'
        ? startRun({ kind: 'sim', feedback: false, items, limit: 90, titulo: selected.nombre })
        : startRun({ kind: 'test', feedback: true, items, titulo: selected.nombre });
      return started ? 'started' : 'empty';
    },
    openExams() { localStudyProgressGateway.updatePreferences(current => ({ ...current, simtab: 'examen' })); go(hashPath('simulation')); },
  },
  simulationReview: {
    async loadChoices(): Promise<ScenarioChoice[]> {
      const scenarios = await studyQuestionCatalog.getScenarios();
      const available = Object.entries(scenarios)
        .filter(([, scenario]) => scenario.questions.filter(question => !(question as Question & { r?: unknown }).r && question.np !== 1).length >= 18 && /libre/i.test(scenario.convocation || '') && !/2018/.test(scenario.convocation || ''));
      const chosen = shuffle(available).slice(0, 2);
      reviewScenarioQuestions = new Map(chosen.map(([id, scenario]) => [id, scenario.questions.filter(question => !(question as Question & { r?: unknown }).r && question.np !== 1).slice(0, 20)]));
      reviewScenarioTexts = new Map(chosen.map(([id, scenario]) => [id, scenario.text]));
      reviewScenarioAccount = localStudyProgressGateway.accountId();
      return chosen.map(([id, scenario]) => ({ id, text: scenario.text.slice(0, 700) + (scenario.text.length > 700 ? '…' : '') }));
    },
    start(id) {
      const items = reviewScenarioQuestions.get(id);
      if (!items?.length || reviewScenarioAccount !== localStudyProgressGateway.accountId()) return 'unavailable';
      const started = startRun({ kind: 'sim', feedback: false, items, limit: simulationRunConfiguration?.secondPartMinutes || 40, supTexto: reviewScenarioTexts.get(id), titulo: 'Simulacro · Parte 2 (supuesto)' });
      return started ? 'started' : 'unavailable';
    },
  },
  test: {
    async loadTopics() {
      const index = await getIndex(); await getMeta();
      const summaries = await progressPorTema(index.temas.map(topic => ({ id: topic.id, name: topic.nombre, total: topic.n })));
      return summaries.map(({ id, name, total, attempted, correct, answerCount }) => ({ id, name, total, attempted, correct, answerCount }));
    },
    loadTopicQuestions: (topicId: string) => studyQuestionCatalog.getTopicQuestions(topicId),
    getConfiguration() {
      const saved = localStudyProgressGateway.getPreferences().test || {};
      return { all: typeof saved.all === 'boolean' ? saved.all : !(saved.sel || []).length, selected: saved.sel || [], count: ([10, 15, 25, 40].includes(saved.n ?? 0) ? saved.n : 15) as TestConfiguration['count'],
        mode: (['nuevas', 'aleatorio', 'falladas', 'dudosas', 'trampas'].includes(saved.mode ?? '') ? saved.mode : 'nuevas') as TestConfiguration['mode'], origins: saved.o || ['O', 'A', 'G'], timed: !!saved.pt,
        minutes: ([10, 20, 30, 45, 60].includes(saved.min ?? 0) ? saved.min : 20) as TestConfiguration['minutes'] };
    },
    saveConfiguration(configuration) {
      localStudyProgressGateway.updatePreferences(current => ({ ...current, test: { all: configuration.all, sel: [...configuration.selected], n: configuration.count, mode: configuration.mode,
        o: [...configuration.origins], pt: configuration.timed ? 1 : 0, min: configuration.minutes } }));
    },
    seenTopics: localStudyProgressGateway.getSeenTopics,
    async start(configuration, options) {
      const account = localStudyProgressGateway.accountId();
      const selected = [...configuration.selected];
      const topics = configuration.all ? (await getIndex()).temas.map(topic => topic.id) : selected;
      if (configuration.mode === 'trampas') {
        const result = await trapTest(configuration.timed ? 300 : configuration.count, undefined, selected.length ? selected : undefined);
        if (account !== localStudyProgressGateway.accountId()) return 'account-changed';
        if (!result.items.length) return 'empty';
        return startRun({ kind: 'test', feedback: true, items: result.items, titulo: 'Mis trampas · ' + result.targets.map(key => TRAMPAS[key] || key).join(', '), ...(configuration.timed ? { limit: configuration.minutes, porTiempo: true } : {}) }, options?.dailyTrainingActivity, options?.trainingActivityReference) ? 'started' : 'empty';
      }
      const items = await selectQuestionsForTopics({ topics, origins: new Set(configuration.origins), mode: configuration.mode, count: configuration.timed ? 300 : configuration.count });
      if (account !== localStudyProgressGateway.accountId()) return 'account-changed';
      if (!items.length) return 'empty';
      return startRun({ kind: 'test', feedback: true, items, titulo: selected.length === 1 ? studyQuestionCatalog.getTopicName(selected[0]) + (configuration.timed ? ` · ${configuration.minutes} min` : '') : 'Test' + (configuration.timed ? ` · ${configuration.minutes} min` : ''), ...(configuration.timed ? { limit: configuration.minutes, porTiempo: true } : {}) }, options?.dailyTrainingActivity, options?.trainingActivityReference) ? 'started' : 'empty';
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
    getFilter() { return String(localStudyProgressGateway.getPreferences().errf || 'abierto'); },
    getReports() { return Object.values(localStudyProgressGateway.getErrorReports()).map(report => ({ id: report.questionId, ts: report.reportedAt, tema: report.topicId, motivo: report.reason, nota: report.note, state: report.state })); },
    subscribe: localProgressRepository.subscribe,
    setFilter(filter) { localStudyProgressGateway.updatePreferences(current => ({ ...current, errf: filter })); },
    async loadContent(ids) {
      const requestedIds = new Set(ids);
      const questionIds = ids.filter(id => !id.startsWith('FC-'));
      const questions = (await studyQuestionCatalog.getQuestions(questionIds)).map(question => ({ id: question.i, origin: ORIGEN[question.o], statement: question.q, options: question.a.map((text, index) => ({ label: LETRAS_OPCION[index], text, correct: index === question.c })), reference: question.u, traps: (question.x || []).map(trap => TRAMPAS[trap] || String(trap)) }));
      const cards = ids.some(id => id.startsWith('FC-')) ? (await allCards()).filter(card => requestedIds.has(card.id)).map(card => ({ id: card.id, question: card.q, answer: card.a, reference: card.ref || null })) : [];
      return { questions, cards };
    },
    setState(id, state) { localStudyProgressGateway.setErrorReportState(id, state); },
    async exportData() {
      const reports = Object.values(localStudyProgressGateway.getErrorReports()).filter(report => report.state !== 'quitado').sort((first, second) => second.reportedAt - first.reportedAt);
      const ids = reports.map(report => report.questionId);
      const questionIds = ids.filter(id => !id.startsWith('FC-'));
      const questions = new Map((await studyQuestionCatalog.getQuestions(questionIds)).map(question => [question.i, question]));
      const cards = ids.some(id => id.startsWith('FC-')) ? new Map((await allCards()).map(card => [card.id, card])) : new Map();
      const errors = reports.map(report => {
        const id = report.questionId;
        const question = questions.get(id), card = cards.get(id);
        return { id, tarjeta: card ? { pregunta: card.q, respuesta: card.a, ref: card.ref || null } : undefined,
          tema: report.topicId, estado: report.state, motivo: report.reason, nota: report.note,
          origen: question ? ORIGEN[question.o] : null, enunciado: question?.q, opciones: question?.a,
          correcta: question ? LETRAS_OPCION[question.c] : null, cita: question?.u || null,
          trampas: (question?.x || []).map(trap => TRAMPAS[trap] || trap) };
      });
      return JSON.stringify({ generado: new Date().toISOString(), errores: errors }, null, 1);
    },
  },
  access: {
    accountId: localStudyProgressGateway.accountId, subscribe(listener) { const offSync = sync.onStatus(listener), offStore = localProgressRepository.subscribe(listener); return () => { offSync(); offStore(); }; },
    async load() { await recover(); return { owner: isOwner(), error: sync.status.accessErr || undefined, requests: sync.status.reqs, grants: sync.status.grants }; },
    approve: async member => await sync.approve(member), reject: async uid => await sync.reject(uid), revoke: async uid => await sync.revoke(uid), confirm: ask, notify: toast,
  },
  markReady: () => routeReady(),
  home: {
    accountId: localStudyProgressGateway.accountId,
    seenTopics: localStudyProgressGateway.getSeenTopics,
    authResolved() { return sync.status.authResolved; },
    getActiveStudy() { const run = getCurrentRun(); return run ? { title: run.titulo || 'Test', position: run.idx, total: run.items.length } : null; },
    getAccess() { return { full: isFull(), level: accessLevel(), greeting: saludo(), state: sync.status.state, configured: sync.status.configured, signedIn: !!sync.status.user, pendingRequests: sync.status.access === 'propietario' ? sync.status.reqs.length : 0 }; },
    subscribe(listener) { const offStore = localProgressRepository.subscribe(listener), offSync = sync.onStatus(listener), offEngine = subscribeEngine(listener); return () => { offStore(); offSync(); offEngine(); }; },
    async loadOverview() {
      await recover(); const account = localStudyProgressGateway.accountId(); const index = await getIndex(); await getMeta();
      const [progress, cardManifest] = await Promise.all([
        getHomeProgressSummary(localProgressRepository),
        fetchJson<{ temas?: Record<string, number> }>('cards/index.json').catch(() => null),
      ]);
      if (account !== localStudyProgressGateway.accountId()) throw new Error('La cuenta cambió mientras se cargaba el resumen de inicio.');
      const metadata = studyQuestionCatalog.getMetadataSnapshot();
      const questionTopicIds = metadata ? index.temas.filter(topic =>
        studyQuestionCatalog.getQuestionIdsForTopic(topic.id).some(id => (metadata[id]?.[3] || []).length > 0),
      ).map(topic => topic.id) : null;
      const cardTopics = cardManifest?.temas;
      const validCardManifest = cardTopics && typeof cardTopics === 'object' && !Array.isArray(cardTopics)
        && Object.values(cardTopics).every(count => Number.isInteger(count) && count >= 0);
      const cardTopicIds = validCardManifest
        ? Object.entries(cardTopics).filter(([, count]) => count > 0).map(([topicId]) => topicId)
        : null;
      const studyContentInventory = { questionTopicIds, cardTopicIds };
      const dueIds = await dueQuestionIds();
      const due = dueIds.length;
      const cardReviews = localCardProgressGateway.getCardReviews();
      const cardDueCount = Object.values(cardReviews).filter(record => record.dueAt <= studyQuestionCatalog.now()).length;
      const failureIds = falladasIds();
      const failureCount = failureIds.length;
      const streak = calculateStudyStreak(progress.answerTimestamps, Date.now());
      const exam = localStudyProgressGateway.getPreferences().exam;
      const daysToExam = daysUntilStudyDate(exam, Date.now());
      const mastery = await dominioTemas(index);
      const trainingPreferences = normalizeTrainingPreferences(localStudyProgressGateway.getPreferences().training);
      const seenTopics = localStudyProgressGateway.getSeenTopics();
      const studiedTopicSet = new Set(seenTopics);
      const studiedTopicIds = [...studiedTopicSet];
      const nextNewTopicEntry = trainingPreferences.academyTopicOrderIds?.length
        ? selectNextAcademyTopic(trainingPreferences.academyTopicOrderIds, index.temas, seenTopics)
        : trainingPreferences.introductionTopicId && !studiedTopicSet.has(trainingPreferences.introductionTopicId)
          ? index.temas.find(topic => topic.id === trainingPreferences.introductionTopicId)
          : undefined;
      const nextNewTopic = nextNewTopicEntry;
      const studiedMastery = filterTopicMasteryToSeen(mastery, studiedTopicIds);
      const studiedWeakTopics = studiedMastery.filter(topic => topic.est === 'r').sort((left, right) => left.score - right.score);
      const recallAssessments = paperRecall.get().filter(item => studiedTopicSet.has(item.topicId));
      const latestRecall = latestPaperRecallByTopic(recallAssessments);
      const selfReportedWeakTopics = [...latestRecall.values()].filter(item => needsPaperRecallFollowUp(item, studyQuestionCatalog.now())).map(item => item.topicId);
      const weakTopicIds = [...new Set([...studiedWeakTopics.map(topic => topic.id), ...selfReportedWeakTopics])];
      const studiedDueCount = dueIds.filter(id => studiedTopicSet.has(studyQuestionCatalog.getTopicForQuestion(id) || '')).length;
      const studiedFailureCount = failureIds.filter(id => studiedTopicSet.has(studyQuestionCatalog.getTopicForQuestion(id) || '')).length;
      const topicForCard = (id: string): string | undefined => {
        const curatedTopic = /^FC-(T\d+\.\d{2})-/.exec(id)?.[1];
        if (curatedTopic) return curatedTopic;
        return id.startsWith('FC-Q-') ? studyQuestionCatalog.getTopicForQuestion(id.slice('FC-Q-'.length)) || undefined : undefined;
      };
      const studiedCardDueCount = Object.entries(cardReviews).filter(([id, record]) => record.dueAt <= studyQuestionCatalog.now()
        && studiedTopicSet.has(topicForCard(id) || '')).length;
      const topicReviewEvidence = studiedMastery.map(topic => ({ topicId: topic.id, topicName: topic.nombre, hasStudyMarker: true, distinctQuestionsAttempted: topic.seen, questionCoverageOfTarget: topic.cob, latestAnswerAccuracy: topic.seen ? topic.prec : null, daysSinceLastQuestionAttempt: topic.dias }));
      const now = Date.now();
      const trainingPlan = buildDailyTrainingPlan({ preferences: trainingPreferences, weekday: new Date(now).getDay(), dateKey: localTrainingDateKey(now), dueCount: studiedDueCount, cardDueCount: studiedCardDueCount, failureCount: studiedFailureCount, weakTopicCount: weakTopicIds.length, weakTopicIds, studiedTopicIds, nextNewTopic: nextNewTopic ? { topicId: nextNewTopic.id, topicName: nextNewTopic.nombre } : undefined,
        topicReviewEvidence });
      return { seen: progress.seen, total: index.n, answers: progress.answers, streak, daysToExam, due,
        completedSessions: localStudyProgressGateway.getSessions().length,
        blocks: BLOQUES.map(([code, name]) => {
          const topics = studiedMastery.filter(topic => topic.id.startsWith(code));
          return { name, total: topics.length, mastered: topics.filter(topic => topic.est === 'g').length,
            assessed: topics.filter(topic => topic.est !== 'n').length };
        }),
        cardsDue: cardDueCount,
        trainingDue: { questions: studiedDueCount, cards: studiedCardDueCount }, trainingFailures:studiedFailureCount,
        quickCount: progress.quickCount, slowCount: progress.slowCount, failures: failureCount,
        studiedTopics: seenTopics.length, topicCount: index.temas.length,
        studiedTopicDetails: index.temas.filter(topic => studiedTopicSet.has(topic.id)).map(topic => ({ id: topic.id, name: topic.nombre })),
        nextNewTopic: nextNewTopic ? { id: nextNewTopic.id, name: nextNewTopic.nombre } : undefined,
        assessedTopics: studiedMastery.filter(topic => topic.est !== 'n').length,
        weakTopics: studiedWeakTopics.length,
        masteredTopics: studiedMastery.filter(topic => topic.est === 'g').length, trainingPlan, trainingSession: trainingSession.getSession(), trainingHistory: trainingSession.getHistory(), paperRecallAssessments: recallAssessments, weakTopicIds, topicReviewEvidence, studyContentInventory,
      };
    },
    startTrainingSession(plan) { return trainingSession.start(plan); },
    startTrainingActivity() { return trainingSession.startCurrentActivity(); },
    pauseTrainingActivity() { return trainingSession.pauseCurrentActivity(); },
    beginTrainingBreak(minutes) { return trainingSession.beginBreak(minutes); },
    endTrainingBreak() { return trainingSession.endBreak(); },
    completeTrainingActivity(activity: TrainingActivity, reference?: TrainingActivityReference) {
      const before = trainingSession.getSession();
      const completed = trainingSession.completeActivity(activity, reference);
      const step = before?.activities[before.currentIndex];
      if (before && completed && completed.currentIndex > before.currentIndex && step) {
        const matchingAgendaItem = findMatchingPlannedAgendaItem(weeklyStudyAgenda.get(), before.dateKey, step);
        if (matchingAgendaItem) weeklyStudyAgenda.setStatus(matchingAgendaItem.id, 'completed');
      }
      return completed;
    },
    recordPaperRecall(topicId: string, rating: PaperRecallRating) { return paperRecall.record(topicId, rating); },
    scheduledStudyActivities() { return trainingCalendar.get(); },
    scheduleStudyActivity(input: Parameters<typeof trainingCalendar.schedule>[0]) { return trainingCalendar.schedule(input); },
    rescheduleStudyActivity(input: Parameters<typeof trainingCalendar.reschedule>[0]) { return trainingCalendar.reschedule(input); },
    weeklyStudyAgenda() { return weeklyStudyAgenda.get(); },
    replaceWeeklyStudyAgendaWeek(weekStart, items) { return weeklyStudyAgenda.replaceWeek(weekStart, items); },
    recoverWeeklyStudyAgenda(proposal) { return weeklyStudyAgenda.recover(proposal); },
    addWeeklyStudyAgendaPlan(proposal) { return weeklyStudyAgenda.addPlan(proposal); },
    setWeeklyStudyAgendaItemStatus(id, status) { return weeklyStudyAgenda.setStatus(id, status); },
    setTrainingReviewMode(topicId: string, mode: StudyReviewMode | null) {
      const preferences = normalizeTrainingPreferences(localStudyProgressGateway.getPreferences().training);
      const reviewModesByTopic = { ...preferences.reviewModesByTopic };
      if (mode) reviewModesByTopic[topicId] = mode;
      else delete reviewModesByTopic[topicId];
      localStudyProgressGateway.updatePreferences(current => ({ ...current, training: { ...preferences, reviewModesByTopic } }));
    },
    quickSession, startReview: (topicIds, dailyTrainingActivity, reference) => startRepaso(topicIds, dailyTrainingActivity, reference), openMenu,
    login: sync.login, requestAccess: async () => await sync.requestAccess(), notify: toast,
  },
  topics: {
    accountId: localStudyProgressGateway.accountId, getStudied: localStudyProgressGateway.getSeenTopics,
    setStudied(ids) { localProgressRepository.saveSeenTopics(ids); }, subscribe: localProgressRepository.subscribe,
    async loadTopics() {
      await recover(); const index = await getIndex(); await getMeta();
      const summaries = await progressPorTema(index.temas.map(topic => ({ id: topic.id, name: topic.nombre, total: topic.n })));
      return summaries.map(({ id, name, total, answered, accuracy }) => ({ id, name, total, answered, accuracy }));
    },
  },
};
