import * as sync from './syncfacade.js';
import * as store from './store.js';
import { esc, richHtml, shuffle, fmtT, pct, nota, allowed, composeSim, quickN, pickQuick, trapRates, pickTrampas, MOTIVOS, MOTIVOS_FALLO, pickRepaso, normUi, swipeDir, keyAction, hiliteHtml, pideNegativa, minLectura, velocidad, analisisSimulacro, ritmoSimulacro } from './logic.js';
import { META, getIndex, getMeta, temaOf, getTema, getSup, temaName, now, pick, dueList, byIds } from './data.js';
import { $, app, L, toast, ask, guard } from './ui.js';
import { ORIGEN, TRAMPAS } from './labels.js';
import { APP_VERSION, APP_BUILD } from './version.js';
import { registerTraining } from './screens/training.js';
import { registerCards } from './screens/cards.js';
import { registerStats } from './screens/stats.js';
import { registerHome } from './screens/home.js';
import { registerSettings } from './screens/settings.js';

// ───────── router ─────────
const routes = {};
let cleanup = null;
function go(h) { if (location.hash === h) route(); else location.hash = h; }
// animaciones: barra de progreso que crece desde el valor anterior, entrada de pantalla y nota que cuenta
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastP = 0;
function pw(p) { const f = lastP; lastP = p; return `style="--from:${f}%;width:${p}%"`; }
function enter(el = app) { if (reduceMotion()) return; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
function countUp() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = parseFloat(String(el.dataset.count).replace(',', '.')); if (!isFinite(to) || reduceMotion()) return;
    const dec = (String(el.dataset.count).split(/[.,]/)[1] || '').length, tn = el.firstChild; if (!tn || tn.nodeType !== 3) return;
    const t0 = performance.now(), D = 900;
    const step = t => { const k = Math.min(1, (t - t0) / D), v = to * (1 - Math.pow(1 - k, 3)); tn.nodeValue = v.toFixed(dec); if (k < 1 && tn.isConnected) requestAnimationFrame(step); else tn.nodeValue = String(el.dataset.count); };
    requestAnimationFrame(step);
  });
}
// saludo con el nombre de la cuenta de Google (se recuerda en el dispositivo; sin cuenta, solo «Hola»)
function saludo() {
  const u = sync.status.user; let n = '';
  try {
    if (u) { const raw = u.name && !u.name.includes('@') ? u.name.trim().split(/\s+/)[0] : ''; n = raw; localStorage.setItem('tai.name', n); }
    else if (sync.status.state === 'sin sesión') localStorage.removeItem('tai.name');
    else n = localStorage.getItem('tai.name') || '';
  } catch (e) {}
  return n ? `Hola, ${n}` : 'Hola';
}
let routeSeq = 0;
async function route() {
  const my = ++routeSeq;
  if (cleanup) { cleanup(); cleanup = null; }
  const [, name, ...args] = (location.hash || '#/home').split('/');
  const sect = { quiz: RUN?.kind === 'sim' ? 'sim' : RUN?.kind === 'test' ? 'test' : 'home', result: LAST?.ses?.kind === 'sim' ? 'sim' : LAST?.ses?.kind === 'test' ? 'test' : 'home', sim2: 'sim', examenes: 'sim', errores: 'settings', cards: 'home' }[name] || name;
  document.querySelectorAll('nav a').forEach(a => { const on = a.dataset.r === sect; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const f = routes[name] || routes.home;
  lastP = 0;
  window.scrollTo(0, 0);
  const lt = setTimeout(() => { if (my === routeSeq) app.innerHTML = '<p class="sub loading" role="status">Cargando…</p>'; }, 120); // respuesta visible si los datos tardan
  try { await getIndex(); await getMeta(); if (my !== routeSeq) return; await f(...args); clearTimeout(lt); if (my !== routeSeq) return; enter(); countUp(); const hd = app.querySelector('h1'); if (hd) hd.tabIndex = -1; (hd || app).focus({ preventScroll: true }); if (RUN && name !== 'quiz') { const b = document.createElement('div'); b.className = 'note run'; b.innerHTML = `<b>${esc(RUN.titulo || 'Test')}</b> en curso · ${Math.min(RUN.idx + 1, RUN.items.length)}/${RUN.items.length} <button class="btn" id="resume">Continuar</button>`; app.prepend(b); $('#resume').onclick = () => go('#/quiz'); } } catch (e) { clearTimeout(lt); app.innerHTML = `<div class="card" role="alert"><h2>No se pudo cargar</h2><p>${navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button class="btn" id="retryRoute">Reintentar</button></div>`; $('#retryRoute').onclick = () => route(); console.error(e); }
}
window.addEventListener('hashchange', route);

// ───────── motor de preguntas ─────────
let RUN = null;
function startRun(cfg) { RUN = { ...cfg, idx: 0, ans: [], t0: now(), secs: 0, paused: false }; go('#/quiz'); }
// La sesión en curso se guarda para sobrevivir al cierre de la app por iOS (solo sesiones del banco, no los supuestos)
const RUN_KEY = 'tai.run';
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) {} }
function saveRun() {
  if (!RUN || RUN.supTexto || !RUN.items.every(q => q.i && META && META[q.i])) return;
  const { kind, feedback, titulo, limit, idx, ans, times, secs, porTiempo } = RUN;
  try { localStorage.setItem(RUN_KEY, JSON.stringify({ kind, feedback, titulo, limit, idx, ans: [...ans], times: times ? [...times] : [], secs, pt: !!porTiempo, ids: RUN.items.map(q => q.i), savedAt: Date.now() })); } catch (e) {}
}
async function resumeRun() {
  let s = null; try { s = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) {}
  if (!s || RUN) return;
  if (!Array.isArray(s.ids) || !s.ids.length || Date.now() - (s.savedAt || 0) > 2 * 86400000) return clearRun();
  const items = await byIds(s.ids);
  if (items.length !== s.ids.length) return clearRun();
  const n = items.length, i = Math.min(s.idx + 1, n);
  if (!(await ask(`Tienes sin terminar «${s.titulo || 'Test'}» (${s.pt ? 'pregunta ' + i : i + '/' + n}${s.limit ? ', quedan ' + fmtT(Math.max(0, s.limit * 60 - s.secs)) : ''}). ¿Continuar donde lo dejaste?`, 'Continuar'))) return clearRun();
  const un = a => Array.from(a || [], x => x === null ? undefined : x);
  RUN = { kind: s.kind, feedback: !!s.feedback, titulo: s.titulo, limit: s.limit || 0, porTiempo: !!s.pt, items, idx: s.idx, ans: un(s.ans), times: un(s.times), t0: now(), secs: s.secs || 0, paused: false };
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
    // Enter/Espacio deben activar el control enfocado mediante el comportamiento nativo.
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button,a,[role="button"]')) return;
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
    const LEC = normUi(store.getCfg().ui).lectura, kw = t => richHtml(t, !!LEC);
    const q = R.items[R.idx];
    const a = R.ans[R.idx];
    const reveal = R.feedback && a !== undefined;
    const inSup = !!q.s;
    app.innerHTML = `
    <h1 class="sr">${esc(R.titulo || 'Test')} · pregunta ${R.idx + 1}${R.porTiempo ? '' : ' de ' + R.items.length}</h1>
    <div class="qhead">
      <button class="ghost" id="exit" aria-label="Salir">✕</button>
      <div class="prog"><div ${pw(R.porTiempo ? Math.min(100, 100 * R.secs / (R.limit * 60)) : 100 * R.idx / R.items.length)}></div></div>
      <div class="cnt">${R.porTiempo ? '#' + (R.idx + 1) : (R.idx + 1) + '/' + R.items.length}</div>
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
      ${q.cp ? `<div class="ctx pre">${richHtml(q.cp)}</div>` : ''}
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
    // «por tiempo»: solo cuentan las preguntas que llegaste a contestar (la que estaba abierta al acabar el tiempo no)
    let hechas = R.items.length;
    if (R.porTiempo) { hechas = 0; R.ans.forEach((x, k) => { if (x !== undefined) hechas = k + 1; }); if (!hechas) { RUN = null; toast('Se acabó el tiempo sin contestar ninguna pregunta.'); return go('#/home'); } }
    const items = R.items.slice(0, hechas), res = { a: 0, f: 0, b: 0 }, fails = [], porTema = {}, porTipo = {};
    items.forEach((q, k) => {
      const x = R.ans[k]; const ok = x === q.c;
      const pt = porTema[q.t] ||= [0, 0]; pt[1]++;
      const tk = META[q.i]?.[2]; const ptk = tk ? (porTipo[tk] ||= [0, 0]) : null; if (ptk) ptk[1]++;
      if (x === undefined || x === -1) { res.b++; if (!R.feedback) store.record(q.i, q.t, 2); }
      else if (ok) { res.a++; pt[0]++; if (ptk) ptk[0]++; if (!R.feedback) store.record(q.i, q.t, 1, now(), R.times?.[k]); }
      else { res.f++; fails.push(q.i); if (!R.feedback) store.record(q.i, q.t, 0, now(), R.times?.[k]); }
    });
    const n = items.length;
    const ses = { id: 's' + now().toString(36), ts: now(), kind: R.kind, n, a: res.a, f: res.f, b: res.b, secs: R.porTiempo ? Math.min(R.secs, R.limit * 60) : R.secs, nota: nota(res.a, res.f, n), temas: porTema, tipos: porTipo, fails, titulo: R.titulo || '', ...(R.porTiempo ? { porTiempo: true } : {}) };
    store.addSession(ses);
    RUN = null; LAST = { ses, items, ans: R.ans, times: R.times || [], limit: R.limit || 0 };
    go('#/result');
  }
};

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
    <div class="score" data-count="${ses.nota}">${ses.nota}<small>/100</small></div>
    <div class="legend">(aciertos − fallos/3) / total</div>
    <div class="trio"><div class="g"><b>${ses.a}</b>Aciertos</div><div class="r"><b>${ses.f}</b>Fallos</div><div><b>${ses.b}</b>Blanco</div></div>
    <div class="legend">${pct(ses.a, ses.n)} % de acierto · ${fmtT(ses.secs)}</div>
  </div>
  <div class="row">
    ${(ses.titulo || '').includes('Parte 1') && SIMCFG?.parte2 ? '<button class="btn" id="p2go">Seguir con la parte 2 (supuesto)</button>' : ''}
    ${ng ? '<button class="btn" id="again">Repetir las falladas</button>' : ''}
    <button class="btn sec" id="home">Inicio</button>
  </div>
  ${LAST.limit && !LAST.ses.porTiempo ? simAnalisis(LAST) : ''}
  <h2>Por tema</h2>
  <div class="card">${Object.entries(ses.temas).sort((a, b) => a[0].localeCompare(b[0])).map(([t, [a, n]]) => `<div class="line"><span>${esc(t)} ${esc(temaName(t))}</span><span>${a}/${n}</span></div>`).join('')}</div>
  <h2>Revisión</h2>
  <div class="card">${items.map((q, k) => {
    const x = ans[k]; const st = x === undefined || x === -1 ? 'b' : x === q.c ? 'g' : 'r';
    return `<details class="rv ${st}"><summary><i></i><span class="sr">${st === 'g' ? 'Acierto' : st === 'r' ? 'Fallo' : 'En blanco'}: </span>${esc(q.q.slice(0, 110))}${q.q.length > 110 ? '…' : ''}</summary>
      <div class="pre">${richHtml(q.q)}</div>${q.a.map((o, i) => `<div class="ro ${i === q.c ? 'ok' : i === x ? 'bad' : ''}"><b>${L[i]}</b> ${richHtml(o)}</div>`).join('')}
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

async function startRepaso() {
  await getMeta(); const st = store.getStats(), t0 = now();
  const cand = []; for (const id in st) { const r = st[id]; if (r[3] >= 0 && r[4] <= t0 && META[id]) cand.push({ i: id, t: META[id][0], due: r[4] }); }
  const ids = pickRepaso(cand, 30).map(x => x.i);
  if (!ids.length) { toast('No tienes repasos pendientes hoy.'); return; }
  startRun({ kind: 'rev', feedback: true, items: await byIds(ids), titulo: 'Repaso de fallos · más vencidas primero, temas mezclados' });
}

// ───────── menú general ─────────
async function openMenu() {
  if ($('#menuov')) return;
  await getMeta();
  const due = (await dueList()).length, nCards = Object.values(store.getCards()).filter(r => r[3] >= 0 && r[4] <= now()).length;
  const nErr = Object.values(store.getReports()).filter(r => r.st === 'abierto').length, vel = velocidad(store.getStats());
  const aqui = location.hash || '#/home';
  const G = [
    ['Estudiar', [
      ['⚡', 'Sesión rápida', '10 preguntas en unos 5 minutos', () => quickSession()],
      ['↻', 'Repaso de fallos', due ? due + ' preguntas toca repasar hoy' : 'Nada pendiente hoy', () => startRepaso()],
      ['▭', 'Tarjetas de repaso', nCards ? nCards + ' tarjetas vencen hoy' : 'Repetición espaciada', '#/cards'],
      ['✎', 'Test por tema', '10–40 preguntas con corrección inmediata', '#/test'],
      ['⏱', 'Simulacros', 'Completo, por examen o por tema', '#/sim'],
    ]],
    ['Entrenar un hábito', [
      ['🔎', 'Detective de trampas', 'Marca qué trampas esconde cada pregunta', '#/trampas'],
      ['👁', 'Lectura atenta', vel.n ? vel.n + ' fallos por velocidad' : 'Qué piden, palabras clave y respuesta', '#/lectura'],
      ['⚡', 'Pregunta relámpago', 'Una sola pregunta', '#/relampago'],
    ]],
    ['Seguimiento', [
      ['▤', 'Estadísticas', 'Mapa de dominio, simulacros y evolución', '#/stats'],
      ['☰', 'Temas vistos', store.getSeen().length + ' temas marcados', '#/temario'],
      ['⚠', 'Errores del banco', nErr ? nErr + ' por revisar' : 'Nada por revisar', '#/errores'],
    ]],
    ['La app', [
      ['⌂', 'Inicio', 'Resumen y cuenta atrás', '#/home'],
      ['⚙', 'Ajustes', NEWV ? 'Hay una versión nueva' : 'Cuenta, apariencia, copia y versión ' + APP_VERSION, '#/settings'],
    ]],
  ];
  const prev = document.activeElement, o = document.createElement('div');
  o.id = 'menuov'; o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'menut');
  const acts = [];
  o.innerHTML = `<div class="card menu"><div class="menuhead"><h2 id="menut">Menú</h2><button class="ghost" id="menux" aria-label="Cerrar menú">✕</button></div>
    ${G.map(([t, l]) => `<div class="gtitle">${esc(t)}</div><div class="lgroup">${l.map(([ic, n, sub, a]) => { const i = acts.push(a) - 1; return `<button class="lrow ${a === aqui ? 'here' : ''}" data-a="${i}" ${a === aqui ? 'aria-current="page"' : ''}><i aria-hidden="true">${ic}</i><span><b>${esc(n)}</b><small>${esc(sub)}</small></span></button>`; }).join('')}</div>`).join('')}</div>`;
  const done = () => { document.removeEventListener('keydown', key, true); o.remove(); prev && prev.focus && prev.focus(); };
  const key = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); }
    else if (e.key === 'Tab') { const bs = [...o.querySelectorAll('button')], i = bs.indexOf(document.activeElement); e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); }
  };
  o.onclick = e => {
    if (e.target === o || e.target.closest('#menux')) return done();
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = acts[+b.dataset.a]; done();
    if (typeof a === 'function') a(); else go(a);
  };
  document.addEventListener('keydown', key, true);
  document.body.append(o); $('#menux', o).focus();
}

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
      <h2 class="h3">Terminar por</h2>
      <div class="seg" id="by">${[[0, 'Nº de preguntas'], [1, 'Tiempo']].map(([v, t]) => `<button class="${(cfg.pt ? 1 : 0) === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      ${cfg.pt ? `<div class="seg" id="mins">${[10, 20, 30, 45, 60].map(v => `<button class="${(cfg.min || 20) === v ? 'on' : ''}" data-v="${v}">${v} min</button>`).join('')}</div><p class="sub sm">Van saliendo preguntas hasta que se acaba el tiempo. Solo cuentan las que contestes.</p>`
      : `<div class="seg" id="n">${[10, 15, 25, 40].map(v => `<button class="${cfg.n === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>`}
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
    $('#by').onclick = e => { if (e.target.dataset.v) { cfg.pt = +e.target.dataset.v; save(); draw(); } };
    $('#n') && ($('#n').onclick = e => { if (e.target.dataset.v) { cfg.n = +e.target.dataset.v; save(); draw(); } });
    $('#mins') && ($('#mins').onclick = e => { if (e.target.dataset.v) { cfg.min = +e.target.dataset.v; save(); draw(); } });
    $('#mode').onclick = e => { if (e.target.dataset.v) { cfg.mode = e.target.dataset.v; save(); draw(); } };
    $('#org').onclick = e => { const v = e.target.dataset.v; if (v) { org.has(v) ? org.delete(v) : org.add(v); if (!org.size) org.add(v); save(); draw(); } };
    app.querySelectorAll('[data-t]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.t) : sel.delete(c.dataset.t); save(); draw(); });
    app.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const ids = idx.temas.filter(t => t.id.startsWith(b.dataset.b)).map(t => t.id); const all = ids.every(i => sel.has(i)); ids.forEach(i => all ? sel.delete(i) : sel.add(i)); save(); draw(); });
    $('#useSeen').onclick = () => { const v = store.getSeen(); if (!v.length) { toast('Aún no has marcado temas vistos (pantalla «Temas vistos» en Inicio).'); return; } sel.clear(); v.forEach(t => sel.add(t)); save(); draw(); };
    $('#go').onclick = guard(async () => {
      const temas = sel.size ? [...sel] : idx.temas.map(t => t.id);
      if (cfg.mode === 'trampas') {
        const r = await trapTest(cfg.pt ? 300 : cfg.n, null, sel.size ? [...sel] : null);
        if (!r.items.length) { toast('Aún no hay datos de trampas: contesta al menos 5 preguntas de alguna trampa y falla alguna.'); return; }
        startRun({ kind: 'test', feedback: true, items: r.items, titulo: 'Mis trampas · ' + r.targets.map(k => TRAMPAS[k] || k).join(', '), ...(cfg.pt ? { limit: cfg.min || 20, porTiempo: true } : {}) }); return;
      }
      const items = await pick({ temas, origins: org, mode: cfg.mode, n: cfg.pt ? 300 : cfg.n });
      if (!items.length) { toast(cfg.mode === 'falladas' ? 'No tienes falladas en esa selección.' : cfg.mode === 'dudosas' ? 'No tienes preguntas marcadas como dudosas ahí.' : 'No hay preguntas con ese filtro.'); return; }
      startRun({ kind: 'test', feedback: true, items, titulo: (sel.size === 1 ? temaName([...sel][0]) : 'Test') + (cfg.pt ? ' · ' + (cfg.min || 20) + ' min' : ''), ...(cfg.pt ? { limit: cfg.min || 20, porTiempo: true } : {}) });
    });
  };
  function save() { store.setCfg('test', { sel: [...sel], n: cfg.n, mode: cfg.mode, o: [...org], pt: cfg.pt || 0, min: cfg.min || 20 }); }
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
// «Exámenes» ya no es una pantalla aparte: son las pestañas «Por examen» y «Por tema» de Simulacros
routes.examenes = async function () { store.setCfg('simtab', 'examen'); go('#/sim'); };

// ───────── simulacro ─────────
routes.sim = async function () {
  const idx = await getIndex(); await getMeta();
  const cfg = Object.assign({ n: 80, min: 90, o: ['O', 'G'], parte2: true, scope: 'vistos' }, store.getCfg().sim || {});
  const seenN = store.getSeen().length;
  const org = new Set(cfg.o);
  const drawCompleto = () => {
    $('#simbody').innerHTML = `
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
    $('#n').onclick = e => { if (e.target.dataset.v) { cfg.n = +e.target.dataset.v; if (cfg.n === 40 && cfg.min > 60) cfg.min = 45; if (cfg.n === 80 && cfg.min < 90) cfg.min = 90; save(); drawCompleto(); } };
    $('#scope').onclick = e => { if (e.target.dataset.v) { cfg.scope = e.target.dataset.v; save(); drawCompleto(); } };
    $('#min').onclick = e => { if (e.target.dataset.v) { cfg.min = +e.target.dataset.v; save(); drawCompleto(); } };
    $('#org').onclick = e => { const v = e.target.dataset.v; if (v) { org.has(v) ? org.delete(v) : org.add(v); if (!org.size) org.add(v); save(); drawCompleto(); } };
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
  // pestañas: Completo (parte 1 + supuesto) · Por examen (simulacros y oficiales) · Por tema (tests de la academia)
  const TABS = [['completo', 'Completo'], ['examen', 'Por examen'], ['tema', 'Por tema']];
  let tab = store.getCfg().simtab; if (!TABS.some(t => t[0] === tab)) tab = 'completo';
  const L2 = listaExamenes();
  const grupos = () => tab === 'tema' ? [['Tests de la academia', L2.tests]] : [['Simulacros de la academia', L2.sims], ['Exámenes oficiales', L2.ofi]];
  const nf = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const drawLista = () => {
    const ses = store.getSessions(), todos = grupos().flatMap(g => g[1]);
    let sel = store.getCfg().exsel; if (!todos.some(x => x.k === sel)) sel = todos[0]?.k;
    const info = e => { const h = ses.filter(x => x.titulo === e.nombre); return h.length ? { nota: h[0].nota, n: h.length, mejor: Math.max(...h.map(x => x.nota)) } : null; };
    $('#simbody').innerHTML = `<p class="sub sm">Elige uno y contesta solo sus preguntas. Notas sobre 100; cada fallo resta 1/3.</p>
      ${grupos().map(([t, l]) => `<h2 class="h3">${esc(t)}</h2><div class="exlist">${l.map(e => { const i = info(e); return `<button class="exrow ${e.k === sel ? 'on' : ''}" data-k="${esc(e.k)}" aria-pressed="${e.k === sel}"><span><b>${esc(e.nombre)}</b><small>${e.ids.length} preguntas${i && i.n > 1 ? ` · ${i.n} intentos · mejor ${nf(i.mejor)}` : ''}</small></span><em class="nt ${i ? (i.nota >= 50 ? 'ok' : 'mid') : ''}">${i ? nf(i.nota) : 'Sin hacer'}</em></button>`; }).join('')}</div>`).join('')}
      <div class="bar2"><button class="btn sec" data-m="est">Estudiar</button><button class="btn" data-m="sim">Examen · 90 min</button></div>`;
    $('#simbody').querySelectorAll('.exrow').forEach(b => b.onclick = () => { store.setCfg('exsel', b.dataset.k); drawLista(); const n = $('#simbody').querySelector('.exrow.on'); n && n.focus({ preventScroll: true }); });
    $('#simbody').querySelectorAll('button[data-m]').forEach(b => b.onclick = guard(async () => {
      const ex = todos.find(x => x.k === sel); if (!ex) return;
      const items = (await byIds(ex.ids)).filter(q => !q.s);
      if (!items.length) { toast('No se pudieron cargar las preguntas.'); return; }
      if (b.dataset.m === 'sim') startRun({ kind: 'sim', feedback: false, items, limit: 90, titulo: ex.nombre });
      else startRun({ kind: 'test', feedback: true, items, titulo: ex.nombre });
    }));
  };
  const shell = () => {
    app.innerHTML = `<h1>Simulacros</h1><div class="seg tabs" id="simtabs" role="group" aria-label="Tipo de simulacro">${TABS.map(([v, t]) => `<button class="${tab === v ? 'on' : ''}" data-v="${v}" aria-pressed="${tab === v}">${t}</button>`).join('')}</div><div id="simbody"></div>`;
    $('#simtabs').onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.v === tab) return; tab = b.dataset.v; store.setCfg('simtab', tab); shell(); enter($('#simbody')); };
    tab === 'completo' ? drawCompleto() : drawLista();
  };
  shell();
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
      ${cby.has(id) ? (c => `<div class="pre sm">${richHtml(c.q)}</div><div class="ro ok"><b>R</b> ${richHtml(c.a)}</div>${c.ref ? `<div class="cita"><span>Temario</span>${esc(c.ref)}</div>` : ''}`)(cby.get(id)) : q ? `<div class="pre sm">${esc(q.q)}</div>${q.a.map((o, i) => `<div class="ro ${i === q.c ? 'ok' : ''}"><b>${L[i]}</b> ${esc(o)}${i === q.c ? ' ✓' : ''}</div>`).join('')}${q.u ? `<div class="cita"><span>Temario</span>${esc(q.u)}</div>` : ''}` : '<p class="sub">La pregunta ya no está en el banco.</p>'}
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


// Las pantallas comparten navegación y limpieza; cada módulo conserva su estado de sesión.
const screen = { get cleanup() { return cleanup; }, set cleanup(fn) { cleanup = fn; } };
registerTraining({ routes, go, route, pw }, screen);
const { allCards, curatedCards } = registerCards({ routes, go, pw, reportBox }, screen);
const { dominioTemas } = registerStats({ routes, go, trapTest, startRun });
registerHome({ routes, go, saludo, quickSession, startRepaso, openMenu, dominioTemas }, screen);
registerSettings({ routes, go, allCards, curatedCards, getNewVersion: () => NEWV, checkUpdate, applyUpdate }, screen);

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
  const aviso = async () => { const n = await checkUpdate(); if (n) toast(`Hay una versión nueva (${n.version}).`, { label: 'Actualizar', fn: applyUpdate }); };
  setTimeout(aviso, 6000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') aviso(); });
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

// ───────── versión y actualización ─────────
let NEWV = null; // versión nueva detectada en el servidor (objeto de version.json)
async function checkUpdate() {
  try {
    const v = await (await fetch('version.json', { cache: 'no-store' })).json();
    NEWV = v && v.build && v.build !== APP_BUILD ? v : null;
  } catch (e) { return undefined; } // sin red: no sabemos
  return NEWV;
}
async function applyUpdate() {
  saveRun(); // si hay un test en curso, se retoma al volver
  try { await store.flushNow(); } catch (e) {}
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update(); reg.waiting?.postMessage('skip');
      const w = reg.installing || reg.waiting;
      // esperar (máx. 6 s) a que el service worker nuevo termine de instalarse antes de recargar
      if (w && w.state !== 'activated') await new Promise(ok => { const t = setTimeout(ok, 6000); w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') { clearTimeout(t); ok(); } }); });
    }
  } catch (e) {}
  location.reload();
}

// aviso de nueva versión del service worker
function watchUpdates(reg) {
  const ready = w => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva.', { label: 'Actualizar', fn: applyUpdate }); });
  if (reg.installing) ready(reg.installing);
  reg.addEventListener('updatefound', () => reg.installing && ready(reg.installing));
}
