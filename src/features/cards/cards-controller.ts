import { previewCardDueAt } from '../../core/domain/spaced-repetition.js';
import { selectLegacyCards, summarizeLegacyCards } from './flashcard-mapper.js';
import type { ActiveCardsSession, CardPreferences, CardsPlan, CardsServices, StudyCard } from '../../shared/ui/study-services.js';

export interface CardsControllerDependencies {
  loadAllCards(): Promise<StudyCard[]>;
  loadCuratedCards(): Promise<StudyCard[]>;
  readPreferences(): unknown;
  savePreferences(preferences: CardPreferences): void;
  accountId(): string | null;
  getCards(): Readonly<Record<string, readonly number[]>>;
  getSeen(): readonly string[];
  getRecord(cardId: string): readonly number[] | undefined;
  now(): number;
  day: number;
  topicName(topicId: string): string;
  grade(cardId: string, value: number, now: number): unknown;
  remove(cardId: string): void;
  getReport(cardId: string): { motivo: string; nota: string; st: string } | undefined;
  saveReport(card: Pick<StudyCard, 'id' | 't'>, reason: string, note: string): void;
}

export function createCardsController(dependencies: CardsControllerDependencies): CardsServices {
  let activeSession: ActiveCardsSession | null = null;
  const getPreferences = (): CardPreferences => {
    const config = Object.assign({ scope: 'vistos', n: 20 }, dependencies.readPreferences() || {});
    const count = [10, 20, 30].includes(config.n) ? config.n as CardPreferences['count'] : 20;
    return { scope: config.scope === 'todos' ? 'todos' : 'vistos', count };
  };
  const getSession = (): ActiveCardsSession | null => {
    if (activeSession && activeSession.account !== dependencies.accountId()) activeSession = null;
    return activeSession;
  };
  const services: CardsServices = {
    loadPlan: async (preferences: CardPreferences): Promise<CardsPlan> => {
      const cards = await dependencies.loadAllCards();
      const records = dependencies.getCards(), timestamp = dependencies.now(), seen = new Set(dependencies.getSeen());
      const ids = selectLegacyCards(cards, records, {
        n: preferences.count, now: timestamp, maxNew: 10,
        seen: preferences.scope === 'vistos' && seen.size ? seen : null,
      });
      return { cards, summary: summarizeLegacyCards(cards, records, timestamp), ids, reviews: ids.filter(id => !!records[id]).length };
    },
    loadAllCards: dependencies.loadAllCards,
    loadCuratedCards: dependencies.loadCuratedCards,
    getPreferences,
    savePreferences: dependencies.savePreferences,
    getSession,
    startSession(cards, ids) {
      const byId = new Map(cards.map(card => [card.id, card]));
      activeSession = { account: dependencies.accountId(), items: ids.map(id => byId.get(id)).filter((card): card is StudyCard => !!card), index: 0, revealed: false, results: [0, 0, 0] };
      return activeSession;
    },
    reveal() {
      const session = getSession();
      if (!session || session.index >= session.items.length) return false;
      session.revealed = true;
      return true;
    },
    grade(value) {
      const session = getSession();
      if (!session?.revealed || session.index >= session.items.length || ![0, 1, 2].includes(value)) return null;
      dependencies.grade(session.items[session.index].id, value, dependencies.now());
      session.results[value as 0 | 1 | 2]++;
      session.index++;
      session.revealed = false;
      return session;
    },
    removeFailureCard() {
      const session = getSession(), card = session?.items[session.index];
      if (!session || !card || card.src !== 'fallo') return session;
      dependencies.remove(card.id);
      session.items.splice(session.index, 1);
      session.revealed = false;
      return session;
    },
    clearSession() { activeSession = null; },
    nextDueDates() {
      return Object.values(dependencies.getCards()).filter(record => record[3] >= 0 && record[4] > dependencies.now()).map(record => record[4]);
    },
    reviewLabel(cardId, value) {
      const timestamp = dependencies.now(), record = dependencies.getRecord(cardId);
      const next = previewCardDueAt(record ? { attempts: record[0], intervalStep: record[3] } : undefined, value, timestamp);
      if (!next) return 'Dominada';
      const days = Math.round((next - timestamp) / dependencies.day);
      return `En ${days} ${days === 1 ? 'día' : 'días'}`;
    },
    topicName: dependencies.topicName,
    getReport: dependencies.getReport,
    saveReport: dependencies.saveReport,
  };
  return services;
}
