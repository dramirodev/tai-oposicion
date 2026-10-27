import { failureStreak as deriveFailureStreak } from '../../../core/domain/spaced-repetition.js';
import type {
  CardMap,
  CardRec,
  Report,
  ReportMap,
  ReportState,
  SeenDoc,
  Session,
  StatMap,
  StatRec,
} from '../dto/stored-progress.js';

const boundedNumber = (value: unknown, minimum = 0, maximum = 1e13): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : null;
const ID_PATTERN = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9._\-~]{1,48}$/;
const TOPIC_ID_PATTERN = /^T\d\.\d\d$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const createDictionary = <Value = unknown>(): Record<string, Value> => Object.create(null);

// Adapt legacy persisted arrays/objects into the canonical safe shape without changing defaults.
export function failureStreak(statRecord?: StatRec | null): number {
  if (!statRecord) return -1;
  return deriveFailureStreak({
    attempts: statRecord[0],
    lastResult: statRecord[5],
    intervalStep: statRecord[3],
    ...(statRecord.length > 10
      ? { failureStreak: Math.floor(boundedNumber(statRecord[10], -1, 3) ?? -1) }
      : {}),
  });
}

export const pendingFailure = (statRecord?: StatRec | null): boolean => {
  const count = failureStreak(statRecord);
  return count >= 0 && count < 3;
};

export function cleanRec(result: unknown): StatRec | null {
  if (!Array.isArray(result) || result.length < 3) return null;
  const attempts = boundedNumber(result[0], 0, 1e6);
  const correctAnswers = boundedNumber(result[1], 0, 1e6);
  const lastSeenAt = boundedNumber(result[2]);
  if (attempts === null || correctAnswers === null || lastSeenAt === null) return null;

  const intervalStep = boundedNumber(result[3], -1, 4);
  const dueAt = boundedNumber(result[4]);
  const lastResult = boundedNumber(result[5], 0, 2);
  const doubtful = boundedNumber(result[6], 0, 1);
  const failureReason = boundedNumber(result[9], 0, 8) || 0;
  const totalTimedSeconds = boundedNumber(result[7], 0, 1e7) || 0;
  const timedAnswerCount = Math.min(boundedNumber(result[8], 0, 1e6) || 0, attempts);
  const cleanedRecord = [
    attempts,
    Math.min(correctAnswers, attempts),
    lastSeenAt,
    intervalStep === null ? -1 : Math.floor(intervalStep),
    dueAt || 0,
    lastResult === null ? 0 : Math.floor(lastResult),
    doubtful ? 1 : 0,
    timedAnswerCount ? totalTimedSeconds : 0,
    timedAnswerCount,
    Math.floor(failureReason),
  ];
  if (result.length > 10) {
    cleanedRecord.push(
      Math.floor(boundedNumber(result[10], -1, 3) ?? failureStreak(cleanedRecord)),
      result[11] === 1 ? 1 : 0,
    );
  }
  if (result.length > 12) cleanedRecord.push(boundedNumber(result[12]) || 0);
  else if (result[11] === 1) cleanedRecord.push(lastSeenAt);
  return cleanedRecord;
}

export function cleanStats(map: unknown): StatMap {
  const result = createDictionary<StatRec>();
  if (!map || typeof map !== 'object') return result;
  for (const id of Object.keys(map)) {
    if (!ID_PATTERN.test(id)) continue;
    const record = cleanRec((map as Record<string, unknown>)[id]);
    if (record) result[id] = record;
  }
  return result;
}

export const CARD_RE = /^FC-[A-Za-z0-9._~-]{1,60}$/;
export const MAX_CARDS = 8000;

export function cleanCard(result: unknown): CardRec | null {
  if (!Array.isArray(result) || result.length < 5) return null;
  const reviewCount = boundedNumber(result[0], 0, 1e6);
  const knownCount = boundedNumber(result[1], 0, 1e6);
  const updatedAt = boundedNumber(result[2]);
  if (reviewCount === null || knownCount === null || updatedAt === null) return null;
  if (result[5] === -1) return [0, 0, updatedAt, -1, 0, -1];

  const intervalStep = boundedNumber(result[3], -1, 4);
  const dueAt = boundedNumber(result[4]);
  const lastGrade = boundedNumber(result[5], 0, 2);
  return [
    reviewCount,
    Math.min(knownCount, reviewCount),
    updatedAt,
    intervalStep === null ? -1 : Math.floor(intervalStep),
    dueAt || 0,
    lastGrade === null ? 0 : Math.floor(lastGrade),
  ];
}

export function cleanCards(map: unknown): CardMap {
  const result = createDictionary<CardRec>();
  let keyCount = 0;
  if (!map || typeof map !== 'object') return result;
  for (const id of Object.keys(map)) {
    if (!CARD_RE.test(id)) continue;
    const record = cleanCard((map as Record<string, unknown>)[id]);
    if (!record) continue;
    result[id] = record;
    if (++keyCount >= MAX_CARDS) break;
  }
  return result;
}

function cleanBreakdown(value: unknown, isValidKey: (key: string) => boolean): Session['temas'] {
  const result = createDictionary<[number, number]>();
  if (!isRecord(value)) return result;
  for (const [key, counts] of Object.entries(value)) {
    if (!Array.isArray(counts)) continue;
    const correct = boundedNumber(counts[0], 0, 1e5);
    const total = boundedNumber(counts[1], 0, 1e5);
    if (isValidKey(key) && correct !== null && total !== null
      && typeof counts[0] === 'number' && typeof counts[1] === 'number') {
      result[key] = [counts[0], counts[1]];
    }
  }
  return result;
}

export function cleanSession(value: unknown): Session | null {
  if (!isRecord(value)) return null;
  const sessionId = typeof value.id === 'string' && ID_PATTERN.test(value.id) ? value.id : null;
  const timestamp = boundedNumber(value.ts);
  if (!sessionId || timestamp === null) return null;

  const topics = cleanBreakdown(value.temas, topicId => TOPIC_ID_PATTERN.test(topicId));
  const types = cleanBreakdown(value.tipos, questionType => /^[A-Za-z0-9]{1,3}$/.test(questionType));

  return {
    id: sessionId,
    ts: timestamp,
    kind: (['sim', 'rev', 'test'] as const).find(kind => kind === value.kind) ?? 'test',
    n: boundedNumber(value.n, 0, 1e4) ?? 0,
    a: boundedNumber(value.a, 0, 1e4) ?? 0,
    f: boundedNumber(value.f, 0, 1e4) ?? 0,
    b: boundedNumber(value.b, 0, 1e4) ?? 0,
    secs: boundedNumber(value.secs, 0, 1e6) ?? 0,
    nota: boundedNumber(value.nota, -100, 100) ?? 0,
    temas: topics,
    tipos: types,
    fails: Array.isArray(value.fails)
      ? value.fails.filter((id: unknown): id is string => typeof id === 'string' && ID_PATTERN.test(id)).slice(0, 500)
      : [],
    titulo: typeof value.titulo === 'string' ? value.titulo.slice(0, 80) : '',
    ...(value.interrupted === true ? { interrupted: true } : {}),
    ...(value.porTiempo === true ? { porTiempo: true } : {}),
  };
}

export function cleanSessions(value: unknown): Session[] {
  return (Array.isArray(value) ? value : [])
    .map(cleanSession)
    .filter((session): session is Session => !!session);
}

export const REPORT_STATES: ReportState[] = ['abierto', 'resuelto', 'quitado'];

export function cleanReports(metadata: unknown): ReportMap {
  const result = createDictionary<Report>();
  if (!metadata || typeof metadata !== 'object') return result;
  for (const id of Object.keys(metadata)) {
    const value = (metadata as Record<string, unknown>)[id];
    if (!ID_PATTERN.test(id) || !isRecord(value)) continue;
    const timestamp = boundedNumber(value.ts);
    if (timestamp === null) continue;
    result[id] = {
      ts: timestamp,
      tema: typeof value.tema === 'string' && TOPIC_ID_PATTERN.test(value.tema) ? value.tema : '',
      motivo: typeof value.motivo === 'string' ? value.motivo.slice(0, 60) : '',
      nota: typeof value.nota === 'string' ? value.nota.slice(0, 300) : '',
      st: REPORT_STATES.find(state => state === value.st) || 'abierto',
    };
  }
  return result;
}

export function cleanSeen(value: unknown): SeenDoc {
  if (!isRecord(value) || !Array.isArray(value.t)) return { t: [], ts: 0 };
  return {
    t: value.t.filter((topic: unknown): topic is string => typeof topic === 'string' && TOPIC_ID_PATTERN.test(topic)).slice(0, 100),
    ts: boundedNumber(value.ts) || 0,
  };
}
