import type { CardReview, ErrorReport, MappingResult, Preferences, QuestionStats, SessionResult } from '../../core/domain/entities.js';
import type { ProgressRepository } from '../../core/ports/ProgressRepository.js';
import type { StudyProgressGateway } from '../../core/ports/StudyProgressGateway.js';
import * as store from './legacy-store.js';
import { cardMapper } from './mappers/card.js';
import { preferencesMapper } from './mappers/preferences.js';
import { reportMapper } from './mappers/report.js';
import { sessionMapper } from './mappers/session.js';
import { statsMapper } from './mappers/stats.js';

function mapRecord<Value>(
  records: Readonly<Record<string, unknown>>,
  map: (id: string, value: unknown) => MappingResult<Value>,
  label: string,
): Record<string, Value> {
  const mapped: Record<string, Value> = {};
  for (const [id, record] of Object.entries(records)) {
    const result = map(id, record);
    if (result.ok) mapped[id] = result.value;
    else console.warn(`Progreso local ${label}.${id}: ${result.reason}`);
  }
  return mapped;
}

function mapList<Value>(
  records: readonly unknown[],
  map: (value: unknown) => MappingResult<Value>,
  label: string,
): Value[] {
  const mapped: Value[] = [];
  records.forEach((record, index) => {
    const result = map(record);
    if (result.ok) mapped.push(result.value);
    else console.warn(`Progreso local ${label}[${index}]: ${result.reason}`);
  });
  return mapped;
}

function mapStatistics(record: unknown): QuestionStats | undefined {
  const result = statsMapper.toDomain(record);
  return result.ok ? result.value : undefined;
}

/** Synchronous typed API needed by the study engine while a question is active. */
export const localStudyProgressGateway: StudyProgressGateway = {
  accountId: store.accountId,
  onAccountChange: store.onAccountChange,
  getQuestionStats: questionId => mapStatistics(store.rec(questionId)),
  getAllQuestionStats() {
    const statistics: Record<string, QuestionStats> = {};
    for (const [questionId, record] of Object.entries(store.getStats())) {
      const mapped = mapStatistics(record);
      if (mapped) statistics[questionId] = mapped;
    }
    return statistics;
  },
  getPreferences() {
    const result = preferencesMapper.toDomain(store.getCfg());
    return result.ok ? result.value : {};
  },
  getSeenTopics: store.getSeen,
  recordAnswer: store.record,
  addSession(session: SessionResult) {
    store.addSession(sessionMapper.toDto(session));
  },
};

export const localProgressRepository: ProgressRepository = {
  async getStats() {
    return mapRecord(store.getStats(), (_id, record) => statsMapper.toDomain(record), 'stats');
  },

  async getQuestionStats(questionId: string) {
    const record = store.rec(questionId);
    if (!record) return undefined;
    const result = statsMapper.toDomain(record);
    if (result.ok) return result.value;
    console.warn(`Progreso local stats.${questionId}: ${result.reason}`);
    return undefined;
  },

  async saveStats(statistics) {
    const records = Object.fromEntries(Object.entries(statistics).map(([id, value]) => [id, statsMapper.toDto(value)]));
    store.mergeRemote(records);
  },

  async getSessions() {
    return mapList(store.getSessions(), value => sessionMapper.toDomain(value), 'sessions');
  },

  async addSession(session: SessionResult) {
    store.addSession(sessionMapper.toDto(session));
  },

  async getPreferences() {
    const result = preferencesMapper.toDomain(store.getCfg());
    if (result.ok) return result.value;
    console.warn(`Preferencias locales: ${result.reason}`);
    return {};
  },

  async savePreferences(preferences: Preferences) {
    store.replaceCfg(preferencesMapper.toDto(preferences));
  },

  async getSeenTopics() {
    return store.getSeen();
  },

  async saveSeenTopics(topicIds: readonly string[]) {
    store.setSeen(topicIds);
  },

  async getReports() {
    return mapRecord(store.getReports(), reportMapper.toDomain, 'reports');
  },

  async saveReports(reports: Readonly<Record<string, ErrorReport>>) {
    const records = Object.fromEntries(Object.entries(reports).map(([id, report]) => [id, reportMapper.toDto(report)]));
    store.mergeReports(records);
  },

  async getCardReviews() {
    return mapRecord(store.getCardsDoc(), (_id, record) => cardMapper.toDomain(record), 'cards');
  },

  async getCardReview(cardId: string) {
    const record = store.getCardsDoc()[cardId];
    if (!record) return undefined;
    const result = cardMapper.toDomain(record);
    if (result.ok) return result.value;
    console.warn(`Progreso local cards.${cardId}: ${result.reason}`);
    return undefined;
  },

  async saveCardReviews(reviews: Readonly<Record<string, CardReview>>) {
    const records = Object.fromEntries(Object.entries(reviews).map(([id, review]) => [id, cardMapper.toDto(review)]));
    store.mergeCards(records);
  },

  subscribe(listener) {
    return store.onChange(listener);
  },
};
