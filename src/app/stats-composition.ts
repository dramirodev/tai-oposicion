import * as store from '../adapters/local/legacy-store.js';
import { META, getIndex, getMeta, now, byIds } from '../adapters/http/legacy-data.js';
import { dominioTemas } from './legacy-topic-mastery.js';
import { aggregateWeeks, slowList, simHistory, compareSessions, cargaRepasos, motivosFallo, suertes, velocidad } from '../features/stats/analytics-mapper.js';
import { ORIGEN, TRAMPAS, TIPOS } from '../shared/presentation/labels.js';
import { percentage } from '../shared/presentation/format.js';
import { falladasIds } from '../core/application/legacy-engine.js';
import { loadQuestionEvolution, loadStrategyReportForPeriod } from './strategy-composition.js';
import { renderStrategyReport } from '../features/stats/strategy-view.js';
import type { StatsServices } from '../shared/ui/study-services.js';
import type { StatsSnapshot } from '../core/application/stats/statistics-model.js';
import { summarizeTopicProgress } from '../core/application/stats/summarize-topic-progress.js';
import type { QuestionRecord } from '../core/domain/question-record.js';
import type { RunCfg } from '../core/application/legacy-engine.js';
import { hashPath } from '../shared/navigation/paths.js';
import { aggregateQuestionPerformance } from '../core/application/stats/aggregate-question-performance.js';

interface StatsActions { go(path: string): void; startRun(run: RunCfg): boolean; startRepaso(): void; trapTest(count: number, traps: number[]): Promise<{ items: QuestionRecord[] }>; }

export function createStatsServices(actions: StatsActions): StatsServices {
  return {
    async load(): Promise<StatsSnapshot> {
      const account = store.accountId();
      const index = await getIndex(); await getMeta();
      if (account !== store.accountId()) throw new Error('La cuenta cambió mientras se cargaban las estadísticas.');
      const stats = store.getStats();
      const performance = aggregateQuestionPerformance(Object.entries(stats).flatMap(([id, record]) => {
        const meta = META[id];
        return meta ? [{ topicId: meta[0], attempts: record[0], correct: record[1], origin: meta[1], type: meta[2], traps: meta[3] }] : [];
      }));
      const topicProgress = summarizeTopicProgress(performance.topicProgress, index.temas.map(topic => ({ id: topic.id, name: topic.nombre, total: topic.n })));
      const sessions = store.getSessions().slice(0, 12);
      const reviewLoad = cargaRepasos(stats, now(), 14), failureReasons = motivosFallo(stats), speed = velocidad(stats);
      const domains = dominioTemas(index).map(topic => ({ id: topic.id, name: topic.nombre, accuracy: topic.prec, days: topic.dias, status: topic.est as StatsSnapshot['domains'][number]['status'], reason: topic.why, due: topic.due, score: topic.score }));
      const simulations = simHistory(store.getSessions()).map(session => ({ id: session.id, ts: session.ts, nota: session.nota, part: session.part, dNota: session.dNota, a: session.a, f: session.f, b: session.b, secs: session.secs }));
      return { generatedAt: now(), ...topicProgress, failureCount: falladasIds().length, sessions, reviewLoad, failureReasons, lucky: suertes(stats), speed: { count: speed.n, total: speed.tot, percent: speed.p },
        trapRates: Object.entries(performance.traps).filter(([, row]) => row[0] >= 5).map(([id, row]) => ({ id, label: TRAMPAS[id] || id, attempts: row[0], failures: row[1], rate: percentage(row[1], row[0]) })).sort((a, b) => b.rate - a.rate),
        origins: Object.entries(performance.origins).map(([id, row]) => ({ label: ORIGEN[id] || id, answers: row[0], accuracy: percentage(row[1], row[0]) })),
        types: Object.entries(performance.types).map(([id, row]) => ({ id, label: TIPOS[id] || id, answers: row[0], accuracy: percentage(row[1], row[0]) })), domains,
        simulations, slow: slowList(stats, { limit: 15 }).map(item => ({ id: item.id, averageSeconds: item.avg, attempts: item.n, correct: item.ok, lastOutcome: item.last })) };
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
    async practiceSlow(onlyCorrect) { const stats = store.getStats(); const selected = slowList(stats, { soloAcertadas: onlyCorrect, limit: 15 }); const questions = await byIds(selected.map(item => item.id)); const byId = new Map(questions.map(question => [question.i, question])); const items = selected.map(item => byId.get(item.id)).filter((question): question is QuestionRecord => !!question); if (!items.length) return 'empty'; return actions.startRun({ kind: 'test', feedback: true, items, titulo: 'Preguntas lentas' }) ? 'started' : 'empty'; },
  };
}
