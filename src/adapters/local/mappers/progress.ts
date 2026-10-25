import type { UserProgress, QuestionStats, SessionResult, ErrorReport, CardReview } from '../../../core/domain/entities.js';
import type { ProgressDto } from '../dto/progress.js';
import { statsMapper } from './stats.js';
import { sessionMapper } from './session.js';
import { reportMapper } from './report.js';
import { cardMapper } from './card.js';

type ProgressMappingResult =
  | { ok: true; value: UserProgress; warnings: string[] }
  | { ok: false; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const progressMapper = {
  toDomain(dto: unknown): ProgressMappingResult {
    // TODO(zod): validate ProgressDto before mapping.
    if (!isRecord(dto)) return { ok: false, reason: 'Progreso inválido' };
    const d = dto;
    if (Object.keys(d).some((key) => !['stats', 'sessions', 'cfg', 'seen', 'reports', 'cards'].includes(key))) {
      return { ok: false, reason: 'Campo de progreso desconocido' };
    }
    if (
      !isRecord(d.stats) || !Array.isArray(d.sessions) || !isRecord(d.cfg)
      || !isRecord(d.seen) || !isRecord(d.reports) || !isRecord(d.cards)
      || Object.keys(d.seen).some((key) => !['t', 'ts'].includes(key))
      || !Array.isArray(d.seen.t) || !d.seen.t.every((topic) => typeof topic === 'string')
      || typeof d.seen.ts !== 'number'
    ) return { ok: false, reason: 'Progreso incompleto' };

    const warnings: string[] = [];
    const statistics: Record<string, QuestionStats> = {};
    const reports: Record<string, ErrorReport> = {};
    const cardReviews: Record<string, CardReview> = {};
    const sessions: SessionResult[] = [];

    for (const [id, raw] of Object.entries(d.stats)) {
      const mapped = statsMapper.toDomain(raw);
      if (mapped.ok) statistics[id] = mapped.value;
      else warnings.push(`stats.${id}: ${mapped.reason}`);
    }
    d.sessions.forEach((raw, index) => {
      const mapped = sessionMapper.toDomain(raw);
      if (mapped.ok) sessions.push(mapped.value);
      else warnings.push(`sessions[${index}]: ${mapped.reason}`);
    });
    for (const [id, raw] of Object.entries(d.reports)) {
      const mapped = reportMapper.toDomain(id, raw);
      if (mapped.ok) reports[id] = mapped.value;
      else warnings.push(`reports.${id}: ${mapped.reason}`);
    }
    for (const [id, raw] of Object.entries(d.cards)) {
      const mapped = cardMapper.toDomain(raw);
      if (mapped.ok) cardReviews[id] = mapped.value;
      else warnings.push(`cards.${id}: ${mapped.reason}`);
    }

    return {
      ok: true,
      value: {
        statistics,
        sessions,
        preferences: d.cfg,
        seenTopics: d.seen.t,
        seenAt: d.seen.ts,
        reports,
        cardReviews,
      },
      warnings,
    };
  },

  toDto(progress: UserProgress): ProgressDto {
    return {
      stats: Object.fromEntries(Object.entries(progress.statistics).map(([id, value]) => [id, statsMapper.toDto(value)])),
      sessions: progress.sessions.map(sessionMapper.toDto),
      cfg: progress.preferences,
      seen: { t: progress.seenTopics, ts: progress.seenAt },
      reports: Object.fromEntries(Object.entries(progress.reports).map(([id, value]) => [id, reportMapper.toDto(value)])),
      cards: Object.fromEntries(Object.entries(progress.cardReviews).map(([id, value]) => [id, cardMapper.toDto(value)])),
    };
  },
};
