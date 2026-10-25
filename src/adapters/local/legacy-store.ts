import { cleanCfg, cleanCfgSetting } from './config.js';
import { failureStreak as deriveFailureStreak } from '../../core/domain/spaced-repetition.js';
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
export const DAY = 86400000;
export const INTERVALS = [2, 5, 14, 30, 60]; // días
export const LUCKY_DAYS = 1; // las acertadas «por suerte» vuelven cada día hasta confirmarlas


// ── Validación de datos externos (localStorage, Firestore, archivos importados) ──
const num = (v: unknown, lo = 0, hi = 1e13): number | null => (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : null;
const ID_RE = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9._\-~]{1,48}$/;
const dict = <T = any>(): Record<string, T> => Object.create(null);
const TEMA_RE = /^T\d\.\d\d$/;
// El historial antiguo no guarda la racha: las pendientes existentes parten de cero.
export function failureStreak(r?: StatRec | null): number {
  if (!r) return -1;
  return deriveFailureStreak({
    attempts: r[0],
    lastResult: r[5],
    intervalStep: r[3],
    ...(r.length > 10 ? { failureStreak: Math.floor(num(r[10], -1, 3) ?? -1) } : {}),
  });
}
export const pendingFailure = (r?: StatRec | null) => { const n = failureStreak(r); return n >= 0 && n < 3; };
export function cleanRec(r: unknown): StatRec | null {
  if (!Array.isArray(r) || r.length < 3) return null;
  const n = num(r[0], 0, 1e6), ok = num(r[1], 0, 1e6), last = num(r[2]);
  if (n === null || ok === null || last === null) return null;
  const box = num(r[3], -1, 4), due = num(r[4]), lr = num(r[5], 0, 2), fl = num(r[6], 0, 1);
  const mo = num(r[9], 0, 8) || 0, ts = num(r[7], 0, 1e7) || 0, tn = Math.min(num(r[8], 0, 1e6) || 0, n); // segundos acumulados y nº de respuestas cronometradas
  const out = [n, Math.min(ok, n), last, box === null ? -1 : Math.floor(box), due || 0, lr === null ? 0 : Math.floor(lr), fl ? 1 : 0, tn ? ts : 0, tn, Math.floor(mo)];
  if (r.length > 10) out.push(Math.floor(num(r[10], -1, 3) ?? failureStreak(out)), r[11] === 1 ? 1 : 0);
  if (r.length > 12) out.push(num(r[12]) || 0);
  else if (r[11] === 1) out.push(last);
  return out;
}
export function cleanStats(map: unknown): StatMap {
  const out = dict<StatRec>();
  if (!map || typeof map !== 'object') return out;
  for (const id of Object.keys(map)) { if (!ID_RE.test(id)) continue; const r = cleanRec((map as Record<string, unknown>)[id]); if (r) out[id] = r; }
  return out;
}
// ── Tarjetas (flashcards): { idTarjeta: [n, ok, last, box, due, lastGrade] } ──
// n=veces repasada, ok=veces «lo sabía», box=-1 dominada (0..4 en repaso), due=próximo repaso, lastGrade=0 fallé/1 dudaba/2 lo sabía
export const CARD_RE = /^FC-[A-Za-z0-9._~-]{1,60}$/;
export const MAX_CARDS = 8000; // ≈70 B por tarjeta: queda por debajo del límite de 1 MB por documento de Firestore
export function cleanCard(r: unknown): CardRec | null {
  if (!Array.isArray(r) || r.length < 5) return null;
  const n = num(r[0], 0, 1e6), ok = num(r[1], 0, 1e6), last = num(r[2]);
  if (n === null || ok === null || last === null) return null;
  if (r[5] === -1) return [0, 0, last, -1, 0, -1]; // marca de borrado sincronizada
  const box = num(r[3], -1, 4), due = num(r[4]), lg = num(r[5], 0, 2);
  return [n, Math.min(ok, n), last, box === null ? -1 : Math.floor(box), due || 0, lg === null ? 0 : Math.floor(lg)];
}
export function cleanCards(map: unknown): CardMap {
  const out = dict<CardRec>(); let k = 0;
  if (!map || typeof map !== 'object') return out;
  for (const id of Object.keys(map)) { if (!CARD_RE.test(id)) continue; const r = cleanCard((map as Record<string, unknown>)[id]); if (r) { out[id] = r; if (++k >= MAX_CARDS) break; } }
  return out;
}
export function cleanSession(s: any): Session | null {
  if (!s || typeof s !== 'object') return null;
  const id = typeof s.id === 'string' && ID_RE.test(s.id) ? s.id : null, ts = num(s.ts);
  if (!id || ts === null) return null;
  const temas: Session['temas'] = {};
  if (s.temas && typeof s.temas === 'object') for (const t in s.temas) {
    const v = s.temas[t];
    if (TEMA_RE.test(t) && Array.isArray(v) && num(v[0], 0, 1e5) !== null && num(v[1], 0, 1e5) !== null) temas[t] = [v[0], v[1]];
  }
  const tipos: Session['tipos'] = {};
  if (s.tipos && typeof s.tipos === 'object') for (const t in s.tipos) {
    const v = s.tipos[t];
    if (/^[A-Za-z0-9]{1,3}$/.test(t) && Array.isArray(v) && num(v[0], 0, 1e5) !== null && num(v[1], 0, 1e5) !== null) tipos[t] = [v[0], v[1]];
  }
  return {
    id, ts, kind: (['sim', 'rev', 'test'] as const).find(k => k === s.kind) ?? 'test',
    n: num(s.n, 0, 1e4) ?? 0, a: num(s.a, 0, 1e4) ?? 0, f: num(s.f, 0, 1e4) ?? 0, b: num(s.b, 0, 1e4) ?? 0,
    secs: num(s.secs, 0, 1e6) ?? 0, nota: num(s.nota, -100, 100) ?? 0, temas, tipos,
    fails: Array.isArray(s.fails) ? s.fails.filter((x: unknown): x is string => typeof x === 'string' && ID_RE.test(x)).slice(0, 500) : [],
    titulo: typeof s.titulo === 'string' ? s.titulo.slice(0, 80) : '',
    ...(s.interrupted === true ? { interrupted: true } : {}),
    ...(s.porTiempo === true ? { porTiempo: true } : {})
  };
}
export function cleanSessions(l: unknown): Session[] { return (Array.isArray(l) ? l : []).map(cleanSession).filter((x): x is Session => !!x); }

// ── Informes de errores del banco: { idPregunta: {ts, tema, motivo, nota, st} } ──
const REP_ST: ReportState[] = ['abierto', 'resuelto', 'quitado'];
export function cleanReports(m: unknown): ReportMap {
  const out = dict<Report>();
  if (!m || typeof m !== 'object') return out;
  for (const id of Object.keys(m)) {
    const r = (m as Record<string, any>)[id]; if (!ID_RE.test(id) || !r || typeof r !== 'object') continue;
    const ts = num(r.ts); if (ts === null) continue;
    out[id] = { ts, tema: typeof r.tema === 'string' && TEMA_RE.test(r.tema) ? r.tema : '', motivo: typeof r.motivo === 'string' ? r.motivo.slice(0, 60) : '', nota: typeof r.nota === 'string' ? r.nota.slice(0, 300) : '', st: REP_ST.includes(r.st) ? r.st : 'abierto' };
  }
  return out;
}
export const getReports = (): ReportMap => S.reports || {};
export function addReport(id: string, tema: string, motivo: string, nota = ''): void {
  S.reports = S.reports || dict();
  S.reports[id] = cleanReports({ [id]: { ts: Date.now(), tema, motivo, nota, st: 'abierto' } })[id];
  persist(); emit(); if (syncer && syncer.pushReports) syncer.pushReports(S.reports);
}
export function setReportState(id: string, st: ReportState): void {
  const r = (S.reports || {})[id]; if (!r || !REP_ST.includes(st)) return;
  S.reports[id] = { ...r, st, ts: Date.now() };
  persist(); emit(); if (syncer && syncer.pushReports) syncer.pushReports(S.reports);
}
export function mergeReports(m0: unknown): boolean {
  const m = cleanReports(m0); S.reports = S.reports || dict(); let ch = false;
  for (const id of Object.keys(m)) if (!S.reports[id] || m[id].ts > S.reports[id].ts) { S.reports[id] = m[id]; ch = true; }
  if (ch) { persist(); emit(); }
  return ch;
}


export interface Syncer { schedule(): void; pushSession?(s: Session): void; pushSeen?(d: SeenDoc): void; pushReports?(m: ReportMap): void; pushCards?(m: CardMap): void; pushImport?(): void }
let S: AppState = load();
const listeners = new Set<() => void>();
let dirty = new Set<string>();
let syncer: Syncer | null = null;

function load(key = stateKey()): AppState {
  try {
    const s = JSON.parse(localStorage.getItem(key) || 'null');
    if (s && s.stats) return { stats: cleanStats(s.stats), sessions: cleanSessions(s.sessions).slice(0, MAX_SESIONES), cfg: cleanCfg(s.cfg), seen: cleanSeen(s.seen), reports: cleanReports(s.reports), cards: cleanCards(s.cards) };
  } catch (e) {}
  return { stats: dict(), sessions: [], cfg: {}, seen: { t: [], ts: 0 }, reports: dict(), cards: dict() };
}
// La copia antigua queda intacta; solo el propietario puede adoptarla.
export function switchAccount(next: string | null, adoptLegacy = false): void {
  if (account === next) return;
  void flushNow();
  account = next;
  try { next ? localStorage.setItem('tai.account', next) : localStorage.removeItem('tai.account'); } catch {}
  const hasLocal = (() => { try { return !!localStorage.getItem(stateKey()); } catch { return false; } })();
  S = load(!hasLocal && adoptLegacy ? LEGACY_KEY : stateKey());
  if (!hasLocal && adoptLegacy && next) {
    try { localStorage.setItem('tai.legacy-pending:' + next, '1'); } catch {}
  }
  dirty.clear(); persist();
  accountListeners.forEach(fn => fn()); emit();
}
let persistWarned = false;
function persist() {
  try { localStorage.setItem(stateKey(), JSON.stringify(S)); } catch (e) {
    // sin espacio o sin permiso: avisar una vez (la copia de IndexedDB sigue intentándose)
    if (!persistWarned) { persistWarned = true; try { dispatchEvent(new Event('tai-persist-error')); } catch (e2) {} }
  }
  mirror();
}
// Copia de seguridad en IndexedDB: en iOS, localStorage puede perder las últimas escrituras si se cierra la app enseguida.
const IDB = 'tai-mirror';
let mirrorTimer: ReturnType<typeof setTimeout> | undefined;
function openIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('sin indexedDB'));
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function mirror() { clearTimeout(mirrorTimer); mirrorTimer = setTimeout(flushMirror, 150); }
export async function flushMirror(): Promise<void> {
  clearTimeout(mirrorTimer);
  try {
    const key = mirrorKey(), payload = JSON.stringify(S);
    const db = await openIdb();
    await new Promise<void>((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(payload, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch (e) {}
}
// Al arrancar: fusiona lo que haya en la copia de IndexedDB (gana siempre lo más reciente). Devuelve true si recuperó algo.
export async function recover(): Promise<boolean> {
  try {
    const key = mirrorKey();
    const db = await openIdb();
    const pendingKey = 'tai.legacy-pending:' + account;
    const legacy = account && localStorage.getItem(pendingKey) === '1';
    const copies = await Promise.all([key, ...(legacy ? ['state'] : [])].map(k => new Promise<string | null | undefined>(res => {
      const r = db.transaction('kv').objectStore('kv').get(k);
      r.onsuccess = () => res(r.result as string | undefined); r.onerror = () => res(null);
    })));
    db.close();
    if (key !== mirrorKey()) return false;
    let ch = false;
    for (const txt of copies) {
      if (!txt) continue;
      const o = JSON.parse(txt); if (!o || typeof o !== 'object') continue;
      ch = mergeRemote(o.stats) || ch; ch = mergeSessions(o.sessions) || ch; ch = mergeSeen(o.seen) || ch; ch = mergeReports(o.reports) || ch; ch = mergeCards(o.cards) || ch;
      if (o.cfg && typeof o.cfg === 'object') { const c = cleanCfg(o.cfg); for (const k in c) if (!(k in S.cfg)) { S.cfg[k] = c[k]; ch = true; } }
    }
    if (ch) { persist(); emit(); }
    if (legacy) localStorage.removeItem(pendingKey);
    return ch;
  } catch (e) { return false; }
}
export function flushNow(): Promise<void> { try { localStorage.setItem(stateKey(), JSON.stringify(S)); } catch (e) {} return flushMirror(); }
export function onChange(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
export const subscribe: (fn: () => void) => () => void = onChange;
function emit() { listeners.forEach(f => f()); }

export const getStats = (): StatMap => S.stats;
export const getSessions = (): Session[] => S.sessions;
export const getCfg = (): Cfg => S.cfg;
// Temas vistos (se sincroniza como un único documento; gana el cambio más reciente)
export const getSeen = (): string[] => (S.seen && S.seen.t) || [];
export const getSeenDoc = (): SeenDoc => S.seen || { t: [], ts: 0 };
export function setSeen(arr: Iterable<string>): void {
  S.seen = { t: [...arr].sort(), ts: Date.now() };
  persist(); emit();
  if (syncer && syncer.pushSeen) syncer.pushSeen(S.seen);
}
export function cleanSeen(r: any): SeenDoc {
  if (!r || !Array.isArray(r.t)) return { t: [], ts: 0 };
  return { t: r.t.filter((x: unknown): x is string => typeof x === 'string' && TEMA_RE.test(x)).slice(0, 100), ts: num(r.ts) || 0 };
}
export function mergeSeen(r0: any): boolean {
  const r = cleanSeen(r0);
  if (!r0 || !Array.isArray(r0.t)) return false;
  if (!S.seen || (r.ts || 0) > (S.seen.ts || 0)) { S.seen = { t: r.t, ts: r.ts || 0 }; persist(); emit(); return true; }
  return false;
}
export function setCfg(k: string, v: unknown): void {
  const value = cleanCfgSetting(k, v);
  if (value === undefined) return;
  S.cfg[k] = value; persist(); emit();
}
export const rec = (id: string): StatRec | undefined => S.stats[id];
export const temaDe = (_id: string): string | null => {
  // los ids no codifican el tema; se guarda el tema junto al registro en meta (ver main.js)
  return null;
};

export function setSyncer(s: Syncer | null): void { syncer = s; }
export function takeDirty() { const d = dirty; dirty = new Set(); return d; }
export function markDirty(tema: string): void { dirty.add(tema); }

// Aplica un resultado: res = 1 acierto, 0 fallo, 2 blanco
// secs (opcional): segundos que tardó en contestar; se acumulan para detectar preguntas lentas
export function record(id: string, tema: string, res: Res, now = Date.now(), secs?: number): void {
  const r = S.stats[id] || [0, 0, 0, -1, 0, 0, 0, 0, 0, 0];
  const streak = failureStreak(r);
  while (r.length < 12) r.push(0);
  r[10] = res === 0 ? 0 : res === 1 && streak >= 0 ? Math.min(3, streak + 1) : streak;
  if (typeof secs === 'number' && secs > 0 && res !== 2) { r[7] += Math.min(120, secs); r[8] += 1; }
  r[0] += 1;
  if (res === 1) r[1] += 1;
  r[2] = now; r[5] = res;
  const luck = r[9]; // 6 = acierto «por suerte» pendiente (0/2 confirmaciones) · 8 = 1/2
  r[9] = 0; // el motivo se anota tras cada fallo
  if (luck && res === 2) r[9] = luck; // dejar en blanco no confirma ni quita la marca
  if (res === 0) { r[3] = 0; r[4] = now + INTERVALS[0] * DAY; }
  else if (res === 1 && luck === 6) { r[9] = 8; r[3] = 0; r[4] = now + LUCKY_DAYS * DAY; } // una vez más bien y se quita la marca
  else if (res === 1 && r[3] >= 0) {
    if (r[3] + 1 >= INTERVALS.length) { r[3] = -1; r[4] = 0; }
    else { r[3] += 1; r[4] = now + INTERVALS[r[3]] * DAY; }
  }
  S.stats[id] = r;
  dirty.add(tema);
  persist(); emit();
  if (syncer) syncer.schedule();
}
// «Acerté dudando»: el acierto ya está registrado; la pregunta entra (o vuelve) a la cola a +2 días.
export function doubt(id: string, tema: string, now = Date.now()): void {
  const r = S.stats[id]; if (!r) return;
  r[3] = 0; r[4] = now + INTERVALS[0] * DAY;
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
// Motivo del último fallo: 1 contenido, 2 trampa, 3 duda entre dos, 4 despiste (saca la pregunta de la cola), 5 no lo sabía
export function setMotivo(id: string, tema: string, m: number, now = Date.now()): void {
  const r = S.stats[id]; if (!r || r[5] !== 0 || !(m >= 1 && m <= 5 || m === 7)) return;
  while (r.length < 10) r.push(0);
  r[9] = m; r[2] = now;
  if (m === 4) { r[3] = -1; r[4] = 0; }
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
// «Fue suerte»: acierto sin saberlo; entra (o vuelve) a la cola a +1 día y debe acertarse 2 veces seguidas para quitar la marca y queda anotado (r[9] = 6)
export function suerte(id: string, tema: string, now = Date.now()): void {
  const r = S.stats[id]; if (!r || r[5] !== 1) return;
  while (r.length < 10) r.push(0);
  r[9] = 6; r[3] = 0; r[4] = now + LUCKY_DAYS * DAY; r[2] = now;
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
export function toggleFlag(id: string, tema: string): number {
  const r = S.stats[id] || [0, 0, Date.now(), -1, 0, 0, 0, 0, 0];
  r[6] = r[6] ? 0 : 1; r[2] = Date.now();
  S.stats[id] = r; dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
  return r[6];
}
// Marca independiente de respuestas y del calendario; viaja en el mismo registro sincronizado.
export function setReviewed(id: string, tema: string, value: boolean): void {
  const r = S.stats[id]; if (!r || typeof value !== 'boolean') return;
  const streak = failureStreak(r);
  while (r.length < 12) r.push(0);
  r[10] = streak; r[11] = value ? 1 : 0;
  r[12] = Math.max(Date.now(), reviewClock(r) + 1); // reloj independiente: no cambia el día de estudio
  dirty.add(tema); persist(); emit();
  if (syncer) syncer.schedule();
}
export function addSession(s: Session): void {
  S.sessions.unshift(s);
  S.sessions = S.sessions.slice(0, MAX_SESIONES);
  persist(); emit();
  if (syncer?.pushSession) syncer.pushSession(s);
}
// [12] fecha de cambio de la marca de temario; independiente del resultado [2].
export const reviewClock = (r?: StatRec) => r ? (r[12] ?? (r[11] === 1 ? r[2] : 0)) : 0;
export const needsSync = (local: StatRec, remote?: StatRec) => !remote || local[2] > remote[2] || reviewClock(local) > reviewClock(remote);
// Mezcla registros remotos (gana el más reciente por pregunta). Devuelve true si cambió algo local.
export function mergeRemote(map0: unknown): boolean {
  const map = cleanStats(map0);
  let changed = false;
  for (const id of Object.keys(map)) {
    const a = S.stats[id], b = map[id];
    if (!a) { S.stats[id] = b; changed = true; continue; }
    const base = b[2] > a[2] ? b : a;
    const review = reviewClock(b) > reviewClock(a) ? b : a;
    const merged = base.slice();
    if (base.length > 10 || review.length > 10) {
      const streak = failureStreak(base);
      while (merged.length < 12) merged.push(0);
      merged[10] = streak;
      merged[11] = review[11] === 1 ? 1 : 0;
      if (reviewClock(review)) merged[12] = reviewClock(review);
    }
    if (JSON.stringify(a) !== JSON.stringify(merged)) { S.stats[id] = merged; changed = true; }
  }
  if (changed) { persist(); emit(); }
  return changed;
}
export function mergeSessions(list0: unknown): boolean {
  const list = cleanSessions(list0);
  const have = new Set(S.sessions.map(s => s.id));
  let ch = false;
  for (const s of list) if (!have.has(s.id)) { S.sessions.push(s); have.add(s.id); ch = true; }
  if (ch) { S.sessions.sort((a, b) => b.ts - a.ts); S.sessions = S.sessions.slice(0, MAX_SESIONES); persist(); emit(); }
  return ch;
}
// ── API de tarjetas ──
const deletedCard = (r?: CardRec) => r?.[5] === -1;
// El documento completo incluye borrados para evitar que otra copia resucite una tarjeta.
export const getCardsDoc = (): CardMap => S.cards || (S.cards = dict());
export const getCards = (): CardMap => Object.fromEntries(Object.entries(getCardsDoc()).filter(([, r]) => !deletedCard(r)));
export const cardRec = (id: string): CardRec | undefined => { const r = getCardsDoc()[id]; return deletedCard(r) ? undefined : r; };
export function mergeCards(m0: unknown): boolean {
  const m = cleanCards(m0); S.cards = S.cards || dict(); let ch = false;
  for (const id of Object.keys(m)) { const a = S.cards[id], b = m[id]; if (!a || b[2] > a[2]) { S.cards[id] = b; ch = true; } }
  if (ch) { persist(); emit(); }
  return ch;
}
// Crea la tarjeta de un fallo (vence hoy). Si ya existe, no la toca. Devuelve true si la creó.
export function addFallo(qid: string, now = Date.now()): boolean {
  const id = 'FC-Q-' + qid; if (!CARD_RE.test(id)) return false;
  S.cards = S.cards || dict(); if (cardRec(id)) return false;
  if (Object.keys(S.cards).length >= MAX_CARDS) return false;
  S.cards[id] = [0, 0, Math.max(now, (S.cards[id]?.[2] || 0) + 1), 0, now, 0];
  persist(); emit(); if (syncer && syncer.pushCards) syncer.pushCards(S.cards); return true;
}
export function removeCard(id: string): void {
  const r = cardRec(id); if (!r) return;
  S.cards[id] = [0, 0, Math.max(Date.now(), r[2] + 1), -1, 0, -1];
  persist(); emit(); if (syncer && syncer.pushCards) syncer.pushCards(S.cards);
}
// Valora una tarjeta: 0 fallé · 1 dudaba (cuentan como fallo: vuelve a +2 días) · 2 lo sabía (sube de caja)
export function gradeCard(id: string, grade: number, now = Date.now()): CardRec | null {
  if (!CARD_RE.test(id) || ![0, 1, 2].includes(grade)) return null;
  S.cards = S.cards || dict();
  const r = cardRec(id) || [0, 0, now, -1, 0, 0];
  const nueva = r[0] === 0;
  r[0] += 1; r[2] = Math.max(now, (S.cards[id]?.[2] || 0) + 1); r[5] = grade;
  if (grade < 2) { r[3] = 0; r[4] = now + INTERVALS[0] * DAY; }
  else {
    r[1] += 1;
    if (nueva || r[3] < 0) { r[3] = 0; r[4] = now + INTERVALS[0] * DAY; }
    else if (r[3] + 1 >= INTERVALS.length) { r[3] = -1; r[4] = 0; }
    else { r[3] += 1; r[4] = now + INTERVALS[r[3]] * DAY; }
  }
  S.cards[id] = r; persist(); emit(); if (syncer && syncer.pushCards) syncer.pushCards(S.cards);
  return r;
}
export function exportAll(): string { return JSON.stringify(S); }
export function importAll(txt: unknown): void {
  if (typeof txt !== 'string' || txt.length > 20e6) throw new Error('Archivo no válido');
  const o = JSON.parse(txt);
  if (!o || typeof o !== 'object' || !o.stats || typeof o.stats !== 'object') throw new Error('Archivo no válido');
  mergeRemote(o.stats);
  mergeSessions(o.sessions || []);
  if (o.seen) mergeSeen(o.seen);
  if (o.reports) mergeReports(o.reports);
  if (o.cards) mergeCards(o.cards);
  if (o.cfg) { S.cfg = { ...S.cfg, ...cleanCfg(o.cfg) }; persist(); emit(); }
  syncer?.pushImport?.();
}
export function resetAll(): void { S = { stats: dict(), sessions: [], cfg: {}, seen: { t: [], ts: 0 }, reports: dict(), cards: dict() }; persist(); emit(); }
