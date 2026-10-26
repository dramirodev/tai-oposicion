import { cleanCfg, cleanCfgSetting } from './config.js';
import { failureStreak as deriveFailureStreak, CARD_REVIEW_INTERVALS_DAYS, CALENDAR_DAY_MILLISECONDS } from '../../core/domain/spaced-repetition.js';
import type { AppState, CardMap, CardRec, Cfg, Report, ReportMap, ReportState, Res, SeenDoc, Session, StatMap, StatRec } from '../legacy/types.js';
// Almacén local (local-first) + sincronización con Firestore.
// Registro por pregunta: [n, ok, last, box, due, lastRes, flag]
//   n=intentos, ok=aciertos, last=timestamp ms, box=-1 fuera del repaso (0..3 en repaso),
//   due=timestamp ms del próximo repaso, lastRes=1/0/2(blanco), flag=1 dudosa
// Extensión opcional: [10]=racha tras fallo (-1 nunca/ya fuera del historial antiguo, 0..3); [11]=temario repasado (0/1); [12]=fecha del cambio de marca.
const LEGACY_KEY = 'tai.v1';
let account: string | null = (() => { try { return localStorage.getItem('tai.account'); } catch { return null; } })();
const stateKey = () => account ? LEGACY_KEY + ':' + account : LEGACY_KEY + ':guest';
const mirrorKey = () => account ? 'state:' + account : 'state:guest';
export const accountId = () => account;
const accountListeners = new Set<() => void>();
export const onAccountChange = (fn: () => void) => { accountListeners.add(fn); return () => accountListeners.delete(fn); };

export const MAX_SESIONES = 300;
export const DAY = CALENDAR_DAY_MILLISECONDS;
export const INTERVALS = CARD_REVIEW_INTERVALS_DAYS; // días
export const LUCKY_DAYS = 1; // las acertadas «por suerte» vuelven cada día hasta confirmarlas


// ── Validación de datos externos (localStorage, Firestore, archivos importados) ──
const boundedNumber = (value: unknown, lo = 0, hi = 1e13): number | null => (typeof value === 'number' && isFinite(value)) ? Math.min(hi, Math.max(lo, value)) : null;
const ID_RE = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9._\-~]{1,48}$/;
const createDictionary = <T = unknown>(): Record<string, T> => Object.create(null);
const isObjectRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const TOPIC_ID_PATTERN = /^T\d\.\d\d$/;
// El historial antiguo no guarda la racha: las pendientes existentes parten de cero.
export function failureStreak(statRecord?: StatRec | null): number {
  if (!statRecord) return -1;
  return deriveFailureStreak({
    attempts: statRecord[0],
    lastResult: statRecord[5],
    intervalStep: statRecord[3],
    ...(statRecord.length > 10 ? { failureStreak: Math.floor(boundedNumber(statRecord[10], -1, 3) ?? -1) } : {}),
  });
}
export const pendingFailure = (statRecord?: StatRec | null) => { const count = failureStreak(statRecord); return count >= 0 && count < 3; };
export function cleanRec(result: unknown): StatRec | null {
  if (!Array.isArray(result) || result.length < 3) return null;
  const attempts = boundedNumber(result[0], 0, 1e6), correctAnswers = boundedNumber(result[1], 0, 1e6), lastSeenAt = boundedNumber(result[2]);
  if (attempts === null || correctAnswers === null || lastSeenAt === null) return null;
  const intervalStep = boundedNumber(result[3], -1, 4), dueAt = boundedNumber(result[4]), lastResult = boundedNumber(result[5], 0, 2), doubtful = boundedNumber(result[6], 0, 1);
  const failureReason = boundedNumber(result[9], 0, 8) || 0;
  const totalTimedSeconds = boundedNumber(result[7], 0, 1e7) || 0;
  const timedAnswerCount = Math.min(boundedNumber(result[8], 0, 1e6) || 0, attempts);
  const cleanedRecord = [attempts, Math.min(correctAnswers, attempts), lastSeenAt, intervalStep === null ? -1 : Math.floor(intervalStep), dueAt || 0, lastResult === null ? 0 : Math.floor(lastResult), doubtful ? 1 : 0, timedAnswerCount ? totalTimedSeconds : 0, timedAnswerCount, Math.floor(failureReason)];
  if (result.length > 10) cleanedRecord.push(Math.floor(boundedNumber(result[10], -1, 3) ?? failureStreak(cleanedRecord)), result[11] === 1 ? 1 : 0);
  if (result.length > 12) cleanedRecord.push(boundedNumber(result[12]) || 0);
  else if (result[11] === 1) cleanedRecord.push(lastSeenAt);
  return cleanedRecord;
}
export function cleanStats(map: unknown): StatMap {
  const out = createDictionary<StatRec>();
  if (!map || typeof map !== 'object') return out;
  for (const id of Object.keys(map)) { if (!ID_RE.test(id)) continue; const statRecord = cleanRec((map as Record<string, unknown>)[id]); if (statRecord) out[id] = statRecord; }
  return out;
}
// ── Tarjetas (flashcards): { idTarjeta: [n, ok, last, box, due, lastGrade] } ──
// n=veces repasada, ok=veces «lo sabía», box=-1 dominada (0..4 en repaso), due=próximo repaso, lastGrade=0 fallé/1 dudaba/2 lo sabía
export const CARD_RE = /^FC-[A-Za-z0-9._~-]{1,60}$/;
export const MAX_CARDS = 8000; // ≈70 B por tarjeta: queda por debajo del límite de 1 MB por documento de Firestore
export function cleanCard(result: unknown): CardRec | null {
  if (!Array.isArray(result) || result.length < 5) return null;
  const reviewCount = boundedNumber(result[0], 0, 1e6), knownCount = boundedNumber(result[1], 0, 1e6), updatedAt = boundedNumber(result[2]);
  if (reviewCount === null || knownCount === null || updatedAt === null) return null;
  if (result[5] === -1) return [0, 0, updatedAt, -1, 0, -1]; // marca de borrado sincronizada
  const intervalStep = boundedNumber(result[3], -1, 4), dueAt = boundedNumber(result[4]), lastGrade = boundedNumber(result[5], 0, 2);
  return [reviewCount, Math.min(knownCount, reviewCount), updatedAt, intervalStep === null ? -1 : Math.floor(intervalStep), dueAt || 0, lastGrade === null ? 0 : Math.floor(lastGrade)];
}
export function cleanCards(map: unknown): CardMap {
  const out = createDictionary<CardRec>(); let keyIndex = 0;
  if (!map || typeof map !== 'object') return out;
  for (const id of Object.keys(map)) { if (!CARD_RE.test(id)) continue; const result = cleanCard((map as Record<string, unknown>)[id]); if (result) { out[id] = result; if (++keyIndex >= MAX_CARDS) break; } }
  return out;
}
export function cleanSession(value: unknown): Session | null {
  if (!isObjectRecord(value)) return null;
  const sessionData = value;
  const sessionId = typeof sessionData.id === 'string' && ID_RE.test(sessionData.id) ? sessionData.id : null, timestamp = boundedNumber(sessionData.ts);
  if (!sessionId || timestamp === null) return null;
  const temas: Session['temas'] = {};
  if (isObjectRecord(sessionData.temas)) for (const topicId in sessionData.temas) {
    const topicCounts = sessionData.temas[topicId];
    const correctRaw = Array.isArray(topicCounts) ? topicCounts[0] : undefined;
    const totalRaw = Array.isArray(topicCounts) ? topicCounts[1] : undefined;
    const correct = boundedNumber(correctRaw, 0, 1e5), total = boundedNumber(totalRaw, 0, 1e5);
    if (TOPIC_ID_PATTERN.test(topicId) && correct !== null && total !== null && typeof correctRaw === 'number' && typeof totalRaw === 'number') temas[topicId] = [correctRaw, totalRaw];
  }
  const tipos: Session['tipos'] = {};
  if (isObjectRecord(sessionData.tipos)) for (const questionType in sessionData.tipos) {
    const typeCounts = sessionData.tipos[questionType];
    const correctRaw = Array.isArray(typeCounts) ? typeCounts[0] : undefined;
    const totalRaw = Array.isArray(typeCounts) ? typeCounts[1] : undefined;
    const correct = boundedNumber(correctRaw, 0, 1e5), total = boundedNumber(totalRaw, 0, 1e5);
    if (/^[A-Za-z0-9]{1,3}$/.test(questionType) && correct !== null && total !== null && typeof correctRaw === 'number' && typeof totalRaw === 'number') tipos[questionType] = [correctRaw, totalRaw];
  }
  return {
    id: sessionId, ts: timestamp, kind: (['sim', 'rev', 'test'] as const).find(key => key === sessionData.kind) ?? 'test',
    n: boundedNumber(sessionData.n, 0, 1e4) ?? 0, a: boundedNumber(sessionData.a, 0, 1e4) ?? 0, f: boundedNumber(sessionData.f, 0, 1e4) ?? 0, b: boundedNumber(sessionData.b, 0, 1e4) ?? 0,
    secs: boundedNumber(sessionData.secs, 0, 1e6) ?? 0, nota: boundedNumber(sessionData.nota, -100, 100) ?? 0, temas, tipos,
    fails: Array.isArray(sessionData.fails) ? sessionData.fails.filter((value: unknown): value is string => typeof value === 'string' && ID_RE.test(value)).slice(0, 500) : [],
    titulo: typeof sessionData.titulo === 'string' ? sessionData.titulo.slice(0, 80) : '',
    ...(sessionData.interrupted === true ? { interrupted: true } : {}),
    ...(sessionData.porTiempo === true ? { porTiempo: true } : {})
  };
}
export function cleanSessions(value: unknown): Session[] { return (Array.isArray(value) ? value : []).map(cleanSession).filter((sessionRecord): sessionRecord is Session => !!sessionRecord); }

// ── Informes de errores del banco: { idPregunta: {ts, tema, motivo, nota, st} } ──
const REP_ST: ReportState[] = ['abierto', 'resuelto', 'quitado'];
export function cleanReports(metadata: unknown): ReportMap {
  const out = createDictionary<Report>();
  if (!metadata || typeof metadata !== 'object') return out;
  for (const id of Object.keys(metadata)) {
    const result = (metadata as Record<string, unknown>)[id]; if (!ID_RE.test(id) || !isObjectRecord(result)) continue;
    const ts = boundedNumber(result.ts); if (ts === null) continue;
    const state = REP_ST.find(candidate => candidate === result.st) || 'abierto';
    out[id] = { ts, tema: typeof result.tema === 'string' && TOPIC_ID_PATTERN.test(result.tema) ? result.tema : '', motivo: typeof result.motivo === 'string' ? result.motivo.slice(0, 60) : '', nota: typeof result.nota === 'string' ? result.nota.slice(0, 300) : '', st: state };
  }
  return out;
}
export const getReports = (): ReportMap => appState.reports || {};
export function addReport(id: string, tema: string, motivo: string, nota = ''): void {
  appState.reports = appState.reports || createDictionary();
  appState.reports[id] = cleanReports({ [id]: { ts: Date.now(), tema, motivo, nota, st: 'abierto' } })[id];
  persist(); emit(); if (syncer && syncer.pushReports) syncer.pushReports(appState.reports);
}
export function setReportState(id: string, st: ReportState): void {
  const result = (appState.reports || {})[id]; if (!result || !REP_ST.includes(st)) return;
  appState.reports[id] = { ...result, st, ts: Date.now() };
  persist(); emit(); if (syncer && syncer.pushReports) syncer.pushReports(appState.reports);
}
export function mergeReports(m0: unknown): boolean {
  const incomingReports = cleanReports(m0); appState.reports = appState.reports || createDictionary(); let changed = false;
  for (const questionId of Object.keys(incomingReports)) if (!appState.reports[questionId] || incomingReports[questionId].ts > appState.reports[questionId].ts) { appState.reports[questionId] = incomingReports[questionId]; changed = true; }
  if (changed) { persist(); emit(); }
  return changed;
}


export interface Syncer { schedule(): void; pushSession?(sessionRecord: Session): void; pushSeen?(seenDocument: SeenDoc): void; pushReports?(reports: ReportMap): void; pushCards?(cards: CardMap): void; pushImport?(): void }
let appState: AppState = load();
const listeners = new Set<() => void>();
let dirty = new Set<string>();
let syncer: Syncer | null = null;

function load(key = stateKey()): AppState {
  try {
    const parsedData = JSON.parse(localStorage.getItem(key) || 'null');
    if (parsedData && parsedData.stats) return { stats: cleanStats(parsedData.stats), sessions: cleanSessions(parsedData.sessions).slice(0, MAX_SESIONES), cfg: cleanCfg(parsedData.cfg), seen: cleanSeen(parsedData.seen), reports: cleanReports(parsedData.reports), cards: cleanCards(parsedData.cards) };
  } catch {}
  return { stats: createDictionary(), sessions: [], cfg: {}, seen: { t: [], ts: 0 }, reports: createDictionary(), cards: createDictionary() };
}
// La copia antigua queda intacta; solo el propietario puede adoptarla.
export function switchAccount(next: string | null, adoptLegacy = false): void {
  if (account === next) return;
  void flushNow();
  account = next;
  try {
    if (next) localStorage.setItem('tai.account', next);
    else localStorage.removeItem('tai.account');
  } catch {}
  const hasLocal = (() => { try { return !!localStorage.getItem(stateKey()); } catch { return false; } })();
  appState = load(!hasLocal && adoptLegacy ? LEGACY_KEY : stateKey());
  if (!hasLocal && adoptLegacy && next) {
    try { localStorage.setItem('tai.legacy-pending:' + next, '1'); } catch {}
  }
  dirty.clear(); persist();
  accountListeners.forEach(fn => fn()); emit();
}
let persistWarned = false;
function persist() {
  try { localStorage.setItem(stateKey(), JSON.stringify(appState)); } catch {
    // sin espacio o sin permiso: avisar una vez (la copia de IndexedDB sigue intentándose)
    if (!persistWarned) { persistWarned = true; try { dispatchEvent(new Event('tai-persist-error')); } catch {} }
  }
  mirror();
}
// Copia de seguridad en IndexedDB: en iOS, localStorage puede perder las últimas escrituras si se cierra la app enseguida.
const IDB = 'tai-mirror';
let mirrorTimer: ReturnType<typeof setTimeout> | undefined;
function openIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('sin indexedDB'));
    const request = indexedDB.open(IDB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => res(request.result); request.onerror = () => rej(request.error);
  });
}
function mirror() { clearTimeout(mirrorTimer); mirrorTimer = setTimeout(flushMirror, 150); }
export async function flushMirror(): Promise<void> {
  clearTimeout(mirrorTimer);
  try {
    const key = mirrorKey(), payload = JSON.stringify(appState);
    const db = await openIdb();
    await new Promise<void>((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(payload, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch {}
}
// Al arrancar: fusiona lo que haya en la copia de IndexedDB (gana siempre lo más reciente). Devuelve true si recuperó algo.
export async function recover(): Promise<boolean> {
  try {
    const key = mirrorKey();
    const db = await openIdb();
    const pendingKey = 'tai.legacy-pending:' + account;
    const legacy = account && localStorage.getItem(pendingKey) === '1';
    const copies = await Promise.all([key, ...(legacy ? ['state'] : [])].map(key => new Promise<string | null | undefined>(res => {
      const request = db.transaction('kv').objectStore('kv').get(key);
      request.onsuccess = () => res(request.result as string | undefined); request.onerror = () => res(null);
    })));
    db.close();
    if (key !== mirrorKey()) return false;
    let recoveredProgress = false;
    for (const txt of copies) {
      if (!txt) continue;
      const parsedData = JSON.parse(txt); if (!parsedData || typeof parsedData !== 'object') continue;
      recoveredProgress = mergeRemote(parsedData.stats) || recoveredProgress; recoveredProgress = mergeSessions(parsedData.sessions) || recoveredProgress; recoveredProgress = mergeSeen(parsedData.seen) || recoveredProgress; recoveredProgress = mergeReports(parsedData.reports) || recoveredProgress; recoveredProgress = mergeCards(parsedData.cards) || recoveredProgress;
      if (parsedData.cfg && typeof parsedData.cfg === 'object') { const cleanedConfig = cleanCfg(parsedData.cfg); for (const configKey in cleanedConfig) if (!(configKey in appState.cfg)) { appState.cfg[configKey] = cleanedConfig[configKey]; recoveredProgress = true; } }
    }
    if (recoveredProgress) { persist(); emit(); }
    if (legacy) localStorage.removeItem(pendingKey);
    return recoveredProgress;
  } catch { return false; }
}
export function flushNow(): Promise<void> { try { localStorage.setItem(stateKey(), JSON.stringify(appState)); } catch {} return flushMirror(); }
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
export function cleanSeen(value: unknown): SeenDoc {
  if (!isObjectRecord(value) || !Array.isArray(value.t)) return { t: [], ts: 0 };
  const topics = value.t;
  return { t: topics.filter((topic: unknown): topic is string => typeof topic === 'string' && TOPIC_ID_PATTERN.test(topic)).slice(0, 100), ts: boundedNumber(value.ts) || 0 };
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
  const statRecord = appState.stats[id] || [0, 0, 0, -1, 0, 0, 0, 0, 0, 0];
  const streak = failureStreak(statRecord);
  while (statRecord.length < 12) statRecord.push(0);
  statRecord[10] = res === 0 ? 0 : res === 1 && streak >= 0 ? Math.min(3, streak + 1) : streak;
  if (typeof secs === 'number' && secs > 0 && res !== 2) { statRecord[7] += Math.min(120, secs); statRecord[8] += 1; }
  statRecord[0] += 1;
  if (res === 1) statRecord[1] += 1;
  statRecord[2] = now; statRecord[5] = res;
  const luck = statRecord[9]; // 6 = acierto «por suerte» pendiente (0/2 confirmaciones) · 8 = 1/2
  statRecord[9] = 0; // el motivo se anota tras cada fallo
  if (luck && res === 2) statRecord[9] = luck; // dejar en blanco no confirma ni quita la marca
  if (res === 0) { statRecord[3] = 0; statRecord[4] = now + INTERVALS[0] * DAY; }
  else if (res === 1 && luck === 6) { statRecord[9] = 8; statRecord[3] = 0; statRecord[4] = now + LUCKY_DAYS * DAY; } // una vez más bien y se quita la marca
  else if (res === 1 && statRecord[3] >= 0) {
    if (statRecord[3] + 1 >= INTERVALS.length) { statRecord[3] = -1; statRecord[4] = 0; }
    else { statRecord[3] += 1; statRecord[4] = now + INTERVALS[statRecord[3]] * DAY; }
  }
  appState.stats[id] = statRecord;
  dirty.add(tema);
  persist(); emit();
  if (syncer) syncer.schedule();
}
// «Acerté dudando»: el acierto ya está registrado; la pregunta entra (o vuelve) a la cola a +2 días.
export function doubt(id: string, tema: string, now = Date.now()): void {
  const statRecord = appState.stats[id]; if (!statRecord) return;
  statRecord[3] = 0; statRecord[4] = now + INTERVALS[0] * DAY;
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
// Motivo del último fallo: 1 contenido, 2 trampa, 3 duda entre dos, 4 despiste (saca la pregunta de la cola), 5 no lo sabía
export function setMotivo(id: string, tema: string, reasonCode: number, now = Date.now()): void {
  const statRecord = appState.stats[id]; if (!statRecord || statRecord[5] !== 0 || !(reasonCode >= 1 && reasonCode <= 5 || reasonCode === 7)) return;
  while (statRecord.length < 10) statRecord.push(0);
  statRecord[9] = reasonCode; statRecord[2] = now;
  if (reasonCode === 4) { statRecord[3] = -1; statRecord[4] = 0; }
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
// «Fue suerte»: acierto sin saberlo; entra (o vuelve) a la cola a +1 día y debe acertarse 2 veces seguidas para quitar la marca y queda anotado (r[9] = 6)
export function suerte(id: string, tema: string, now = Date.now()): void {
  const statRecord = appState.stats[id]; if (!statRecord || statRecord[5] !== 1) return;
  while (statRecord.length < 10) statRecord.push(0);
  statRecord[9] = 6; statRecord[3] = 0; statRecord[4] = now + LUCKY_DAYS * DAY; statRecord[2] = now;
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
  const streak = failureStreak(statRecord);
  while (statRecord.length < 12) statRecord.push(0);
  statRecord[10] = streak; statRecord[11] = value ? 1 : 0;
  statRecord[12] = Math.max(Date.now(), reviewClock(statRecord) + 1); // reloj independiente: no cambia el día de estudio
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
export const needsSync = (local: StatRec, remote?: StatRec) => !remote || local[2] > remote[2] || reviewClock(local) > reviewClock(remote);
// Mezcla registros remotos (gana el más reciente por pregunta). Devuelve true si cambió algo local.
export function mergeRemote(map0: unknown): boolean {
  const map = cleanStats(map0);
  let changed = false;
  for (const id of Object.keys(map)) {
    const statRecord = appState.stats[id], statRecordItem = map[id];
    if (!statRecord) { appState.stats[id] = statRecordItem; changed = true; continue; }
    const base = statRecordItem[2] > statRecord[2] ? statRecordItem : statRecord;
    const review = reviewClock(statRecordItem) > reviewClock(statRecord) ? statRecordItem : statRecord;
    const merged = base.slice();
    if (base.length > 10 || review.length > 10) {
      const streak = failureStreak(base);
      while (merged.length < 12) merged.push(0);
      merged[10] = streak;
      merged[11] = review[11] === 1 ? 1 : 0;
      if (reviewClock(review)) merged[12] = reviewClock(review);
    }
    if (JSON.stringify(statRecord) !== JSON.stringify(merged)) { appState.stats[id] = merged; changed = true; }
  }
  if (changed) { persist(); emit(); }
  return changed;
}
export function mergeSessions(list0: unknown): boolean {
  const list = cleanSessions(list0);
  const have = new Set(appState.sessions.map(storedSession => storedSession.id));
  let changed = false;
  for (const incomingSession of list) if (!have.has(incomingSession.id)) { appState.sessions.push(incomingSession); have.add(incomingSession.id); changed = true; }
  if (changed) { appState.sessions.sort((leftSession, rightSession) => rightSession.ts - leftSession.ts); appState.sessions = appState.sessions.slice(0, MAX_SESIONES); persist(); emit(); }
  return changed;
}
// ── API de tarjetas ──
const deletedCard = (result?: CardRec) => result?.[5] === -1;
// El documento completo incluye borrados para evitar que otra copia resucite una tarjeta.
export const getCardsDoc = (): CardMap => appState.cards || (appState.cards = createDictionary());
export const getCards = (): CardMap => Object.fromEntries(Object.entries(getCardsDoc()).filter(([, result]) => !deletedCard(result)));
export const cardRec = (id: string): CardRec | undefined => { const result = getCardsDoc()[id]; return deletedCard(result) ? undefined : result; };
export function mergeCards(m0: unknown): boolean {
  const incomingCards = cleanCards(m0); appState.cards = appState.cards || createDictionary(); let changed = false;
  for (const cardId of Object.keys(incomingCards)) { const storedCard = appState.cards[cardId], incomingCard = incomingCards[cardId]; if (!storedCard || incomingCard[2] > storedCard[2]) { appState.cards[cardId] = incomingCard; changed = true; } }
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
// Valora una tarjeta: 0 fallé · 1 dudaba (cuentan como fallo: vuelve a +2 días) · 2 lo sabía (sube de caja)
export function gradeCard(id: string, grade: number, now = Date.now()): CardRec | null {
  if (!CARD_RE.test(id) || ![0, 1, 2].includes(grade)) return null;
  appState.cards = appState.cards || createDictionary();
  const cardRecord = cardRec(id) || [0, 0, now, -1, 0, 0];
  const isFirstReview = cardRecord[0] === 0;
  cardRecord[0] += 1; cardRecord[2] = Math.max(now, (appState.cards[id]?.[2] || 0) + 1); cardRecord[5] = grade;
  if (grade < 2) { cardRecord[3] = 0; cardRecord[4] = now + INTERVALS[0] * DAY; }
  else {
    cardRecord[1] += 1;
    if (isFirstReview || cardRecord[3] < 0) { cardRecord[3] = 0; cardRecord[4] = now + INTERVALS[0] * DAY; }
    else if (cardRecord[3] + 1 >= INTERVALS.length) { cardRecord[3] = -1; cardRecord[4] = 0; }
    else { cardRecord[3] += 1; cardRecord[4] = now + INTERVALS[cardRecord[3]] * DAY; }
  }
  appState.cards[id] = cardRecord; persist(); emit(); if (syncer && syncer.pushCards) syncer.pushCards(appState.cards);
  return cardRecord;
}
export function exportAll(): string { return JSON.stringify(appState); }
export function importAll(txt: unknown): void {
  if (typeof txt !== 'string' || txt.length > 20e6) throw new Error('Archivo no válido');
  const parsedData = JSON.parse(txt);
  if (!parsedData || typeof parsedData !== 'object' || !parsedData.stats || typeof parsedData.stats !== 'object') throw new Error('Archivo no válido');
  mergeRemote(parsedData.stats);
  mergeSessions(parsedData.sessions || []);
  if (parsedData.seen) mergeSeen(parsedData.seen);
  if (parsedData.reports) mergeReports(parsedData.reports);
  if (parsedData.cards) mergeCards(parsedData.cards);
  if (parsedData.cfg) { appState.cfg = { ...appState.cfg, ...cleanCfg(parsedData.cfg) }; persist(); emit(); }
  syncer?.pushImport?.();
}
export function resetAll(): void { appState = { stats: createDictionary(), sessions: [], cfg: {}, seen: { t: [], ts: 0 }, reports: createDictionary(), cards: createDictionary() }; persist(); emit(); }
