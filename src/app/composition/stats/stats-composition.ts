import { isStudyQuestionEligible } from '../../../core/domain/selection.js';
import { questionRecordSemanticRevision } from '../../../core/domain/attempts/question-semantic-revision.js';
import { readTrainingSessionHistory } from '../../../adapters/local/training-session.js';
import { summarizePlannedStudyHistory } from '../../../core/application/stats/planned-study-metrics.js';
import type { MetricsQuery } from '../../../core/application/stats/metrics-query.js';
import { hasActiveRun } from '../study/study-engine-composition.js';
import { loadDetailedMetrics } from '../../../core/application/stats/load-detailed-metrics.js';
import { questionContentRevision } from '../../../core/domain/attempts/highlights.js';
import { isQuestionEditoriallyQuarantined } from '../../../core/domain/question-review-overrides.js';
import type { ProgressRepository } from '../../../core/ports/ProgressRepository.js';
import type { StudyProgressGateway } from '../../../core/ports/StudyProgressGateway.js';
import { createTopicMasteryComposition } from '../topics/topic-mastery-composition.js';
import { aggregateWeeks, simHistory, compareSessions } from '../../../features/stats/analytics-mapper.js';
import { ORIGEN, TRAMPAS, TIPOS } from '../../../shared/presentation/labels.js';
import { percentage } from '../../../shared/presentation/format.js';
import { falladasIds, studyQuestionCatalog } from '../study/study-engine-composition.js';
import { loadStudyActivity, loadStrategyReportForPeriod } from './strategy-composition.js';
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
import { localAttemptRepository } from '../../../adapters/local/attempt-repository.js';
import type { AttemptRepository } from '../../../core/ports/AttemptRepository.js';
import { academyCurriculumTopicLoaders } from '../../../core/domain/academy-curriculum.generated.js';
import { publishedAcademyQuestionSectionManifest } from '../../../core/domain/academy-question-section-map.published.js';
import { parsePublishedSectionManifest } from '../../../core/domain/academy-section-evidence.js';
import { loadAcademySectionPerformance } from '../../../core/application/stats/load-academy-section-performance.js';
import type { AcademyCurriculumTopic } from '../../../core/domain/academy-curriculum-types.js';
import type { Question } from '../../../core/domain/entities.js';

interface AcademySectionPerformanceOptions {
  repository?: Pick<AttemptRepository, 'getScopePage'> & Partial<Pick<AttemptRepository, 'getSession' | 'getEvents'>>;
  manifest?: unknown;
  loadQuestions?: (ids: readonly string[]) => Promise<readonly Question[]>;
  loadTopic?: (topicId: string) => Promise<AcademyCurriculumTopic | undefined>;
}

interface StatsActions { go(path: string): void; startRun(run: RunCfg): boolean; startRepaso(): void; trapTest(count: number, traps: number[]): Promise<{ items: QuestionRecord[] }>; }

export function createStatsServices(actions: StatsActions, progressRepository: ProgressRepository, studyProgress: StudyProgressGateway, sectionPerformanceOptions: AcademySectionPerformanceOptions = {}): StatsServices {
  const dominioTemas = createTopicMasteryComposition({ progressRepository, accountId: studyProgress.accountId, questionIdsForTopic: topicId => studyQuestionCatalog.getMetadataSnapshot()?._by[topicId] || [], now: studyQuestionCatalog.now });
  const publishedManifest = sectionPerformanceOptions.manifest ?? publishedAcademyQuestionSectionManifest;
  const loadSectionPerformance = (query?: MetricsQuery) => loadAcademySectionPerformance({
    manifest: publishedManifest,
    accountId: studyProgress.accountId,
    repository: sectionPerformanceOptions.repository ?? localAttemptRepository,
    loadQuestions: sectionPerformanceOptions.loadQuestions ?? (async ids => (await studyQuestionCatalog.getQuestions([...ids])).flatMap(row => [{
      id:row.i, topicId:row.t, origin:row.o, statement:row.q, options:row.a, correctIndex:row.c, context:row.cp, assumptionText:row.supTexto, citation:row.u, source:row.source,
    }])),
    loadTopic: sectionPerformanceOptions.loadTopic ?? (async topicId => {
      const loader = academyCurriculumTopicLoaders[topicId];
      return loader ? (await loader()).academyCurriculumTopic : undefined;
    }),
  }, query);
  let sessionsForComparison: LegacySession[] = [];
  return {
    accountId: studyProgress.accountId,
    onAccountChange: studyProgress.onAccountChange,
    onMetricsChange(listener) {
      const stopAttempts = localAttemptRepository.subscribe(studyProgress.accountId() || 'guest', listener);
      const stopProgress = progressRepository.subscribe(listener);
      return () => { stopAttempts(); stopProgress(); };
    },
    async loadCatalogueCoverage(query, practicedIds) {
      const account = studyProgress.accountId();
      const index = await studyQuestionCatalog.getIndex();
      const topics = index.temas.filter(topic => !query.topicId || query.topicId === topic.id);
      const origins = new Set<QuestionRecord['o']>(query.origin === 'O' || query.origin === 'A' || query.origin === 'G' ? [query.origin] : ['O', 'A', 'G']);
      const eligible = new Map<string, QuestionRecord>();
      for (const topic of topics) {
        const questions = await studyQuestionCatalog.getTopicQuestions(topic.id);
        if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió al comprobar la cobertura.');
        for (const question of questions) if (isStudyQuestionEligible(question, origins, query.mode ?? 'practice')) eligible.set(question.i, question);
      }
      const practiced = new Set(practicedIds.filter(id => eligible.has(id))).size;
      const revision = questionContentRevision(JSON.stringify([...eligible.values()].map(question => [question.i, questionRecordSemanticRevision(question)])), []);
      const manifest = parsePublishedSectionManifest(publishedManifest);
      if (!manifest) throw new Error('La publicación editorial no cumple el formato esperado.');
      let approvedLinks = 0, staleLinks = 0;
      if (manifest?.links.length) {
        const selected = { ...manifest, links: manifest.links.filter(link => eligible.has(link.questionId)) };
        const current = await loadAcademySectionPerformance({ manifest: selected, accountId: studyProgress.accountId,
          repository: { getScopePage: async () => ({ attempts: [], nextCursor: null }) },
          loadQuestions: async ids => ids.flatMap(id => {
            const row = eligible.get(id);
            return row ? [{ id: row.i, topicId: row.t, origin: row.o, statement: row.q, options: row.a, correctIndex: row.c,
              context: row.cp, assumptionText: row.supTexto, citation: row.u, source: row.source }] : [];
          }),
          loadTopic: sectionPerformanceOptions.loadTopic ?? (async topicId => {
            const loader = academyCurriculumTopicLoaders[topicId];
            return loader ? (await loader()).academyCurriculumTopic : undefined;
          }),
        });
        if (current.status === 'ready') approvedLinks = current.rows.reduce((sum, row) => sum + row.linkedQuestions, 0);
        if ('staleLinks' in current) staleLinks = current.staleLinks;
      }
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió al comprobar la vinculación.');
      return { eligible: eligible.size, practiced, percent: eligible.size ? 100 * practiced / eligible.size : null, revision,
        approvedLinks, approvedPercent: eligible.size ? 100 * approvedLinks / eligible.size : null, staleLinks, manifestRevision: manifest?.revision };

    },
    async loadMetrics(query) {
      const account = studyProgress.accountId();
      const metadata = await studyQuestionCatalog.getMetadataIndex();
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió al cargar el catálogo.');
      const entries = Object.entries(metadata).flatMap(([id, entry]) => Array.isArray(entry) && !entry[5] && !isQuestionEditoriallyQuarantined(id)
        ? [[id, { topicId: entry[0] as string, origin: entry[1] as string }] as const] : []);
      const metrics = await loadDetailedMetrics({ repository: localAttemptRepository, accountId: studyProgress.accountId, query,
        questions: new Map(entries), catalogueRevision: questionContentRevision(JSON.stringify(entries), []), now: studyQuestionCatalog.now() });
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió al cargar la planificación histórica.');
      return { ...metrics, planning: summarizePlannedStudyHistory(readTrainingSessionHistory(account), query) };
    },
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
      const sessionTopics = new Map(domainSessions.map(session => [session.id, Object.keys(session.topicResults)]));
      sessionsForComparison = domainSessions.map(toLegacyStatsSession);
      const sessions = sessionsForComparison.slice(0, 12).map(session => ({ ...session, topicIds: sessionTopics.get(session.id) ?? [], scorePending: session.scorePending }));
      const predictedCardRetention = forecastCardRetention(Object.values(cardReviews), studyQuestionCatalog.now());
      const speed = progress.speed;
      const domains = (await dominioTemas(index)).map(topic => ({ id: topic.id, name: topic.nombre, accuracy: topic.prec, days: topic.dias, status: topic.est as StatsSnapshot['domains'][number]['status'], reason: topic.why, due: topic.due, score: topic.score }));
      const simulations = simHistory(sessionsForComparison).map(session => ({ id: session.id, ts: session.ts, topicIds: sessionTopics.get(session.id) ?? [], nota: session.nota, part: session.part, dNota: session.dNota, a: session.a, f: session.f, b: session.b, secs: session.secs, ...(session.scoringPolicy ? { scoringPolicy: session.scoringPolicy } : {}) }));
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió mientras se cargaban las estadísticas.');
      return { generatedAt: studyQuestionCatalog.now(), answers: progress.answers, correct: progress.correct, accuracy: progress.accuracy, topics: progress.topics, weakTopics: progress.weakTopics, failureCount: falladasIds().length, sessions, reviewLoad: progress.reviewLoad, cardReviewStatus: { recorded: Object.keys(cardReviews).length, dueNow: Object.values(cardReviews).filter(card => card.dueAt <= studyQuestionCatalog.now()).length, withFsrs: Object.values(cardReviews).filter(card => card.fsrs).length }, predictedCardRetention, failureReasons: progress.failureReasons, lucky: progress.lucky, speed: { count: speed.count, total: speed.total, percent: speed.percent },
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
    async loadQuestionStatements(questionIds, expectedSemanticRevisions) {
      const account = studyProgress.accountId();
      const questions = await studyQuestionCatalog.getQuestions([...new Set(questionIds)]);
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió al cargar el detalle.');
      return questions.map(question => ({ id: question.i, statement: question.q, ...(expectedSemanticRevisions ? { currentCompatible: expectedSemanticRevisions[question.i] === questionRecordSemanticRevision(question) } : {}) }));
    },
    getApprovedSectionLinkCount() { return parsePublishedSectionManifest(publishedManifest)?.links.length ?? -1; },
    loadAcademySectionPerformance: loadSectionPerformance,
    async practiceSectionErrors(sectionId, query) {
      if (hasActiveRun()) return 'active-session';
      const account = studyProgress.accountId();
      const performance = await loadSectionPerformance(query);
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió al preparar el repaso.');
      if (performance.status !== 'ready') return 'empty';
      const row = performance.rows.find(value => value.sectionId === sectionId);
      const ids = [...new Set(query.mode ? row?.errorQuestions?.[query.mode] ?? []
        : [...(row?.errorQuestions?.practice ?? []), ...(row?.errorQuestions?.simulation ?? [])])];
      const questions = await studyQuestionCatalog.getQuestions(ids);
      if (account !== studyProgress.accountId()) throw new Error('La cuenta cambió al preparar el repaso.');
      if (hasActiveRun()) return 'active-session';
      const approved = parsePublishedSectionManifest(publishedManifest);
      const expected = new Map(approved?.links.map(link => [link.questionId, link.semanticRevision]));
      const selectedIds = new Set(ids);
      const items = questions.filter(question => selectedIds.has(question.i) && !question.r && !isQuestionEditoriallyQuarantined(question.i)
        && expected.get(question.i) === questionRecordSemanticRevision(question));
      if (!items.length) return 'empty';
      return actions.startRun({ kind: 'test', feedback: true, items, titulo: `Errores del apartado · ${row?.title ?? sectionId}` }) ? 'started' : 'empty';
    },
    async loadWeekly(filter) { const sessions = (await progressRepository.getSessions()).map(toLegacyStatsSession); return aggregateWeeks(sessions, { tema: filter.topic, tipo: filter.type, weeks: filter.weeks, now: studyQuestionCatalog.now() }).map(week => ({ start: week.start, n: week.n, ok: week.ok, secs: week.secs, sessions: week.ses, accuracy: week.acierto, secondsPerQuestion: week.segPreg })); },
    loadStudyActivity,
    async loadStrategy(days) { return renderStrategyReport(await loadStrategyReportForPeriod(days)); },
    practiceTopics(ids, origin) { studyProgress.updatePreferences(current => { const test = current.test || { n: 15, o: ['O', 'A', 'G'] as const }; return { ...current, test: { sel: ids ? [...ids] : [], n: test.n || 15, mode: 'nuevas', o: origin ? [origin] : test.o ? [...test.o] : ['O', 'A', 'G'] } }; }); actions.go(hashPath('test')); },
    reviewDue() { actions.startRepaso(); },
    practiceFailures() { actions.go(hashPath('failures')); },
    async practiceTrap(id) { const result = await actions.trapTest(15, [Number(id)]); if (!result.items.length) return 'empty'; return actions.startRun({ kind: 'test', feedback: true, items: [...result.items], titulo: `Trampa: ${TRAMPAS[id] || id}` }) ? 'started' : 'empty'; },
    async practiceSlow(onlyCorrect) { const stats = await progressRepository.getStats(); const selected = slowestQuestions(Object.entries(stats).map(([id, stat]) => ({ id, attempts: stat.attempts, correct: stat.correct, lastOutcome: stat.lastResult ?? -1, totalSeconds: stat.secondsStudied ?? 0, timedAnswers: stat.timedAnswers ?? 0 })), { onlyLastCorrect: onlyCorrect, limit: 15 }); const questions = await studyQuestionCatalog.getQuestions(selected.map(item => item.id)); const byId = new Map(questions.map(question => [question.i, question])); const items = selected.map(item => byId.get(item.id)).filter((question): question is QuestionRecord => !!question); if (!items.length) return 'empty'; return actions.startRun({ kind: 'test', feedback: true, items, titulo: 'Preguntas lentas' }) ? 'started' : 'empty'; },
  };
}
