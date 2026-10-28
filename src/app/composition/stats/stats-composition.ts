import type { ProgressRepository } from '../../../core/ports/ProgressRepository.js';
import type { StudyProgressGateway } from '../../../core/ports/StudyProgressGateway.js';
import { createTopicMasteryComposition } from '../topics/topic-mastery-composition.js';
import { aggregateWeeks, simHistory, compareSessions } from '../../../features/stats/analytics-mapper.js';
import { ORIGEN, TRAMPAS, TIPOS } from '../../../shared/presentation/labels.js';
import { percentage } from '../../../shared/presentation/format.js';
import { falladasIds, studyQuestionCatalog } from '../study/study-engine-composition.js';
import { loadQuestionEvolution, loadStrategyReportForPeriod } from './strategy-composition.js';
import { renderStrategyReport } from '../../../features/stats/strategy-view.js';
import type { StatsServices } from '../../../shared/ui/study-services.js';
import type { StatsSnapshot } from '../../../core/application/stats/statistics-model.js';
import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { RunCfg } from '../study/study-engine-composition.js';
import { hashPath } from '../../../shared/navigation/paths.js';
import { getProgressStatistics } from '../../../core/application/stats/get-progress-statistics.js';
import { slowestQuestions } from '../../../core/domain/study-analytics.js';
import { forecastCardRetention } from '../../../adapters/local/fsrs-card-scheduler.js';
import type { StudyQuestionMetaEntry } from '../../../core/domain/study-catalog.js';
import type { LegacySession } from '../../../features/stats/analytics-mapper.js';
import { toLegacyStatsSession } from '../../../features/stats/stats-session-mapper.js';

interface StatsActions { go(path: string): void; startRun(run: RunCfg): boolean; startRepaso(): void; trapTest(count: number, traps: number[]): Promise<{ items: QuestionRecord[] }>; }

export function createStatsServices(actions: StatsActions, progressRepository: ProgressRepository, studyProgress: StudyProgressGateway): StatsServices {
  const dominioTemas = createTopicMasteryComposition({ progressRepository, accountId: studyProgress.accountId, questionIdsForTopic: topicId => studyQuestionCatalog.getMetadataSnapshot()?._by[topicId] || [], now: studyQuestionCatalog.now });
  let sessionsForComparison: LegacySession[] = [];
  return {
    async load(): Promise<StatsSnapshot> {
      const account = studyProgress.accountId();
      const [index, questionMetadata, domainSessions, cardReviews] = await Promise.all([studyQuestionCatalog.getIndex(), studyQuestionCatalog.getMetadata(), progressRepository.getSessions(), progressRepository.getCardReviews()]);
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió mientras se cargaban las estadísticas.');
      const metadata = Object.fromEntries(Object.entries(questionMetadata).flatMap(([id, entry]) => {
        if (!Array.isArray(entry)) return [];
        const [topicId, origin, type, traps] = entry as StudyQuestionMetaEntry;
        return [[id, { topicId, origin, type, traps }]];
      }));
      const progress = await getProgressStatistics(progressRepository, metadata, index.temas.map(topic => ({ id: topic.id, name: topic.nombre, total: topic.n })), studyQuestionCatalog.now());
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió mientras se cargaban las estadísticas.');
      sessionsForComparison = domainSessions.map(toLegacyStatsSession);
      const sessions = sessionsForComparison.slice(0, 12);
      const predictedCardRetention = forecastCardRetention(Object.values(cardReviews), studyQuestionCatalog.now());
      const speed = progress.speed;
      const domains = (await dominioTemas(index)).map(topic => ({ id: topic.id, name: topic.nombre, accuracy: topic.prec, days: topic.dias, status: topic.est as StatsSnapshot['domains'][number]['status'], reason: topic.why, due: topic.due, score: topic.score }));
      const simulations = simHistory(sessionsForComparison).map(session => ({ id: session.id, ts: session.ts, nota: session.nota, part: session.part, dNota: session.dNota, a: session.a, f: session.f, b: session.b, secs: session.secs }));
      return { generatedAt: studyQuestionCatalog.now(), answers: progress.answers, correct: progress.correct, accuracy: progress.accuracy, topics: progress.topics, weakTopics: progress.weakTopics, failureCount: falladasIds().length, sessions, reviewLoad: progress.reviewLoad, predictedCardRetention, failureReasons: progress.failureReasons, lucky: progress.lucky, speed: { count: speed.count, total: speed.total, percent: speed.percent },
        trapRates: Object.entries(progress.traps).filter(([, row]) => row[0] >= 5).map(([id, row]) => ({ id, label: TRAMPAS[id] || id, attempts: row[0], failures: row[1], rate: percentage(row[1], row[0]) })).sort((a, b) => b.rate - a.rate),
        origins: Object.entries(progress.origins).map(([id, row]) => ({ label: ORIGEN[id] || id, answers: row[0], accuracy: percentage(row[1], row[0]) })),
        types: Object.entries(progress.types).map(([id, row]) => ({ id, label: TIPOS[id] || id, answers: row[0], accuracy: percentage(row[1], row[0]) })), domains,
        simulations, slow: progress.slow.map(item => ({ id: item.id, averageSeconds: item.averageSeconds, attempts: item.attempts, correct: item.correct, lastOutcome: item.lastOutcome })) };
    },
    getPreference(key) {
      const cfg = studyProgress.getPreferences();
      if (key === 'domainOrder') return { order: cfg.dmord === 'frios' ? 'frios' : 'tema' } as Record<string, string | number | boolean>;
      const saved = cfg.evo || {};
      return { mode: saved.m === 'tiempo' ? 'tiempo' : 'acierto', filter: saved.f || 'g', weeks: [8, 12, 26].includes(Number(saved.w)) ? Number(saved.w) : 12, table: !!saved.tabla } as Record<string, string | number | boolean>;
    },
    savePreference(key, value) {
      if (key === 'domainOrder') studyProgress.updatePreferences(current => ({ ...current, dmord: value.order === 'frios' ? 'frios' : 'tema' }));
      else studyProgress.updatePreferences(current => ({ ...current, evo: { ...(current.evo || {}), m: value.mode === 'tiempo' ? 'tiempo' : 'acierto', f: typeof value.filter === 'string' ? value.filter : 'g', w: [8, 12, 26].includes(Number(value.weeks)) ? Number(value.weeks) : 12, tabla: value.table === true } }));
    },
    compareSimulations(firstId, secondId) {
      const sessions = sessionsForComparison; const first = sessions.find(session => session.id === firstId), second = sessions.find(session => session.id === secondId);
      if (!first || !second) return null;
      const compare = compareSessions(first, second);
      return { scoreDelta: compare.dNota, accuracyDelta: compare.dAcierto, secondsDelta: compare.dSeg,
        topics: compare.rows.map(row => ({ id: row.t, first: row.pa, second: row.pb, delta: row.d })) };
    },
    async loadWeekly(filter) { const sessions = (await progressRepository.getSessions()).map(toLegacyStatsSession); return aggregateWeeks(sessions, { tema: filter.topic, tipo: filter.type, weeks: filter.weeks, now: studyQuestionCatalog.now() }).map(week => ({ start: week.start, n: week.n, ok: week.ok, secs: week.secs, sessions: week.ses, accuracy: week.acierto, secondsPerQuestion: week.segPreg })); },
    loadQuestionEvolution,
    async loadStrategy(days) { return renderStrategyReport(await loadStrategyReportForPeriod(days)); },
    practiceTopics(ids) { studyProgress.updatePreferences(current => { const test = current.test || { n: 15, o: ['O', 'A', 'G'] as const }; return { ...current, test: { sel: ids ? [...ids] : [], n: test.n || 15, mode: 'nuevas', o: test.o ? [...test.o] : ['O', 'A', 'G'] } }; }); actions.go(hashPath('test')); },
    reviewDue() { actions.startRepaso(); },
    practiceFailures() { actions.go(hashPath('failures')); },
    async practiceTrap(id) { const result = await actions.trapTest(15, [Number(id)]); if (!result.items.length) return 'empty'; return actions.startRun({ kind: 'test', feedback: true, items: [...result.items], titulo: `Trampa: ${TRAMPAS[id] || id}` }) ? 'started' : 'empty'; },
    async practiceSlow(onlyCorrect) { const stats = await progressRepository.getStats(); const selected = slowestQuestions(Object.entries(stats).map(([id, stat]) => ({ id, attempts: stat.attempts, correct: stat.correct, lastOutcome: stat.lastResult ?? -1, totalSeconds: stat.secondsStudied ?? 0, timedAnswers: stat.timedAnswers ?? 0 })), { onlyLastCorrect: onlyCorrect, limit: 15 }); const questions = await studyQuestionCatalog.getQuestions(selected.map(item => item.id)); const byId = new Map(questions.map(question => [question.i, question])); const items = selected.map(item => byId.get(item.id)).filter((question): question is QuestionRecord => !!question); if (!items.length) return 'empty'; return actions.startRun({ kind: 'test', feedback: true, items, titulo: 'Preguntas lentas' }) ? 'started' : 'empty'; },
  };
}
