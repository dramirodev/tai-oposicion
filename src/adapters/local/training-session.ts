import { MAX_TRAINING_SESSION_HISTORY, toTrainingSessionHistoryEntry, type DailyTrainingSession, type TrainingSessionHistoryEntry, type TrainingSessionStep } from '../../core/domain/study-training-session.js';
import type { StudyReviewMode, TrainingActivity } from '../../core/domain/entities.js';
import type { TrainingPlanReason } from '../../core/domain/study-training-plan.js';
import { localTrainingDateKey } from '../../core/domain/study-training-session.js';
import { isStudyTopicId } from '../../core/domain/topic-id.js';

const activities = new Set<TrainingActivity>(['newContent', 'activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews']);
const reasons = new Set<TrainingPlanReason>(['active-recall', 'new-content-day', 'new-topic-day', 'weak-topics', 'coverage', 'recurring-failures', 'due-reviews']);
const reviewModes = new Set<StudyReviewMode>(['initial-study', 'active-retrieval', 'selective-reading', 'broad-reading']);
const keyFor = (accountId: string | null) => `tai.training-session.v1.${encodeURIComponent(accountId || 'guest')}`;
const historyKeyFor = (accountId: string | null) => `tai.training-history.v1.${encodeURIComponent(accountId || 'guest')}`;

type StoredTrainingSessionStep = Pick<TrainingSessionStep, 'activity' | 'minutes'>
  & Partial<Pick<TrainingSessionStep, 'id' | 'reason' | 'topicId' | 'topicIds' | 'reviewMode' | 'attemptSessionIds'>>;
type StoredTrainingSession = Omit<DailyTrainingSession, 'activities'> & { activities: readonly StoredTrainingSessionStep[] };

function isSessionStep(value: unknown): value is StoredTrainingSessionStep {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const step = value as Partial<StoredTrainingSessionStep>;
  return activities.has(step.activity as TrainingActivity)
    && Number.isInteger(step.minutes) && step.minutes! > 0 && step.minutes! <= 240
    && (step.id === undefined || (typeof step.id === 'string' && !!step.id.trim() && step.id.length <= 180))
    && (step.attemptSessionIds === undefined || (Array.isArray(step.attemptSessionIds)
      && step.attemptSessionIds.length <= 500
      && step.attemptSessionIds.every(id => typeof id === 'string' && !!id.trim() && id.length <= 180)))
    && (step.reason === undefined || reasons.has(step.reason as TrainingPlanReason))
    && (step.reviewMode === undefined || reviewModes.has(step.reviewMode as StudyReviewMode))
    && (step.topicId === undefined || isStudyTopicId(step.topicId))
    && (step.topicIds === undefined || (Array.isArray(step.topicIds) && step.topicIds.length > 0
      && step.topicIds.every(isStudyTopicId)));
}

function isTrainingHistoryEntry(value: unknown): value is TrainingSessionHistoryEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Partial<TrainingSessionHistoryEntry>;
  return typeof entry.id === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(entry.id)
    && entry.id === entry.dateKey
    && Number.isFinite(entry.startedAt) && Number.isFinite(entry.completedAt)
    && entry.startedAt! >= 0 && entry.completedAt! >= entry.startedAt!
    && Number.isInteger(entry.plannedMinutes) && entry.plannedMinutes! > 0 && entry.plannedMinutes! <= 1440
    && Array.isArray(entry.activities) && entry.activities.length > 0 && entry.activities.length <= 6
    && entry.activities.every(isSessionStep)
    && new Set(entry.activities.map(activity => activity.activity)).size === entry.activities.length
    && Array.isArray(entry.elapsedSecondsByActivity)
    && entry.elapsedSecondsByActivity.length === entry.activities.length
    && entry.elapsedSecondsByActivity.every(seconds => Number.isInteger(seconds) && seconds >= 0 && seconds <= 86_400);
}

function readHistory(accountId: string | null): TrainingSessionHistoryEntry[] {
  try {
    const serialized = localStorage.getItem(historyKeyFor(accountId));
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTrainingHistoryEntry).sort((left, right) => right.completedAt - left.completedAt).slice(0, MAX_TRAINING_SESSION_HISTORY);
  } catch { return []; }
}

function mergeHistory(accountId: string | null, incoming: readonly TrainingSessionHistoryEntry[]): boolean {
  const current = readHistory(accountId);
  const byId = new Map(current.map(entry => [entry.id, entry]));
  let changed = false;
  for (const entry of incoming) {
    if (!isTrainingHistoryEntry(entry)) continue;
    const existing = byId.get(entry.id);
    if (existing && existing.completedAt >= entry.completedAt) continue;
    byId.set(entry.id, entry);
    changed = true;
  }
  if (!changed) return false;
  const merged = [...byId.values()].sort((left, right) => right.completedAt - left.completedAt).slice(0, MAX_TRAINING_SESSION_HISTORY);
  try { localStorage.setItem(historyKeyFor(accountId), JSON.stringify(merged)); }
  catch { /* The active session remains usable when history storage is unavailable. */ }
  return true;
}

export function readTrainingSessionHistory(accountId: string | null): readonly TrainingSessionHistoryEntry[] {
  return readHistory(accountId);
}

export function mergeRemoteTrainingSessionHistory(accountId: string | null, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return mergeHistory(accountId, value.filter(isTrainingHistoryEntry));
}

function isDailyTrainingSession(value: unknown, timestamp: number): value is StoredTrainingSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Partial<StoredTrainingSession>;
  if (session.dateKey !== localTrainingDateKey(timestamp) || !Array.isArray(session.activities)
    || !session.activities.length || session.activities.length > 6 || !session.activities.every(isSessionStep)
    || (session.schemaVersion !== undefined && session.schemaVersion !== 2)
    || (session.id !== undefined && (typeof session.id !== 'string' || !session.id.trim() || session.id.length > 180))
    || new Set(session.activities.map(step => step.activity)).size !== session.activities.length
    || !Number.isInteger(session.currentIndex) || session.currentIndex! < 0 || session.currentIndex! > session.activities.length
    || (session.elapsedSecondsByActivity !== undefined && (!Array.isArray(session.elapsedSecondsByActivity)
      || session.elapsedSecondsByActivity.length !== session.activities.length
      || !session.elapsedSecondsByActivity.every(seconds => Number.isInteger(seconds) && seconds >= 0 && seconds <= 86_400)))
    || !Number.isFinite(session.startedAt) || session.startedAt! < 0
    || (session.updatedAt !== undefined && (!Number.isFinite(session.updatedAt) || session.updatedAt < session.startedAt!))
    || (session.currentStartedAt !== null && (!Number.isFinite(session.currentStartedAt) || session.currentStartedAt! < session.startedAt!))
    || (session.completedAt !== null && (!Number.isFinite(session.completedAt) || session.completedAt! < session.startedAt!))) return false;
  if (session.completedAt !== null && session.currentIndex !== session.activities.length) return false;
  if (session.completedAt === null && session.currentIndex === session.activities.length) return false;
  return true;
}

const defaultReason: Record<TrainingActivity, TrainingPlanReason> = {
  newContent: 'new-content-day', activeRecall: 'active-recall', topicTest: 'coverage', mixedTopicTest: 'coverage', failures: 'recurring-failures', spacedReviews: 'due-reviews',
};

export function readTrainingSession(accountId: string | null, timestamp: number): DailyTrainingSession | null {
  const key = keyFor(accountId);
  let serialized: string | null;
  try { serialized = localStorage.getItem(key); }
  catch { return null; }
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isDailyTrainingSession(parsed, timestamp)) {
      const id = parsed.id ?? `training:${parsed.dateKey}`;
      return {
      ...parsed,
      schemaVersion: 2,
      id,
      activities: parsed.activities.map((step, index) => ({
        id: step.id ?? `${id}:activity:${index + 1}`,
        activity: step.activity,
        minutes: step.minutes,
        reason: step.reason ?? defaultReason[step.activity],
        ...(step.topicId ? { topicId: step.topicId } : {}),
        ...(step.topicIds ? { topicIds: [...step.topicIds] } : {}),
        ...(step.reviewMode ? { reviewMode: step.reviewMode } : {}),
        ...(step.attemptSessionIds ? { attemptSessionIds: [...step.attemptSessionIds] } : {}),
      })),
      };
    }
  } catch { /* Invalid local checkpoints are removed below. */ }
  try { localStorage.removeItem(key); }
  catch { /* Storage may be unavailable in private browsing modes. */ }
  return null;
}

export function saveTrainingSession(accountId: string | null, session: DailyTrainingSession): void {
  try { localStorage.setItem(keyFor(accountId), JSON.stringify(session)); }
  catch { /* The daily plan remains usable if storage is unavailable. */ }
  const completed = toTrainingSessionHistoryEntry(session);
  if (completed) mergeHistory(accountId, [completed]);
}

/** Merge only a valid current-day checkpoint newer than the local copy. */
export function mergeRemoteTrainingSession(accountId: string | null, timestamp: number, value: unknown, updatedAt: number): boolean {
  if (!Number.isFinite(updatedAt) || !isDailyTrainingSession(value, timestamp)) return false;
  const current = readTrainingSession(accountId, timestamp);
  if (current && (current.updatedAt ?? current.startedAt) >= updatedAt) return false;
  const incoming = value as StoredTrainingSession;
  const id = incoming.id ?? `training:${incoming.dateKey}`;
  saveTrainingSession(accountId, {
    ...incoming,
    schemaVersion: 2,
    id,
    updatedAt,
    activities: incoming.activities.map((step, index) => ({
      id: step.id ?? `${id}:activity:${index + 1}`,
      activity: step.activity,
      minutes: step.minutes,
      reason: step.reason ?? defaultReason[step.activity],
      ...(step.topicId ? { topicId: step.topicId } : {}),
      ...(step.topicIds ? { topicIds: [...step.topicIds] } : {}),
      ...(step.reviewMode ? { reviewMode: step.reviewMode } : {}),
      ...(step.attemptSessionIds ? { attemptSessionIds: [...step.attemptSessionIds] } : {}),
    })),
  });
  return true;
}

export function clearTrainingSession(accountId: string | null): void {
  try { localStorage.removeItem(keyFor(accountId)); }
  catch { /* Clearing a checkpoint must not block study navigation. */ }
}
