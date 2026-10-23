import * as store from './store.js';
import * as sync from './sync.js';
import { esc, shuffle, fmtT, pct, nota, allowed, composeSim, dominioCalc, aggregateWeeks, slowList, quickN, pickQuick, simHistory, compareSessions, trapRates, pickTrampas, MOTIVOS, MOTIVOS_FALLO, pickRepaso, cargaRepasos, motivosFallo, suertes, normUi, ZOOMS, swipeDir, keyAction, pickCards, cardStats, cardFromQuestion, hiliteHtml, claveHtml, claveSpans, pideNegativa, minLectura, velocidad, CONSEJOS_LECTURA, analisisSimulacro, ritmoSimulacro } from './logic.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const L = 'ABCD';

// avisos y confirmaciones propios (sustituyen a alert/confirm nativos)
let toastT = null;
function toastEl() {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  return t;
}
toastEl(); // la región viva debe existir antes del primer aviso para que se anuncie
// botón ocupado mientras carga: evita dobles pulsaciones y da respuesta inmediata
const guard = fn => async function (...a) {
  if (this.disabled) return;
  const h = this.innerHTML; this.disabled = true; this.textContent = 'Cargando…';
  try { return await fn.apply(this, a); } finally { this.disabled = false; this.innerHTML = h; }
};
addEventListener('tai-persist-error', () => toast('No se pudo guardar el progreso en este dispositivo (¿poco espacio?). Exporta una copia en Ajustes.'));
addEventListener('offline', () => toast('Sin conexión: solo funciona lo ya descargado.'));
addEventListener('online', () => toast('Conexión recuperada.'));
function toast(msg) {
  const t = toastEl();
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4500);
}
function ask(msg, okLabel = 'Aceptar', danger = false) {
  return new Promise(res => {
    const prev = document.activeElement, o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'askm');
    o.innerHTML = `<div class="card"><p id="askm"></p><div class="row"><button class="btn sec" data-v="0">Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-v="1">${esc(okLabel)}</button></div></div>`;
    $('#askm', o).textContent = msg;
    const done = v => { document.removeEventListener('keydown', key, true); o.remove(); prev && prev.focus && prev.focus(); res(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Tab') { const bs = [...o.querySelectorAll('button')], i = bs.indexOf(document.activeElement); e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); }
      else e.stopPropagation();
    };
    o.onclick = e => { const b = e.target.closest('button'); if (b) done(b.dataset.v === '1'); };
    document.addEventListener('keydown', key, true);
    document.body.append(o); o.querySelector('[data-v="1"]').focus();
  });
}
const ORIGEN = { O: 'Oficial', A: 'Academia', G: 'Generada' };
const TRAMPAS = { 1: 'Cambio de sujeto/órgano', 2: 'Cifra o plazo vecino', 3: 'Alcance del sujeto', 4: 'Pregunta inversa', 5: 'Obligación/facultad', 6: 'Numeración de normas', 7: 'Conceptos casi idénticos', 8: 'Orden invertido', 9: 'Inventado que suena real', 10: 'Trampa del supuesto', 11: 'Contaminación entre normas', 12: 'Absolutización', 13: 'Intruso', 14: 'Cierta pero no responde' };
const TRAMPA_EXPL = {
  1: 'Cambian quién hace algo: el órgano, la autoridad o el sujeto correcto se sustituye por otro parecido.',
  2: 'Cifra, plazo o unidad cercana a la real (10 vs 15 días, hábiles vs naturales). Compara el número con el del temario.',
  3: 'Se amplía o reduce a quién o a qué afecta (todos / solo algunos). Mira el alcance exacto del sujeto.',
  4: 'La pregunta pide la INCORRECTA, la falsa o la excepción. Quien lee deprisa marca la correcta.',
  5: 'Confunden «deberá» con «podrá»: obligación frente a facultad.',
  6: 'Número de ley, artículo o norma cambiado por otro que suena igual. Memoriza la numeración exacta.',
  7: 'Dos conceptos muy parecidos que se intercambian (p. ej. siglas o definiciones casi iguales). Busca el matiz que los distingue.',
  8: 'Los elementos son los correctos pero el orden (fases, niveles, capas) está invertido.',
  9: 'Opción inventada con apariencia técnica verosímil. Si no la reconoces del temario, desconfía.',
  10: 'En el supuesto práctico, un dato del enunciado cambia la respuesta. Relee el caso antes de responder.',
  11: 'Se atribuye a una norma algo que pertenece a otra distinta. Pregúntate de qué norma sale cada dato.',
  12: 'Palabras absolutas (siempre, nunca, solo, todos) que convierten en falsa una afirmación casi cierta.',
  13: 'Una opción no pertenece al grupo que se pide (el «intruso»). Comprueba que cada elemento encaja.',
  14: 'La frase es verdadera, pero no responde a lo que se pregunta. Contrasta cada opción con el enunciado.',
};
const TIPOS = { D: 'Directa', I: 'Inversa', C: 'Completar', K: 'Código/cálculo' };

// ───────── datos ─────────
let INDEX, META, SUP;
const cache = new Map();
async function j(url) { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); }
async function getIndex() { return INDEX ||= await j('data/index.json'); }
async function getMeta() {
  if (!META) {
    META = await j('data/meta.json');
    const by = {};
    for (const id in META) (by[META[id][0]] ||= []).push(id);
    META._by = by;
  }
  return META;
}
const temaOf = id => META && META[id] ? META[id][0] : null;
async function getTema(t) { if (!cache.has(t)) cache.set(t, j(`data/${t}.json`).catch(e => { cache.delete(t); throw e; })); return cache.get(t); }
async function getSup() { return SUP ||= await j('data/supuestos.json'); }
const temaName = t => (INDEX?.temas.find(x => x.id === t)?.nombre) || t;

const now = () => Date.now();

// ───────── comodidad: tema y tamaño de letra ─────────
function applyUi() {
  const u = normUi(store.getCfg().ui);
  const r = document.documentElement;
  if (u.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', u.theme);
  r.style.setProperty('--z', String(ZOOMS[u.size]));
  const dark = u.theme === 'dark' || (u.theme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0e1424' : '#14213d';
}
applyUi();
store.onChange(applyUi);

// ───────── router ─────────
const routes = {};
let cleanup = null;
function go(h) { if (location.hash === h) route(); else location.hash = h; }
let routeSeq = 0;
async function route() {
  const my = ++routeSeq;
  if (cleanup) { cleanup(); cleanup = null; }
  const [, name, ...args] = (location.hash || '#/home').split('/');
  const sect = { quiz: RUN?.kind === 'sim' ? 'sim' : RUN?.kind === 'test' ? 'test' : 'home', result: LAST?.ses?.kind === 'sim' ? 'sim' : LAST?.ses?.kind === 'test' ? 'test' : 'home', sim2: 'sim', examenes: 'sim', errores: 'settings', cards: 'home' }[name] || name;
  document.querySelectorAll('nav a').forEach(a => { const on = a.dataset.r === sect; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const f = routes[name] || routes.home;
  window.scrollTo(0, 0);
  const lt = setTimeout(() => { if (my === routeSeq) app.innerHTML = '<p class="sub loading" role="status">Cargando…</p>'; }, 120); // respuesta visible si los datos tardan
  try { await getIndex(); await getMeta(); if (my !== routeSeq) return; await f(...args); clearTimeout(lt); if (my !== routeSeq) return; const hd = app.querySelector('h1'); if (hd) hd.tabIndex = -1; (hd || app).focus({ preventScroll: true }); if (RUN && name !== 'quiz') { const b = document.createElement('div'); b.className = 'note run'; b.innerHTML = `<b>${esc(RUN.titulo || 'Test')}</b> en curso · ${Math.min(RUN.idx + 1, RUN.items.length)}/${RUN.items.length} <button class="btn" id="resume">Continuar</button>`; app.prepend(b); $('#resume').onclick = () => go('#/quiz'); } } catch (e) { clearTimeout(lt); app.innerHTML = `<div class="card" role="alert"><h2>No se pudo cargar</h2><p>${navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button class="btn" id="retryRoute">Reintentar</button></div>`; $('#retryRoute').onclick = () => route(); console.error(e); }
}
window.addEventListener('hashchange', route);

// ───────── selección de preguntas ─────────
function prioridad(q, mode) {
  const r = store.rec(q.i);
  if (mode === 'falladas') return r && (r[5] === 0 || r[3] >= 0) ? 0 : 9;
  if (mode === 'dudosas') return r && r[6] ? 0 : 9;
  if (mode === 'nuevas') return !r ? 0 : (r[5] === 0 ? 1 : 2);
  return 0;
}
async function pick({ temas, origins, mode, n }) {
  const pool = [];
  for (const l of await Promise.all(temas.map(getTema))) for (const q of l) if (allowed(q, origins)) pool.push(q);
  let c = shuffle(pool).map(q => [prioridad(q, mode), q]);
  if (mode === 'falladas' || mode === 'dudosas') c = c.filter(x => x[0] === 0);
  else if (mode === 'nuevas') c.sort((a, b) => a[0] - b[0] || (store.rec(a[1].i)?.[2] || 0) - (store.rec(b[1].i)?.[2] || 0));
  return c.slice(0, n).map(x => x[1]);
}
async function dueList(temasFilter) {
  await getMeta();
  const t = now(), out = [];
  const st = store.getStats();
  for (const id in st) { const r = st[id]; if (r[3] >= 0 && r[4] <= t && META[id] && (!temasFilter || temasFilter.has(META[id][0]))) out.push([r[4], id]); }
  out.sort((a, b) => a[0] - b[0]);
  return out.map(x => x[1]);
}
async function byIds(ids) {
  await getMeta();
  const need = new Set(ids.map(id => META[id]?.[0]).filter(Boolean));
  const m = new Map();
  for (const l of await Promise.all([...need].map(getTema))) for (const q of l) m.set(q.i, q);
  return ids.map(id => m.get(id)).filter(Boolean);
}

// ───────── motor de preguntas ─────────
let RUN = null;
function startRun(cfg) { RUN = { ...cfg, idx: 0, ans: [], t0: now(), secs: 0, paused: false }; go('#/quiz'); }
// La sesión en curso se guarda para sobrevivir al cierre de la app por iOS (solo sesiones del banco, no los supuestos)
const RUN_KEY = 'tai.run';
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) {} }
function saveRun() {
  if (!RUN || RUN.supTexto || !RUN.items.every(q => q.i && META && META[q.i])) return;
  const { kind, feedback, titulo, limit, idx, ans, times, secs } = RUN;
  try { localStorage.setItem(RUN_KEY, JSON.stringify({ kind, feedback, titulo, limit, idx, ans: [...ans], times: times ? [...times] : [], secs, ids: RUN.items.map(q => q.i), savedAt: Date.now() })); } catch (e) {}
}
async function resumeRun() {
  let s = null; try { s = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) {}
  if (!s || RUN) return;
  if (!Array.isArray(s.ids) || !s.ids.length || Date.now() - (s.savedAt || 0) > 2 * 86400000) return clearRun();
  const items = await byIds(s.ids);
  if (items.length !== s.ids.length) return clearRun();
  const n = items.length, i = Math.min(s.idx + 1, n);
  if (!(await ask(`Tienes sin terminar «${s.titulo || 'Test'}» (${i}/${n}${s.limit ? ', quedan ' + fmtT(Math.max(0, s.limit * 60 - s.secs)) : ''}). ¿Continuar donde lo dejaste?`, 'Continuar'))) return clearRun();
  const un = a => Array.from(a || [], x => x === null ? undefined : x);
  RUN = { kind: s.kind, feedback: !!s.feedback, titulo: s.titulo, limit: s.limit || 0, items, idx: s.idx, ans: un(s.ans), times: un(s.times), t0: now(), secs: s.secs || 0, paused: false };
  go('#/quiz');
}

routes.quiz = async function () {
  if (!RUN) return go('#/home');
  const R = RUN;
  let tick = null;
  {
    // el tiempo sale de la hora real (no de contar ticks): iOS frena los timers con la pantalla bloqueada
    tick = setInterval(() => {
      if (R.paused) { R.since = null; return; }
      if (R.since == null) { R.since = Date.now(); R.base = R.secs; }
      R.secs = R.base + Math.floor((Date.now() - R.since) / 1000);
      if (!R.limit) return;
      const left = R.limit * 60 - R.secs;
      const el = $('#clock'); if (el) el.textContent = fmtT(left);
      const pc = $('#pace'); if (pc) { const d = ritmoSimulacro(R.idx, R.items.length, R.limit * 60, R.secs), bud = Math.round(R.limit * 60 / R.items.length); pc.className = 'pace ' + (d >= 0 ? 'up' : d > -3 ? 'mid' : 'low'); pc.textContent = `Ritmo: ${d > 0 ? d + ' por delante' : d < 0 ? -d + ' por detrás' : 'al día'} · ${bud} s por pregunta`; }
      if (left <= 0) { clearInterval(tick); finish(); }
    }, 500);
  }
  const onKey = e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''))) return;
    if (R.paused && e.key === 'Tab') { e.preventDefault(); const rb = $('.overlay #resume'); rb && rb.focus(); return; }
    if (R.items[R.idx] === undefined) return;
    const act = keyAction(e, R.items[R.idx].a.length); if (!act) return;
    e.preventDefault();
    if (act.t === 'opt') { const b = app.querySelector(`.opt[data-i="${act.i}"]`); b && b.click(); }
    else if (act.t === 'next') { const b = $('#next'); b && b.click(); }
    else if (act.t === 'prev') prev();
    else if (act.t === 'blank') { const b = $('#blank'); b && b.click(); }
    else if (act.t === 'flag') { const b = $('#flag'); b && b.click(); }
    else if (act.t === 'pause') { const b = R.paused ? $('.overlay #resume') : $('#pause'); b && b.click(); }
  };
  let tx = null;
  const onTs = e => { const t = e.touches[0]; tx = e.touches.length === 1 && t.clientX > 24 && t.clientX < innerWidth - 24 && !e.target.closest('details,input,textarea,button,.opt') ? [t.clientX, t.clientY] : null; };
  const onTe = e => {
    if (!tx) return; const t = e.changedTouches[0];
    const d = swipeDir(t.clientX - tx[0], t.clientY - tx[1]); tx = null;
    if (d === 'next') { const b = $('#next'); b && b.click(); } else if (d === 'prev') prev();
  };
  function prev() { if (R.paused || R.idx <= 0) return; R.idx--; draw(); window.scrollTo(0, 0); }
  document.addEventListener('keydown', onKey);
  document.addEventListener('touchstart', onTs, { passive: true });
  document.addEventListener('touchend', onTe, { passive: true });
  cleanup = () => { clearInterval(tick); clearInterval(R.gt); document.removeEventListener('keydown', onKey); document.removeEventListener('touchstart', onTs); document.removeEventListener('touchend', onTe); };
  draw();

  function draw() {
    if (R.idx >= R.items.length) return finish();
    saveRun();
    if (R.tIdx !== R.idx) { R.tIdx = R.idx; R.q0 = R.secs; R.qT0 = Date.now(); }
    const LEC = normUi(store.getCfg().ui).lectura, kw = t => LEC ? claveHtml(t) : esc(t);
    const q = R.items[R.idx];
    const a = R.ans[R.idx];
    const reveal = R.feedback && a !== undefined;
    const inSup = !!q.s;
    app.innerHTML = `
    <h1 class="sr">${esc(R.titulo || 'Test')} · pregunta ${R.idx + 1} de ${R.items.length}</h1>
    <div class="qhead">
      <button class="ghost" id="exit" aria-label="Salir">✕</button>
      <div class="prog"><div style="width:${100 * R.idx / R.items.length}%"></div></div>
      <div class="cnt">${R.idx + 1}/${R.items.length}</div>
      ${R.limit ? `<div class="clock" id="clock">${fmtT(R.limit * 60 - R.secs)}</div><button class="ghost" id="pause" aria-label="Pausar">⏸</button>` : ''}
    </div>
    ${R.titulo ? `<div class="sub">${esc(R.titulo)}</div>` : ''}
    ${R.limit && R.kind === 'sim' ? '<div class="pace" id="pace"></div>' : ''}
    <div class="card q">
      <div class="meta">
        <span class="tag">${esc(q.t)} · ${esc(temaName(q.t))}</span>
        <span class="tag o${q.o}">${ORIGEN[q.o]}${q.o === 'O' && q.y ? ' · ' + esc(q.y.replace('Ingreso libre ', '').replace('convocatoria ', '')) : ''}</span>
        ${q.p ? '<span class="tag warn">Respuesta provisional</span>' : ''}
        ${q.w ? '<span class="tag warn">Puede caducar</span>' : ''}
        ${q.o === 'G' && q.v ? '<span class="tag">Variante</span>' : ''}
      </div>
      ${inSup ? `<details class="sup"><summary>Enunciado del supuesto</summary><div class="pre">${esc(R.supTexto || '')}</div></details>` : ''}
      ${q.cp ? `<div class="ctx pre">${esc(q.cp)}</div>` : ''}
      ${pideNegativa(q.q) ? '<div class="pide">Ojo: te piden la opción INCORRECTA o la excepción</div>' : ''}
      <div class="enun pre">${kw(q.q)}</div>
      <div class="opts">
      ${q.a.map((o, i) => {
        let cl = 'opt';
        if (reveal) { if (i === q.c) cl += ' ok'; else if (i === a) cl += ' bad'; cl += ' dis'; }
        else if (a === i) cl += ' sel';
        return `<button class="${cl}" data-i="${i}" ${a === i && !reveal ? 'aria-pressed="true"' : ''}><b>${L[i]}</b><span class="pre">${kw(o)}</span>${reveal && i === q.c ? '<span class="sr">(respuesta correcta)</span>' : reveal && i === a ? '<span class="sr">(tu respuesta, incorrecta)</span>' : ''}</button>`;
      }).join('')}
      </div>
      ${reveal ? feedback(q, a) : ''}
    </div>
    <div class="bar2">
      ${R.feedback ? (reveal ? `<button class="btn" id="next">${R.idx + 1 === R.items.length ? 'Terminar' : 'Siguiente'} →</button>` : `<button class="btn sec" id="blank">No lo sé</button>`)
        : `<button class="btn sec" id="blank">${a === -1 ? '✓ En blanco' : 'Dejar en blanco'}</button>
           <button class="btn" id="next">${R.idx + 1 === R.items.length ? 'Terminar' : 'Siguiente'} →</button>`}
    </div>
    ${R.paused ? `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pt"><div class="card"><h2 id="pt">En pausa</h2><p>El tiempo está detenido.</p><button class="btn" id="resume">Continuar</button></div></div>` : ''}`;
    bind(q);
    if (R.paused) { app.querySelectorAll('.qhead,.sub,.pace,.card.q,.bar2').forEach(el => { if (!el.closest('.overlay')) el.inert = true; }); const rb = $('.overlay #resume'); rb && rb.focus(); }
    clearInterval(R.gt);
    if (LEC === 2 && !reveal && a === undefined && !R.paused) {
      const need = minLectura(q), left = () => Math.ceil(need - (Date.now() - R.qT0) / 1000);
      if (left() > 0) {
        const opts = app.querySelectorAll('.opt'); opts.forEach(b => b.disabled = true);
        $('.opts').insertAdjacentHTML('afterend', `<div class="gate" id="gate"></div>`);
        const upd = () => { const l = left(), g = $('#gate'); if (!g) return clearInterval(R.gt); if (l <= 0) { clearInterval(R.gt); g.remove(); app.querySelectorAll('.opt').forEach(b => b.disabled = false); } else g.textContent = `👀 Lee con calma: podrás responder en ${l} s. ¿Qué te piden? ¿Hay NO, SALVO, cifras?`; };
        upd(); R.gt = setInterval(upd, 400);
      }
    }
    if (reveal) { const lv = $('#live'); if (lv) lv.textContent = (a === -1 ? 'Sin responder' : a === q.c ? 'Correcto' : 'Incorrecto') + '. Respuesta: ' + L[q.c]; const nx = $('#next'); nx && nx.focus({ preventScroll: true }); }
    else if (a !== undefined && !R.paused) { const so = app.querySelector('.opt.sel'); so && so.focus({ preventScroll: true }); }
    if (reveal) { const f = $('.fb'); if (f) setTimeout(() => f.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' }), 60); }
  }
  function feedback(q, a) {
    const ok = a === q.c;
    return `<div class="fb ${ok ? 'good' : 'wrong'}"><b>${a === -1 ? 'Sin responder' : ok ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>${L[q.c]}</b>${!ok && a !== -1 && R.fast?.[R.idx] ? `<div class="fbsub">Marcaste ${L[a]} en ${R.fast[R.idx][0]} s${R.fast[R.idx][0] < R.fast[R.idx][1] * 0.6 ? `; leerla con calma lleva unos ${R.fast[R.idx][1]} s` : ''}.</div>` : ''}
      ${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}
      ${q.n ? `<div class="cita"><span>Nota</span>${esc(q.n)}</div>` : ''}
      ${q.x?.length ? `<div class="trap">Trampa: ${q.x.map(x => esc(TRAMPAS[x] || x)).join(' · ')}</div>` : ''}
      ${!ok && a !== -1 && R.feedback ? `<div class="mot" id="mot"><small>¿Por qué fallé?${(() => { const f = R.fast?.[R.idx]; return f && f[0] < f[1] * 0.6 ? ` <b class="r">Respondiste en ${f[0]} s; leerla bien lleva ≈${f[1]} s. ¿Fue velocidad?</b>` : ''; })()}</small>${[5, 7, 1, 2, 3, 4].map(m => `<button class="${store.rec(q.i)?.[9] === m ? 'on' : (m === 7 && R.fast?.[R.idx] && R.fast[R.idx][0] < R.fast[R.idx][1] * 0.6 ? 'sug' : '')}" data-m="${m}">${MOTIVOS_FALLO[m]}</button>`).join('')}<button class="mk" id="mkcard" ${store.rec(q.i)?.[9] === 4 && !store.cardRec('FC-Q-' + q.i) ? 'hidden' : ''}>${store.cardRec('FC-Q-' + q.i) ? '📇 Tarjeta creada ✓' : '📇 Hacer tarjeta'}</button></div>` : ''}
      ${ok && a !== -1 && R.feedback ? (() => { const r = store.rec(q.i) || [], en = r[3] === 0 && r[4] > now() + 86400000 * 1.5; return `<div class="mot" id="acc"><small>¿Seguro? (entra en repaso a +2 días)</small>${(() => { const pl = R.luck?.[R.idx]; return pl === 6 ? '<b class="r">🍀 Marcada como suerte: acierto 1/2. Otra vez bien y se quita la etiqueta.</b>' : pl === 8 ? '<b class="r">🍀 ¡Acierto 2/2! Etiqueta de suerte quitada: ya la sabes.</b>' : ''; })()}<button class="${en && r[9] !== 6 && r[9] !== 8 ? 'on' : ''}" data-a="doubt">🤔 Acerté dudando</button><button class="${r[9] === 6 || r[9] === 8 ? 'on' : ''}" data-a="suerte">🍀 Fue suerte</button></div>`; })() : ''}
      <button class="ghost fl" id="flag">${store.rec(q.i)?.[6] ? '★ Dudosa' : '☆ Marcar como dudosa'}</button>
      <div class="repw" id="rep"></div></div>`;
  }
  function bind(q) {
    $('#exit').onclick = async () => { if (await ask(R.feedback ? '¿Salir? Lo ya respondido queda guardado.' : '¿Abandonar el simulacro? Se perderá.', 'Salir', !R.feedback)) { if (R.feedback && R.ans.some(x => x !== undefined)) finish(); else { RUN = null; clearRun(); go('#/home'); } } };
    $('#pause') && ($('#pause').onclick = () => { R.paused = true; draw(); });
    $('#resume') && ($('#resume').onclick = () => { R.paused = false; draw(); const pb = $('#pause'); pb && pb.focus(); });
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (R.paused) return;
      const i = +b.dataset.i;
      if (R.feedback) { if (R.ans[R.idx] !== undefined) return; answer(q, i); draw(); }
      else { R.ans[R.idx] = i; (R.times ||= [])[R.idx] = Math.max(1, R.secs - R.q0); draw(); }
    });
    $('#blank') && ($('#blank').onclick = () => {
      if (R.feedback) { if (R.ans[R.idx] === undefined) { answer(q, -1); draw(); } }
      else { R.ans[R.idx] = R.ans[R.idx] === -1 ? undefined : -1; draw(); }
    });
    $('#next') && ($('#next').onclick = () => { R.idx++; draw(); window.scrollTo(0, 0); });
    $('#mot') && ($('#mot').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const mk = $('#mkcard'), id = 'FC-Q-' + q.i;
      if (b === mk) { if (store.cardRec(id)) { store.removeCard(id); mk.textContent = '📇 Hacer tarjeta'; } else { store.addFallo(q.i); mk.textContent = '📇 Tarjeta creada ✓'; } return; }
      store.setMotivo(q.i, q.t, +b.dataset.m);
      $('#mot').querySelectorAll('button[data-m]').forEach(x => x.classList.toggle('on', x === b));
      if (mk) mk.hidden = +b.dataset.m === 4 && !store.cardRec(id); // el despiste no merece tarjeta
    });
    $('#acc') && ($('#acc').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'suerte') store.suerte(q.i, q.t); else store.doubt(q.i, q.t); $('#acc').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#rep') && reportBox(q, $('#rep'));
    $('#flag') && ($('#flag').onclick = () => { store.toggleFlag(q.i, q.t); $('#flag').textContent = store.rec(q.i)?.[6] ? '★ Dudosa' : '☆ Marcar como dudosa'; });
  }
  function answer(q, i) {
    R.ans[R.idx] = i;
    (R.luck ||= {})[R.idx] = store.rec(q.i)?.[9] || 0;
    (R.fast ||= {})[R.idx] = [Math.round((Date.now() - R.qT0) / 1000), minLectura(q)];
    store.record(q.i, q.t, i === q.c ? 1 : 0, now(), i === -1 ? undefined : Math.max(1, R.secs - R.q0));
  }
  async function finish() {
    clearInterval(tick); clearRun();
    const items = R.items, res = { a: 0, f: 0, b: 0 }, fails = [], porTema = {}, porTipo = {};
    items.forEach((q, k) => {
      const x = R.ans[k]; const ok = x === q.c;
      const pt = porTema[q.t] ||= [0, 0]; pt[1]++;
      const tk = META[q.i]?.[2]; const ptk = tk ? (porTipo[tk] ||= [0, 0]) : null; if (ptk) ptk[1]++;
      if (x === undefined || x === -1) { res.b++; if (!R.feedback) store.record(q.i, q.t, 2); }
      else if (ok) { res.a++; pt[0]++; if (ptk) ptk[0]++; if (!R.feedback) store.record(q.i, q.t, 1, now(), R.times?.[k]); }
      else { res.f++; fails.push(q.i); if (!R.feedback) store.record(q.i, q.t, 0, now(), R.times?.[k]); }
      if (R.feedback && (x === undefined)) res.b++;
    });
    const n = items.length;
    const ses = { id: 's' + now().toString(36), ts: now(), kind: R.kind, n, a: res.a, f: res.f, b: res.b, secs: R.secs, nota: nota(res.a, res.f, n), temas: porTema, tipos: porTipo, fails, titulo: R.titulo || '' };
    store.addSession(ses);
    RUN = null; LAST = { ses, items, ans: R.ans, times: R.times || [], limit: R.limit || 0 };
    go('#/result');
  }
};

// ───────── pregunta relámpago (enlace #/relampago, pensado para avisos) ─────────
routes.relampago = async function () {
  await getMeta(); const st = store.getStats(), t = now();
  const lucky = Object.keys(st).filter(id => (st[id][9] === 6 || st[id][9] === 8) && META[id]);
  const due = await dueList();
  const fallos = Object.keys(st).filter(id => st[id][5] === 0 && META[id]);
  const pool = [...shuffle(lucky).slice(0, 5), ...due.slice(0, 5), ...shuffle(fallos).slice(0, 5)];
  const cand = pool.length ? pool : shuffle(Object.keys(META).filter(k => k !== '_by')).slice(0, 10);
  let q = null;
  for (const q0 of await byIds(shuffle(cand).slice(0, 8))) if (!q0.s && !q0.cp) { q = q0; break; }
  if (!q) { app.innerHTML = '<div class="card"><p>No hay pregunta disponible.</p></div>'; return; }
  const why = lucky.includes(q.i) ? '🍀 Marcada como suerte' : due.includes(q.i) ? '⏰ Toca repasarla' : fallos.includes(q.i) ? '↩ La fallaste' : '🆕 Nueva';
  const LEC = normUi(store.getCfg().ui).lectura, kw = x => LEC ? claveHtml(x) : esc(x), t0 = Date.now();
  app.innerHTML = `<h1>⚡ Pregunta relámpago</h1><div class="sub">${why}</div>
  <div class="card q"><div class="meta"><span class="tag">${esc(q.t)} · ${esc(temaName(q.t))}</span></div>
  <div class="enun pre">${kw(q.q)}</div>
  <div class="opts">${q.a.map((o, i) => `<button class="opt" data-i="${i}"><b>${L[i]}</b><span class="pre">${kw(o)}</span></button>`).join('')}</div><div id="fb"></div></div>
  <div class="bar2" id="bar"><button class="btn sec" id="skip">Ahora no</button></div>`;
  $('#skip').onclick = () => go('#/home');
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, ok = i === q.c;
    store.record(q.i, q.t, ok ? 1 : 0, now(), Math.max(1, Math.round((Date.now() - t0) / 1000)));
    app.querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; x.classList.add('dis'); if (k === q.c) x.classList.add('ok'); else if (k === i) x.classList.add('bad'); });
    $('#fb').innerHTML = `<div class="fb ${ok ? 'good' : 'wrong'}"><b>${ok ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>${L[q.c]}</b>${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}${q.n ? `<div class="cita"><span>Nota</span>${esc(q.n)}</div>` : ''}${q.x?.length ? `<div class="trap">Trampa: ${q.x.map(x => esc(TRAMPAS[x] || x)).join(' · ')}</div>` : ''}</div>`;
    $('#bar').innerHTML = '<button class="btn" id="more">Otra →</button><button class="btn sec" id="home">Inicio</button>';
    $('#more').onclick = () => route(); $('#home').onclick = () => go('#/home');
  });
};

// mezcla aleatoria: cada grupo aporta hasta k ids prioritarios y el resto rellena hasta n; las ids de `rec` solo se usan si faltan
const mezclaIds = (grupos, resto, n = 40, rec = new Set()) => {
  const fresh = a => [...shuffle(a.filter(id => !rec.has(String(id)))), ...shuffle(a.filter(id => rec.has(String(id))))];
  const pick = grupos.flatMap(([a, k]) => fresh(a).slice(0, k)), got = new Set(pick);
  return [...pick, ...fresh(resto).filter(id => !got.has(id)).slice(0, n)];
};

// ───────── detective de trampas: ejercicio ─────────
let TRUN = null;
routes.trampas = async function () {
  await getMeta();
  if (!TRUN) {
    const st = store.getStats();
    const ids = Object.keys(META).filter(id => id !== '_by' && (META[id][3] || []).length);
    const fail = ids.filter(id => st[id] && st[id][5] === 0), rest = ids.filter(id => !fail.includes(id));
    const items = (await byIds(mezclaIds([[fail, 4]], rest))).filter(q => !q.s && q.x?.length).slice(0, 8);
    TRUN = { items, k: 0, res: [] };
  }
  const R = TRUN; const ALL = Object.keys(TRAMPAS).map(Number);
  function draw() {
    if (R.k >= R.items.length) return end();
    const mode = store.getCfg().tmode === 1 ? 1 : 0; // 0 = solo enunciado, 1 = con opciones
    const q = R.items[R.k], good = new Set(q.x.map(Number));
    const dis = shuffle(ALL.filter(k => !good.has(k))).slice(0, Math.max(3, 8 - good.size));
    const chips = shuffle([...good, ...dis]), sel = new Set();
    app.innerHTML = `<div class="qhead"><button class="ghost" id="exit" aria-label="Salir">✕</button><div class="prog"><div style="width:${100 * R.k / R.items.length}%"></div></div><div class="cnt">${R.k + 1}/${R.items.length}</div></div>
    <h1 class="sub">🕵️ Detective de trampas</h1>
    <div class="seg" id="md">${[[0, 'Solo enunciado'], [1, 'Con opciones']].map(([v, t]) => `<button class="${mode === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
    <div class="card q"><div class="meta"><span class="tag">${esc(q.t)} · ${esc(temaName(q.t))}</span></div>
      ${q.cp ? `<div class="ctx pre">${esc(q.cp)}</div>` : ''}
      <div class="enun pre">${claveHtml(q.q)}</div>
      ${mode ? `<div class="opts">${q.a.map((o, i) => `<div class="opt dis" id="o${i}"><b>${L[i]}</b><span class="pre">${claveHtml(o)}</span></div>`).join('')}</div>` : ''}
      <p><b>¿Qué trampas ves aquí?</b> <small>Marca todas las que apliquen (${good.size === 1 ? 'hay 1' : 'hay varias'} posible${good.size === 1 ? '' : 's'}).</small></p>
      <div class="mot" id="chips">${chips.map(k => `<button aria-pressed="false" data-k="${k}">${esc(TRAMPAS[k])}</button>`).join('')}</div>
      <div id="fb"></div></div>
    <div class="bar2"><button class="btn" id="chk">Comprobar</button></div>`;
    $('#exit').onclick = async () => { if (await ask('¿Salir del ejercicio?', 'Salir')) { TRUN = null; go('#/home'); } };
    $('#md').onclick = e => { const b = e.target.closest('button'); if (b) { store.setCfg('tmode', +b.dataset.v); draw(); } };
    $('#chips').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; const k = +b.dataset.k; sel.has(k) ? sel.delete(k) : sel.add(k); b.setAttribute('aria-pressed', String(b.classList.toggle('on'))); };
    $('#chk').onclick = () => {
      if ($('#chk').dataset.done) { R.k++; draw(); window.scrollTo(0, 0); return; }
      let hit = 0, fa = 0, miss = 0; const td = { ...(store.getCfg().tdet || {}) };
      app.querySelectorAll('#chips button').forEach(b => {
        const k = +b.dataset.k, on = sel.has(k), g = good.has(k); b.disabled = true; b.classList.remove('on');
        if (g && on) { hit++; b.classList.add('ok'); b.textContent = '✔ ' + b.textContent; }
        else if (g) { miss++; b.classList.add('sug'); b.textContent = '○ ' + b.textContent + ' (no la viste)'; }
        else if (on) { fa++; b.classList.add('bad'); b.textContent = '✖ ' + b.textContent + ' (falsa alarma)'; }
      });
      for (const k of good) { const a = td[k] ? [...td[k]] : [0, 0]; a[0]++; if (sel.has(k)) a[1]++; td[k] = a; }
      store.setCfg('tdet', td);
      R.res.push({ hit, miss, fa, n: good.size, x: [...good] });
      if (mode) { const o = $('#o' + q.c); o && o.classList.add('ok'); }
      $('#fb').innerHTML = `<div class="fb ${miss || fa ? 'wrong' : 'good'}"><b>${!miss && !fa ? '¡Detectadas todas!' : `Detectaste ${hit} de ${good.size}${fa ? ` y marcaste ${fa} de más` : ''}.`}</b> Respuesta correcta: <b>${L[q.c]}</b>
        ${[...good].map(k => `<div class="trapx ${sel.has(k) ? 'hit' : 'miss'}"><b>${sel.has(k) ? 'Detectada' : 'No la viste'}: ${esc(TRAMPAS[k] || k)}</b><p>${esc(TRAMPA_EXPL[k] || '')}</p></div>`).join('')}${[...sel].filter(k => !good.has(k)).map(k => `<div class="trapx fa"><b>Falsa alarma: ${esc(TRAMPAS[k] || k)}</b><p>No aplica aquí. ${esc(TRAMPA_EXPL[k] || '')}</p></div>`).join('')}
        ${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}${q.n ? `<div class="cita"><span>Nota</span>${esc(q.n)}</div>` : ''}
        ${!mode ? `<details><summary>Ver opciones</summary>${q.a.map((o, i) => `<div class="line"><span><b>${L[i]}</b> ${esc(o)}</span><span>${i === q.c ? '✔' : ''}</span></div>`).join('')}</details>` : ''}</div>`;
      $('#chk').textContent = R.k + 1 === R.items.length ? 'Terminar →' : 'Siguiente →'; $('#chk').dataset.done = 1;
      $('#fb').scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    };
  }
  function end() {
    const n = R.res.length, tot = R.res.reduce((a, r) => a + r.n, 0), hit = R.res.reduce((a, r) => a + r.hit, 0), fa = R.res.reduce((a, r) => a + r.fa, 0);
    const td = store.getCfg().tdet || {};
    const rows = Object.entries(td).filter(([, v]) => v[0] >= 3).sort((a, b) => a[1][1] / a[1][0] - b[1][1] / b[1][0]).slice(0, 6);
    app.innerHTML = `<h1>Detective de trampas</h1><div class="grid"><div class="stat"><b>${hit}/${tot}</b><span>trampas detectadas</span></div><div class="stat"><b>${fa}</b><span>falsas alarmas</span></div></div>
    <div class="card"><h2 class="h3">Las que más se te escapan</h2>${rows.length ? rows.map(([k, v]) => `<div class="line"><span>${esc(TRAMPAS[k] || k)}</span><span>${pct(v[1], v[0])}% <small>(${v[1]}/${v[0]})</small></span></div>`).join('') : '<p class="sub">Aparecerá cuando hayas visto cada trampa ≥3 veces.</p>'}</div>
    <div class="bar2"><button class="btn" id="again">Otra tanda</button><button class="btn sec" id="home">Inicio</button></div>`;
    TRUN = null; $('#again').onclick = () => route(); $('#home').onclick = () => go('#/home');
  }
  draw();
};

// ───────── lectura atenta: ejercicio ─────────
let LRUN = null;
routes.lectura = async function () {
  await getMeta(); const st = store.getStats();
  if (!LRUN) {
    const vel = velocidad(st).ids;
    let recent = []; try { const r = JSON.parse(localStorage.getItem('tai.lrec') || '[]'); if (Array.isArray(r)) recent = r.map(String); } catch { }
    const rec = new Set(recent), velS = new Set(vel);
    const fallos = Object.keys(st).filter(id => st[id][5] === 0 && !velS.has(id));
    const fS = new Set(fallos);
    const rest = Object.keys(META).filter(k => k !== '_by' && META[k] && !velS.has(k) && !fS.has(k));
    const ids = mezclaIds([[vel, 3], [fallos, 2]], rest, 40, rec);
    const got = new Map((await byIds(ids)).filter(q => !q.s && !q.cp).map(q => [String(q.i), q]));
    const ok = ids.map(id => got.get(String(id))).filter(Boolean);
    const items = shuffle(ok.slice(0, 8));
    if (!items.length) { app.innerHTML = `<h1>Lectura atenta</h1><div class="card"><p>No hay preguntas disponibles ahora mismo. Comprueba la conexión e inténtalo de nuevo.</p></div><div class="bar2"><button class="btn" id="retry">Reintentar</button><button class="btn sec" id="home">Inicio</button></div>`; $('#retry').onclick = () => route(); $('#home').onclick = () => go('#/home'); return; }
    LRUN = { items, k: 0, step: 0, res: [], mark: new Set() };
  }
  const R = LRUN; let gt = null;
  cleanup = () => clearInterval(gt);
  const words = t => t.split(/(\s+)/);
  function draw() {
    clearInterval(gt);
    if (R.k >= R.items.length) return end();
    const q = R.items[R.k], neg = pideNegativa(q.q);
    const head = `<div class="qhead"><button class="ghost" id="exit" aria-label="Salir">✕</button><div class="prog"><div style="width:${100 * R.k / R.items.length}%"></div></div><div class="cnt">${R.k + 1}/${R.items.length}</div></div><h1 class="sub">Lectura atenta · paso ${R.step + 1} de 3</h1>`;
    if (R.step === 0) {
      app.innerHTML = `${head}<div class="card q"><div class="enun pre">${esc(q.q)}</div><p><b>1. ¿Qué te piden?</b> Antes de ver las opciones.</p>
        <div class="opts"><button class="opt" data-v="0"><b>✔</b><span>La opción CORRECTA / VERDADERA</span></button><button class="opt" data-v="1"><b>✖</b><span>La INCORRECTA / FALSA / la excepción</span></button></div><div id="fb0"></div></div>`;
      app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = (+b.dataset.v === 1) === neg; R.pideOk = ok; b.classList.add(ok ? 'ok' : 'bad'); if (!ok) app.querySelectorAll('.opt').forEach(x => { if (x !== b) x.classList.add('ok'); });
        $('#fb0').innerHTML = `<div class="fb ${ok ? 'good' : 'wrong'}"><b>${ok ? '¡Bien leído!' : 'Ojo: lo habías leído al revés.'}</b> Te piden la opción <b>${neg ? 'INCORRECTA / excepción' : 'CORRECTA'}</b>.</div><div class="bar2"><button class="btn" id="n0">Siguiente →</button></div>`;
        app.querySelectorAll('.opt').forEach(x => x.disabled = true); $('#n0').onclick = () => { R.step = 1; R.mark = new Set(); draw(); };
      });
    } else if (R.step === 1) {
      const toks = words(q.q), spans = claveSpans(q.q); let pos = 0, wi = 0, key = [];
      const html = toks.map(t => { const a = pos; pos += t.length; if (/^\s+$/.test(t) || !t) return esc(t); const id = wi++; const k = spans.some(([x, y]) => a >= x && a < y); if (k) key.push(id); return `<button type="button" class="tk" aria-pressed="false" data-id="${id}" data-k="${k ? 1 : 0}">${esc(t)}</button>`; }).join('');
      app.innerHTML = `${head}<div class="card q"><p><b>2. Toca las palabras que cambian el sentido</b> (negaciones, excepciones, absolutos, cifras y plazos).</p><div class="enun pre tks">${html}</div><div id="fb1"></div><div class="bar2"><button class="btn sec" id="none">No contiene</button><button class="btn" id="chk">Continuar</button></div></div>`;
      app.querySelectorAll('.tk').forEach(el => el.onclick = () => el.setAttribute('aria-pressed', String(el.classList.toggle('on'))));
      $('#none').onclick = () => { app.querySelectorAll('.tk.on').forEach(el => { el.classList.remove('on'); el.setAttribute('aria-pressed', 'false'); }); $('#chk').dataset.claim = 'none'; $('#chk').click(); };
      $('#chk').onclick = () => {
        if ($('#chk').dataset.done) { R.step = 2; draw(); return; }
        const claimNone = $('#chk').dataset.claim === 'none'; $('#none').remove();
        let hit = 0, miss = 0, extra = 0;
        app.querySelectorAll('.tk').forEach(el => { const on = el.classList.contains('on'), k = el.dataset.k === '1'; if (k) { el.classList.add('key'); on ? hit++ : miss++; } else if (on) extra++; });
        R.marcadas = [hit, key.length];
        if (claimNone) {
          const okN = key.length === 0;
          R.marcadas = [0, key.length];
          $('#fb1').innerHTML = `<div class="fb ${okN ? 'good' : 'wrong'}">${okN ? '<b>Correcto:</b> no hay palabras clave destacables. Lo importante es entender bien qué pide.' : `<b>Ojo:</b> sí había ${key.length} palabra${key.length === 1 ? '' : 's'} clave (resaltada${key.length === 1 ? '' : 's'}). Mira qué cambia el sentido.`}</div>`;
          $('#chk').textContent = 'Ver opciones →'; $('#chk').dataset.done = 1; return;
        }
        $('#fb1').innerHTML = `<div class="fb ${miss ? 'wrong' : 'good'}">${key.length ? `Detectaste <b>${hit}</b> de <b>${key.length}</b> palabras clave${miss ? ' (las que faltaban están resaltadas)' : ''}.` : 'Esta pregunta no tiene palabras clave destacables: lo importante es entender bien qué pide.'}${extra ? ` Marcaste ${extra} que no eran clave.` : ''}</div>`;
        $('#chk').textContent = 'Ver opciones →'; $('#chk').dataset.done = 1;
      };
    } else {
      const need = minLectura(q); R.t0 = Date.now();
      app.innerHTML = `${head}<div class="card q"><div class="enun pre">${claveHtml(q.q)}</div><p class="sm"><b>3. Lee las cuatro opciones enteras</b> antes de responder.</p><div class="opts">${q.a.map((o, i) => `<button class="opt" data-i="${i}" disabled><b>${L[i]}</b><span class="pre">${claveHtml(o)}</span></button>`).join('')}</div><div class="gate" id="gate"></div><div id="fb2"></div></div>`;
      const upd = () => { const l = Math.ceil(need - (Date.now() - R.t0) / 1000), g = $('#gate'); if (!g) return clearInterval(gt); if (l <= 0) { clearInterval(gt); g.remove(); app.querySelectorAll('.opt').forEach(b => b.disabled = false); } else g.textContent = `Lectura mínima: ${l} s`; };
      upd(); gt = setInterval(upd, 400);
      app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const i = +b.dataset.i, ok = i === q.c, secs = Math.max(1, Math.round((Date.now() - R.t0) / 1000));
        store.record(q.i, q.t, ok ? 1 : 0, now(), secs);
        try { let r = JSON.parse(localStorage.getItem('tai.lrec') || '[]'); if (!Array.isArray(r)) r = []; localStorage.setItem('tai.lrec', JSON.stringify([String(q.i), ...r.filter(x => String(x) !== String(q.i))].slice(0, 80))); } catch { }
        R.res.push({ q: q.i, ok, pide: R.pideOk, marc: R.marcadas });
        app.querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; x.classList.add('dis'); if (k === q.c) x.classList.add('ok'); else if (k === i) x.classList.add('bad'); });
        $('#fb2').innerHTML = `<div class="fb ${ok ? 'good' : 'wrong'}"><b>${ok ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>${L[q.c]}</b>${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}</div><div class="bar2"><button class="btn" id="n2">${R.k + 1 === R.items.length ? 'Terminar' : 'Siguiente'} →</button></div>`;
        $('#n2').onclick = () => { R.k++; R.step = 0; draw(); window.scrollTo(0, 0); };
      });
    }
    $('#exit').onclick = async () => { if (await ask('¿Salir del ejercicio?', 'Salir')) { LRUN = null; go('#/home'); } };
  }
  function end() {
    const n = R.res.length, ok = R.res.filter(r => r.ok).length, pide = R.res.filter(r => r.pide).length;
    const ms = R.res.reduce((a, r) => [a[0] + (r.marc?.[0] || 0), a[1] + (r.marc?.[1] || 0)], [0, 0]);
    app.innerHTML = `<h1>Lectura atenta</h1><div class="grid"><div class="stat"><b>${ok}/${n}</b><span>aciertos</span></div><div class="stat"><b>${pide}/${n}</b><span>«qué piden» bien</span></div><div class="stat"><b>${ms[1] ? pct(ms[0], ms[1]) + '%' : '—'}</b><span>palabras clave</span></div></div>
    <div class="card"><h2 class="h3">Método de 3 pasos</h2><ul class="tips">${CONSEJOS_LECTURA.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
    <div class="bar2"><button class="btn" id="again">Otra tanda</button><button class="btn sec" id="home">Inicio</button></div>`;
    LRUN = null; $('#again').onclick = () => route(); $('#home').onclick = () => go('#/home');
  }
  draw();
};

// ───────── tarjetas (flashcards) ─────────
let CARDIDX; const cardCache = new Map(); let CRUN = null;
async function curatedCards() {
  if (CARDIDX === undefined) { try { CARDIDX = (await j('cards/index.json')).temas || {}; } catch (e) { return []; } } // sin caché del fallo: se reintenta
  const out = [], ts = Object.keys(CARDIDX);
  for (const t of ts) if (!cardCache.has(t)) cardCache.set(t, j(`cards/${t}.json`).catch(e => { cardCache.delete(t); return []; }));
  const lists = await Promise.all(ts.map(t => cardCache.get(t))); // en paralelo: antes eran peticiones una tras otra
  ts.forEach((t, i) => { for (const c of lists[i]) if (c && c.id && c.q && c.a && !c.revisar) out.push({ ...c, t }); });
  return out;
}
async function falloCards() {
  await getMeta(); const out = [];
  const ids = Object.keys(store.getCards()).filter(id => id.startsWith('FC-Q-')).map(id => [id.slice(5), temaOf(id.slice(5))]).filter(x => x[1]);
  const temas = new Map(await Promise.all([...new Set(ids.map(x => x[1]))].map(async t => [t, await getTema(t)])));
  for (const [qid, t] of ids) { const q = temas.get(t).find(x => x.i === qid); if (q) out.push(cardFromQuestion(q)); }
  return out;
}
const allCards = async () => [...await curatedCards(), ...await falloCards()];

routes.cards = async function () {
  await getIndex(); await getMeta();
  if (CRUN) return cardSession();
  const cards = await allCards();
  const cfg = Object.assign({ scope: 'vistos', n: 20 }, store.getCfg().cardsc || {});
  const draw = () => {
    const recs = store.getCards(), cs = cardStats(cards, recs, now());
    app.innerHTML = `
    <h1>Tarjetas de repaso</h1>
    <div class="sub">Primero intenta recordar la respuesta; después pulsa para verla y valora cómo te fue.</div>
    <div class="grid">
      <div class="stat"><b>${cs.hoy}</b><span>vencen hoy</span></div>
      <div class="stat"><b>${cs.nuevas}</b><span>nuevas</span></div>
      <div class="stat"><b>${cs.enRepaso}</b><span>en repaso</span></div>
      <div class="stat"><b>${cs.dominadas}</b><span>dominadas</span></div>
    </div>
    ${cards.length ? `<div class="card"><h2 class="h3">Tarjetas por sesión</h2><div class="seg" id="cn">${[10, 20, 30].map(v => `<button class="${cfg.n === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      <h2 class="h3">Tarjetas nuevas de</h2><div class="seg" id="cs">${[['vistos', 'Mis temas vistos'], ['todos', 'Todos los temas']].map(([v, t]) => `<button class="${cfg.scope === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      <p class="sm"><small>Las vencidas salen primero, mezcladas por tema. Como máximo 10 nuevas por sesión.</small></p></div>
      <div class="bar2"><button class="btn" id="go">Empezar</button></div>` :
      `<div class="note">Aún no tienes tarjetas. Al fallar una pregunta en un test pulsa <b>«📇 Hacer tarjeta»</b> (si el motivo no es un despiste) y aparecerá aquí.</div>`}`;
    $('#cn') && ($('#cn').onclick = e => { const b = e.target.closest('button'); if (b) { store.setCfg('cardsc', { ...cfg, n: +b.dataset.v }); cfg.n = +b.dataset.v; draw(); } });
    $('#cs') && ($('#cs').onclick = e => { const b = e.target.closest('button'); if (b) { store.setCfg('cardsc', { ...cfg, scope: b.dataset.v }); cfg.scope = b.dataset.v; draw(); } });
    $('#go') && ($('#go').onclick = () => {
      const seen = new Set(store.getSeen());
      const ids = pickCards(cards, recs, { n: cfg.n, now: now(), maxNew: 10, seen: cfg.scope === 'vistos' && seen.size ? seen : null });
      if (!ids.length) { toast('No hay tarjetas pendientes ahora mismo. Vuelve cuando venza alguna.'); return; }
      const by = new Map(cards.map(c => [c.id, c]));
      CRUN = { items: ids.map(id => by.get(id)).filter(Boolean), idx: 0, rev: false, res: [0, 0, 0] };
      cardSession();
    });
  };
  draw();
};

function cardSession() {
  const R = CRUN; if (!R) return go('#/cards');
  const NOMBRE = ['Fallé', 'Dudaba', 'Lo sabía'];
  const grade = g => {
    if (!R.rev) return;
    store.gradeCard(R.items[R.idx].id, g, now()); R.res[g]++; R.idx++; R.rev = false; draw(); window.scrollTo(0, 0);
  };
  const show = () => { if (!R.rev) { R.rev = true; draw(); const a = $('.fa'); a && a.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' }); } };
  const onKey = e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
    const k = e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (!R.rev) show(); }
    else if (R.rev && (k === '1' || k === 'ArrowLeft')) { e.preventDefault(); grade(0); }
    else if (R.rev && k === '2') { e.preventDefault(); grade(1); }
    else if (R.rev && (k === '3' || k === 'ArrowRight')) { e.preventDefault(); grade(2); }
  };
  let tx = null;
  const onTs = e => { const t = e.touches[0]; tx = e.touches.length === 1 && t.clientX > 24 && t.clientX < innerWidth - 24 && !e.target.closest('button,details,input,textarea') ? [t.clientX, t.clientY] : null; };
  const onTe = e => { if (!tx) return; const t = e.changedTouches[0]; const d = swipeDir(t.clientX - tx[0], t.clientY - tx[1]); tx = null; if (R.rev && d === 'next') grade(0); else if (R.rev && d === 'prev') grade(2); };
  document.addEventListener('keydown', onKey); document.addEventListener('touchstart', onTs, { passive: true }); document.addEventListener('touchend', onTe, { passive: true });
  cleanup = () => { document.removeEventListener('keydown', onKey); document.removeEventListener('touchstart', onTs); document.removeEventListener('touchend', onTe); };

  function draw() {
    if (R.idx >= R.items.length) return fin();
    const c = R.items[R.idx];
    app.innerHTML = `
    <div class="qhead"><button class="ghost" id="exit" aria-label="Salir">✕</button><div class="prog" role="progressbar" aria-label="Progreso" aria-valuemin="0" aria-valuemax="${R.items.length}" aria-valuenow="${R.idx}"><div style="width:${100 * R.idx / R.items.length}%"></div></div><div class="cnt">${R.idx + 1}/${R.items.length}</div></div>
    <div class="card q fc" id="fc">
      <div class="meta"><span class="tag">${esc(c.t)} · ${esc(temaName(c.t))}</span>${c.tipo ? `<span class="tag">${esc(c.tipo)}</span>` : ''}${c.caduca ? '<span class="tag warn">Puede caducar</span>' : ''}</div>
      <div class="enun pre">${esc(c.q)}</div>
      ${R.rev ? `<div class="fa"><small>Respuesta</small><div class="pre">${esc(c.a)}</div>
        ${c.nota ? `<div class="cita"><span>Nota</span>${esc(c.nota)}</div>` : ''}
        ${c.ref ? `<div class="cita"><span>Temario</span>${esc(c.ref)}</div>` : ''}
        <div class="repw" id="crep"></div>
        ${c.src === 'fallo' ? '<button class="ghost fl" id="quit">🗑 Quitar esta tarjeta</button>' : ''}</div>` : '<div class="fh">Toca para ver la respuesta</div>'}
    </div>
    <div class="bar2">${R.rev ? NOMBRE.map((t, g) => `<button class="btn ${g === 0 ? 'bad' : g === 1 ? 'sec' : ''}" data-g="${g}">${t}</button>`).join('') : '<button class="btn" id="show">Mostrar respuesta</button>'}</div>
    ${R.rev ? '<p class="sub fgl">Teclado 1·2·3 · deslizar ← Fallé · → Lo sabía</p>' : ''}`;
    $('#exit').onclick = () => { CRUN = null; go('#/home'); };
    $('#show') && ($('#show').onclick = show);
    $('#fc').onclick = e => { if (!R.rev && !e.target.closest('button')) show(); };
    app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => grade(+b.dataset.g));
    $('#crep') && reportBox({ i: c.id, t: c.t }, $('#crep'));
    $('#quit') && ($('#quit').onclick = () => { store.removeCard(c.id); R.items.splice(R.idx, 1); R.rev = false; draw(); });
  }
  function fin() {
    const rs = R.res, tot = rs[0] + rs[1] + rs[2];
    const sig = Object.values(store.getCards()).filter(r => r[3] >= 0 && r[4] > now()).map(r => r[4]).sort((a, b) => a - b)[0];
    CRUN = null; cleanup && cleanup(); cleanup = null;
    app.innerHTML = `<h1>Sesión terminada</h1>
    <div class="grid"><div class="stat"><b>${rs[2]}</b><span>lo sabía</span></div><div class="stat"><b>${rs[1]}</b><span>dudaba</span></div><div class="stat"><b>${rs[0]}</b><span>fallé</span></div><div class="stat"><b>${pct(rs[2], tot)}%</b><span>retención</span></div></div>
    <p class="sub">${rs[0] + rs[1] ? 'Las que fallaste o dudaste vuelven en 2 días.' : '¡Todas recordadas!'}${sig ? ' Próximo repaso: ' + new Date(sig).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) + '.' : ''}</p>
    <button class="btn" id="otra">Otra sesión</button> <button class="btn sec" id="ini">Inicio</button>`;
    $('#otra').onclick = () => go('#/cards'); $('#ini').onclick = () => go('#/home');
  }
  draw();
}

let LAST = null;
function simAnalisis({ ses, items, ans, times, limit }) {
  const r = analisisSimulacro({ correct: items.map(q => q.c), ans, times, limitSecs: limit * 60, secs: ses.secs });
  const pts = [];
  pts.push(`<div class="line"><span>Nota sin penalización</span><span>${r.sinPenal}</span></div>`);
  pts.push(`<div class="line"><span>Puntos que te restaron los fallos</span><span class="${r.perdidoFallos ? 'r' : ''}">−${r.perdidoFallos}</span></div>`);
  pts.push(`<div class="line"><span>Tiempo usado</span><span>${fmtT(ses.secs)} de ${fmtT(limit * 60)} (${r.uso} %)</span></div>`);
  pts.push(`<div class="line"><span>Tiempo medio por pregunta</span><span>${r.media} s <small>(presupuesto ${r.presupuesto} s)</small></span></div>`);
  const tips = [];
  if (r.lentas.length) tips.push(`Te atascaste en ${r.lentas.map(x => `la ${x.k + 1} (${x.t} s${x.ok ? '' : ', fallada'})`).join(', ')}. Si pasan de ${Math.round(r.presupuesto * 1.5)} s, déjalas para el final.`);
  if (r.rapidasFalladas >= 2) tips.push(`Fallaste ${r.rapidasFalladas} preguntas respondiendo muy deprisa: probable lectura rápida. Aplica el método de 3 pasos.`);
  if (r.f > 0) tips.push('Cada fallo resta 1/3: si puedes descartar al menos una opción, merece la pena responder; si no, déjala en blanco.');
  if (r.b > r.n * 0.15) tips.push(`Dejaste ${r.b} en blanco. Con una opción descartada, responder suma de media.`);
  return `<h2>Ritmo y puntos</h2><div class="card">${pts.join('')}${tips.length ? `<ul class="tips">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div>`;
}
routes.result = async function () {
  if (!LAST) return go('#/home');
  const { ses, items, ans } = LAST;
  const ng = ses.f;
  app.innerHTML = `
  <h1>Resultado</h1>
  <div class="card big">
    <div class="score">${ses.nota}<small>/100</small></div>
    <div class="legend">(aciertos − fallos/3) / total</div>
    <div class="trio"><div class="g"><b>${ses.a}</b>Aciertos</div><div class="r"><b>${ses.f}</b>Fallos</div><div><b>${ses.b}</b>Blanco</div></div>
    <div class="legend">${pct(ses.a, ses.n)} % de acierto · ${fmtT(ses.secs)}</div>
  </div>
  <div class="row">
    ${(ses.titulo || '').includes('Parte 1') && SIMCFG?.parte2 ? '<button class="btn" id="p2go">Seguir con la parte 2 (supuesto)</button>' : ''}
    ${ng ? '<button class="btn" id="again">Repetir las falladas</button>' : ''}
    <button class="btn sec" id="home">Inicio</button>
  </div>
  ${LAST.limit ? simAnalisis(LAST) : ''}
  <h2>Por tema</h2>
  <div class="card">${Object.entries(ses.temas).sort((a, b) => a[0].localeCompare(b[0])).map(([t, [a, n]]) => `<div class="line"><span>${esc(t)} ${esc(temaName(t))}</span><span>${a}/${n}</span></div>`).join('')}</div>
  <h2>Revisión</h2>
  <div class="card">${items.map((q, k) => {
    const x = ans[k]; const st = x === undefined || x === -1 ? 'b' : x === q.c ? 'g' : 'r';
    return `<details class="rv ${st}"><summary><i></i><span class="sr">${st === 'g' ? 'Acierto' : st === 'r' ? 'Fallo' : 'En blanco'}: </span>${esc(q.q.slice(0, 110))}${q.q.length > 110 ? '…' : ''}</summary>
      <div class="pre">${esc(q.q)}</div>${q.a.map((o, i) => `<div class="ro ${i === q.c ? 'ok' : i === x ? 'bad' : ''}"><b>${L[i]}</b> ${esc(o)}</div>`).join('')}
      ${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}<div class="repw" data-rq="${k}"></div></details>`;
  }).join('')}</div>`;
  app.querySelectorAll('[data-rq]').forEach(el => reportBox(items[+el.dataset.rq], el));
  $('#home').onclick = () => go('#/home');
  $('#p2go') && ($('#p2go').onclick = () => go('#/sim2'));
  $('#again') && ($('#again').onclick = async () => startRun({ kind: 'rev', feedback: true, items: shuffle(items.filter((q, k) => ans[k] !== q.c)), titulo: 'Repetición de falladas' }));
};


// ───────── sesión rápida (~5 min) ─────────
async function quickSession() {
  const idx = await getIndex(); await getMeta();
  const N = quickN(store.getStats());
  const orgs = new Set((store.getCfg().test || {}).o || ['O', 'A', 'G']);
  const due = (await byIds((await dueList()).slice(0, N))).filter(q => allowed(q, orgs));
  const seen = new Set(store.getSeen());
  const ord = { r: 0, y: 1, n: 2, g: 3 };
  let temas = dominioTemas(idx).filter(t => !seen.size || seen.has(t.id));
  if (!temas.length) temas = dominioTemas(idx);
  temas.sort((a, b) => (ord[a.est] - ord[b.est]) || ((b.dias ?? 0) - (a.dias ?? 0)));
  const pools = [];
  for (const l of await Promise.all(temas.slice(0, 8).map(t => getTema(t.id)))) pools.push(shuffle(l.filter(q => allowed(q, orgs) && !store.rec(q.i))));
  const items = pickQuick(due, pools, N);
  if (!items.length) { toast('No hay preguntas nuevas ni repasos con esos filtros.'); return; }
  const nd = items.filter(q => store.rec(q.i)).length;
  startRun({ kind: 'rev', feedback: true, items, titulo: `Sesión rápida · ${nd} repasos + ${items.length - nd} nuevas` });
}

// ───────── inicio ─────────
routes.home = async function () {
  const idx = await getIndex(); await getMeta();
  const st = store.getStats();
  let seen = 0, n = 0, ok = 0, dias = new Set();
  for (const id in st) { seen++; n += st[id][0]; ok += st[id][1]; dias.add(new Date(st[id][2]).toDateString()); }
  const due = (await dueList()).length;
  let streak = 0; const d = new Date();
  if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (dias.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  const ex = new Date((store.getCfg().exam || '2027-06-01') + 'T09:00:00'); const dd = Math.ceil((ex - new Date()) / 86400000);
  const nCards = Object.values(store.getCards()).filter(r => r[3] >= 0 && r[4] <= now()).length;
  const vel = velocidad(st);
  const row = (id, ico, t, sub, dis) => `<button class="lrow" id="${id}" ${dis ? 'disabled' : ''}><i aria-hidden="true">${ico}</i><span><b>${t}</b><small>${sub}</small></span></button>`;
  app.innerHTML = `
  <div class="hhead"><div><div class="eyebrow">Preparación TAI</div><h1>Hola, David</h1></div><button class="iconbtn" id="stats" aria-label="Estadísticas">▤</button></div>
  <div class="hero"><div class="hnum"><b>${dd > 0 ? dd : 0}</b><span>días al examen</span></div>
    <div class="hbars"><div class="hl"><span>Preguntas vistas</span><b>${seen} / ${idx.n}</b></div><div class="hb"><i style="width:${Math.min(100, pct(seen, idx.n))}%"></i></div><div class="hl"><span>Acierto global</span><b>${pct(ok, n)}%</b></div></div></div>
  <button class="cta" id="quick"><i aria-hidden="true">⚡</i><span><b>Sesión rápida · 5 min</b><small>${quickN(st)} preguntas: ${due ? 'tus repasos pendientes (' + due + ') mezclados con ' : ''}nuevas de tus temas más débiles</small></span></button>
  <div class="gtitle">Estudiar</div>
  <div class="lgroup">
    ${row('rev', '↻', 'Repaso de fallos', due ? due + ' preguntas toca repasar hoy' : 'Nada pendiente hoy', !due)}
    ${row('cards', '▭', 'Tarjetas de repaso', (() => { const c = Object.values(store.getCards()), h = c.filter(r => r[3] >= 0 && r[4] <= now()).length; return c.length ? (h ? h + ' tarjetas vencen hoy' : 'Nada vence hoy · ' + c.length + ' en tu mazo') : 'Convierte tus fallos en tarjetas y repásalas con repetición espaciada'; })())}
    ${row('test', '✎', 'Test por tema', '10–40 preguntas con corrección inmediata')}
    ${row('sim', '⏱', 'Simulacro', 'Parte 1 con tiempo y nota oficial + supuesto práctico')}
    ${row('examenes', '☷', 'Exámenes y simulacros', 'Elige uno por número y contesta solo sus preguntas')}
  </div>
  <div class="gtitle">Entrenar un hábito</div>
  <div class="lgroup">
    ${row('trampas', '🔎', 'Detective de trampas', 'Marca qué trampas esconde cada pregunta')}
    ${row('lectura', '👁', 'Lectura atenta', vel.n ? vel.n + ' fallos por velocidad: entrena a leer con método' : 'Qué piden, palabras clave y respuesta')}
    ${row('relam', '⚡', 'Pregunta relámpago', 'Una sola, empezando por las marcadas como suerte')}
  </div>
  <div class="gtitle">Seguimiento</div>
  <div class="lgroup">
    ${row('mapa', '◎', 'Mapa de dominio', (() => { const dm = dominioTemas(idx), c = k => dm.filter(x => x.est === k).length; return c('r') + c('y') + c('g') ? `🔴 ${c('r')} reforzar · 🟠 ${c('y')} a vigilar · 🟢 ${c('g')} dominados` : 'Aparecerá cuando empieces a contestar'; })())}
    ${row('temario', '☰', 'Temas vistos', store.getSeen().length ? store.getSeen().length + ' de ' + idx.temas.length + ' temas marcados · el simulacro usa estos' : 'Marca lo que ya has estudiado y el simulacro lo tendrá en cuenta')}
  </div>
  <div class="mini"><div><b>${due}</b><span>repasos hoy</span></div><div><b>${nCards}</b><span>tarjetas vencen</span></div><div><b>${streak}</b><span>días seguidos</span></div></div>
  ${navigator.onLine === false ? `<div class="note">Sin conexión: solo funcionan las preguntas ya descargadas (Ajustes → Uso sin conexión).</div>` : ''}
  ${sync.status.state === 'sin sesión' ? `<div class="note">Inicia sesión en <a href="#/settings">Ajustes</a> para sincronizar iPhone e iPad.</div>` : ''}
  ${sync.status.state === 'sin configurar' ? `<div class="note">Firebase aún no está configurado: el progreso se guarda solo en este dispositivo.</div>` : ''}`;
  $('#quick').onclick = guard(() => quickSession());
  $('#rev').onclick = guard(async () => {
    await getMeta(); const st = store.getStats(), t0 = now();
    const cand = []; for (const id in st) { const r = st[id]; if (r[3] >= 0 && r[4] <= t0 && META[id]) cand.push({ i: id, t: META[id][0], due: r[4] }); }
    const ids = pickRepaso(cand, 30).map(x => x.i);
    startRun({ kind: 'rev', feedback: true, items: await byIds(ids), titulo: 'Repaso de fallos · más vencidas primero, temas mezclados' });
  });
  $('#cards').onclick = () => go('#/cards');
  $('#lectura').onclick = () => go('#/lectura');
  $('#trampas').onclick = () => go('#/trampas');
  $('#relam').onclick = () => go('#/relampago');
  $('#mapa').onclick = () => go('#/stats');
  $('#temario').onclick = () => go('#/temario');
  $('#test').onclick = () => go('#/test');
  $('#sim').onclick = () => go('#/sim');
  $('#examenes').onclick = () => go('#/examenes');
  $('#stats').onclick = () => go('#/stats');
};


// ───────── temas vistos ─────────
const BLOQUES = [['T1', 'Bloque I · Organización del Estado'], ['T2', 'Bloque II · Informática básica'], ['T3', 'Bloque III · Desarrollo'], ['T4', 'Bloque IV · Sistemas y comunicaciones']];
routes.temario = async function () {
  const idx = await getIndex(); await getMeta();
  const draw = () => {
    const sel = new Set(store.getSeen());
    const tstat = (t, n) => { let v = 0, ok = 0, tot = 0; for (const id of META._by[t] || []) { const r = store.rec(id); if (r) { v++; ok += r[1]; tot += r[0]; } } return `${v}/${n}${tot ? ' · ' + pct(ok, tot) + '%' : ''}`; };
    app.innerHTML = `
    <h1>Temas vistos</h1>
    <p class="sub">Marca los temas que ya has estudiado. El simulacro (y el botón «mis temas vistos» del test) usarán solo estos. Se sincroniza entre tus dispositivos.</p>
    <div class="row"><button class="btn sec" id="all">Marcar todos</button><button class="btn sec" id="none">Quitar todos</button></div>
    <div class="card"><h2 class="h3">${sel.size} de ${idx.temas.length} temas marcados</h2>
    ${BLOQUES.map(([b, nom]) => `<div class="bl"><div class="blh"><span>${nom}</span><button class="ghost sm" data-b="${b}">bloque</button></div>
      ${idx.temas.filter(t => t.id.startsWith(b)).map(t => `<label class="tm ${sel.has(t.id) ? 'on' : ''}"><input type="checkbox" data-t="${t.id}" ${sel.has(t.id) ? 'checked' : ''}><span><b>${t.id}</b> ${esc(t.nombre)}</span><small>${tstat(t.id, t.n)}</small></label>`).join('')}</div>`).join('')}
    </div>
    <div class="bar2"><button class="btn" id="sim">Ir al simulacro</button></div>`;
    app.querySelectorAll('[data-t]').forEach(c => c.onchange = () => { const x = new Set(store.getSeen()); c.checked ? x.add(c.dataset.t) : x.delete(c.dataset.t); store.setSeen([...x]); });
    app.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const ids = idx.temas.filter(t => t.id.startsWith(b.dataset.b)).map(t => t.id); const x = new Set(store.getSeen()); const all = ids.every(i => x.has(i)); ids.forEach(i => all ? x.delete(i) : x.add(i)); store.setSeen([...x]); });
    $('#all').onclick = () => store.setSeen(idx.temas.map(t => t.id));
    $('#none').onclick = () => store.setSeen([]);
    $('#sim').onclick = () => go('#/sim');
  };
  let sig = store.getSeen().join();
  cleanup = store.onChange(() => { const n = store.getSeen().join(); if (n !== sig) { sig = n; const y = window.scrollY; draw(); window.scrollTo(0, y); } });
  draw();
};


// ───────── mis trampas ─────────
async function trapTest(n, only, temas) {
  await getMeta();
  const rates = trapRates(store.getStats(), id => META[id]?.[3] || [], 5).filter(r => r.err > 0);
  const targets = only || rates.slice(0, 3).map(r => r.k);
  if (!targets.length) return { items: [], targets };
  const tg = new Set(targets.map(Number)), ts = temas && temas.length ? new Set(temas) : null;
  const ids = Object.keys(META).filter(id => id !== '_by' && (!ts || ts.has(META[id][0])) && (META[id][3] || []).some(k => tg.has(+k)));
  const orgs = new Set((store.getCfg().test || {}).o || ['O', 'A', 'G']);
  const cands = (await byIds(ids)).filter(q => allowed(q, orgs));
  return { items: pickTrampas(cands, id => store.rec(id), targets, n), targets };
}

// ───────── test por tema ─────────
routes.test = async function () {
  const idx = await getIndex(); await getMeta();
  const cfg = store.getCfg().test || { sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] };
  const sel = new Set(cfg.sel), org = new Set(cfg.o);
  const bloques = [['T1', 'Bloque I · Organización del Estado'], ['T2', 'Bloque II · Informática básica'], ['T3', 'Bloque III · Desarrollo'], ['T4', 'Bloque IV · Sistemas y comunicaciones']];
  const draw = () => {
    app.innerHTML = `
    <h1>Test por tema</h1>
    <div class="card">
      <h2 class="h3">Preguntas</h2>
      <div class="seg" id="n">${[10, 15, 25, 40].map(v => `<button class="${cfg.n === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      <h2 class="h3">Qué preguntas</h2>
      <div class="seg" id="mode">${[['nuevas', 'Nuevas primero'], ['aleatorio', 'Aleatorio'], ['falladas', 'Falladas'], ['dudosas', 'Dudosas'], ['trampas', 'Mis trampas']].map(([v, t]) => `<button class="${cfg.mode === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      ${cfg.mode === 'trampas' ? '<p class="sub sm">Saca preguntas de tus 3 trampas con más fallos (mínimo 5 respuestas por trampa): primero las que fallaste, luego las que no has visto.</p>' : ''}
      <h2 class="h3">Origen</h2>
      <div class="seg multi" id="org">${[['G', 'Generadas'], ['O', 'Oficiales'], ['A', 'Academia']].map(([v, t]) => `<button class="${org.has(v) ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
    </div>
    <div class="card"><h2 class="h3">Temas <small>(${sel.size ? sel.size + ' elegidos' : 'ninguno = todos'})</small></h2>
    <div class="row"><button class="btn sec" id="useSeen">Usar mis temas vistos (${store.getSeen().length})</button></div>
    ${bloques.map(([b, nom]) => `<div class="bl"><div class="blh"><span>${nom}</span><button class="ghost sm" data-b="${b}">todos</button></div>
      ${idx.temas.filter(t => t.id.startsWith(b)).map(t => `<label class="tm ${sel.has(t.id) ? 'on' : ''}"><input type="checkbox" data-t="${t.id}" ${sel.has(t.id) ? 'checked' : ''}><span><b>${t.id}</b> ${esc(t.nombre)}</span><small>${tstat(t.id, t.n)}</small></label>`).join('')}</div>`).join('')}
    </div>
    <div class="bar2"><button class="btn" id="go">Empezar</button></div>`;
    $('#n').onclick = e => { if (e.target.dataset.v) { cfg.n = +e.target.dataset.v; save(); draw(); } };
    $('#mode').onclick = e => { if (e.target.dataset.v) { cfg.mode = e.target.dataset.v; save(); draw(); } };
    $('#org').onclick = e => { const v = e.target.dataset.v; if (v) { org.has(v) ? org.delete(v) : org.add(v); if (!org.size) org.add(v); save(); draw(); } };
    app.querySelectorAll('[data-t]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.t) : sel.delete(c.dataset.t); save(); draw(); });
    app.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const ids = idx.temas.filter(t => t.id.startsWith(b.dataset.b)).map(t => t.id); const all = ids.every(i => sel.has(i)); ids.forEach(i => all ? sel.delete(i) : sel.add(i)); save(); draw(); });
    $('#useSeen').onclick = () => { const v = store.getSeen(); if (!v.length) { toast('Aún no has marcado temas vistos (pantalla «Temas vistos» en Inicio).'); return; } sel.clear(); v.forEach(t => sel.add(t)); save(); draw(); };
    $('#go').onclick = guard(async () => {
      const temas = sel.size ? [...sel] : idx.temas.map(t => t.id);
      if (cfg.mode === 'trampas') {
        const r = await trapTest(cfg.n, null, sel.size ? [...sel] : null);
        if (!r.items.length) { toast('Aún no hay datos de trampas: contesta al menos 5 preguntas de alguna trampa y falla alguna.'); return; }
        startRun({ kind: 'test', feedback: true, items: r.items, titulo: 'Mis trampas · ' + r.targets.map(k => TRAMPAS[k] || k).join(', ') }); return;
      }
      const items = await pick({ temas, origins: org, mode: cfg.mode, n: cfg.n });
      if (!items.length) { toast(cfg.mode === 'falladas' ? 'No tienes falladas en esa selección.' : cfg.mode === 'dudosas' ? 'No tienes preguntas marcadas como dudosas ahí.' : 'No hay preguntas con ese filtro.'); return; }
      startRun({ kind: 'test', feedback: true, items, titulo: sel.size === 1 ? temaName([...sel][0]) : 'Test' });
    });
  };
  function save() { store.setCfg('test', { sel: [...sel], n: cfg.n, mode: cfg.mode, o: [...org] }); }
  function tstat(t, n) {
    let v = 0, ok = 0, tot = 0;
    for (const id of META._by[t] || []) { const r = store.rec(id); if (r) { v++; ok += r[1]; tot += r[0]; } }
    return `${v}/${n}${tot ? ' · ' + pct(ok, tot) + '%' : ''}`;
  }
  draw();
};


// ───────── exámenes y simulacros por número ─────────
const EX_OFICIALES = {
  'TAIL2022-P1': 'Ingreso libre 2022 (conv. 2023)', 'TAI2024B-P1': 'Ingreso libre 2023-24 (conv. 2024)', 'L2018-P1': 'Ingreso libre 2018',
  'L2019-P1': 'Ingreso libre 2019', 'L2025A-P1': 'Ingreso libre 2025', 'L2025X-P1': 'Ingreso libre 2025 (extraordinario)',
  'P2018-P1': 'Promoción interna 2018', 'P2019-P1': 'Promoción interna 2019', 'P2022-P1': 'Promoción interna 2022 (conv. 2023)',
  'P2024A-P1': 'Promoción interna 2021-24 (conv. 2024)', 'P2025A-P1': 'Promoción interna 2025',
};
function listaExamenes() {
  const g = {};
  for (const id in META) {
    if (id === '_by') continue; const o = META[id][1];
    if (o !== 'O' && o !== 'A') continue;
    const m = /^(.*-P1)-(\d+)$/.exec(id); if (!m) continue; // las de reserva (-R-) quedan fuera
    (g[m[1]] ||= []).push(id);
  }
  const sims = [], ofi = [];
  for (const k in g) {
    const ids = g[k].sort(), a = /^AS(\d+)([A-Z]?)-P1$/.exec(k);
    if (a && ids.length >= 20) sims.push({ k, ids, n: +a[1], nombre: `Simulacro ${+a[1]}${a[2] ? ' (' + a[2] + ')' : ''}` });
    else if (EX_OFICIALES[k] && ids.length >= 20) ofi.push({ k, ids, nombre: EX_OFICIALES[k] });
  }
  sims.sort((x, y) => x.n - y.n || x.k.localeCompare(y.k)); ofi.sort((x, y) => x.nombre.localeCompare(y.nombre));
  // tests por tema de la academia (AT…): el tema es el que más se repite entre sus preguntas
  const tests = [];
  for (const k in g) {
    if (!/^AT\d+(ALT)?-P1$/.test(k) || g[k].length < 10) continue;
    const c = {}; for (const id of g[k]) { const t = META[id][0]; c[t] = (c[t] || 0) + 1; }
    const tema = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    tests.push({ k, ids: g[k].sort(), tema, nombre: '' });
  }
  tests.sort((a, b) => a.tema.localeCompare(b.tema) || a.k.localeCompare(b.k));
  const vistos = {};
  for (const t of tests) { const n = vistos[t.tema] = (vistos[t.tema] || 0) + 1; t.nombre = `Test ${t.tema} · ${temaName(t.tema)}${tests.filter(x => x.tema === t.tema).length > 1 ? ' (' + n + ')' : ''}`; }
  return { sims, ofi, tests };
}
routes.examenes = async function () {
  await getIndex(); await getMeta(); const { sims, ofi, tests } = listaExamenes();
  const ses = store.getSessions();
  const info = nombre => { const h = ses.filter(x => x.titulo === nombre); return h.length ? `Última nota ${h[0].nota} · mejor ${Math.max(...h.map(x => x.nota))} · ${h.length} intento${h.length === 1 ? '' : 's'}` : 'Sin hacer'; };
  const fila = e => `<div class="card"><b>${esc(e.nombre)}</b> <small>· ${e.ids.length} preguntas</small><div class="sub sm">${esc(info(e.nombre))}</div>
    <div class="row"><button class="btn" data-k="${esc(e.k)}" data-m="sim">Cronometrado</button><button class="btn sec" data-k="${esc(e.k)}" data-m="est">Con corrección</button></div></div>`;
  app.innerHTML = `<h1>Exámenes</h1><div class="sub">Elige un examen y contesta solo sus preguntas. «Cronometrado» no corrige hasta el final y puntúa con la nota oficial; «Con corrección» te explica cada pregunta al momento.</div>
    <h2 class="h3">Simulacros de la academia</h2>${sims.map(fila).join('') || '<p class="sub">No hay simulacros cargados.</p>'}
    <h2 class="h3">Exámenes oficiales</h2>${ofi.map(fila).join('') || '<p class="sub">No hay exámenes cargados.</p>'}
    <h2 class="h3">Tests por tema de la academia</h2>${tests.map(fila).join('') || '<p class="sub">No hay tests cargados.</p>'}`;
  app.onclick = async e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    const ex = [...sims, ...ofi, ...tests].find(x => x.k === b.dataset.k); if (!ex) return;
    const items = (await byIds(ex.ids)).filter(q => !q.s);
    if (!items.length) { toast('No se pudieron cargar las preguntas.'); return; }
    if (b.dataset.m === 'sim') startRun({ kind: 'sim', feedback: false, items, limit: 90, titulo: ex.nombre });
    else startRun({ kind: 'test', feedback: true, items, titulo: ex.nombre });
  };
  cleanup = () => { app.onclick = null; };
};

// ───────── simulacro ─────────
routes.sim = async function () {
  const idx = await getIndex(); await getMeta();
  const cfg = Object.assign({ n: 80, min: 90, o: ['O', 'G'], parte2: true, scope: 'vistos' }, store.getCfg().sim || {});
  const seenN = store.getSeen().length;
  const org = new Set(cfg.o);
  const draw = () => {
    app.innerHTML = `
    <h1>Simulacro</h1>
    <div class="card">
      <h2 class="h3">Parte 1 · conocimientos</h2>
      <div class="seg" id="n">${[40, 80].map(v => `<button class="${cfg.n === v ? 'on' : ''}" data-v="${v}">${v} preguntas</button>`).join('')}</div>
      <h2 class="h3">Tiempo (minutos)</h2>
      <div class="seg" id="min">${[45, 60, 90, 120].map(v => `<button class="${cfg.min === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      <h2 class="h3">Temas</h2>
      <div class="seg" id="scope"><button class="${cfg.scope !== 'todos' ? 'on' : ''}" data-v="vistos">Mis temas vistos (${seenN})</button><button class="${cfg.scope === 'todos' ? 'on' : ''}" data-v="todos">Todo el temario</button></div>
      ${cfg.scope !== 'todos' && !seenN ? '<p class="sub sm">No has marcado ningún tema: se usará todo el temario.</p>' : ''}
      <p class="sub sm"><a href="#/temario">Editar temas vistos</a></p>
      <h2 class="h3">Origen de las preguntas</h2>
      <div class="seg multi" id="org">${[['G', 'Generadas'], ['O', 'Oficiales'], ['A', 'Academia']].map(([v, t]) => `<button class="${org.has(v) ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      <label class="chk"><input type="checkbox" id="p2" ${cfg.parte2 ? 'checked' : ''}> Después, parte 2: elegir 1 de 2 supuestos prácticos (20 preguntas)</label>
    </div>
    <div class="note">Reparto por temas calcado a los exámenes oficiales. Cada fallo resta 1/3 de acierto; en blanco no resta. No hay corrección hasta el final.</div>
    <div class="bar2"><button class="btn" id="go">Empezar simulacro</button></div>`;
    $('#n').onclick = e => { if (e.target.dataset.v) { cfg.n = +e.target.dataset.v; if (cfg.n === 40 && cfg.min > 60) cfg.min = 45; if (cfg.n === 80 && cfg.min < 90) cfg.min = 90; save(); draw(); } };
    $('#scope').onclick = e => { if (e.target.dataset.v) { cfg.scope = e.target.dataset.v; save(); draw(); } };
    $('#min').onclick = e => { if (e.target.dataset.v) { cfg.min = +e.target.dataset.v; save(); draw(); } };
    $('#org').onclick = e => { const v = e.target.dataset.v; if (v) { org.has(v) ? org.delete(v) : org.add(v); if (!org.size) org.add(v); save(); draw(); } };
    $('#p2').onchange = e => { cfg.parte2 = e.target.checked; save(); };
    $('#go').onclick = guard(async () => {
      const useSeen = cfg.scope !== 'todos' && seenN;
      const items = await simParte1(idx, org, cfg.n, useSeen ? new Set(store.getSeen()) : null);
      if (!items.length) { toast('No hay preguntas con esos filtros.'); return; }
      SIMCFG = { parte2: cfg.parte2, org: [...org], min2: Math.round(cfg.min * 0.45) };
      startRun({ kind: 'sim', feedback: false, items, limit: cfg.min, titulo: 'Simulacro · Parte 1' });
    });
  };
  function save() { store.setCfg('sim', { n: cfg.n, min: cfg.min, o: [...org], parte2: cfg.parte2, scope: cfg.scope }); }
  draw();
};
let SIMCFG = null;
async function simParte1(idx, org, N, only) {
  const temas = idx.temas.filter(t => !only || only.has(t.id));
  const pools = {};
  const ls = await Promise.all(temas.map(t => getTema(t.id)));
  temas.forEach((t, i) => { pools[t.id] = shuffle(ls[i].filter(x => allowed(x, org))).sort((a, b) => (store.rec(a.i) ? 1 : 0) - (store.rec(b.i) ? 1 : 0)); });
  return composeSim(temas, pools, N);
}
// Parte 2 tras la parte 1: ofrece 2 supuestos
routes.sim2 = async function () {
  const sup = await getSup();
  const ok = Object.entries(sup).filter(([k, v]) => v.q.filter(x => !x.r).length >= 18 && /libre/i.test(v.conv || '') && !/2018/.test(v.conv || ''));
  const two = shuffle(ok).slice(0, 2);
  app.innerHTML = `<h1>Parte 2 · Supuesto práctico</h1><div class="note">Elige uno de los dos supuestos. Son ejercicios reales de convocatorias anteriores.</div>
  ${two.map(([k, v], i) => `<div class="card"><h2 class="h3">Supuesto ${i + 1}</h2><div class="pre sm">${esc(v.texto.slice(0, 700))}${v.texto.length > 700 ? '…' : ''}</div><button class="btn" data-k="${k}">Elegir este supuesto</button></div>`).join('')}
  <button class="btn sec" id="skip">Saltar la parte 2</button>`;
  app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const v = sup[b.dataset.k];
    const items = v.q.filter(x => !x.r).slice(0, 20);
    startRun({ kind: 'sim', feedback: false, items, limit: SIMCFG?.min2 || 40, supTexto: v.texto, titulo: 'Simulacro · Parte 2 (supuesto)' });
  });
  $('#skip').onclick = () => go('#/home');
};


// ───────── mapa de dominio ─────────
// Estado por tema a partir de: precisión actual (último resultado de cada pregunta vista),
// cobertura (vistas / banco, con objetivo del 60 %) y frescura (días desde la última vez).
const dominioTemas = idx => dominioCalc(idx.temas, t => META._by[t], id => store.rec(id), now());
const ESTADO = { g: 'Dominado', y: 'A vigilar', r: 'Reforzar', n: 'Sin datos' };
const hace = d => d === null ? '—' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`;
function mapaHTML(dm, orden) {
  const ord = { r: 0, y: 1, g: 2, n: 3 };
  const l = dm.slice();
  if (orden === 'frios') l.sort((a, b) => (ord[a.est] - ord[b.est]) || ((b.dias ?? -1) - (a.dias ?? -1)));
  const c = k => dm.filter(x => x.est === k).length;
  return `<div class="dmsum"><span class="dot r"></span>${c('r')} <span class="dot y"></span>${c('y')} <span class="dot g"></span>${c('g')} <span class="dot n"></span>${c('n')}</div>
  <div class="seg" id="dmord"><button class="${orden !== 'frios' ? 'on' : ''}" data-v="tema">Por tema</button><button class="${orden === 'frios' ? 'on' : ''}" data-v="frios">Más urgentes primero</button></div>
  <div class="dm">${l.map(t => `<button class="dmt ${t.est}" data-dt="${t.id}"><div class="dmh"><span class="dot ${t.est}"></span><b>${t.id}</b><small>${hace(t.dias)}</small></div><div class="dmn">${esc(t.nombre)}</div><div class="dmb"><i style="width:${t.score}%"></i></div><small>${ESTADO[t.est]} · ${esc(t.why)}${t.due ? ' · ' + t.due + ' repasos' : ''}</small></button>`).join('')}</div>
  <p class="legend">Rojo: precisión o cobertura bajas, o más de 30 días sin tocar. Ámbar: va bien pero falta práctica o lleva más de 2 semanas parado. Verde: precisión alta y reciente. La puntuación mezcla tu acierto actual (65 %) y las preguntas vistas respecto al 60 % del banco (35 %). Toca un tema para practicarlo.</p>`;
}
function bindMapa(root, dm, redraw) {
  root.querySelectorAll('[data-dt]').forEach(b => b.onclick = () => {
    const c = store.getCfg().test || { n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] };
    store.setCfg('test', { sel: [b.dataset.dt], n: c.n || 15, mode: 'nuevas', o: c.o || ['O', 'A', 'G'] });
    go('#/test');
  });
  const o = root.querySelector('#dmord'); if (o) o.onclick = e => { if (e.target.dataset.v) { store.setCfg('dmord', e.target.dataset.v); redraw(); } };
}



// ───────── avisar de error en el banco ─────────
function reportBox(q, host) {
  const show = () => {
    const r = store.getReports()[q.i];
    host.innerHTML = r && r.st === 'abierto' ? `<span class="rep ok">✓ Error anotado <button class="ghost sm" data-rep>editar</button></span>` : `<button class="ghost fl" data-rep>⚠ Avisar de error</button>`;
    host.querySelector('[data-rep]').onclick = form;
  };
  const form = () => {
    const r = store.getReports()[q.i];
    host.innerHTML = `<div class="repf"><select data-m aria-label="Motivo del error">${MOTIVOS.map(m => `<option ${r && r.motivo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
      <input data-n aria-label="Qué falla" maxlength="300" placeholder="Qué falla (opcional)" value="${esc(r?.nota || '')}">
      <div class="row"><button class="btn" data-s>Guardar</button><button class="btn sec" data-c>Cancelar</button></div></div>`;
    host.querySelector('[data-s]').onclick = () => { store.addReport(q.i, q.t, host.querySelector('[data-m]').value, host.querySelector('[data-n]').value.trim()); show(); };
    host.querySelector('[data-c]').onclick = show;
  };
  show();
}
routes.errores = async function () {
  const flt = () => (store.getCfg().errf || 'abierto');
  const draw = async () => {
    const R = store.getReports(), f = flt();
    const all = Object.entries(R).filter(([, r]) => r.st !== 'quitado').sort((a, b) => b[1].ts - a[1].ts);
    const list = all.filter(([, r]) => f === 'todos' || r.st === f);
    const by = new Map((await byIds(list.filter(([id]) => !id.startsWith('FC-')).map(([id]) => id))).map(q => [q.i, q]));
    const cby = list.some(([id]) => id.startsWith('FC-')) ? new Map((await allCards()).map(c => [c.id, c])) : new Map();
    const nOpen = all.filter(([, r]) => r.st === 'abierto').length;
    app.innerHTML = `<h1>Errores del banco</h1>
    <p class="sub">${nOpen} por revisar · ${all.length - nOpen} resueltos. Las preguntas que marcas con «Avisar de error» llegan aquí.</p>
    <div class="seg" id="ef">${[['abierto', 'Por revisar'], ['resuelto', 'Resueltos'], ['todos', 'Todos']].map(([v, t]) => `<button class="${f === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
    <div class="row"><button class="btn sec" id="exp" ${all.length ? '' : 'disabled'}>Exportar para corregir</button></div>
    ${list.map(([id, r]) => { const q = by.get(id); return `<div class="card"><div class="meta"><span class="tag">${esc(id)}</span>${q ? `<span class="tag o${q.o}">${ORIGEN[q.o]}</span>` : ''}${cby.has(id) ? '<span class="tag">Tarjeta</span>' : ''}<span class="tag warn">${esc(r.motivo || 'Otro')}</span>${r.st === 'resuelto' ? '<span class="tag oG">Resuelto</span>' : ''}</div>
      ${r.nota ? `<p class="sm"><b>Nota:</b> ${esc(r.nota)}</p>` : ''}
      ${cby.has(id) ? (c => `<div class="pre sm">${esc(c.q)}</div><div class="ro ok"><b>R</b> ${esc(c.a)}</div>${c.ref ? `<div class="cita"><span>Temario</span>${esc(c.ref)}</div>` : ''}`)(cby.get(id)) : q ? `<div class="pre sm">${esc(q.q)}</div>${q.a.map((o, i) => `<div class="ro ${i === q.c ? 'ok' : ''}"><b>${L[i]}</b> ${esc(o)}${i === q.c ? ' ✓' : ''}</div>`).join('')}${q.u ? `<div class="cita"><span>Temario</span>${esc(q.u)}</div>` : ''}` : '<p class="sub">La pregunta ya no está en el banco.</p>'}
      <div class="row"><button class="btn sec" data-st="${r.st === 'resuelto' ? 'abierto' : 'resuelto'}" data-id="${esc(id)}">${r.st === 'resuelto' ? 'Reabrir' : 'Marcar resuelto'}</button><button class="btn sec" data-st="quitado" data-id="${esc(id)}">Quitar</button></div></div>`; }).join('') || '<div class="card"><p class="sub">Nada en esta lista.</p></div>'}`;
    $('#ef').onclick = e => { if (e.target.dataset.v) { store.setCfg('errf', e.target.dataset.v); } };
    app.querySelectorAll('[data-st]').forEach(b => b.onclick = () => store.setReportState(b.dataset.id, b.dataset.st));
    $('#exp').onclick = () => {
      const out = all.map(([id, r]) => { const q = by.get(id) || null, c = cby.get(id) || null; return { id, tarjeta: c ? { pregunta: c.q, respuesta: c.a, ref: c.ref || null } : undefined, tema: r.tema, estado: r.st, motivo: r.motivo, nota: r.nota, origen: q ? ORIGEN[q.o] : null, enunciado: q?.q, opciones: q?.a, correcta: q ? L[q.c] : null, cita: q?.u || null, trampas: (q?.x || []).map(x => TRAMPAS[x] || x) }; });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ generado: new Date().toISOString(), errores: out }, null, 1)], { type: 'application/json' })); a.download = 'errores-banco.json'; a.click();
    };
  };
  let sig = JSON.stringify(store.getReports()) + (store.getCfg().errf || '');
  cleanup = store.onChange(() => { const n = JSON.stringify(store.getReports()) + (store.getCfg().errf || ''); if (n !== sig) { sig = n; draw(); } });
  await draw();
};


// ───────── historial de simulacros ─────────
function paintSims() {
  const el = $('#sims'); if (!el) return;
  const H = simHistory(store.getSessions());
  if (!H.length) { el.innerHTML = '<div class="card"><p class="sub">Aún no has hecho ningún simulacro. Cuando lo hagas verás aquí tu nota por intento y podrás comparar dos.</p></div>'; return; }
  const c = store.getCfg().simc || {};
  const P1 = H.filter(h => h.part === 'p1');
  const fmtD = t => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const dlt = (d, u = '', menosEsMejor = false) => d === null ? '' : `<span class="${d === 0 ? '' : (d > 0) !== menosEsMejor ? 'g' : 'r'}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${d}${u}</span>`;
  let chart = '';
  if (P1.length) {
    const Wd = 340, Ht = 150, L0 = 34, R0 = 14, T0 = 14, B0 = 24, iw = Wd - L0 - R0, ih = Ht - T0 - B0;
    const vals = P1.map(h => h.nota), lo = Math.min(0, Math.floor(Math.min(...vals) / 10) * 10), hi = 100;
    const X = i => L0 + (P1.length === 1 ? iw / 2 : iw * i / (P1.length - 1)), Y = v => T0 + ih * (1 - (v - lo) / (hi - lo));
    const grid = [lo, (lo + hi) / 2, hi].map(v => `<line x1="${L0}" x2="${Wd - R0}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${L0 - 6}" y="${Y(v) + 4}" text-anchor="end" class="gt">${Math.round(v)}</text>`).join('');
    const line = P1.length > 1 ? `<polyline points="${P1.map((h, i) => X(i) + ',' + Y(h.nota)).join(' ')}" class="ln"/>` : '';
    const dots = P1.map((h, i) => `<circle cx="${X(i)}" cy="${Y(h.nota)}" r="4.5" class="pt"><title>${fmtD(h.ts)}: ${esc(String(h.nota))}/100</title></circle>`).join('');
    const last = P1[P1.length - 1], k = P1.length - 1;
    chart = `<div class="evo"><svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="Nota por simulacro">${grid}${line}${dots}<text x="${Math.min(X(k), Wd - R0 - 2)}" y="${Y(last.nota) - 9}" text-anchor="end" class="vl">${last.nota}</text><text x="${L0}" y="${Ht - 6}" class="gt">${fmtD(P1[0].ts)}</text><text x="${Wd - R0}" y="${Ht - 6}" text-anchor="end" class="gt">${fmtD(last.ts)}</text></svg></div>`;
  }
  const rows = H.slice().reverse().slice(0, 15).map(h => `<div class="sl"><div class="slh"><b>${esc(String(h.nota))}</b><small>${fmtD(h.ts)} · ${h.part === 'p2' ? 'Parte 2 (supuesto)' : 'Parte 1'}${h.dNota === null ? '' : ' · ' + dlt(h.dNota)}</small></div><div class="sm">${h.a} aciertos · ${h.f} fallos · ${h.b} en blanco · ${fmtT(h.secs)}</div></div>`).join('');
  let cmp = '<p class="sub sm">Haz al menos 2 simulacros de la parte 1 para compararlos.</p>';
  if (P1.length >= 2) {
    const ia = Math.min(Math.max(0, c.a ?? P1.length - 2), P1.length - 1), ib = Math.min(Math.max(0, c.b ?? P1.length - 1), P1.length - 1);
    const opt = sel => P1.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${fmtD(h.ts)} · ${esc(String(h.nota))}</option>`).join('');
    const C = compareSessions(P1[ia], P1[ib]);
    cmp = `<div class="row"><select id="sca" aria-label="Intento A">${opt(ia)}</select><select id="scb" aria-label="Intento B">${opt(ib)}</select></div>
      <p class="sm">Nota: <b>${dlt(C.dNota)}</b> · acierto ${dlt(C.dAcierto, ' pts')}${C.dSeg !== null ? ' · ritmo ' + dlt(C.dSeg, ' s/preg.', true) : ''}</p>
      <table class="tb"><tr><th>Tema</th><th>A</th><th>B</th><th>Δ</th></tr>${C.rows.map(r => `<tr><td>${r.t}</td><td>${r.pa ?? '—'}</td><td>${r.pb ?? '—'}</td><td>${r.d === null ? '' : dlt(r.d)}</td></tr>`).join('')}</table>
      <p class="legend">A es el intento de la izquierda y B el de la derecha; Δ en puntos de acierto por tema.</p>`;
  }
  el.innerHTML = `<div class="card">${chart}<p class="legend">Nota de la parte 1 por intento (sobre 100).</p><h2 class="h3">Últimos intentos</h2>${rows}<h2 class="h3">Comparar dos intentos</h2>${cmp}</div>`;
  const sa = $('#sca'), sb = $('#scb');
  if (sa) sa.onchange = sb.onchange = () => { store.setCfg('simc', { a: +sa.value, b: +sb.value }); paintSims(); };
}

// ───────── evolución y preguntas lentas ─────────
function paintEvo(idx) {
  const el = $('#evo'); if (!el) return;
  const c = Object.assign({ m: 'acierto', f: 'g', w: 12, tabla: false }, store.getCfg().evo || {});
  const save = () => store.setCfg('evo', c);
  const tipos = Object.keys(TIPOS);
  const opts = `<option value="g" ${c.f === 'g' ? 'selected' : ''}>Todo el temario</option>
    <optgroup label="Por tipo de pregunta">${tipos.map(k => `<option value="k:${k}" ${c.f === 'k:' + k ? 'selected' : ''}>${esc(TIPOS[k])}</option>`).join('')}</optgroup>
    <optgroup label="Por tema">${idx.temas.map(t => `<option value="t:${t.id}" ${c.f === 't:' + t.id ? 'selected' : ''}>${t.id} ${esc(t.nombre)}</option>`).join('')}</optgroup>`;
  const filt = c.m === 'tiempo' || c.f === 'g' ? {} : c.f.startsWith('t:') ? { tema: c.f.slice(2) } : { tipo: c.f.slice(2) };
  const W = aggregateWeeks(store.getSessions(), { ...filt, weeks: c.w });
  const key = c.m === 'tiempo' ? 'segPreg' : 'acierto';
  const pts = W.map((w, i) => ({ i, v: w[key], w })).filter(p => p.v !== null);
  const fmtD = t => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const unit = c.m === 'tiempo' ? ' s' : ' %';
  let chart;
  if (!pts.length) chart = `<p class="sub">Aún no hay sesiones en este periodo${c.m !== 'tiempo' && c.f !== 'g' ? ' para este filtro (los tipos solo se guardan en sesiones nuevas)' : ''}.</p>`;
  else {
    const Wd = 340, H = 170, L = 34, R = 12, T = 14, B = 26, iw = Wd - L - R, ih = H - T - B;
    const max = c.m === 'tiempo' ? Math.max(10, Math.ceil(Math.max(...pts.map(p => p.v)) / 10) * 10) : 100;
    const X = i => L + (W.length === 1 ? iw / 2 : iw * i / (W.length - 1)), Y = v => T + ih * (1 - v / max);
    const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${Wd - R}" y1="${Y(max * f)}" y2="${Y(max * f)}" class="gl"/><text x="${L - 6}" y="${Y(max * f) + 4}" text-anchor="end" class="gt">${Math.round(max * f)}</text>`).join('');
    const line = pts.length > 1 ? `<polyline points="${pts.map(p => X(p.i) + ',' + Y(p.v)).join(' ')}" class="ln"/>` : '';
    const dots = pts.map(p => `<circle cx="${X(p.i)}" cy="${Y(p.v)}" r="4.5" class="pt"/>`).join('');
    const last = pts[pts.length - 1];
    const lab = `<text x="${Math.min(X(last.i), Wd - R - 2)}" y="${Y(last.v) - 9}" text-anchor="end" class="vl">${last.v}${unit.trim()}</text>`;
    const step = Math.ceil(W.length / 6);
    const xt = W.map((w, i) => i % step === (W.length - 1) % step ? `<text x="${X(i)}" y="${H - 6}" text-anchor="${i === W.length - 1 ? 'end' : 'middle'}" class="gt">${fmtD(w.start)}</text>` : '').join('');
    const cols = W.map((w, i) => `<rect x="${X(i) - iw / W.length / 2}" y="${T}" width="${iw / W.length}" height="${ih}" class="hit" data-i="${i}"/>`).join('');
    chart = `<div class="evo"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Evolución semanal">${grid}${line}${dots}${lab}${xt}${cols}</svg><div class="tip" id="tip" hidden></div></div>`;
  }
  const tabla = c.tabla ? `<table class="tb"><tr><th>Semana</th><th>${c.m === 'tiempo' ? 'seg/preg.' : 'Acierto'}</th><th>Resp.</th></tr>${W.filter(w => w.n).map(w => `<tr><td>${fmtD(w.start)}</td><td>${w[key] ?? '—'}</td><td>${esc(String(w.n))}</td></tr>`).join('') || '<tr><td colspan="3">Sin datos</td></tr>'}</table>` : '';
  el.innerHTML = `<div class="card">
    <div class="seg" id="evm"><button class="${c.m !== 'tiempo' ? 'on' : ''}" data-v="acierto">Acierto</button><button class="${c.m === 'tiempo' ? 'on' : ''}" data-v="tiempo">Tiempo por pregunta</button></div>
    <div class="row"><select id="evf" aria-label="Qué medir en la evolución" ${c.m === 'tiempo' ? 'disabled' : ''}>${opts}</select><select id="evw" aria-label="Número de semanas">${[8, 12, 26].map(v => `<option value="${v}" ${c.w === v ? 'selected' : ''}>${v} semanas</option>`).join('')}</select></div>
    ${chart}
    <p class="legend">${c.m === 'tiempo' ? 'Segundos medios por pregunta en tus sesiones (sin contar pausas).' : 'Porcentaje de aciertos por semana, sobre las preguntas contestadas en esa semana.'} <button class="ghost sm" id="evt">${c.tabla ? 'Ocultar tabla' : 'Ver tabla'}</button></p>${tabla}</div>`;
  $('#evm').onclick = e => { if (e.target.dataset.v) { c.m = e.target.dataset.v; save(); paintEvo(idx); } };
  $('#evf').onchange = e => { c.f = e.target.value; save(); paintEvo(idx); };
  $('#evw').onchange = e => { c.w = +e.target.value; save(); paintEvo(idx); };
  $('#evt').onclick = () => { c.tabla = !c.tabla; save(); paintEvo(idx); };
  const tip = $('#tip');
  el.querySelectorAll('.hit').forEach(r => {
    const show = () => { const w = W[+r.dataset.i]; if (!w.n) { tip.hidden = true; return; } tip.hidden = false; tip.innerHTML = `<b>Semana del ${fmtD(w.start)}</b><br>${c.m === 'tiempo' ? (w.segPreg ?? '—') + ' s/pregunta' : w.acierto + ' % de acierto'}<br>${esc(String(w.n))} respuestas · ${esc(String(w.ses))} sesiones`; tip.style.left = Math.min(Math.max(8, 100 * (+r.dataset.i) / Math.max(1, W.length - 1)), 70) + '%'; };
    r.onpointerenter = show; r.onpointerdown = show;
  });
}
async function paintSlow() {
  const el = $('#slow'); if (!el) return;
  const c = Object.assign({ ok: false }, store.getCfg().slow || {});
  const L = slowList(store.getStats(), { soloAcertadas: c.ok, limit: 15 });
  if (!L.length) { el.innerHTML = `<div class="card"><p class="sub">Aún no hay tiempos guardados. Se registran desde ahora, al contestar cada pregunta.</p></div>`; return; }
  const items = await byIds(L.map(x => x.id)); const by = new Map(items.map(q => [q.i, q]));
  el.innerHTML = `<div class="card"><div class="seg" id="slf"><button class="${!c.ok ? 'on' : ''}" data-v="0">Todas</button><button class="${c.ok ? 'on' : ''}" data-v="1">Las que aciertas</button></div>
    <p class="legend">Las que más tardas en contestar. Si las aciertas pero tardas mucho, probablemente aún no las dominas.</p>
    ${L.map(x => { const q = by.get(x.id); return `<div class="sl"><div class="slh"><b>${Math.round(x.avg)} s</b><small>${esc(q ? q.t : '')} · ${x.ok}/${x.n} aciertos${x.last === 1 ? ' · última ✓' : x.last === 0 ? ' · última ✗' : ''}</small></div><div class="sm">${esc(q ? q.q.slice(0, 140) + (q.q.length > 140 ? '…' : '') : x.id)}</div></div>`; }).join('')}
    <div class="row"><button class="btn" id="slgo">Practicar estas ${L.length}</button></div></div>`;
  $('#slf').onclick = e => { if (e.target.dataset.v !== undefined) { c.ok = e.target.dataset.v === '1'; store.setCfg('slow', c); paintSlow(); } };
  $('#slgo').onclick = () => startRun({ kind: 'test', feedback: true, items: shuffle(L.map(x => by.get(x.id)).filter(Boolean)), titulo: 'Preguntas lentas' });
}

// ───────── estadísticas ─────────
routes.stats = async function () {
  const idx = await getIndex(); await getMeta();
  const st = store.getStats();
  const T = {}, TR = {}, OR = {}, TI = {};
  let n = 0, ok = 0;
  for (const id in st) {
    const r = st[id], m = META[id]; if (!m) continue;
    n += r[0]; ok += r[1];
    const err = r[0] - r[1];
    const a = T[m[0]] ||= [0, 0, 0]; a[0] += r[0]; a[1] += r[1]; a[2]++;
    (OR[m[1]] ||= [0, 0])[0] += r[0]; OR[m[1]][1] += r[1];
    if (m[2]) { (TI[m[2]] ||= [0, 0])[0] += r[0]; TI[m[2]][1] += r[1]; }
    for (const x of m[3]) { const b = TR[x] ||= [0, 0]; b[0] += r[0]; b[1] += err; }
  }
  const bar = (v, w = 100) => `<div class="bar"><i style="width:${v}%" class="${v >= 75 ? 'g' : v >= 50 ? 'y' : 'r'}"></i></div>`;
  const temas = idx.temas.map(t => { const a = T[t.id] || [0, 0, 0]; return { ...t, int: a[0], ok: a[1], seen: a[2], p: pct(a[1], a[0]) }; });
  const weak = temas.filter(t => t.int >= 8).sort((a, b) => a.p - b.p).slice(0, 5);
  const ses = store.getSessions().slice(0, 12);
  const carga = cargaRepasos(st, now(), 14), mx = Math.max(1, ...carga), mf = motivosFallo(st), mft = mf.reduce((a, b) => a + b, 0);
  const diaL = k => { const d = new Date(now() + k * 86400000); return k === 0 ? 'hoy' : ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()] + d.getDate(); };
  const cargaHTML = `<div class="card"><div class="cg">${carga.map((v, k) => `<div class="cgc" title="${v} repasos"><small>${v || ''}</small><i class="${k === 0 && v ? 'hoy' : ''}" style="height:${Math.round(60 * v / mx)}px"></i><small>${diaL(k)}</small></div>`).join('')}</div>
    <p class="legend">Preguntas que vencen cada día (hoy incluye las atrasadas). Total en 14 días: ${carga.reduce((a, b) => a + b, 0)}.</p>
    ${mft ? `<h2 class="h3">Por qué fallas (último fallo)</h2>${[5, 7, 1, 2, 3, 4].map(m => `<div class="line"><span>${MOTIVOS_FALLO[m]}</span><span>${mf[m]} <small>(${pct(mf[m], mft)}%)</small></span></div>`).join('')}` : ''}
    ${suertes(st) ? `<div class="line"><span>🍀 Aciertos por suerte (pendientes de repasar)</span><span>${suertes(st)}</span></div>` : ''}</div>`;
  const paintMapa = () => { const dm = dominioTemas(idx); const el = $('#mapa'); el.innerHTML = mapaHTML(dm, store.getCfg().dmord); bindMapa(el, dm, paintMapa); };
  app.innerHTML = `
  <h1>Estadísticas</h1>
  <h2 style="margin-top:6px">Mapa de dominio</h2><div id="mapa"></div>
  <h2>Simulacros</h2><div id="sims"></div>
  <div id="vel"></div>
  <h2>Carga de repasos</h2><div id="carga"></div>
  <h2>Evolución</h2><div id="evo"></div>
  <h2>Preguntas lentas</h2><div id="slow"></div>
  <div class="grid"><div class="stat"><b>${n}</b><span>respuestas</span></div><div class="stat"><b>${pct(ok, n)}%</b><span>acierto</span></div></div>
  ${weak.length ? `<h2>Para reforzar</h2><div class="card">${weak.map(t => `<div class="line"><span><b>${t.id}</b> ${esc(t.nombre)}</span><span class="r">${t.p}%</span></div>`).join('')}</div>` : ''}
  <h2>Por tema</h2><div class="card">${temas.map(t => `<div class="trow"><div class="line"><span><b>${t.id}</b> ${esc(t.nombre)}</span><span>${t.int ? t.p + '%' : '—'}</span></div>${bar(t.int ? t.p : 0)}<small>${t.seen}/${t.n} vistas · ${t.int} respuestas</small></div>`).join('')}</div>
  <h2>Errores por tipo de trampa</h2><div class="card">${Object.entries(TR).filter(([, v]) => v[0] >= 5).sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0]).map(([k, v]) => `<div class="trow"><div class="line"><span>${esc(TRAMPAS[k] || k)}</span><span>${pct(v[1], v[0])}% fallos <small>(${v[0]})</small> <button class="ghost sm" data-trap="${k}">practicar</button></span></div>${bar(100 - pct(v[1], v[0]))}</div>`).join('') || '<p class="sub">Aún no hay datos suficientes (se necesitan ≥5 respuestas por trampa).</p>'}</div>
  <h2>Por origen y tipo</h2><div class="card">${Object.entries(OR).map(([k, v]) => `<div class="line"><span>${ORIGEN[k]}</span><span>${pct(v[1], v[0])}% <small>(${v[0]})</small></span></div>`).join('')}
  ${Object.entries(TI).map(([k, v]) => `<div class="line"><span>${TIPOS[k] || k}</span><span>${pct(v[1], v[0])}% <small>(${v[0]})</small></span></div>`).join('')}</div>
  <h2>Últimas sesiones</h2><div class="card">${ses.map(s => `<div class="line"><span>${new Date(s.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${s.kind === 'sim' ? 'Simulacro' : s.kind === 'rev' ? 'Repaso' : 'Test'} ${esc(String(s.n))}p</span><span>${s.kind === 'sim' ? esc(String(s.nota)) + '/100' : pct(s.a, s.n) + '%'}</span></div>`).join('') || '<p class="sub">Sin sesiones todavía.</p>'}</div>`;
  app.querySelectorAll('[data-trap]').forEach(b => b.onclick = async () => { const r = await trapTest(15, [+b.dataset.trap]); if (!r.items.length) { toast('No hay preguntas con esa trampa.'); return; } startRun({ kind: 'test', feedback: true, items: r.items, titulo: 'Trampa: ' + (TRAMPAS[b.dataset.trap] || b.dataset.trap) }); });
  $('#carga').innerHTML = cargaHTML;
  { const v = velocidad(st), lentos = Object.keys(st).filter(id => st[id][8] >= 3 && st[id][7] / st[id][8] < 6).length;
    $('#vel').innerHTML = `<h2>Velocidad de lectura</h2><div class="card">${v.tot ? `<div class="line"><span>Fallos por velocidad</span><span><b>${v.n}</b> de ${v.tot} <small>(${v.p}%)</small></span></div>` : '<p class="sub">Aún no has etiquetado fallos. Al fallar, pulsa «Velocidad» si leíste deprisa.</p>'}
    ${v.p >= 15 ? '<p class="r"><b>Es un patrón relevante</b>: más de 1 de cada 7 fallos se debe a leer rápido. Prueba el modo «Resaltar + frenar» en Ajustes y el ejercicio de lectura atenta.</p>' : ''}
    <ul class="tips">${CONSEJOS_LECTURA.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <button class="btn" id="golec">👀 Entrenar lectura atenta</button></div>`;
    $('#golec').onclick = () => go('#/lectura'); }
  paintMapa();
  paintSims();
  paintEvo(idx);
  paintSlow();
};

// ───────── ajustes ─────────
routes.settings = async function () {
  const idx = await getIndex();
  const draw = () => {
    const s = sync.status; const ui = normUi(store.getCfg().ui);
    app.innerHTML = `
    <h1>Ajustes</h1>
    <div class="card"><h2 class="h3">Cuenta y sincronización</h2>
      ${!sync.configured ? '<p>Firebase no está configurado todavía (ver README).</p>' :
        s.user ? `<p>Conectado como <b>${esc(s.user.name)}</b><br><small>${esc(s.state)}${s.lastSync ? ' · ' + new Date(s.lastSync).toLocaleTimeString('es-ES') : ''}</small></p><button class="btn sec" id="out">Cerrar sesión</button>` :
          '<p>Inicia sesión para tener el mismo historial en iPhone y iPad.</p><button class="btn" id="in">Entrar con Google</button>'}
      ${s.error ? `<p class="r"><small>${esc(s.error)}</small></p>` : ''}
      ${s.user && s.state !== 'sincronizado' && s.state !== 'sincronizando…' ? `${s.detail ? `<p><small>${esc(s.detail)}</small></p>` : ''}<button class="btn sec" id="retrySync">Reintentar sincronización</button>` : ''}
      <p><small>En este dispositivo: ${Object.keys(store.getStats()).length} preguntas vistas · ${store.getSeen().length} temas vistos · ${store.getSessions().length} sesiones</small></p>
      ${sync.configured ? `<p><small>Dominio: ${esc(sync.diag().host)} · auth: ${esc(sync.diag().authDomain)}</small></p>` : ''}
    </div>
    <div class="card"><h2 class="h3">Comodidad</h2>
      <p class="sm">Tema</p>
      <div class="seg" id="th">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) => `<button class="${ui.theme === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      <p class="sm">Tamaño de letra</p>
      <div class="seg" id="fz">${['A', 'A+', 'A++', 'A+++'].map((t, i) => `<button class="${ui.size === i ? 'on' : ''}" data-v="${i}">${t}</button>`).join('')}</div>
      <p class="sm">Lectura atenta <small>(contra los fallos por leer deprisa)</small></p>
      <div class="seg" id="lec">${[[0, 'Normal'], [1, 'Resaltar clave'], [2, 'Resaltar + frenar']].map(([v, t]) => `<button class="${ui.lectura === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      <p><small>«Resaltar clave» marca NO, SALVO, EXCEPTO, absolutos y cifras. «Frenar» bloquea las opciones unos segundos según la longitud de la pregunta (en modo test).</small></p>
      <p><small>Teclado (iPad): 1–4 o A–D responden · Intro, → o espacio: siguiente · ←: anterior · B: en blanco · F: dudosa · P: pausa. Gestos: desliza a la izquierda para pasar y a la derecha para volver.</small></p>
      <p><small>Se guarda solo en este dispositivo.</small></p>
    </div>
    <div class="card"><h2 class="h3">Fecha del examen</h2><label class="sm" for="exd">Para la cuenta atrás de Inicio</label><input type="date" id="exd" value="${esc(store.getCfg().exam || '2027-06-01')}"></div>
    <div class="card"><h2 class="h3">Errores del banco</h2><p>${Object.values(store.getReports()).filter(r => r.st === 'abierto').length} por revisar. Anótalos con «Avisar de error» al contestar y exporta la lista para corregirlos.</p><button class="btn sec" id="errs">Ver errores del banco</button></div>
    <div class="card"><h2 class="h3">Uso sin conexión</h2><p id="off">Pulsa para descargar todo el banco en el dispositivo (≈9 MB).</p><button class="btn sec" id="dl">Descargar para uso sin conexión</button></div>
    <div class="card"><h2 class="h3">Tarjetas</h2><p>Exporta las tarjetas curadas (y tus fallos convertidos en tarjeta) a Anki: texto separado por tabuladores, importable con «Archivo → Importar».</p><button class="btn sec" id="anki">Exportar tarjetas a Anki (.txt)</button></div>
    <div class="card"><h2 class="h3">Copia de seguridad</h2><button class="btn sec" id="ex">Exportar progreso</button> <label class="btn sec file">Importar<input type="file" id="im" accept=".json"></label></div>
    <div class="card"><h2 class="h3">Zona delicada</h2><button class="btn danger" id="rs">Borrar progreso de este dispositivo</button></div>
    <p class="sub">Banco: ${idx.n} preguntas + ${idx.nsup} de supuestos. Versión 1.0</p>`;
    $('#in') && ($('#in').onclick = () => sync.login());
    $('#out') && ($('#out').onclick = () => sync.logout());
    $('#retrySync') && ($('#retrySync').onclick = () => sync.retry());
    $('#errs').onclick = () => go('#/errores');
    $('#exd').onchange = e => { if (/^\d{4}-\d\d-\d\d$/.test(e.target.value)) store.setCfg('exam', e.target.value); };
    $('#th').onclick = e => { const b = e.target.closest('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), theme: b.dataset.v }); draw(); } };
    $('#lec').onclick = e => { const b = e.target.closest('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), lectura: +b.dataset.v }); draw(); } };
    $('#fz').onclick = e => { const b = e.target.closest('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), size: +b.dataset.v }); draw(); } };
    $('#dl').onclick = download;
    $('#anki').onclick = async () => {
      const cs = await allCards(); const f = t => String(t).replace(/[\t\r\n]+/g, ' ');
      const txt = '#separator:tab\n#html:false\n#tags column:4\n' + cs.map(c => [f(c.q), f(c.a), f(c.ref || ''), f((c.t || '').replace('.', '_') + ' ' + (c.tipo || ''))].join('\t')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })); a.download = 'tai-tarjetas-anki.txt'; a.click();
    };
    $('#ex').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([store.exportAll()], { type: 'application/json' })); a.download = 'tai-progreso.json'; a.click(); };
    $('#im').onchange = async e => { try { store.importAll(await e.target.files[0].text()); toast('Progreso importado'); } catch (x) { toast(x.message); } };
    $('#rs').onclick = async () => { if (await ask('¿Borrar TODO el progreso de este dispositivo? (Si hay sesión iniciada, lo sincronizado en la nube se volverá a descargar.)', 'Borrar todo', true)) { store.resetAll(); toast('Borrado'); } };
  };
  async function download() {
    const el = $('#off'); let k = 0;
    try {
      await Promise.all(idx.temas.map(t => getTema(t.id).then(() => { k++; el.textContent = `Descargando… ${k}/${idx.temas.length}`; })));
      await getSup(); await getMeta(); await curatedCards();
      el.textContent = 'Listo: todo el banco está disponible sin conexión.';
    } catch (e) { el.textContent = 'Error de descarga: ' + e.message; }
  }
  const off = sync.onStatus(draw);
  cleanup = off;
  draw();
};

// ───────── arranque ─────────
(async function boot() {
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} // pide que el navegador no borre los datos locales
  await store.recover(); // copia de seguridad en IndexedDB
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flushNow(); });
  addEventListener('pagehide', () => store.flushNow());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(watchUpdates).catch(() => {});
  await route(); // primer pintado sin esperar a Firebase
  addEventListener('pagehide', saveRun); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveRun(); });
  resumeRun().catch(() => {});
  setTimeout(prefetchBanco, 4000);
  try { await getMeta(); await sync.init({ temaOf, idsOfTema: t => META._by[t] || [] }); } catch (e) { console.error(e); }
})();

// Descarga el banco en segundo plano (2 a la vez) para que Test, Simulacro y Repaso arranquen sin esperar a la red
async function prefetchBanco() {
  if (navigator.connection?.saveData || navigator.onLine === false || !window.caches) return;
  try {
    const idx = await getIndex(), c = await caches.open('tai-data');
    const falta = [];
    for (const t of idx.temas) { const u = `data/${t.id}.json`; if (!(await c.match(u))) falta.push(u); }
    const w = async () => { for (let u; (u = falta.shift());) { try { await (await fetch(u)).arrayBuffer(); } catch (e) { return; } } };
    await Promise.all([w(), w()]);
  } catch (e) {}
}

// aviso de nueva versión del service worker
function watchUpdates(reg) {
  const ready = w => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva: cierra y abre la app para actualizar.'); });
  if (reg.installing) ready(reg.installing);
  reg.addEventListener('updatefound', () => reg.installing && ready(reg.installing));
}
