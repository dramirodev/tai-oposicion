import { cleanCfg, cleanCfgSetting } from './config.js';
import { CARD_REVIEW_INTERVALS_DAYS, CALENDAR_DAY_MILLISECONDS } from '../../core/domain/spaced-repetition.js';
import { markLuckyQuestion, markQuestionSyllabusReviewed, recordQuestionAnswer, recordQuestionFailureReason, scheduleDoubtfulQuestion } from '../../core/domain/question-progress.js';
import { scheduleCardWithFsrs } from './fsrs-card-scheduler.js';
import { mergeQuestionProgress, questionProgressNeedsSync } from '../../core/domain/progress-merge.js';
import { mergeSessionHistory, MAX_SESSION_HISTORY } from '../../core/domain/session-history.js';
import { mergeErrorReports } from '../../core/domain/error-reports.js';
import { statsMapper } from './mappers/stats.js';
import { cardMapper } from './mappers/card.js';
import { reportMapper } from './mappers/report.js';
import type { AppState, CardMap, CardRec, Cfg, ReportMap, ReportState, Res, SeenDoc, Session, StatMap, StatRec } from '../legacy/types.js';
import {
  clearPendingLegacyAdoption,
  hasPendingLegacyAdoption,
  hasProgressSnapshot,
  markLegacyProgressForAdoption,
  mirrorStorageKey,
  progressStorageKey,
  readActiveAccount,
  readMirroredProgress,
  readProgressSnapshot,
  unscopedProgressStorageKey,
  writeActiveAccount,
  writeMirroredProgress,
  writeProgressSnapshot,
} from './progress-snapshot-storage.js';
import {
  CARD_RE,
  MAX_CARDS,
  REPORT_STATES,
  cleanCards,
  cleanReports,
  cleanSeen,
  cleanSessions,
  cleanStats,
} from './mappers/stored-progress.js';
export {
  CARD_RE,
  MAX_CARDS,
  REPORT_STATES,
  cleanCard,
  cleanCards,
  cleanRec,
  cleanReports,
  cleanSeen,
  cleanSession,
  cleanSessions,
  cleanStats,
  failureStreak,
  pendingFailure,
} from './mappers/stored-progress.js';
// Almacén local (local-first) + sincronización con Firestore.
// Registro por pregunta: [n, ok, last, box, due, lastRes, flag]
//   n=intentos, ok=aciertos, last=timestamp ms, box=-1 fuera del repaso (0..3 en repaso),
//   due=timestamp ms del próximo repaso, lastRes=1/0/2(blanco), flag=1 dudosa
// Extensión opcional: [10]=racha tras fallo (-1 nunca/ya fuera del historial antiguo, 0..3); [11]=temario repasado (0/1); [12]=fecha del cambio de marca.
let account: string | null = readActiveAccount();
const stateKey = () => progressStorageKey(account);
const mirrorKey = () => mirrorStorageKey(account);
export const accountId = () => account;
const accountListeners = new Set<() => void>();
export const onAccountChange = (fn: () => void) => { accountListeners.add(fn); return () => accountListeners.delete(fn); };

export const MAX_SESIONES = MAX_SESSION_HISTORY;
export const DAY = CALENDAR_DAY_MILLISECONDS;
export const INTERVALS = CARD_REVIEW_INTERVALS_DAYS; // días
export const LUCKY_DAYS = 1; // las acertadas «por suerte» vuelven cada día hasta confirmarlas


const createDictionary = <T = unknown>(): Record<string, T> => Object.create(null);
const isObjectRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const getReports = (): ReportMap => appState.reports || {};
export function addReport(id: string, tema: string, motivo: string, nota = ''): void {
  appState.reports = appState.reports || createDictionary();
  appState.reports[id] = cleanReports({ [id]: { ts: Date.now(), tema, motivo, nota, st: 'abierto' } })[id];
  persist(); emit(); if (syncer && syncer.pushReports) syncer.pushReports(appState.reports);
}
export function setReportState(id: string, st: ReportState): void {
  const result = (appState.reports || {})[id]; if (!result || !REPORT_STATES.includes(st)) return;
  appState.reports[id] = { ...result, st, ts: Date.now() };
  persist(); emit(); if (syncer && syncer.pushReports) syncer.pushReports(appState.reports);
}
export function mergeReports(m0: unknown): boolean {
  const incomingReports = cleanReports(m0);
  appState.reports = appState.reports || createDictionary();
  const toDomain = (reports: ReportMap) => Object.entries(reports).flatMap(([questionId, report]) => {
    const result = reportMapper.toDomain(questionId, report);
    return result.ok ? [result.value] : [];
  });
  const merged = mergeErrorReports(toDomain(appState.reports), toDomain(incomingReports));
  if (!merged.changed) return false;

  const reports = createDictionary<ReportMap[string]>();
  for (const report of merged.reports) reports[report.questionId] = reportMapper.toDto(report);
  appState.reports = reports;
  persist(); emit();
  return true;
}


export interface Syncer { schedule(): void; pushSession?(sessionRecord: Session): void; pushSeen?(seenDocument: SeenDoc): void; pushReports?(reports: ReportMap): void; pushCards?(cards: CardMap): void; pushImport?(): void }
let appState: AppState = load();
const listeners = new Set<() => void>();
let dirty = new Set<string>();
let syncer: Syncer | null = null;

function load(key = stateKey()): AppState {
  try {
    const parsedData = readProgressSnapshot(key) as Partial<AppState> | null;
    if (parsedData && parsedData.stats) return { stats: cleanStats(parsedData.stats), sessions: cleanSessions(parsedData.sessions).slice(0, MAX_SESIONES), cfg: cleanCfg(parsedData.cfg), seen: cleanSeen(parsedData.seen), reports: cleanReports(parsedData.reports), cards: cleanCards(parsedData.cards) };
  } catch {}
  return { stats: createDictionary(), sessions: [], cfg: {}, seen: { t: [], ts: 0 }, reports: createDictionary(), cards: createDictionary() };
}
// La copia antigua queda intacta; solo el propietario puede adoptarla.
export function switchAccount(next: string | null, adoptLegacy = false): void {
  if (account === next) return;
  void flushNow();
  account = next;
  writeActiveAccount(next);
  const hasLocal = hasProgressSnapshot(stateKey());
  appState = load(!hasLocal && adoptLegacy ? unscopedProgressStorageKey() : stateKey());
  if (!hasLocal && adoptLegacy && next) {
    markLegacyProgressForAdoption(next);
  }
  dirty.clear(); persist();
  accountListeners.forEach(fn => fn()); emit();
}
let persistWarned = false;
function persist() {
  if (!writeProgressSnapshot(stateKey(), appState)) {
    // sin espacio o sin permiso: avisar una vez (la copia de IndexedDB sigue intentándose)
    if (!persistWarned) { persistWarned = true; try { dispatchEvent(new Event('tai-persist-error')); } catch {} }
  }
  mirror();
}
// Copia de seguridad en IndexedDB: en iOS, localStorage puede perder las últimas escrituras si se cierra la app enseguida.
let mirrorTimer: ReturnType<typeof setTimeout> | undefined;
function mirror() { clearTimeout(mirrorTimer); mirrorTimer = setTimeout(flushMirror, 150); }
export async function flushMirror(): Promise<void> {
  clearTimeout(mirrorTimer);
  try {
    await writeMirroredProgress(mirrorKey(), appState);
  } catch {}
}
function mergeMirroredCopy(text: string): boolean {
  const parsedData = JSON.parse(text);
  if (!parsedData || typeof parsedData !== 'object') return false;
  let recovered = mergeRemote(parsedData.stats);
  recovered = mergeSessions(parsedData.sessions) || recovered;
  recovered = mergeSeen(parsedData.seen) || recovered;
  recovered = mergeReports(parsedData.reports) || recovered;
  recovered = mergeCards(parsedData.cards) || recovered;
  if (parsedData.cfg && typeof parsedData.cfg === 'object') {
    const cleanedConfig = cleanCfg(parsedData.cfg);
    for (const configKey in cleanedConfig) {
      if (!(configKey in appState.cfg)) { appState.cfg[configKey] = cleanedConfig[configKey]; recovered = true; }
    }
  }
  return recovered;
}

// Al arrancar: fusiona lo que haya en la copia de IndexedDB (gana siempre lo más reciente). Devuelve true si recuperó algo.
export async function recover(): Promise<boolean> {
  try {
    const key = mirrorKey();
    const legacy = hasPendingLegacyAdoption(account);
    const copies = await readMirroredProgress([key, ...(legacy ? ['state'] : [])]);
    if (key !== mirrorKey()) return false;
    let recoveredProgress = false;
    for (const text of copies) if (text) recoveredProgress = mergeMirroredCopy(text) || recoveredProgress;
    if (recoveredProgress) { persist(); emit(); }
    if (legacy) clearPendingLegacyAdoption(account);
    return recoveredProgress;
  } catch { return false; }
}
export function flushNow(): Promise<void> { writeProgressSnapshot(stateKey(), appState); return flushMirror(); }
export function onChange(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
export const subscribe: (fn: () => void) => () => void = onChange;
function emit() { listeners.forEach(listener => listener()); }

export const getStats = (): StatMap => appState.stats;
export const getSessions = (): Session[] => appState.sessions;
export const getCfg = (): Cfg => appState.cfg;
// Temas vistos (se sincroniza como un único documento; gana el cambio más reciente)
export const getSeen = (): string[] => (appState.seen && appState.seen.t) || [];
export const getSeenDoc = (): SeenDoc => appState.seen || { t: [], ts: 0 };
export function setSeen(arr: Iterable<string>): void {
  appState.seen = { t: [...arr].sort(), ts: Date.now() };
  persist(); emit();
  if (syncer && syncer.pushSeen) syncer.pushSeen(appState.seen);
}
export function mergeSeen(r0: unknown): boolean {
  if (!isObjectRecord(r0) || !Array.isArray(r0.t)) return false;
  const result = cleanSeen(r0);
  if (!appState.seen || (result.ts || 0) > (appState.seen.ts || 0)) { appState.seen = { t: result.t, ts: result.ts || 0 }; persist(); emit(); return true; }
  return false;
}
export function setCfg(key: string, itemValue: unknown): void {
  const value = cleanCfgSetting(key, itemValue);
  if (value === undefined) return;
  appState.cfg[key] = value; persist(); emit();
}
export function replaceCfg(cfg: unknown): void {
  appState.cfg = cleanCfg(cfg);
  persist(); emit();
}
export const rec = (id: string): StatRec | undefined => appState.stats[id];
export const temaDe = (): string | null => {
  // los ids no codifican el tema; se guarda el tema junto al registro en meta (ver main.js)
  return null;
};

export function setSyncer(state: Syncer | null): void { syncer = state; }
export function takeDirty() { const data = dirty; dirty = new Set(); return data; }
export function markDirty(tema: string): void { dirty.add(tema); }

// Aplica un resultado: res = 1 acierto, 0 fallo, 2 blanco
// secs (opcional): segundos que tardó en contestar; se acumulan para detectar preguntas lentas
export function record(id: string, tema: string, res: Res, now = Date.now(), secs?: number): void {
  const persistedRecord = appState.stats[id];
  const mapped = persistedRecord ? statsMapper.toDomain(persistedRecord) : null;
  const statistics = recordQuestionAnswer(mapped?.ok ? mapped.value : undefined, res, now, secs);
  const statRecord = statsMapper.toDto(statistics);
  // Keep the historic 12-slot tuple expected by sync clients and old records.
  while (statRecord.length < 12) statRecord.push(0);
  appState.stats[id] = statRecord;
  dirty.add(tema);
  persist(); emit();
  if (syncer) syncer.schedule();
}
// «Acerté dudando»: el acierto ya está registrado; la pregunta entra (o vuelve) a la cola a +2 días.
export function doubt(id: string, tema: string, now = Date.now()): void {
  const statRecord = appState.stats[id]; if (!statRecord) return;
  const mapped = statsMapper.toDomain(statRecord);
  if (!mapped.ok) return;
  const updated = scheduleDoubtfulQuestion(mapped.value, now);
  if (!updated) return;
  appState.stats[id] = statsMapper.toDto(updated);
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
// Motivo del último fallo: 1 contenido, 2 trampa, 3 duda entre dos, 4 despiste (saca la pregunta de la cola), 5 no lo sabía
export function setMotivo(id: string, tema: string, reasonCode: number, now = Date.now()): void {
  const statRecord = appState.stats[id]; if (!statRecord) return;
  const mapped = statsMapper.toDomain(statRecord);
  if (!mapped.ok) return;
  const updated = recordQuestionFailureReason(mapped.value, reasonCode, now);
  if (!updated) return;
  appState.stats[id] = statsMapper.toDto(updated);
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
// «Fue suerte»: acierto sin saberlo; entra (o vuelve) a la cola a +1 día y debe acertarse 2 veces seguidas para quitar la marca y queda anotado (r[9] = 6)
export function suerte(id: string, tema: string, now = Date.now()): void {
  const statRecord = appState.stats[id]; if (!statRecord) return;
  const mapped = statsMapper.toDomain(statRecord);
  if (!mapped.ok) return;
  const updated = markLuckyQuestion(mapped.value, now);
  if (!updated) return;
  appState.stats[id] = statsMapper.toDto(updated);
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
export function toggleFlag(id: string, tema: string): number {
  const statRecord = appState.stats[id] || [0, 0, Date.now(), -1, 0, 0, 0, 0, 0];
  statRecord[6] = statRecord[6] ? 0 : 1; statRecord[2] = Date.now();
  appState.stats[id] = statRecord; dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
  return statRecord[6];
}
// Marca independiente de respuestas y del calendario; viaja en el mismo registro sincronizado.
export function setReviewed(id: string, tema: string, value: boolean): void {
  const statRecord = appState.stats[id]; if (!statRecord || typeof value !== 'boolean') return;
  const mapped = statsMapper.toDomain(statRecord);
  if (!mapped.ok) return;
  const updated = markQuestionSyllabusReviewed(mapped.value, value, Date.now());
  if (!updated) return;
  appState.stats[id] = statsMapper.toDto(updated); // reloj independiente: no cambia el día de estudio
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
export function addSession(newSession: Session): void {
  appState.sessions.unshift(newSession);
  appState.sessions = appState.sessions.slice(0, MAX_SESIONES);
  persist(); emit();
  if (syncer?.pushSession) syncer.pushSession(newSession);
}
// [12] fecha de cambio de la marca de temario; independiente del resultado [2].
export const reviewClock = (statRecord?: StatRec) => statRecord ? (statRecord[12] ?? (statRecord[11] === 1 ? statRecord[2] : 0)) : 0;
export const needsSync = (local: StatRec, remote?: StatRec) => {
  const localProgress = statsMapper.toDomain(local);
  if (!remote) return true;
  const remoteProgress = statsMapper.toDomain(remote);
  return localProgress.ok && remoteProgress.ok
    ? questionProgressNeedsSync(localProgress.value, remoteProgress.value)
    : local[2] > remote[2] || reviewClock(local) > reviewClock(remote);
};
// Mezcla registros remotos (gana el más reciente por pregunta). Devuelve true si cambió algo local.
export function mergeRemote(map0: unknown): boolean {
  const map = cleanStats(map0);
  let changed = false;
  for (const id of Object.keys(map)) {
    const statRecord = appState.stats[id], statRecordItem = map[id];
    if (!statRecord) { appState.stats[id] = statRecordItem; changed = true; continue; }
    const currentProgress = statsMapper.toDomain(statRecord), incomingProgress = statsMapper.toDomain(statRecordItem);
    if (!currentProgress.ok || !incomingProgress.ok) continue;
    const merged = statsMapper.toDto(mergeQuestionProgress(currentProgress.value, incomingProgress.value));
    if (JSON.stringify(statRecord) !== JSON.stringify(merged)) { appState.stats[id] = merged; changed = true; }
  }
  if (changed) { persist(); emit(); }
  return changed;
}
export function mergeSessions(list0: unknown): boolean {
  const list = cleanSessions(list0);
  const merged = mergeSessionHistory(appState.sessions, list, MAX_SESIONES);
  if (merged.changed) { appState.sessions = [...merged.sessions]; persist(); emit(); }
  return merged.changed;
}
// ── API de tarjetas ──
const deletedCard = (result?: CardRec) => result?.[5] === -1;
// El documento completo incluye borrados para evitar que otra copia resucite una tarjeta.
export const getCardsDoc = (): CardMap => appState.cards || (appState.cards = createDictionary());
export const getCards = (): CardMap => Object.fromEntries(Object.entries(getCardsDoc()).filter(([, result]) => !deletedCard(result)));
export const cardRec = (id: string): CardRec | undefined => { const result = getCardsDoc()[id]; return deletedCard(result) ? undefined : result; };
function preserveFsrsOnLegacyCardUpdate(stored: CardRec, incoming: CardRec, original: unknown): CardRec {
  const current = cardMapper.toDomain(stored), updated = cardMapper.toDomain(incoming);
  if (!current.ok || !current.value.fsrs || !updated.ok || updated.value.fsrs) return incoming;
  const hasExplicitGrade = Array.isArray(original) && original.length >= 6
    && Number.isInteger(original[5]) && original[5] >= 0 && original[5] <= 2;
  const migrated = hasExplicitGrade
    ? scheduleCardWithFsrs(current.value, original[5] as 0 | 1 | 2, incoming[2], stored[2])
    : { ...current.value, lastReviewedAt: Math.max(current.value.lastReviewedAt, updated.value.lastReviewedAt) };
  migrated.attempts = updated.value.attempts;
  migrated.known = updated.value.known;
  return cardMapper.toDto(migrated);
}
export function mergeCards(m0: unknown): boolean {
  const incomingCards = cleanCards(m0); appState.cards = appState.cards || createDictionary(); let changed = false;
  for (const cardId of Object.keys(incomingCards)) {
    const storedCard = appState.cards[cardId], incomingCard = incomingCards[cardId];
    if (!storedCard || incomingCard[2] > storedCard[2]) {
      const raw = m0 && typeof m0 === 'object' ? (m0 as Record<string, unknown>)[cardId] : undefined;
      appState.cards[cardId] = storedCard && !deletedCard(incomingCard)
        ? preserveFsrsOnLegacyCardUpdate(storedCard, incomingCard, raw)
        : incomingCard;
      changed = true;
    }
  }
  if (changed) { persist(); emit(); }
  return changed;
}
// Crea la tarjeta de un fallo (vence hoy). Si ya existe, no la toca. Devuelve true si la creó.
export function addFallo(qid: string, now = Date.now()): boolean {
  const id = 'FC-Q-' + qid; if (!CARD_RE.test(id)) return false;
  appState.cards = appState.cards || createDictionary(); if (cardRec(id)) return false;
  if (Object.keys(appState.cards).length >= MAX_CARDS) return false;
  appState.cards[id] = [0, 0, Math.max(now, (appState.cards[id]?.[2] || 0) + 1), 0, now, 0];
  persist(); emit(); if (syncer && syncer.pushCards) syncer.pushCards(appState.cards); return true;
}
export function removeCard(id: string): void {
  const result = cardRec(id); if (!result) return;
  appState.cards[id] = [0, 0, Math.max(Date.now(), result[2] + 1), -1, 0, -1];
  persist(); emit(); if (syncer && syncer.pushCards) syncer.pushCards(appState.cards);
}
// Valora una tarjeta con FSRS: 0 fallé · 1 dudaba · 2 lo sabía.
export function gradeCard(id: string, grade: number, now = Date.now()): CardRec | null {
  if (!CARD_RE.test(id) || ![0, 1, 2].includes(grade)) return null;
  appState.cards = appState.cards || createDictionary();
  const current = cardRec(id);
  const mapped = current ? cardMapper.toDomain(current) : null;
  const graded = scheduleCardWithFsrs(mapped?.ok ? mapped.value : undefined, grade as 0 | 1 | 2, now, appState.cards[id]?.[2] || 0);
  const cardRecord = cardMapper.toDto(graded);
  appState.cards[id] = cardRecord; persist(); emit(); if (syncer && syncer.pushCards) syncer.pushCards(appState.cards);
  return cardRecord;
}
export function exportAll(): string { return JSON.stringify(appState); }
function parseImportedProgress(txt: unknown): Record<string, unknown> {
  if (typeof txt !== 'string' || txt.length > 20e6) throw new Error('Archivo no válido');
  const parsedData = JSON.parse(txt);
  if (!parsedData || typeof parsedData !== 'object' || !parsedData.stats || typeof parsedData.stats !== 'object') throw new Error('Archivo no válido');
  return parsedData;
}
export function importAll(txt: unknown): void {
  const parsedData = parseImportedProgress(txt);
  mergeRemote(parsedData.stats);
  mergeSessions(parsedData.sessions || []);
  if (parsedData.seen) mergeSeen(parsedData.seen);
  if (parsedData.reports) mergeReports(parsedData.reports);
  if (parsedData.cards) mergeCards(parsedData.cards);
  if (parsedData.cfg) { appState.cfg = { ...appState.cfg, ...cleanCfg(parsedData.cfg) }; persist(); emit(); }
  syncer?.pushImport?.();
}
export function resetAll(): void { appState = { stats: createDictionary(), sessions: [], cfg: {}, seen: { t: [], ts: 0 }, reports: createDictionary(), cards: createDictionary() }; persist(); emit(); }
