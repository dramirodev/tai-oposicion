import { isStudyDateKey } from './study-training-calendar.js';
import { isStudyTopicId } from './topic-id.js';
import { buildDailyTrainingPlan, selectNextAcademyTopic, type DailyTrainingPlan, type PlannedTrainingActivity, type TrainingPlanReason } from './study-training-plan.js';
import type { TrainingSessionStep } from './study-training-session.js';
import type { TrainingPreferences } from './entities.js';
import type { ScheduledStudyActivity } from './study-training-calendar.js';
import { resolveTrainingDay } from './study-training-events.js';
import type { TopicReviewEvidence } from './study-review-intervention.js';

export const WEEKLY_AGENDA_SCHEMA_VERSION = 1 as const;
export const MAX_WEEKLY_AGENDA_ITEMS = 70;

export type WeeklyAgendaKind = 'newContent' | 'activeRecall' | 'topicTest' | 'mixedTopicTest' | 'failures' | 'spacedReviews';
export type WeeklyAgendaStatus = 'planned' | 'completed' | 'skipped' | 'rescheduled';

/** A dated, user-confirmed activity. New content is not a review and may target an unstudied topic. */
export interface WeeklyAgendaItem {
  id: string;
  weekStart: string;
  dateKey: string;
  kind: WeeklyAgendaKind;
  topicIds: readonly string[];
  minutes: number;
  status: WeeklyAgendaStatus;
  createdAt: number;
  updatedAt: number;
  /** History link when a missed activity is recovered into a later week. */
  recoveryOf?: string;
  /** Original date retained on the closed record when a pending item is moved. */
  rescheduledTo?: string;
}

export interface WeeklyStudyAgenda {
  schemaVersion: typeof WEEKLY_AGENDA_SCHEMA_VERSION;
  revision: number;
  updatedAt: number;
  items: readonly WeeklyAgendaItem[];
}

const kinds = new Set<WeeklyAgendaKind>(['newContent', 'activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews']);
const statuses = new Set<WeeklyAgendaStatus>(['planned', 'completed', 'skipped', 'rescheduled']);

export function isMondayStudyDate(dateKey: unknown): dateKey is string {
  if (!isStudyDateKey(dateKey)) return false;
  return new Date(`${dateKey}T12:00:00`).getDay() === 1;
}

export function weekStartForStudyDate(dateKey: string): string | null {
  if (!isStudyDateKey(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function isWeeklyAgendaItem(value: unknown): value is WeeklyAgendaItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<WeeklyAgendaItem>;
  const weekStart = weekStartForStudyDate(item.dateKey ?? '');
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 128
    && isMondayStudyDate(item.weekStart) && weekStart === item.weekStart
    && isStudyDateKey(item.dateKey) && kinds.has(item.kind as WeeklyAgendaKind)
    && Array.isArray(item.topicIds) && item.topicIds.length <= 20 && item.topicIds.every(isStudyTopicId)
    && (item.kind === 'newContent' ? item.topicIds.length === 1 : item.topicIds.length >= 1)
    && Number.isInteger(item.minutes) && item.minutes! >= 5 && item.minutes! <= 240
    && statuses.has(item.status as WeeklyAgendaStatus)
    && (item.recoveryOf === undefined || (typeof item.recoveryOf === 'string' && item.recoveryOf.length > 0 && item.recoveryOf.length <= 128))
    && (item.rescheduledTo === undefined || (item.status === 'rescheduled' && isStudyDateKey(item.rescheduledTo) && item.rescheduledTo > (item.dateKey ?? '')))
    && (item.status === 'rescheduled' ? isStudyDateKey(item.rescheduledTo) : item.rescheduledTo === undefined)
    && Number.isFinite(item.createdAt) && item.createdAt! >= 0
    && Number.isFinite(item.updatedAt) && item.updatedAt! >= item.createdAt!;
}

export function emptyWeeklyStudyAgenda(): WeeklyStudyAgenda {
  return { schemaVersion: WEEKLY_AGENDA_SCHEMA_VERSION, revision: 0, updatedAt: 0, items: [] };
}

export function isWeeklyStudyAgenda(value: unknown): value is WeeklyStudyAgenda {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const agenda = value as Partial<WeeklyStudyAgenda>;
  return agenda.schemaVersion === WEEKLY_AGENDA_SCHEMA_VERSION
    && Number.isInteger(agenda.revision) && agenda.revision! >= 0
    && Number.isFinite(agenda.updatedAt) && agenda.updatedAt! >= 0
    && Array.isArray(agenda.items) && agenda.items.length <= MAX_WEEKLY_AGENDA_ITEMS
    && agenda.items.every(isWeeklyAgendaItem)
    && new Set(agenda.items.map(item => item.id)).size === agenda.items.length;
}

/** Preserves completed/skipped history and resolves concurrent item updates deterministically. */
export function mergeWeeklyStudyAgenda(current: WeeklyStudyAgenda, incoming: unknown): WeeklyStudyAgenda {
  if (!isWeeklyStudyAgenda(incoming)) return current;
  const items = new Map(current.items.map(item => [item.id, item]));
  const statusPriority: Record<WeeklyAgendaStatus, number> = { planned:0, skipped:1, rescheduled:2, completed:3 };
  for (const item of incoming.items) {
    const previous = items.get(item.id);
    if (!previous || item.updatedAt > previous.updatedAt
      || (item.updatedAt === previous.updatedAt && statusPriority[item.status] > statusPriority[previous.status])) items.set(item.id, item);
  }
  const merged = [...items.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.id.localeCompare(b.id));
  const bounded = merged.slice(-MAX_WEEKLY_AGENDA_ITEMS);
  return {
    schemaVersion: WEEKLY_AGENDA_SCHEMA_VERSION,
    revision: Math.max(current.revision, incoming.revision),
    updatedAt: Math.max(current.updatedAt, incoming.updatedAt),
    items: bounded,
  };
}

export function replaceWeeklyAgendaWeek(current: WeeklyStudyAgenda, weekStart: string, items: readonly WeeklyAgendaItem[], now: number): WeeklyStudyAgenda | null {
  if (!isMondayStudyDate(weekStart) || !Number.isFinite(now) || !items.every(isWeeklyAgendaItem)
    || items.some(item => item.weekStart !== weekStart) || items.length > 35) return null;
  const retained = current.items.filter(item => item.weekStart !== weekStart || item.status !== 'planned');
  const retainedIds = new Set(retained.map(item => item.id));
  if (items.some(item => retainedIds.has(item.id))) return null;
  const next: WeeklyStudyAgenda = {
    schemaVersion: WEEKLY_AGENDA_SCHEMA_VERSION,
    revision: current.revision + 1,
    updatedAt: Math.max(now, current.updatedAt + 1),
    items: [...retained, ...items.map(item => ({ ...item, status: 'planned' as const, createdAt: now, updatedAt: now }))]
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.id.localeCompare(b.id))
      .slice(-MAX_WEEKLY_AGENDA_ITEMS),
  };
  return next;
}

export function updateWeeklyAgendaItemStatus(current: WeeklyStudyAgenda, id: string, status: WeeklyAgendaStatus, now: number): WeeklyStudyAgenda | null {
  if (!Number.isFinite(now) || !statuses.has(status)) return null;
  const item = current.items.find(candidate => candidate.id === id);
  if (!item || (item.status !== 'planned' && item.status !== status)) return null;
  if (item.status === status) return current;
  const updatedAt = Math.max(now, item.updatedAt + 1);
  return {
    ...current,
    revision: current.revision + 1,
    updatedAt: Math.max(updatedAt, current.updatedAt + 1),
    items: current.items.map(candidate => candidate.id === id ? { ...candidate, status, updatedAt } : candidate),
  };
}

export interface WeeklyAgendaRecoveryProposal {
  baseRevision: number;
  targetWeekStart: string;
  moves: readonly { sourceId: string; sourceUpdatedAt: number; target: WeeklyAgendaItem }[];
  unplacedIds: readonly string[];
}

export interface WeeklyAgendaPlanProposal {
  baseRevision: number;
  targetWeekStart: string;
  items: readonly WeeklyAgendaItem[];
  skippedDays: readonly { dateKey: string; reason: 'past' | 'rest' | 'unavailable' | 'no-capacity' | 'no-activities' | 'no-content' }[];
  missingTopicIds: readonly string[];
  plannedNewTopicIds: readonly string[];
  contentInventoryStatus: 'manifest' | 'partial' | 'unavailable' | 'not-checked';
  omittedContentActivities: readonly { dateKey: string; kind: WeeklyAgendaKind; topicIds: readonly string[] }[];
  horizonCapacityGapBefore: number | null;
  acceleratedNewTopicIds: readonly string[];
  horizonCapacityGapAfter: number | null;
}

/** Builds a reviewable weekly draft from the existing daily rules and real study/catalog evidence. */
export function proposeWeeklyAgendaPlan(input: {
  agenda: WeeklyStudyAgenda;
  targetWeekStart: string;
  todayKey: string;
  preferences: TrainingPreferences;
  catalogTopics: readonly { id: string; name: string }[];
  studiedTopicIds: readonly string[];
  dueCount: number;
  cardDueCount: number;
  failureCount: number;
  weakTopicCount: number;
  weakTopicIds: readonly string[];
  topicReviewEvidence: readonly TopicReviewEvidence[];
  scheduledActivities: readonly ScheduledStudyActivity[];
  /** Topic-level availability from loaded manifests; it is not proof of official syllabus coverage. */
  contentInventory?: { questionTopicIds: readonly string[] | null; cardTopicIds: readonly string[] | null };
  /** Remaining optimistic topic-slot deficit from the global horizon; null means unknown. */
  horizonCapacityGap?: number | null;
}): WeeklyAgendaPlanProposal | null {
  if (!isMondayStudyDate(input.targetWeekStart) || !isStudyDateKey(input.todayKey)) return null;
  const dates = Array.from({ length:7 }, (_, index) => addStudyDays(input.targetWeekStart, index)).filter((date): date is string => !!date);
  const studied = [...new Set(input.studiedTopicIds)];
  const topicById = new Map(input.catalogTopics.map(topic => [topic.id, topic]));
  const agendaItems = input.agenda.items.filter(item => item.weekStart === input.targetWeekStart);
  const plannedItems = agendaItems.filter(item => item.status === 'planned');
  const plannedNewTopicIds: string[] = [];
  const reservedNewTopicIds = agendaItems.filter(item => item.kind === 'newContent').flatMap(item => item.topicIds);
  const reservedNewContentDates = new Set(agendaItems.filter(item => item.kind === 'newContent' && item.status === 'planned').map(item => item.dateKey));
  const missingTopicIds = (input.preferences.academyTopicOrderIds ?? []).filter(id => !topicById.has(id) && !studied.includes(id));
  const items: WeeklyAgendaItem[] = [];
  const omittedContentActivities: { dateKey: string; kind: WeeklyAgendaKind; topicIds: readonly string[] }[] = [];
  const acceleratedNewTopicIds: string[] = [];
  const skippedDays: { dateKey: string; reason: 'past' | 'rest' | 'unavailable' | 'no-capacity' | 'no-activities' | 'no-content' }[] = [];
  let dueCount = Math.max(0, input.dueCount), cardDueCount = Math.max(0, input.cardDueCount), failureCount = Math.max(0, input.failureCount);
  let idSequence = 0;
  const reviewTopics = [...new Set([...input.weakTopicIds, ...studied])].slice(0, 20);
  const existingSlots = input.agenda.items.filter(item => item.weekStart === input.targetWeekStart).length;
  const availableItemSlots = Math.max(0, Math.min(MAX_WEEKLY_AGENDA_ITEMS - input.agenda.items.length, 35 - existingSlots));

  for (const dateKey of dates) {
    if (dateKey <= input.todayKey) { skippedDays.push({ dateKey, reason:'past' }); continue; }
    const day = resolveTrainingDay({ dateKey, preferences:input.preferences });
    if (!day.minutes || day.focus === 'rest') { skippedDays.push({ dateKey, reason:'rest' }); continue; }
    const reserved = plannedItems.filter(item => item.dateKey === dateKey).reduce((sum, item) => sum + item.minutes, 0)
      + input.scheduledActivities.filter(item => item.dateKey === dateKey).reduce((sum, item) => sum + item.minutes, 0);
    const remaining = day.minutes - reserved;
    if (remaining < 5) { skippedDays.push({ dateKey, reason:'no-capacity' }); continue; }

    const pendingOrder = (input.preferences.academyTopicOrderIds ?? []).filter(id => !plannedNewTopicIds.includes(id) && !reservedNewTopicIds.includes(id));
    const preferredId = input.preferences.academyTopicOrderIds?.length ? undefined : input.preferences.introductionTopicId;
    const orderedIds = pendingOrder.length ? pendingOrder : preferredId && !plannedNewTopicIds.includes(preferredId) && !reservedNewTopicIds.includes(preferredId) ? [preferredId] : [];
    const nextTopic = selectNextAcademyTopic(orderedIds, input.catalogTopics, studied);
    const accelerateNewContent = day.focus === 'consolidation'
      && Number.isInteger(input.horizonCapacityGap) && (input.horizonCapacityGap ?? 0) > acceleratedNewTopicIds.length
      && !reservedNewContentDates.has(dateKey);
    const effectiveFocus = accelerateNewContent ? 'new-content' : day.focus;
    const dayPreferences: TrainingPreferences = {
      ...input.preferences,
      minutesByDay:[...input.preferences.minutesByDay] as TrainingPreferences['minutesByDay'],
      calendarEvents:[...(input.preferences.calendarEvents ?? []), {
        id:`weekly-plan-capacity-${dateKey}`, kind:'study-window', title:'Capacidad restante de propuesta',
        startDate:dateKey, endDate:dateKey, studyMinutes:remaining, focus:effectiveFocus,
        createdAt:0, updatedAt:Math.max(0, ...(input.preferences.calendarEvents ?? []).map(event => event.updatedAt)) + 1,
      }],
      ...(nextTopic ? { academyTopicOrderIds:orderedIds, introductionTopicId:undefined } : { academyTopicOrderIds:[], introductionTopicId:undefined }),
    };
    const dailyPlan = buildDailyTrainingPlan({
      preferences:dayPreferences, weekday:new Date(`${dateKey}T12:00:00`).getDay(), dateKey,
      dueCount, cardDueCount, failureCount, weakTopicCount:input.weakTopicCount, weakTopicIds:input.weakTopicIds,
      studiedTopicIds:studied,
      nextNewTopic:nextTopic ? { topicId:nextTopic.id, topicName:nextTopic.name } : undefined,
      topicReviewEvidence:input.topicReviewEvidence,
    });
    let skippedForContent = false;
    const mapped = dailyPlan.activities.flatMap(activity => {
      if (activity.minutes < 5) return [];
      const kind = weeklyKindForTrainingActivity(activity.activity);
      if (!kind) return [];
      let topicIds = activity.activity === 'newContent' && activity.topicId ? [activity.topicId]
        : activity.activity === 'topicTest' && activity.topicId ? [activity.topicId]
          : (activity.topicIds?.length ? activity.topicIds : reviewTopics).slice(0, 20);
      if (input.contentInventory) {
        const available = activity.activity === 'activeRecall' ? input.contentInventory.cardTopicIds
          : activity.activity === 'newContent' ? null
            : activity.activity === 'topicTest' || activity.activity === 'mixedTopicTest' || activity.activity === 'failures'
              ? input.contentInventory.questionTopicIds
              : input.contentInventory.questionTopicIds === null || input.contentInventory.cardTopicIds === null
                ? null : [...new Set([...input.contentInventory.questionTopicIds, ...input.contentInventory.cardTopicIds])];
        if (available === null && activity.activity !== 'newContent') {
          skippedForContent = true;
          omittedContentActivities.push({ dateKey, kind, topicIds });
          return [];
        }
        if (available) {
          const requestedTopicIds = topicIds;
          topicIds = requestedTopicIds.filter(topicId => available.includes(topicId));
          const omittedTopicIds = requestedTopicIds.filter(topicId => !available.includes(topicId));
          if (omittedTopicIds.length) {
            skippedForContent = true;
            omittedContentActivities.push({ dateKey, kind, topicIds:omittedTopicIds });
          }
        }
      }
      if (!topicIds.length) return [];
      const id = `weekly-plan:${input.targetWeekStart}:${dateKey}:${idSequence++}`;
      return [{ id, weekStart:input.targetWeekStart, dateKey, kind, topicIds, minutes:activity.minutes, status:'planned' as const, createdAt:input.agenda.updatedAt, updatedAt:input.agenda.updatedAt }];
    });
    if (!mapped.length) { skippedDays.push({ dateKey, reason:skippedForContent ? 'no-content' : 'no-activities' }); continue; }
    const duplicate = (item: Pick<WeeklyAgendaItem, 'kind' | 'topicIds'>) => {
      const topicsKey = [...item.topicIds].sort().join('|');
      return agendaItems.some(existing => existing.dateKey === dateKey && existing.kind === item.kind && [...existing.topicIds].sort().join('|') === topicsKey)
        || items.some(existing => existing.dateKey === dateKey && existing.kind === item.kind && [...existing.topicIds].sort().join('|') === topicsKey)
        || input.scheduledActivities.some(existing => existing.dateKey === dateKey && existing.activity === item.kind && item.topicIds.length === 1 && item.topicIds[0] === existing.topicId);
    };
    const uniqueMapped = mapped.filter(item => !duplicate(item));
    if (!uniqueMapped.length) { skippedDays.push({ dateKey, reason:'no-activities' }); continue; }
    if (items.length + uniqueMapped.length > availableItemSlots) { skippedDays.push({ dateKey, reason:'no-capacity' }); continue; }
    items.push(...uniqueMapped);
    const newTopic = dailyPlan.activities.find(activity => activity.activity === 'newContent')?.topicId;
    if (newTopic && uniqueMapped.some(item => item.kind === 'newContent' && item.topicIds[0] === newTopic)) {
      plannedNewTopicIds.push(newTopic);
      if (accelerateNewContent) acceleratedNewTopicIds.push(newTopic);
    }
    if (uniqueMapped.some(item => item.kind === 'spacedReviews')) { dueCount = 0; cardDueCount = 0; }
    if (uniqueMapped.some(item => item.kind === 'failures')) failureCount = 0;
  }
  const inventoryStatuses = input.contentInventory ? [input.contentInventory.questionTopicIds, input.contentInventory.cardTopicIds].map(value => value === null ? 'unavailable' : 'manifest') : [];
  const contentInventoryStatus = !input.contentInventory ? 'not-checked' : inventoryStatuses.every(status => status === 'manifest') ? 'manifest' : inventoryStatuses.every(status => status === 'unavailable') ? 'unavailable' : 'partial';
  const horizonCapacityGapBefore = Number.isInteger(input.horizonCapacityGap) && (input.horizonCapacityGap ?? -1) >= 0 ? input.horizonCapacityGap! : null;
  const horizonCapacityGapAfter = horizonCapacityGapBefore === null ? null : Math.max(0, horizonCapacityGapBefore - acceleratedNewTopicIds.length);
  return { baseRevision:input.agenda.revision, targetWeekStart:input.targetWeekStart, items, skippedDays, missingTopicIds, plannedNewTopicIds, contentInventoryStatus, omittedContentActivities, horizonCapacityGapBefore, acceleratedNewTopicIds, horizonCapacityGapAfter };
}

export function applyWeeklyAgendaPlan(current: WeeklyStudyAgenda, proposal: WeeklyAgendaPlanProposal, now: number): WeeklyStudyAgenda | null {
  if (!Number.isFinite(now) || current.revision !== proposal.baseRevision || !isMondayStudyDate(proposal.targetWeekStart)
    || !proposal.items.length || current.items.length + proposal.items.length > MAX_WEEKLY_AGENDA_ITEMS
    || current.items.filter(item => item.weekStart === proposal.targetWeekStart).length + proposal.items.length > 35) return null;
  const ids = new Set(current.items.map(item => item.id));
  if (proposal.items.some(item => !isWeeklyAgendaItem(item) || item.status !== 'planned' || item.weekStart !== proposal.targetWeekStart || ids.has(item.id))) return null;
  const timestamp = Math.max(now, current.updatedAt + 1);
  return { schemaVersion:WEEKLY_AGENDA_SCHEMA_VERSION, revision:current.revision + 1, updatedAt:timestamp,
    items:[...current.items, ...proposal.items.map(item => ({ ...item, createdAt:timestamp, updatedAt:timestamp }))]
      .sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.id.localeCompare(right.id)) };
}

function weeklyKindForTrainingActivity(activity: PlannedTrainingActivity['activity']): WeeklyAgendaKind | null {
  return activity === 'newContent' || activity === 'activeRecall' || activity === 'topicTest' || activity === 'mixedTopicTest' || activity === 'failures' || activity === 'spacedReviews'
    ? activity : null;
}

/** Proposes a bounded recovery into the selected week's future capacity; it never mutates the agenda. */
export function proposeWeeklyAgendaRecovery(input: {
  agenda: WeeklyStudyAgenda;
  targetWeekStart: string;
  todayKey: string;
  preferences: TrainingPreferences;
  seenTopicIds: readonly string[];
  scheduledActivities: readonly ScheduledStudyActivity[];
}): WeeklyAgendaRecoveryProposal | null {
  if (!isMondayStudyDate(input.targetWeekStart) || !isStudyDateKey(input.todayKey)) return null;
  const weekEnd = addStudyDays(input.targetWeekStart, 6);
  if (!weekEnd || weekEnd <= input.todayKey) return null;
  const targetDays = Array.from({ length:7 }, (_, index) => addStudyDays(input.targetWeekStart, index))
    .filter((date): date is string => !!date && date > input.todayKey && date <= weekEnd);
  const pastDue = input.agenda.items.filter(item => item.status === 'planned' && item.dateKey < input.todayKey)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  const targetWeekItems = input.agenda.items.filter(item => item.weekStart === input.targetWeekStart);
  const maxMoves = Math.max(0, Math.min(MAX_WEEKLY_AGENDA_ITEMS - input.agenda.items.length, 35 - targetWeekItems.length));
  const allocated = new Map<string, number>();
  for (const item of targetWeekItems) if (item.status === 'planned') allocated.set(item.dateKey, (allocated.get(item.dateKey) ?? 0) + item.minutes);
  for (const activity of input.scheduledActivities) if (targetDays.includes(activity.dateKey)) allocated.set(activity.dateKey, (allocated.get(activity.dateKey) ?? 0) + activity.minutes);
  const moves: { sourceId: string; sourceUpdatedAt: number; target: WeeklyAgendaItem }[] = [];
  const unplacedIds: string[] = [];
  const seen = new Set(input.seenTopicIds);
  for (const source of pastDue) {
    if (source.kind !== 'newContent' && source.topicIds.some(topicId => !seen.has(topicId))) { unplacedIds.push(source.id); continue; }
    if (moves.length >= maxMoves) { unplacedIds.push(source.id); continue; }
    const dateKey = targetDays.find(day => {
      const available = resolveTrainingDay({ dateKey:day, preferences:input.preferences }).minutes;
      return available > 0 && (allocated.get(day) ?? 0) + source.minutes <= available;
    });
    if (!dateKey) { unplacedIds.push(source.id); continue; }
    const id = `${source.id.slice(0, 80)}:recovery:${dateKey}`;
    if (input.agenda.items.some(item => item.id === id)) { unplacedIds.push(source.id); continue; }
    const used = allocated.get(dateKey) ?? 0;
    allocated.set(dateKey, used + source.minutes);
    moves.push({ sourceId:source.id, sourceUpdatedAt:source.updatedAt, target:{ ...source, id, weekStart:input.targetWeekStart, dateKey, status:'planned', createdAt:input.agenda.updatedAt, updatedAt:input.agenda.updatedAt, recoveryOf:source.id, rescheduledTo:undefined } });
  }
  return { baseRevision:input.agenda.revision, targetWeekStart:input.targetWeekStart, moves, unplacedIds };
}

/** Applies a confirmed proposal only against the exact agenda revision it was prepared from. */
export function applyWeeklyAgendaRecovery(current: WeeklyStudyAgenda, proposal: WeeklyAgendaRecoveryProposal, now: number): WeeklyStudyAgenda | null {
  if (!Number.isFinite(now) || current.revision !== proposal.baseRevision || !isMondayStudyDate(proposal.targetWeekStart)
    || !proposal.moves.length || current.items.length + proposal.moves.length > MAX_WEEKLY_AGENDA_ITEMS
    || current.items.filter(item => item.weekStart === proposal.targetWeekStart).length + proposal.moves.length > 35) return null;
  const byId = new Map(current.items.map(item => [item.id, item]));
  for (const move of proposal.moves) {
    const source = byId.get(move.sourceId);
    if (!source || source.status !== 'planned' || source.updatedAt !== move.sourceUpdatedAt || source.dateKey >= move.target.dateKey
      || move.target.status !== 'planned' || move.target.recoveryOf !== source.id || move.target.weekStart !== proposal.targetWeekStart
      || byId.has(move.target.id)) return null;
  }
  const movedAt = Math.max(now, current.updatedAt + 1);
  for (const move of proposal.moves) {
    const source = byId.get(move.sourceId)!;
    byId.set(source.id, { ...source, status:'rescheduled', rescheduledTo:move.target.dateKey, updatedAt:movedAt });
    byId.set(move.target.id, { ...move.target, createdAt:movedAt, updatedAt:movedAt });
  }
  return { schemaVersion:WEEKLY_AGENDA_SCHEMA_VERSION, revision:current.revision + 1, updatedAt:movedAt,
    items:[...byId.values()].sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.id.localeCompare(right.id)) };
}

function addStudyDays(dateKey: string, days: number): string | null {
  if (!isStudyDateKey(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  const result = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return isStudyDateKey(result) ? result : null;
}

/** Resolves today's confirmed items to the existing daily checkpoint format without touching an active checkpoint. */
export function dailyTrainingPlanFromAgenda(input: {
  plan: DailyTrainingPlan;
  agenda: WeeklyStudyAgenda;
  dateKey: string;
  studiedTopicIds: readonly string[];
}): DailyTrainingPlan {
  if (input.plan.restDay) return input.plan;
  const studied = new Set(input.studiedTopicIds);
  const items = input.agenda.items.filter(item => item.dateKey === input.dateKey && item.status === 'planned'
    && (item.kind === 'newContent' || item.topicIds.every(topicId => studied.has(topicId))));
  if (!items.length) return input.plan;
  const activities: PlannedTrainingActivity[] = items.map(item => {
    const reason: TrainingPlanReason = item.kind === 'newContent' ? 'new-content-day'
      : item.kind === 'activeRecall' ? 'active-recall'
        : item.kind === 'failures' ? 'recurring-failures'
          : item.kind === 'spacedReviews' ? 'due-reviews' : 'coverage';
    return { activity:item.kind, minutes:item.minutes, reason,
      ...(item.kind === 'newContent' ? { topicId:item.topicIds[0] } : undefined),
      ...(item.kind !== 'newContent' ? { topicIds:[...item.topicIds], ...(item.topicIds.length === 1 ? { topicId:item.topicIds[0] } : {}) } : undefined) };
  });
  const totalMinutes = activities.reduce((sum, activity) => sum + activity.minutes, 0);
  if (totalMinutes > input.plan.minutes) return input.plan;
  return { ...input.plan, restDay:false, minutes:totalMinutes, activities };
}

export function findMatchingPlannedAgendaItem(agenda: WeeklyStudyAgenda, dateKey: string, step: TrainingSessionStep): WeeklyAgendaItem | undefined {
  const stepTopics = step.topicIds ?? (step.topicId ? [step.topicId] : []);
  return agenda.items.find(item => item.dateKey === dateKey && item.status === 'planned'
    && item.kind === step.activity && item.minutes === step.minutes && item.topicIds.join('|') === stepTopics.join('|'));
}
