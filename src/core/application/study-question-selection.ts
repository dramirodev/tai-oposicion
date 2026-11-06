import { analyzeTopicMastery } from '../domain/topic-mastery.js';
import {
  estimateQuickQuestionCount,
  filterScoringQuestions,
  isQuestionAllowed,
  pickGuestQuestions,
  pickQuickQuestions,
  composeWeightedQuestions,
  questionPriority,
  shuffleItems,
} from '../domain/selection.js';
import { isQuestionEditoriallyQuarantined, isEditorialQuarantineActive } from '../domain/question-review-overrides.js';
import { hasPendingFailure, questionReviewDueAt, selectSpacedReviews } from '../domain/spaced-repetition.js';
import { calculateTrapRates, selectTrapQuestions } from '../domain/traps.js';
import type { QuestionRecord } from '../domain/question-record.js';
import type { StudyCatalogIndex } from '../domain/study-catalog.js';
import type { GuestQuestionHistoryRepository } from '../ports/GuestQuestionHistoryRepository.js';
import type { StudyProgressGateway } from '../ports/StudyProgressGateway.js';
import type { StudyQuestionCatalog } from '../ports/StudyQuestionCatalog.js';

type Question = QuestionRecord;
export interface StudyQuestionSelection { items: Question[]; titulo: string }

const emptyGuestQuestionHistory: GuestQuestionHistoryRepository = {
  readRecentQuestionIds: () => [],
  saveRecentQuestionIds: () => {},
};

export function createStudyQuestionSelection(
  progress: StudyProgressGateway,
  catalog: StudyQuestionCatalog,
) {
  const origins = (): Set<string> => new Set(progress.getPreferences().test?.o || ['O', 'A', 'G']);
  const questionAllowed = (question: Question, allowedOrigins: ReadonlySet<string>): boolean =>
    isQuestionAllowed(question.o, question.r, allowedOrigins)
      && !isEditorialQuarantineActive(question);

  async function loadQuestionsInRequestedOrder(ids: readonly string[]): Promise<Question[]> {
    if (!ids.length) return [];
    const loaded = await catalog.getQuestions([...ids]);
    const byId = new Map(loaded.map(question => [question.i, question]));
    return ids.flatMap(id => {
      const question = byId.get(id);
      return question ? [question] : [];
    });
  }

  async function verifyPendingEditorialStats(): Promise<void> {
    const ids = Object.keys(progress.getAllQuestionStats()).filter(isQuestionEditoriallyQuarantined);
    if (ids.length) {
      try { await catalog.getQuestions(ids); } catch { /* Unavailable content stays quarantined. */ }
    }
  }

  async function dueQuestionIds(): Promise<string[]> {
    await catalog.getMetadata();
    await verifyPendingEditorialStats();
    const timestamp = catalog.now();
    return Object.entries(progress.getAllQuestionStats())
      .map(([id, statistics]) => ({ id, dueAt: questionReviewDueAt(statistics) }))
      .filter((entry): entry is { id: string; dueAt: number } => entry.dueAt !== undefined
        && entry.dueAt <= timestamp
        && !!catalog.getTopicForQuestion(entry.id)
        && !isQuestionEditoriallyQuarantined(entry.id))
      .sort((left, right) => left.dueAt - right.dueAt)
      .map(entry => entry.id);
  }

  // Candidate IDs must reach the loader on cold entry; only loaded content can
  // distinguish an old quarantined record from its approved correction.
  const failedQuestionCandidateIds = (): string[] => Object.entries(progress.getAllQuestionStats())
    .filter(([id, stats]) => catalog.getTopicForQuestion(id) && hasPendingFailure(stats))
    .map(([id]) => id);
  const falladasIds = (): string[] => failedQuestionCandidateIds().filter(id => !isQuestionEditoriallyQuarantined(id));

  async function quickGuest(
    index: StudyCatalogIndex,
    count: number,
    allowedOrigins: Set<string>,
    history: GuestQuestionHistoryRepository,
  ): Promise<Question[]> {
    const recentIds = history.readRecentQuestionIds();
    const topics = shuffleItems(index.temas, Math.random).slice(0, count + 3);
    const pools = (await Promise.all(topics.map(topic => catalog.getTopicQuestions(topic.id)))).map((questions, topicIndex) => ({
      topicId: topics[topicIndex].id,
      questions: filterScoringQuestions(
        questions.filter(question => questionAllowed(question, allowedOrigins)),
        true,
        question => question.np,
      ),
    }));
    const items = pickGuestQuestions(pools, count, question => question.i, id => !!progress.getQuestionStats(id), new Set(recentIds), Math.random);
    history.saveRecentQuestionIds([...recentIds, ...items.map(item => item.i)].slice(-300));
    return items;
  }

  async function quickItems(
    full: boolean,
    history: GuestQuestionHistoryRepository = emptyGuestQuestionHistory,
  ): Promise<StudyQuestionSelection | { items: []; titulo: '' }> {
    const index = await catalog.getIndex();
    await catalog.getMetadata();
    const statistics = Object.values(progress.getAllQuestionStats());
    const count = estimateQuickQuestionCount(statistics.map(item => ({
      totalSeconds: item.secondsStudied || 0,
      count: item.timedAnswers || 0,
    })));
    const allowedOrigins = origins();
    if (!full) return { items: await quickGuest(index, count, allowedOrigins, history), titulo: 'Sesión rápida · una pregunta por tema' };

    const due = (await loadQuestionsInRequestedOrder((await dueQuestionIds()).slice(0, count)))
      .filter(question => questionAllowed(question, allowedOrigins));
    const seenTopics = new Set(progress.getSeenTopics());
    const statusOrder = { red: 0, yellow: 1, new: 2, green: 3 } as const;
    const statusCode = { new: 'new', red: 'red', yellow: 'yellow', green: 'green' } as const;
    const topicPriorities = analyzeTopicMastery(
      index.temas.map(topic => ({ ...topic, questionCount: topic.n })),
      topicId => catalog.getMetadataSnapshot()?._by[topicId] || [],
      questionId => {
        const item = progress.getQuestionStats(questionId);
        return item ? {
          attempts: item.attempts, correct: item.correct, lastSeenAt: item.lastSeenAt,
          intervalStep: item.intervalStep, dueAt: item.dueAt, lastResult: item.lastResult,
        } : undefined;
      },
      catalog.now(),
    ).map(result => ({ id: result.topic.id, status: statusCode[result.status], daysSinceLastSeen: result.daysSinceLastSeen }));
    let topics = topicPriorities.filter(topic => !seenTopics.size || seenTopics.has(topic.id));
    if (!topics.length) topics = topicPriorities;
    topics = shuffleItems(topics, Math.random);
    topics.sort((left, right) => statusOrder[left.status] - statusOrder[right.status]
      || ((right.daysSinceLastSeen ?? 0) - (left.daysSinceLastSeen ?? 0)));
    const pools: Question[][] = [];
    for (const questions of await Promise.all(topics.slice(0, 8).map(item => catalog.getTopicQuestions(item.id)))) {
      pools.push(shuffleItems(questions.filter(question => questionAllowed(question, allowedOrigins)
        && !progress.getQuestionStats(question.i)), Math.random));
    }
    const items = pickQuickQuestions(due, pools, count, question => question.i, Math.random);
    const dueCount = items.filter(item => progress.getQuestionStats(item.i)).length;
    return { items, titulo: `Sesión rápida · ${dueCount} repasos + ${items.length - dueCount} nuevas` };
  }

  async function repasoItems(topicIds?: readonly string[]): Promise<StudyQuestionSelection> {
    await catalog.getMetadata();
    await verifyPendingEditorialStats();
    const timestamp = catalog.now();
    const seenTopics = new Set(progress.getSeenTopics());
    const allowedTopics = topicIds
      ? new Set(topicIds.filter(topicId => seenTopics.has(topicId)))
      : null;
    const candidates: { id: string; topicId: string; dueAt: number }[] = [];
    for (const [id, statistics] of Object.entries(progress.getAllQuestionStats())) {
      const topicId = catalog.getTopicForQuestion(id);
      const dueAt = questionReviewDueAt(statistics);
      if (dueAt !== undefined && dueAt <= timestamp && topicId && !isQuestionEditoriallyQuarantined(id) && (!allowedTopics || allowedTopics.has(topicId))) {
        candidates.push({ id, topicId, dueAt });
      }
    }
    const ids = selectSpacedReviews(candidates.map(item => ({ topicId: item.topicId, dueAt: item.dueAt, item })), 30)
      .map(review => review.item.id);
    const items = await loadQuestionsInRequestedOrder(ids);
    return {
      items: items.filter(question => !isEditorialQuarantineActive(question)),
      titulo: 'Repaso de fallos · más vencidas primero, temas mezclados',
    };
  }

  async function selectQuestionsForTopics(
    options: { topics: string[]; origins: ReadonlySet<Question['o']>; mode: string; count: number },
    random: () => number = Math.random,
  ): Promise<Question[]> {
    const questions = (await Promise.all(options.topics.map(topicId => catalog.getTopicQuestions(topicId))))
      .flat()
      .filter(question => questionAllowed(question, options.origins));
    let prioritized = shuffleItems(questions, random)
      .map(question => [questionPriority(options.mode, progress.getQuestionStats(question.i)), question] as const);
    if (options.mode === 'falladas' || options.mode === 'dudosas') prioritized = prioritized.filter(([priority]) => priority === 0);
    else if (options.mode === 'nuevas') {
      prioritized.sort(([leftPriority, leftQuestion], [rightPriority, rightQuestion]) => leftPriority - rightPriority
        || (progress.getQuestionStats(leftQuestion.i)?.lastSeenAt ?? 0) - (progress.getQuestionStats(rightQuestion.i)?.lastSeenAt ?? 0));
    }
    return prioritized.slice(0, options.count).map(([, question]) => question);
  }

  async function selectWeightedSimulationQuestions(
    topics: readonly { id: string; weight?: number }[],
    allowedOrigins: ReadonlySet<Question['o']>,
    count: number,
    random: () => number = Math.random,
    acceptQuestion: (question: Question) => boolean = () => true,
  ): Promise<Question[]> {
    const questionsByTopic = await Promise.all(topics.map(topic => catalog.getTopicQuestions(topic.id)));
    const pools = Object.fromEntries(topics.map((topic, index) => {
      const available = shuffleItems(
        questionsByTopic[index].filter(question => questionAllowed(question, allowedOrigins)
          && acceptQuestion(question)
          && (question.o !== 'G' || question.v === 0)
          && question.np !== 1
          && question.p !== 1),
        random,
      );
      // Within each exposure tier, rotate the selected sources so a large pool
      // of generated questions does not crowd out official or academy questions.
      const origins = shuffleItems([...allowedOrigins], random);
      const buckets = new Map(origins.map(origin => [origin, { fresh: [] as Question[], seen: [] as Question[] }]));
      for (const question of available) {
        const tier = progress.getQuestionStats(question.i) ? 'seen' : 'fresh';
        buckets.get(question.o)![tier].push(question);
      }
      const ordered: Question[] = [];
      for (const tier of ['fresh', 'seen'] as const) {
        const queues = [...buckets.values()].map(bucket => bucket[tier]);
        const largest = Math.max(0, ...queues.map(queue => queue.length));
        for (let round = 0; round < largest; round++) {
          for (const queue of queues) if (round < queue.length) ordered.push(queue[round]);
        }
      }
      return [topic.id, ordered];
    }));
    return composeWeightedQuestions(topics, pools, count, random, question => question.f || question.i);
  }

  async function trapTest(
    itemCount: number,
    only?: (number | string)[],
    topics?: string[],
  ): Promise<{ items: Question[]; targets: (number | string)[] }> {
    await catalog.getMetadata();
    const statistics = progress.getAllQuestionStats();
    const rates = calculateTrapRates(
      Object.fromEntries(Object.entries(statistics).map(([id, record]) => [id, { attempts: record.attempts, correct: record.correct }])),
      id => catalog.getMetadataSnapshot()?.[id]?.[3] || [],
      5,
    ).filter(rate => rate.errorCount > 0);
    const targets = only || rates.slice(0, 3).map(rate => +rate.trapId);
    if (!targets.length) return { items: [], targets };
    const targetIds = new Set(targets.map(Number));
    const topicFilter = topics?.length ? new Set(topics) : null;
    const metadata = catalog.getMetadataSnapshot()!;
    const ids = Object.keys(metadata).filter(id => id !== '_by'
      && (!topicFilter || topicFilter.has(metadata[id][0]))
      && (metadata[id][3] || []).some((key: number | string) => targetIds.has(+key)));
    const candidates = (await catalog.getQuestions(ids)).filter(question => questionAllowed(question, origins()));
    const items = selectTrapQuestions(
      candidates.map(question => ({ id: question.i, trapIds: question.x || [], question })),
      id => {
        const item = progress.getQuestionStats(id);
        return item ? { lastResult: item.lastResult } : undefined;
      },
      targets,
      itemCount,
      Math.random,
    ).map(candidate => candidate.question);
    return { items, targets };
  }

  return { dueQuestionIds, falladasIds, failedQuestionCandidateIds, quickItems, repasoItems, selectQuestionsForTopics, selectWeightedSimulationQuestions, trapTest };
}
