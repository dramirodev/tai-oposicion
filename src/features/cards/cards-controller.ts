import { selectLegacyCards, summarizeLegacyCards } from './flashcard-mapper.js';
import type { ActiveCardsSession, CardPreferences, CardsPlan, CardsServices, StudyCard } from '../../shared/ui/study-services.js';
import type { CardsSessionCheckpoint } from '../../core/domain/entities.js';

export interface CardsControllerDependencies {
  loadAllCards(): Promise<StudyCard[]>;
  loadCuratedCards(): Promise<StudyCard[]>;
  readPreferences(): unknown;
  savePreferences(preferences: CardPreferences): void;
  readSavedSession(accountId: string | null): CardsSessionCheckpoint | null;
  saveSession(accountId: string | null, session: CardsSessionCheckpoint): void;
  clearSavedSession(accountId: string | null): void;
  previewReviewDate(cardId: string, grade: 0 | 1 | 2, now: number): number;
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
  const persistSession = (session: ActiveCardsSession) => dependencies.saveSession(session.account, {
    ids: session.items.map(card => card.id), index: session.index, revealed: session.revealed, results: [...session.results],
  });
  const services: CardsServices = {
    seenTopics: dependencies.getSeen,
    loadPlan: async (preferences: CardPreferences, topicIds?: readonly string[]): Promise<CardsPlan> => {
      const account = dependencies.accountId();
      const loadedCards = await dependencies.loadAllCards();
      if (account !== dependencies.accountId()) throw new Error('La cuenta cambió mientras se cargaban las tarjetas.');
      const seenTopics = new Set(dependencies.getSeen());
      const allowedTopics = topicIds ? new Set(topicIds.filter(topicId => seenTopics.has(topicId))) : null;
      const cards = allowedTopics ? loadedCards.filter(card => allowedTopics.has(card.t)) : loadedCards;
      const records = dependencies.getCards(), timestamp = dependencies.now(), seen = seenTopics;
      const ids = selectLegacyCards(cards, records, {
        n: preferences.count, now: timestamp, maxNew: 10,
        seen: preferences.scope === 'vistos' && seen.size ? seen : null,
      });
      if (!getSession()) {
        const saved = dependencies.readSavedSession(account);
        if (saved) {
          // Se resuelve contra todas las tarjetas, no solo las del tema acotado: abrir un plan parcial no debe perder el progreso.
          const byId = new Map(loadedCards.map(card => [card.id, card]));
          const items = saved.ids.map(id => byId.get(id));
          if (items.every((card): card is StudyCard => !!card)) {
            activeSession = { account, items, index: saved.index, revealed: saved.revealed, results: [...saved.results] };
          } else dependencies.clearSavedSession(account);
        }
      }
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
      persistSession(activeSession);
      return activeSession;
    },
    reveal() {
      const session = getSession();
      if (!session || session.index >= session.items.length) return false;
      session.revealed = true;
      persistSession(session);
      return true;
    },
    grade(value) {
      const session = getSession();
      if (!session?.revealed || session.index >= session.items.length || ![0, 1, 2].includes(value)) return null;
      dependencies.grade(session.items[session.index].id, value, dependencies.now());
      session.results[value as 0 | 1 | 2]++;
      session.index++;
      session.revealed = false;
      persistSession(session);
      return session;
    },
    removeFailureCard() {
      const session = getSession(), card = session?.items[session.index];
      if (!session || !card || card.src !== 'fallo') return session;
      dependencies.remove(card.id);
      session.items.splice(session.index, 1);
      session.revealed = false;
      persistSession(session);
      return session;
    },
    clearSession() {
      const session = activeSession;
      activeSession = null;
      if (session) dependencies.clearSavedSession(session.account);
    },
    nextDueDates() {
      return Object.values(dependencies.getCards()).filter(record => record[3] >= 0 && record[4] > dependencies.now()).map(record => record[4]);
    },
    reviewLabel(cardId, value) {
      const timestamp = dependencies.now();
      const next = dependencies.previewReviewDate(cardId, value as 0 | 1 | 2, timestamp);
      const minutes = Math.max(1, Math.ceil((next - timestamp) / 60000));
      if (minutes < 60) return `En ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
      const hours = Math.ceil(minutes / 60);
      if (hours < 24) return `En ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      const days = Math.ceil((next - timestamp) / dependencies.day);
      return `En ${days} ${days === 1 ? 'día' : 'días'}`;
    },
    topicName: dependencies.topicName,
    getReport: dependencies.getReport,
    saveReport: dependencies.saveReport,
  };
  return services;
}
