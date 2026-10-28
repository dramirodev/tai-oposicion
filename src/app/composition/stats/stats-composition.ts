import * as store from '../../../adapters/local/legacy-store.js';
import { localProgressRepository } from '../../../adapters/local/progress-repository.js';
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
import { cardMapper } from '../../../adapters/local/mappers/card.js';
import { forecastCardRetention } from '../../../adapters/local/fsrs-card-scheduler.js';
import type { StudyQuestionMetaEntry } from '../../../core/domain/study-catalog.js';

interface StatsActions { go(path: string): void; startRun(run: RunCfg): boolean; startRepaso(): void; trapTest(count: number, traps: number[]): Promise<{ items: QuestionRecord[] }>; }

export function createStatsServices(actions: StatsActions): StatsServices {
  const dominioTemas = createTopicMasteryComposition({ progressRepository: localProgressRepository, accountId: store.accountId, questionIdsForTopic: topicId => studyQuestionCatalog.getMetadataSnapshot()?._by[topicId] || [], now: studyQuestionCatalog.now });
  return {
    async load(): Promise<StatsSnapshot> {
      const account = store.accountId();
      const index = await studyQuestionCatalog.getIndex(); const questionMetadata = await studyQuestionCatalog.getMetadata();
      if (account !== store.accountId()) throw new Error('La cuenta cambió mientras se cargaban las estadísticas.');
      const metadata = Object.fromEntries(Object.entries(questionMetadata).flatMap(([id, entry]) => {
        if (!Array.isArray(entry)) return [];
        const [topicId, origin, type, traps] = entry as StudyQuestionMetaEntry;
        return [[id, { topicId, origin, type, traps }]];
      }));
      const progress = await getProgressStatistics(localProgressRepository, metadata, index.temas.map(topic => ({ id: topic.id, name: topic.nombre, total: topic.n })), studyQuestionCatalog.now());
      if (account !== store.accountId()) throw new Error('La cuenta cambió mientras se cargaban las estadísticas.');
      const sessions = store.getSessions().slice(0, 12);
      const cardReviews = Object.values(store.getCards()).flatMap(record => {
        const mapped = cardMapper.toDomain(record);
        return mapped.ok ? [mapped.value] : [];
      });
      const predictedCardRetention = forecastCardRetention(cardReviews, studyQuestionCatalog.now());
      const speed = progress.speed;
      const domains = (await dominioTemas(index)).map(topic => ({ id: topic.id, name: topic.nombre, accuracy: topic.prec, days: topic.dias, status: topic.est as StatsSnapshot['domains'][number]['status'], reason: topic.why, due: topic.due, score: topic.score }));
      const simulations = simHistory(store.getSessions()).map(session => ({ id: session.id, ts: session.ts, nota: session.nota, part: session.part, dNota: session.dNota, a: session.a, f: session.f, b: session.b, secs: session.secs }));
      return { generatedAt: studyQuestionCatalog.now(), answers: progress.answers, correct: progress.correct, accuracy: progress.accuracy, topics: progress.topics, weakTopics: progress.weakTopics, failureCount: falladasIds().length, sessions, reviewLoad: progress.reviewLoad, predictedCardRetention, failureReasons: progress.failureReasons, lucky: progress.lucky, speed: { count: speed.count, total: speed.total, percent: speed.percent },
        trapRates: Object.entries(progress.traps).filter(([, row]) => row[0] >= 5).map(([id, row]) => ({ id, label: TRAMPAS[id] || id, attempts: row[0], failures: row[1], rate: percentage(row[1], row[0]) })).sort((a, b) => b.rate - a.rate),
        origins: Object.entries(progress.origins).map(([id, row]) => ({ label: ORIGEN[id] || id, answers: row[0], accuracy: percentage(row[1], row[0]) })),
        types: Object.entries(progress.types).map(([id, row]) => ({ id, label: TIPOS[id] || id, answers: row[0], accuracy: percentage(row[1], row[0]) })), domains,
        simulations, slow: progress.slow.map(item => ({ id: item.id, averageSeconds: item.averageSeconds, attempts: item.attempts, correct: item.correct, lastOutcome: item.lastOutcome })) };
    },
    getPreference(key) {
      const cfg = store.getCfg();
      if (key === 'domainOrder') return { order: cfg.dmord === 'frios' ? 'frios' : 'tema' } as Record<string, string | number | boolean>;
      const saved = cfg.evo || {};
      return { mode: saved.m === 'tiempo' ? 'tiempo' : 'acierto', filter: saved.f || 'g', weeks: [8, 12, 26].includes(Number(saved.w)) ? Number(saved.w) : 12, table: !!saved.tabla } as Record<string, string | number | boolean>;
    },
    savePreference(key, value) {
      if (key === 'domainOrder') store.setCfg('dmord', value.order === 'frios' ? 'frios' : 'tema');
      else store.setCfg('evo', { ...(store.getCfg().evo || {}), m: value.mode, f: value.filter, w: value.weeks, tabla: value.table });
    },
    compareSimulations(firstId, secondId) {
      const sessions = store.getSessions(); const first = sessions.find(session => session.id === firstId), second = sessions.find(session => session.id === secondId);
      if (!first || !second) return null;
      const compare = compareSessions(first, second);
      return { scoreDelta: compare.dNota, accuracyDelta: compare.dAcierto, secondsDelta: compare.dSeg,
        topics: compare.rows.map(row => ({ id: row.t, first: row.pa, second: row.pb, delta: row.d })) };
    },
    loadWeekly(filter) { return aggregateWeeks(store.getSessions(), { tema: filter.topic, tipo: filter.type, weeks: filter.weeks }).map(week => ({ start: week.start, n: week.n, ok: week.ok, secs: week.secs, sessions: week.ses, accuracy: week.acierto, secondsPerQuestion: week.segPreg })); },
    loadQuestionEvolution,
    async loadStrategy(days) { return renderStrategyReport(await loadStrategyReportForPeriod(days)); },
    practiceTopics(ids) { const current = store.getCfg().test || { n: 15, o: ['O', 'A', 'G'] }; store.setCfg('test', { sel: ids ? [...ids] : [], n: current.n || 15, mode: 'nuevas', o: current.o || ['O', 'A', 'G'] }); actions.go(hashPath('test')); },
    reviewDue() { actions.startRepaso(); },
    practiceFailures() { actions.go(hashPath('failures')); },
    async practiceTrap(id) { const result = await actions.trapTest(15, [Number(id)]); if (!result.items.length) return 'empty'; return actions.startRun({ kind: 'test', feedback: true, items: [...result.items], titulo: `Trampa: ${TRAMPAS[id] || id}` }) ? 'started' : 'empty'; },
    async practiceSlow(onlyCorrect) { const stats = await localProgressRepository.getStats(); const selected = slowestQuestions(Object.entries(stats).map(([id, stat]) => ({ id, attempts: stat.attempts, correct: stat.correct, lastOutcome: stat.lastResult ?? -1, totalSeconds: stat.secondsStudied ?? 0, timedAnswers: stat.timedAnswers ?? 0 })), { onlyLastCorrect: onlyCorrect, limit: 15 }); const questions = await studyQuestionCatalog.getQuestions(selected.map(item => item.id)); const byId = new Map(questions.map(question => [question.i, question])); const items = selected.map(item => byId.get(item.id)).filter((question): question is QuestionRecord => !!question); if (!items.length) return 'empty'; return actions.startRun({ kind: 'test', feedback: true, items, titulo: 'Preguntas lentas' }) ? 'started' : 'empty'; },
  };
}
