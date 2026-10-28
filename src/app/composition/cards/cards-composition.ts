import type { QuestionRecord } from '../../../core/domain/question-record.js';
import type { CardsServices, StudyCard } from '../../../shared/ui/study-services.js';
import { createCardsController, type CardsControllerDependencies } from '../../../features/cards/cards-controller.js';
import { cardFromFailedQuestion } from '../../../features/cards/flashcard-mapper.js';
import { cardMapper } from '../../../adapters/local/mappers/card.js';
import { previewCardWithFsrs } from '../../../adapters/local/fsrs-card-scheduler.js';
import { clearCardsSession, readCardsSession, saveCardsSession } from '../../../adapters/local/cards-session.js';

interface CardQuestionDependencies {
  loadQuestionMetadata(): Promise<unknown>;
  failedCardQuestionIds(): readonly string[];
  loadQuestionsById(ids: string[]): Promise<QuestionRecord[]>;
  loadJson<T>(url: string): Promise<T>;
  verifiedSources: Readonly<Record<string, QuestionRecord['source']>>;
}

export type CardsCompositionDependencies = CardQuestionDependencies & Omit<CardsControllerDependencies, 'loadAllCards' | 'loadCuratedCards' | 'previewReviewDate' | 'readSavedSession' | 'saveSession' | 'clearSavedSession'>;

/** Loads curated and failed-question cards, then wires the existing study-card controller. */
export function createCardsComposition(dependencies: CardsCompositionDependencies): { services: CardsServices; loadAllCards(): Promise<StudyCard[]> } {
  let cardIndex: Record<string, unknown> | undefined;
  const cardCache = new Map<string, Promise<Record<string, unknown>[]>>();

  async function loadCuratedCards(): Promise<StudyCard[]> {
    if (cardIndex === undefined) {
      try { cardIndex = (await dependencies.loadJson<{ temas?: Record<string, unknown> }>('cards/index.json')).temas || {}; }
      catch { return []; }
    }
    const topicIds = Object.keys(cardIndex);
    for (const topicId of topicIds) {
      if (!cardCache.has(topicId)) {
        cardCache.set(topicId, dependencies.loadJson<Record<string, unknown>[]>(`cards/${topicId}.json`).catch(error => {
          cardCache.delete(topicId);
          throw error;
        }));
      }
    }
    const lists = await Promise.all(topicIds.map(topicId => cardCache.get(topicId)?.catch(() => []) ?? Promise.resolve([])));
    return lists.flatMap((items, index) => items
      .filter(card => card && card.id && card.q && card.a && !card.revisar)
      .map(card => ({ ...card, t: topicIds[index] } as unknown as StudyCard)));
  }

  async function loadAllCards(): Promise<StudyCard[]> {
    await dependencies.loadQuestionMetadata();
    const questionIds = dependencies.failedCardQuestionIds();
    const questions = await dependencies.loadQuestionsById([...questionIds]);
    const failures = questions.map(question => ({
      ...cardFromFailedQuestion(question),
      np: question.np,
      source: question.source || dependencies.verifiedSources[question.i],
      supTexto: question.supTexto,
      cp: question.cp,
    } as StudyCard));
    return [...await loadCuratedCards(), ...failures];
  }

  const services = createCardsController({
    loadAllCards,
    loadCuratedCards,
    readPreferences: dependencies.readPreferences,
    savePreferences: dependencies.savePreferences,
    previewReviewDate(cardId, grade, timestamp) {
      const record = dependencies.getRecord(cardId), mapped = record ? cardMapper.toDomain(record) : null;
      return previewCardWithFsrs(mapped?.ok ? mapped.value : undefined, grade, timestamp);
    },
    readSavedSession: readCardsSession,
    saveSession: saveCardsSession,
    clearSavedSession: clearCardsSession,
    accountId: dependencies.accountId,
    getCards: dependencies.getCards,
    getSeen: dependencies.getSeen,
    getRecord: dependencies.getRecord,
    now: dependencies.now,
    day: dependencies.day,
    topicName: dependencies.topicName,
    grade: dependencies.grade,
    remove: dependencies.remove,
    getReport: dependencies.getReport,
    saveReport: dependencies.saveReport,
  });
  return { services, loadAllCards };
}
