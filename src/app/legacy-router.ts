import { saveExportFile } from '../shared/ui/download-file.js';
import { helpIconLink } from '../shared/ui/help-icon-link.js';
import type { StudyServices } from '../shared/ui/study-services.js';
import { questionNotice, sourceHtml, filterFailures } from '../shared/presentation/legacy-study.js';
import { VERIFIED_SOURCES } from '../adapters/http/verified-sources.js';
import * as sync from '../adapters/firebase/sync-facade.js';
import * as store from '../adapters/local/legacy-store.js';
import { esc, richHtml, shuffle, fmtT, pct, nota, allowed, questionsForSession, composeSim, quickN, pickQuick, pickGuest, trapRates, pickTrampas, MOTIVOS, MOTIVOS_FALLO, pickRepaso, normUi, swipeDir, keyAction, hiliteHtml, pideNegativa, minLectura, velocidad, analisisSimulacro, ritmoSimulacro } from '../legacy/logic.js';
import { META, getIndex, getMeta, temaOf, idsOfTema, getTema, getSup, temaName, now, pick, dueList, byIds } from '../adapters/http/legacy-data.js';
import { $, legacyScope, bindLegacyHost, L, toast, ask, guard, focusHeading, type El } from '../shared/ui/legacy-dom.js';
import { showMenu, type MenuGroup } from '../shared/ui/dialog-actions.js';
import { BLOQUES, ORIGEN, TRAMPAS } from '../shared/presentation/labels.js';
import { APP_VERSION, APP_BUILD } from './build-info.js';
import { registerTraining } from '../features/trainers/legacy.js';
import { registerCards } from '../features/cards/legacy.js';
import { registerStats } from '../features/stats/legacy.js';
import { registerSettings } from '../features/settings/legacy.js';
import { isFull, isOwner, accessLevel, GUEST_ROUTES } from '../adapters/legacy/access.js';
import { subscribe as subscribeEngine, getCurrentRun, getLastResult, clearActiveRun, createRun, clearRun, saveRun, pendingRun, resumeRun, tickCurrentRun, currentSecondsRemaining, answerCurrentQuestion, answerCurrentDeferred, revealCurrentSolution, finishCurrentRun, setQuestionIndex, toggleReviewQuestion, setRunPaused, toggleDeferredBlank, startCurrentQuestion, setAttemptTrackingVisible, flushAttemptTracking, quickItems, repasoItems, trapTest, falladasIds, setCurrentConfidence, toggleCurrentDiscardedOption, addCurrentHighlight, removeCurrentHighlight } from '../core/application/legacy-engine.js';
import { dominioTemas } from './legacy-topic-mastery.js';
import { formatPendingRunPrompt } from '../shared/presentation/pending-run.ts';
import { createAccountRecovery } from '../core/application/recover-account.js';
import type { Origin } from '../core/domain/entities.js';
import { createHighlight, questionContentRevision, resolveHighlight } from '../core/domain/attempts/highlights.js';
import { canonicalText, paintTextHighlight, selectedTextAnchor } from './legacy-highlight-dom.js';
import { findLegacyCodeExplanation } from './explanation-composition.js';
import { explanationMapper } from '../features/explanations/explanation-mapper.js';
import { renderCodeExplanation } from '../features/explanations/legacy-view.js';
import { loadStrategyReportForPeriod } from './strategy-composition.js';
import { renderStrategyReport } from '../features/stats/strategy-view.js';
import { createManualAiExport, deleteManualStudyHistory, listManualExportSessions } from './ai-study-export-composition.js';

// ───────── router ─────────
const routes: Record<string, any> = {};
let navigate: (h: string, refresh?: boolean) => void = h => { location.hash = h; };
export function configureLegacyRouter(fn: (h: string, refresh?: boolean) => void): void { navigate = fn; }
function go(h: string) { navigate(h); }
function route() { navigate(location.hash || '#/home', true); }
const recover = createAccountRecovery(store.accountId, () => store.recover());
let painted: () => void;
export const firstLegacyPaint = new Promise<void>(resolve => { painted = resolve; });
// animaciones: barra de progreso que transforma su relleno desde el valor anterior, entrada de pantalla y nota que cuenta
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastP = 0;
function pw(p: any) { const f = lastP; lastP = p; return `style="--progress-from:${p > 0 ? f / p : 0};width:${p}%"`; }
function enter(el: HTMLElement) { if (reduceMotion()) return; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
function countUp() {
  document.querySelectorAll<El>('[data-count]').forEach(el => {
    const to = parseFloat(String(el.dataset.count!).replace(',', '.')); if (!isFinite(to) || reduceMotion()) return;
    const dec = (String(el.dataset.count!).split(/[.,]/)[1] || '').length, tn = el.firstChild; if (!tn || tn.nodeType !== 3) return;
    const t0 = performance.now(), D = 900;
    const step = (t: any) => { const k = Math.min(1, (t - t0) / D), v = to * (1 - Math.pow(1 - k, 3)); tn.nodeValue = v.toFixed(dec); if (k < 1 && tn.isConnected) requestAnimationFrame(step); else tn.nodeValue = String(el.dataset.count!); };
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
/** React es dueño del contenedor; el HTML legacy solo escribe dentro de él. */
export function renderLegacy(host: HTMLElement, pathname: string) {
  const release = bindLegacyHost(host);
  const { app, $ } = legacyScope();
  let active = true;
  let [, name, ...args] = pathname.split('/'); name ||= 'home';
  const f = routes[name] || routes.home;
  lastP = 0; window.scrollTo(0, 0);
  const lt = setTimeout(() => { if (active) app.innerHTML = '<p class="sub loading" role="status">Cargando…</p>'; }, 120);
  const ready = (async () => {
    try {
      await recover();
      if (name !== 'ayuda') { await getIndex(); await getMeta(); }
      if (!active) return;
      await f(...args); if (!active) return;
      clearTimeout(lt); enter(app); countUp();
      const hd = app.querySelector<El>('h1'); if (hd) hd.tabIndex = -1;
      (hd || app).focus({ preventScroll: true });
      const currentRun = getCurrentRun();
      if (currentRun && name !== 'quiz' && name !== 'home') {
        const b = document.createElement('div'); b.className = 'note run';
        b.innerHTML = `<b>${esc(currentRun.titulo || 'Test')}</b> en curso · ${Math.min(currentRun.idx + 1, currentRun.items.length)}/${currentRun.items.length} <button class="btn" id="resume">Continuar</button>`;
        app.prepend(b); $('#resume').onclick = () => go('#/quiz');
      }
    } catch (e) {
      if (!active) return;
      app.innerHTML = `<div class="card" role="alert"><h2>No se pudo cargar</h2><p>${navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button class="btn" id="retryRoute">Reintentar</button></div>`;
      $('#retryRoute').onclick = () => route(); console.error(e);
    } finally { clearTimeout(lt); painted(); }
  })();
  return { ready, dispose() { active = false; clearTimeout(lt); release(); } };
}

// ───────── motor de preguntas ─────────
function startRun(cfg: any) {
  if (!createRun(cfg)) { toast('No hay preguntas puntuables en esta selección. Puedes consultarlas en modo estudio.'); return; }
  go('#/quiz');
}
async function resumeSaved() {
  const p = await pendingRun(isFull());
  if (!p) return;
  const accepted = await ask(formatPendingRunPrompt({ title: p.saved.titulo, index: p.saved.idx, itemCount: p.items.length, seconds: p.saved.secs, limitMinutes: p.saved.limit, timeLimited: p.saved.pt }), 'Continuar');
  if (p.account !== store.accountId()) return;
  if (!accepted) return clearRun();
  if (resumeRun(p)) go('#/quiz');
}

routes.quiz = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const candidate = getCurrentRun();
  if (!candidate) { go('#/home'); return; }
  const R = candidate;
  let tick: any = null, gateTimer: any = null, closing = false, endConfirmation: AbortController | null = null;
  {
    // el tiempo sale de la hora real (no de contar ticks): iOS frena los timers con la pantalla bloqueada
    tick = setInterval(() => {
      tickCurrentRun();
      if (!R.limit) return;
      const left = currentSecondsRemaining();
      const el = $('#clock'); if (el) el.textContent = fmtT(left);
      const pc = $('#pace'); if (pc) { const d = ritmoSimulacro(R.idx, R.items.length, R.limit * 60, R.secs), bud = Math.round(R.limit * 60 / R.items.length); pc.className = 'pace ' + (d >= 0 ? 'up' : d > -3 ? 'mid' : 'low'); pc.textContent = `Ritmo: ${d > 0 ? d + ' por delante' : d < 0 ? -d + ' por detrás' : 'al día'} · ${bud} s por pregunta`; }
      if (left <= 0) { clearInterval(tick); finish('timeout'); }
    }, 500);
  }
  const onKey = (e: any) => {
    const eventTarget = e.target as El;
    const textRoot = typeof eventTarget?.closest === 'function'
      ? eventTarget.closest<El>('.enun, .opt .pre') || eventTarget.closest<El>('.opt')?.querySelector<El>('.pre') || null
      : null;
    if (textRoot && !eventTarget.closest('.opt') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return; }
    if (textRoot && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const selection = window.getSelection();
      if (selection && (!selection.anchorNode || !textRoot.contains(selection.anchorNode))) {
        const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT);
        let first = walker.nextNode();
        while (first && !first.textContent?.length) first = walker.nextNode();
        if (first) { const range = document.createRange(); range.setStart(first, 0); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
      }
      const direction = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 'backward' : 'forward';
      const granularity = e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'line' : 'character';
      const modify = (selection as (Selection & { modify?: (alter: string, direction: string, granularity: string) => void }) | null)?.modify;
      if (selection && modify) {
        e.preventDefault();
        modify.call(selection, e.shiftKey ? 'extend' : 'move', direction, granularity);
        onSelectionChange();
      }
      return;
    }
    // Enter/Espacio deben activar el control enfocado mediante el comportamiento nativo.
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as El).closest?.('button,a,[role="button"]')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(((e.target as El).tagName || ''))) return;
    if (R.paused && e.key === 'Tab') { e.preventDefault(); const rb = $('.overlay #resume'); rb && rb.focus(); return; }
    if (R.items[R.idx] === undefined) return;
    const act = keyAction(e, R.items[R.idx].a.length); if (!act) return;
    e.preventDefault();
    if (act.t === 'opt') { const b = app.querySelector<El>(`.opt[data-i="${act.i}"]`); b && b.click(); }
    else if (act.t === 'next') { const b = $('#next'); b && b.click(); }
    else if (act.t === 'prev') prev();
    else if (act.t === 'blank') { const b = $('#blank'); b && b.click(); }
    else if (act.t === 'flag') { const b = $('#flag'); b && b.click(); }
    else if (act.t === 'pause') { const b = R.paused ? $('.overlay #resume') : $('#pause'); b && b.click(); }
  };
  let tx: any = null;
  const onTs = (e: any) => { const t = e.touches[0]; tx = e.touches.length === 1 && t.clientX > 24 && t.clientX < innerWidth - 24 && !(e.target as El).closest<El>('details,input,textarea,button,.opt') ? [t.clientX, t.clientY] : null; };
  const onTe = (e: any) => {
    if (!tx) return; const t = e.changedTouches[0];
    const d = swipeDir(t.clientX - tx[0], t.clientY - tx[1]); tx = null;
    if (d === 'next') { const b = $('#next'); b && b.click(); } else if (d === 'prev') prev();
  };
  const onSelectionChange = () => {
    const tools = app.querySelector<HTMLElement>('#highlight-tools');
    if (!tools || R.paused) return;
    const anchor = selectedTextAnchor(app);
    tools.hidden = !anchor;
    if (anchor) {
      const remove = app.querySelector<HTMLButtonElement>('[data-remove-highlight]');
      const mark = (R.highlights?.[R.idx] || []).find(item => item.field === anchor.field
        && item.start < anchor.end && item.end > anchor.start);
      if (remove) { remove.hidden = !mark; if (mark) remove.dataset.removeHighlight = mark.id; }
    }
  };
  function prev() { if (R.paused || R.idx <= 0) return; setQuestionIndex(R.idx - 1); draw(); focusHeading(); window.scrollTo(0, 0); }
  document.addEventListener('keydown', onKey);
  document.addEventListener('touchstart', onTs, { passive: true });
  document.addEventListener('touchend', onTe, { passive: true });
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('keyup', onSelectionChange);
  app.addEventListener('mouseup', onSelectionChange);
  app.addEventListener('touchend', onSelectionChange);
  routeScreen.cleanup = () => { endConfirmation?.abort(); clearInterval(tick); clearInterval(gateTimer); document.removeEventListener('keydown', onKey); document.removeEventListener('touchstart', onTs); document.removeEventListener('touchend', onTe); document.removeEventListener('selectionchange', onSelectionChange); document.removeEventListener('keyup', onSelectionChange); app.removeEventListener('mouseup', onSelectionChange); app.removeEventListener('touchend', onSelectionChange); };
  draw();

  function draw() {
    if (R.idx >= R.items.length) return finish();
    saveRun();
    startCurrentQuestion();
    const LEC = normUi(store.getCfg().ui).lectura, kw = (t: any) => richHtml(t, !!LEC);
    const q = R.items[R.idx];
    const a = R.ans[R.idx];
    const state = R.feedback ? (R.studyStates?.[R.idx] || 'unseen') : undefined;
    const consulted = state === 'revealed';
    const reveal = R.feedback && (a !== undefined || consulted);
    const contentRevision = questionContentRevision(q.q, q.a);
    const confidence = R.confidences?.[R.idx] || null;
    const discarded = new Set(R.discardedOptions?.[R.idx] || []);
    const responseLocked = R.feedback ? state === 'answered' || state === 'revealed' : typeof a === 'number' && a >= 0;
    const inSup = !!q.s;
    app.innerHTML = `
    <h1 class="sr">${esc(R.titulo || 'Test')} · pregunta ${R.idx + 1}${R.porTiempo ? '' : ' de ' + R.items.length}</h1>
    <div class="qhead">
      <button class="ghost" id="exit" aria-label="Salir">✕</button>
      <div class="prog"><div ${pw(R.porTiempo ? Math.min(100, 100 * R.secs / (R.limit! * 60)) : 100 * R.idx / R.items.length)}></div></div>
      <div class="cnt">${R.porTiempo ? '#' + (R.idx + 1) : (R.idx + 1) + '/' + R.items.length}</div>
      ${R.limit ? `<div class="clock" id="clock">${fmtT(R.limit * 60 - R.secs)}</div><button class="ghost" id="pause" aria-label="Pausar">⏸</button>` : ''}
    </div>
    <div class="sub study-run-title">${esc(R.titulo || 'Práctica')}${helpIconLink('sesiones', 'Ayuda sobre controles y estados de pregunta')}</div>
    ${R.limit && R.kind === 'sim' ? '<div class="pace" id="pace"></div>' : ''}
    ${!R.feedback ? `<details class="question-map"><summary>Mapa de preguntas · ${R.ans.filter(x => x !== undefined && x >= 0).length} ${R.ans.filter(x => x !== undefined && x >= 0).length === 1 ? 'respondida' : 'respondidas'} · ${(R.review || []).length} para revisar</summary><div class="question-grid">${R.items.map((_, k) => { const status = R.ans[k] === undefined ? 'Sin responder' : R.ans[k] === -1 ? 'En blanco' : 'Respondida'; return `<button data-jump="${k}" ${k === R.idx ? 'aria-current="step"' : ''} class="${R.ans[k] !== undefined && R.ans[k] >= 0 ? 'answered' : ''}">${k + 1}<small>${status}${R.review?.includes(k) ? ' · Revisar' : ''}</small></button>`; }).join('')}</div></details><button class="ghost" id="review-question" aria-pressed="${!!R.review?.includes(R.idx)}">${R.review?.includes(R.idx) ? '✓ Marcada para revisar' : 'Marcar para revisar'}</button>` : `<details class="question-map"><summary>Mapa de preguntas · ${R.studyStates?.filter(x => x === 'answered').length || 0} respondidas · ${R.studyStates?.filter(x => x === 'pending').length || 0} pendientes · ${R.studyStates?.filter(x => x === 'revealed').length || 0} consultadas</summary><div class="question-grid">${R.items.map((_, k) => { const itemState = R.studyStates?.[k] || 'unseen'; const label = itemState === 'answered' ? 'Respondida' : itemState === 'pending' ? 'Pendiente' : itemState === 'revealed' ? 'Solución consultada' : 'Sin visitar'; return `<button data-jump="${k}" ${k === R.idx ? 'aria-current="step"' : ''} class="${itemState}">${k + 1}<small>${label}</small></button>`; }).join('')}</div></details>`}
    ${state === 'pending' ? '<p class="note">Si ves la solución, ya no podrás responder esta pregunta en este intento.</p>' : ''}
    <div class="card q ${inSup ? 'with-sup' : ''}">
      <div class="meta">
        <span class="tag">${esc(q.t)} · ${esc(temaName(q.t))}</span>
        <span class="tag o${q.o}">${ORIGEN[q.o]}${q.o === 'O' && q.y ? ' · ' + esc(q.y.replace('Ingreso libre ', '').replace('convocatoria ', '')) : ''}</span>
        ${q.p ? '<span class="tag warn">Respuesta provisional</span>' : ''}
        ${q.w ? '<span class="tag warn">Puede caducar</span>' : ''}
        ${q.o === 'G' && q.v ? '<span class="tag">Variante</span>' : ''}
      </div>
      ${questionNotice(q)}
      ${inSup ? `<details class="sup scenario-context"><summary>Enunciado del supuesto</summary><div class="pre">${esc(R.supTexto || q.supTexto || '')}</div></details>` : ''}
      ${q.cp ? `<div class="ctx pre">${richHtml(q.cp)}</div>` : ''}
      ${pideNegativa(q.q) ? '<div class="pide">Ojo: te piden la opción INCORRECTA o la excepción</div>' : ''}
      <div class="enun pre" tabindex="0" aria-label="Enunciado. Usa Mayús y las flechas para seleccionar texto">${kw(q.q)}</div>
      <div class="study-signals" aria-label="Señales opcionales de estudio">
        <span class="study-signals-label">¿Cómo lo ves?</span>
        ${[['sure', 'Seguro'], ['betweenTwo', 'Entre dos'], ['guess', 'Adivino']].map(([value, label]) => `<button type="button" class="signal${confidence === value ? ' on' : ''}" data-confidence="${value}" aria-pressed="${confidence === value}" ${responseLocked ? 'disabled' : ''}>${label}</button>`).join('')}
      </div>
      <div class="opts">
      ${q.a.map((o, i) => {
        let cl = 'opt';
        if (discarded.has(i)) cl += ' discarded';
        if (reveal) { if (i === q.c) cl += ' ok'; else if (i === a) cl += ' bad'; cl += ' dis'; }
        else if (a === i) cl += ' sel';
        return `<div class="option-control"><button class="${cl}" data-i="${i}" aria-pressed="${a === i}" ${reveal ? 'disabled' : ''}><b>${L[i]}</b><span class="pre" tabindex="0" aria-label="Opción ${L[i]}. Usa Mayús y las flechas para seleccionar texto">${kw(o)}</span>${reveal && i === q.c ? '<span class="sr">(respuesta correcta)</span>' : reveal && i === a ? '<span class="sr">(tu respuesta, incorrecta)</span>' : ''}</button><button type="button" class="discard-option${discarded.has(i) ? ' on' : ''}" data-discard-option="${i}" aria-pressed="${discarded.has(i)}" aria-label="${discarded.has(i) ? 'Restaurar' : 'Descartar'} opción ${L[i]}" ${responseLocked ? 'disabled' : ''}>${discarded.has(i) ? 'Restaurar' : 'Descartar'}</button></div>`;
      }).join('')}
      </div>
      <div class="highlight-tools" id="highlight-tools" role="group" aria-label="Subrayado opcional" hidden>
        <span>Texto seleccionado:</span><button type="button" class="signal" data-add-highlight="key">Clave</button>
        <button type="button" class="signal" data-add-highlight="doubt">Duda</button>
        <button type="button" class="signal" data-remove-highlight hidden>Quitar marca</button>
      </div>
      <p class="sub stale-highlight" id="stale-highlight" hidden>Una marca no coincide con el texto actual y no se ha movido.</p>
      ${reveal ? feedback(q, a, consulted) : ''}
    </div>
    <div class="bar2">
      ${R.feedback ? `<button class="btn sec" id="prev" ${R.idx === 0 ? 'disabled' : ''}>← Anterior</button>${state === 'unseen' ? '<button class="btn sec" id="blank">No lo sé</button>' : state === 'pending' ? '<span class="tag warn" role="status">Pendiente</span><button class="btn sec" id="reveal-solution">Ver solución</button>' : state === 'revealed' ? '<span class="tag warn" role="status">Solución consultada · blanco</span>' : '<span class="tag" role="status">Respondida</span>'}<button class="btn" id="next">${R.idx + 1 === R.items.length ? 'Terminar' : 'Siguiente'} →</button>`
        : `<button class="btn sec" id="blank">${a === -1 ? '✓ En blanco' : 'Dejar en blanco'}</button>
           <button class="btn" id="next">${R.idx + 1 === R.items.length ? 'Terminar' : 'Siguiente'} →</button>`}
    </div>
    ${R.paused ? `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pt"><div class="card"><h2 id="pt">En pausa</h2><p>El tiempo está detenido.</p><button class="btn" id="resume">Continuar</button></div></div>` : ''}`;
    bind(q);
    if (reveal && R.feedback) {
      const run = R, index = R.idx, slot = app.querySelector<HTMLElement>('#code-explanation-slot');
      if (slot) void findLegacyCodeExplanation(q.i, q.q, q.a).then(result => {
        if (!slot.isConnected || getCurrentRun() !== run || run.idx !== index) return;
        if (result.status === 'current') slot.innerHTML = renderCodeExplanation(explanationMapper.toViewModel(result.explanation));
        else if (result.status === 'outdated') slot.textContent = 'Hay una explicación de una revisión anterior; no se muestra para evitar información desactualizada.';
      }).catch(() => {});
    }
    (R.highlights?.[R.idx] || []).forEach(mark => {
      const root = mark.field === 'statement' ? app.querySelector('.enun')
        : app.querySelector(`.opt[data-i="${Number(mark.field.slice(7))}"] .pre`);
      if (!root) return;
      const sourceText = root.textContent?.replace(/\u00a0/g, ' ') || '';
      const resolved = resolveHighlight(mark, sourceText, contentRevision);
      if (resolved.stale) { const note = $('#stale-highlight'); if (note) note.hidden = false; return; }
      paintTextHighlight(root, resolved.start, resolved.end, mark.category, mark.id);
    });
    if (R.paused) { app.querySelectorAll<El>('.qhead,.sub,.pace,.card.q,.bar2').forEach(el => { if (!el.closest<El>('.overlay')) el.inert = true; }); const rb = $('.overlay #resume'); rb && rb.focus(); }
    clearInterval(gateTimer);
    if (LEC === 2 && !reveal && a === undefined && !R.paused) {
      const need = minLectura(q), left = () => Math.ceil(need - (Date.now() - R.qT0!) / 1000);
      if (left() > 0) {
        const opts = app.querySelectorAll<El>('.opt'); opts.forEach(b => b.disabled = true);
        $('.opts').insertAdjacentHTML('afterend', `<div class="gate" id="gate"></div>`);
        const upd = () => { const l = left(), g = $<El>('#gate'); if (!g) return clearInterval(gateTimer); if (l <= 0) { clearInterval(gateTimer); g.remove(); app.querySelectorAll<El>('.opt').forEach(b => b.disabled = false); } else g.textContent = `👀 Lee con calma: podrás responder en ${l} s. ¿Qué te piden? ¿Hay NO, SALVO, cifras?`; };
        upd(); gateTimer = setInterval(upd, 400);
      }
    }
    if (reveal) { const lv = $('#live'); if (lv) lv.textContent = (a === -1 ? 'Sin responder' : a === q.c ? 'Correcto' : 'Incorrecto') + '. Respuesta: ' + L[q.c]; const nx = $('#next'); nx && nx.focus({ preventScroll: true }); }
    else if (a !== undefined && !R.paused) { const so = app.querySelector<El>('.opt.sel'); so && so.focus({ preventScroll: true }); }
    // El enunciado permanece en su sitio al revelar: sin saltos automáticos de lectura.
  }
  function feedback(q: any, a: any, wasConsulted = false) {
    const ok = a === q.c;
    return `<div class="fb ${wasConsulted ? 'note' : ok ? 'good' : 'wrong'}"><b>${wasConsulted ? 'Solución consultada · cuenta como blanco' : a === -1 ? 'Sin responder' : ok ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>${L[q.c]}</b>${!wasConsulted && !ok && a !== -1 && R.fast?.[R.idx] ? `<div class="fbsub">Marcaste ${L[a]} en ${R.fast[R.idx][0]} s${R.fast[R.idx][0] < R.fast[R.idx][1] * 0.6 ? `; leerla con calma lleva unos ${R.fast[R.idx][1]} s` : ''}.</div>` : ''}
      ${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}
      ${sourceHtml(q, VERIFIED_SOURCES)}
      ${q.x?.length ? `<div class="trap">Trampa: ${q.x.map((x: any) => esc(TRAMPAS[x] || x)).join(' · ')}</div>` : ''}
      ${!wasConsulted && !ok && a !== -1 && R.feedback ? `<div class="mot" id="mot"><small>¿Por qué fallé?${helpIconLink('motivos', 'Ayuda sobre los motivos del fallo')}${(() => { const f = R.fast?.[R.idx]; return f && f[0] < f[1] * 0.6 ? ` <b class="r">Respondiste en ${f[0]} s; leerla bien lleva ≈${f[1]} s. ¿Fue velocidad?</b>` : ''; })()}</small>${[5, 7, 1, 2, 3, 4].map(m => `<button class="${store.rec(q.i)?.[9] === m ? 'on' : (m === 7 && R.fast?.[R.idx] && R.fast[R.idx][0] < R.fast[R.idx][1] * 0.6 ? 'sug' : '')}" data-m="${m}">${MOTIVOS_FALLO[m]}</button>`).join('')}<button class="mk" id="mkcard" ${store.rec(q.i)?.[9] === 4 && !store.cardRec('FC-Q-' + q.i) ? 'hidden' : ''}>${store.cardRec('FC-Q-' + q.i) ? '📇 Tarjeta creada ✓' : '📇 Hacer tarjeta'}</button></div>` : ''}
      ${ok && a !== -1 && R.feedback ? (() => { const r = store.rec(q.i) || [], en = r[3] === 0 && r[4] > now() + 86400000 * 1.5; return `<div class="mot" id="acc"><small>¿Seguro? (entra en repaso a +2 días)</small>${(() => { const pl = R.luck?.[R.idx]; return pl === 6 ? '<b class="r">🍀 Marcada como suerte: acierto 1/2. Otra vez bien y se quita la etiqueta.</b>' : pl === 8 ? '<b class="r">🍀 ¡Acierto 2/2! Etiqueta de suerte quitada: ya la sabes.</b>' : ''; })()}<button class="${en && r[9] !== 6 && r[9] !== 8 ? 'on' : ''}" data-a="doubt">🤔 Acerté dudando</button><button class="${r[9] === 6 || r[9] === 8 ? 'on' : ''}" data-a="suerte">🍀 Fue suerte</button></div>`; })() : ''}
      <button class="ghost fl" id="flag">${store.rec(q.i)?.[6] ? '★ Dudosa' : '☆ Marcar como dudosa'}</button>
      <div class="repw" id="rep"></div><div id="code-explanation-slot" aria-live="polite"></div></div>`;
  }
  function bind(q: any) {
    app.querySelectorAll<El>('[data-jump]').forEach(b => b.onclick = () => { if (getCurrentRun() !== R || R.paused) return; setQuestionIndex(+b.dataset.jump!); draw(); focusHeading(); window.scrollTo(0, 0); });
    $('#review-question') && ($('#review-question').onclick = () => { if (getCurrentRun() !== R || R.paused) return; toggleReviewQuestion(); draw(); $('#review-question').focus({preventScroll:true}); });
    $('#exit').onclick = async () => {
      if (closing || getCurrentRun() !== R) return;
      closing = true;
      endConfirmation = new AbortController();
      const accepted = await ask('¿Salir? Lo respondido se guardará como sesión interrumpida.', 'Salir', false, endConfirmation.signal);
      endConfirmation = null;
      closing = false;
      if (!accepted || getCurrentRun() !== R) return;
      if (R.ans.some(x => x !== undefined)) finish('interrupted');
      else { clearActiveRun(); clearRun(); go('#/home'); }
    };
    $('#pause') && ($('#pause').onclick = () => { setRunPaused(true); draw(); });
    $('#prev') && ($('#prev').onclick = prev);
    $('#resume') && ($('#resume').onclick = () => { setRunPaused(false); draw(); const pb = $('#pause'); pb && pb.focus(); });
    app.querySelectorAll<El>('.opt').forEach(b => b.onclick = () => {
      if (R.paused) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed
        && (b.contains(selection.anchorNode) || b.contains(selection.focusNode))) return;
      const i = +b.dataset.i!;
      if (R.feedback) { if (R.ans[R.idx] !== undefined) return; answer(q, i); draw(); }
      else { answerCurrentDeferred(i); draw(); }
    });
    app.querySelectorAll<HTMLButtonElement>('[data-confidence]').forEach(button => button.onclick = () => {
      const value = button.dataset.confidence;
      if (value === 'sure' || value === 'betweenTwo' || value === 'guess') {
        setCurrentConfidence(value);
        draw();
      }
    });
    app.querySelectorAll<HTMLButtonElement>('[data-discard-option]').forEach(button => button.onclick = () => {
      toggleCurrentDiscardedOption(Number(button.dataset.discardOption));
      draw();
    });
    const highlightTools = $('#highlight-tools');
    highlightTools?.addEventListener('mousedown', event => event.preventDefault());
    highlightTools?.addEventListener('touchstart', event => event.preventDefault(), { passive: false });
    app.querySelectorAll<HTMLButtonElement>('[data-add-highlight]').forEach(button => button.onclick = () => {
      const anchor = selectedTextAnchor(app);
      const category = button.dataset.addHighlight;
      if (!anchor || (category !== 'key' && category !== 'doubt')) return;
      const field = anchor.field;
      const existing = (R.highlights?.[R.idx] || []).find(mark => mark.field === field
        && mark.start < anchor.end && mark.end > anchor.start);
      if (existing) return;
      const state = R.studyStates?.[R.idx];
      const timing = state === 'revealed' ? 'after-reveal'
        : typeof R.ans[R.idx] === 'number' && R.ans[R.idx]! >= 0 ? 'after-answer' : 'before-answer';
      const created = createHighlight({
        id: globalThis.crypto?.randomUUID?.() || `mark-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...anchor,
        category,
        contentRevision: questionContentRevision(q.q, q.a),
        createdAt: Date.now(),
        timing,
      });
      if (created.ok && addCurrentHighlight(created.value)) {
        window.getSelection()?.removeAllRanges();
        draw();
      }
    });
    app.querySelectorAll<HTMLButtonElement>('[data-remove-highlight]').forEach(button => button.onclick = () => {
      const id = button.dataset.removeHighlight;
      if (id && removeCurrentHighlight(id)) { window.getSelection()?.removeAllRanges(); draw(); }
    });
    $('#blank') && ($('#blank').onclick = () => {
      if (R.feedback) { if (R.ans[R.idx] === undefined) { answer(q, -1); if (R.idx < R.items.length - 1) setQuestionIndex(R.idx + 1); draw(); if (R.idx > 0) focusHeading(); } }
      else { toggleDeferredBlank(); draw(); }
    });
    $('#reveal-solution') && ($('#reveal-solution').onclick = () => { if (revealCurrentSolution()) { draw(); focusHeading(); } });
    $('#next') && ($('#next').onclick = () => { if (R.idx === R.items.length - 1) { void finish(); return; } setQuestionIndex(R.idx + 1); draw(); focusHeading(); window.scrollTo(0, 0); });
    $('#mot') && ($('#mot').onclick = e => {
      const b = (e.target as El).closest<El>('button'); if (!b) return;
      const mk = $('#mkcard'), id = 'FC-Q-' + q.i;
      if (b === mk) { if (store.cardRec(id)) { store.removeCard(id); mk.textContent = '📇 Hacer tarjeta'; } else { store.addFallo(q.i); mk.textContent = '📇 Tarjeta creada ✓'; } return; }
      store.setMotivo(q.i, q.t, +b.dataset.m!);
      $('#mot').querySelectorAll<El>('button[data-m]').forEach(x => x.classList.toggle('on', x === b));
      if (mk) mk.hidden = +b.dataset.m! === 4 && !store.cardRec(id); // el despiste no merece tarjeta
    });
    $('#acc') && ($('#acc').onclick = e => { const b = (e.target as El).closest<El>('button'); if (!b) return; if (b.dataset.a! === 'suerte') store.suerte(q.i, q.t); else store.doubt(q.i, q.t); $('#acc').querySelectorAll<El>('button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#rep') && reportBox(q, $('#rep'));
    $('#flag') && ($('#flag').onclick = () => { store.toggleFlag(q.i, q.t); $('#flag').textContent = store.rec(q.i)?.[6] ? '★ Dudosa' : '☆ Marcar como dudosa'; });
  }
  function answer(q: any, i: any) { answerCurrentQuestion(i, minLectura(q)); }
  async function finish(reason: 'complete' | 'interrupted' | 'timeout' = 'complete') {
    if (getCurrentRun() !== R || closing && reason !== 'timeout') return;
    if (reason === 'timeout') endConfirmation?.abort();
    const missing = R.items.filter((_, k) => R.ans[k] === undefined).length;
    if (reason === 'complete' && !R.feedback && missing) {
      closing = true;
      endConfirmation = new AbortController();
      const accepted = await ask(`Quedan ${missing} preguntas sin responder. ¿Terminar y guardar la sesión como interrumpida?`, 'Terminar', false, endConfirmation.signal);
      endConfirmation = null;
      closing = false;
      if (!accepted || getCurrentRun() !== R) return;
      reason = 'interrupted';
    }
    clearInterval(tick);
    if (!finishCurrentRun(reason)) { toast('Se acabó el tiempo sin contestar ninguna pregunta.'); return go('#/home'); }
    go('#/result');
  }
};

function simAnalisis({ ses, items, ans, times, limit }: any) {
  const r = analisisSimulacro({ correct: items.map((q: any) => q.c), ans, times, limitSecs: limit * 60, secs: ses.secs });
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
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const lastResult = getLastResult();
  if (!lastResult) return go('#/home');
  const { ses, items, ans, studyStates = [], highlights = [], confidences = [], discardedOptions = [] } = lastResult;
  const ng = ses.f;
  const consultedCount = studyStates.filter(state => state === 'revealed').length;
  app.innerHTML = `
  <h1>Resultado</h1>
  ${ses.interrupted ? `<div class="note result-status"><b>Sesión interrumpida</b><p>${ses.a + ses.f} de ${ses.n} preguntas respondidas. La puntuación global mantiene las no contestadas como blancos.</p></div>` : ''}
  <div class="card big">
  <p class="score-label">Puntuación global${helpIconLink('puntuacion', 'Ayuda sobre cómo se calcula la puntuación')}</p>
    <div class="score" data-count="${ses.nota}">${ses.nota}<small>/100</small></div>
    <div class="legend">100 × (aciertos − fallos/3) / total de preguntas</div>
    <div class="trio"><div class="g"><b>${ses.a}</b>Aciertos</div><div class="r"><b>${ses.f}</b>Fallos</div><div><b>${ses.b}</b>Blanco</div></div>
    ${consultedCount ? `<div class="legend" id="consulted-count">${consultedCount} ${consultedCount === 1 ? 'solución consultada' : 'soluciones consultadas'} · contadas como blanco, sin acierto ni fallo</div>` : ''}
    <div class="legend">${ses.a + ses.f ? pct(ses.a, ses.a + ses.f) + ' % de acierto sobre lo contestado' : 'Sin respuestas evaluables'} · ${fmtT(ses.secs)}</div>
  </div>
  <div class="row">
    ${(ses.titulo || '').includes('Parte 1') && SIMCFG?.parte2 ? '<button class="btn" id="p2go">Seguir con la parte 2 (supuesto)</button>' : ''}
    ${ng ? '<button class="btn" id="again">Repetir las falladas</button>' : ''}
    <button class="btn sec" id="home">Inicio</button>
  </div>
  ${lastResult.limit && !lastResult.ses.porTiempo ? simAnalisis(lastResult) : ''}
  ${ses.kind === 'sim' && !ses.interrupted ? '<section class="strategy-result"><h2>Analítica de estrategia</h2><p class="sub">Análisis del historial completado; las sesiones incompletas se excluyen y la muestra pequeña no genera recomendación.</p><button class="btn sec" id="result-strategy-load">Calcular informe del último año</button><div id="result-strategy-report" aria-live="polite"></div></section>' : ''}
  <h2>Por tema</h2>
  <div class="card">${Object.entries(ses.temas).sort((a, b) => a[0].localeCompare(b[0])).map(([t, [a, n]]) => `<div class="line"><span>${esc(t)} ${esc(temaName(t))}</span><span>${a}/${n}</span></div>`).join('')}</div>
  <h2>Revisión</h2>
  <div class="card">${items.map((q, k) => {
    const x = ans[k], consulted = studyStates[k] === 'revealed'; const st = consulted || x === undefined || x === -1 ? 'b' : x === q.c ? 'g' : 'r';
    const label = consulted ? 'Solución consultada · blanco' : st === 'g' ? 'Acierto' : st === 'r' ? 'Fallo' : 'En blanco';
    return `<details class="rv ${st}"><summary><i></i><span class="sr">${label}: </span>${consulted ? '<span class="tag warn">Solución consultada · blanco</span> ' : ''}${esc(q.q.slice(0, 110))}${q.q.length > 110 ? '…' : ''}</summary>
      ${questionNotice(q)}<div class="pre review-statement">${richHtml(q.q)}</div>${q.a.map((o, i) => `<div class="ro ${i === q.c ? 'ok' : i === x ? 'bad' : ''}" data-answer-index="${i}"><b>${L[i]}</b> <span class="pre review-option-text">${richHtml(o)}</span>${i === q.c ? ' <span class="sr">(Respuesta correcta)</span>' : ''}</div>`).join('')}
      ${confidences[k] ? `<p class="sub">Confianza antes de responder: ${confidences[k] === 'sure' ? 'Seguro' : confidences[k] === 'betweenTwo' ? 'Entre dos' : 'Adivino'}</p>` : ''}
      ${discardedOptions[k]?.length ? `<p class="sub">Opciones que descartaste antes de responder: ${discardedOptions[k].map(index => L[index]).join(', ')}</p>` : ''}
      ${highlights[k]?.length ? '<p class="sub">Tus marcas de este intento:</p>' : ''}
      ${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}${sourceHtml(q, VERIFIED_SOURCES)}<div class="code-explanation-slot" data-explanation="${k}" aria-live="polite"></div><div class="repw" data-rq="${k}"></div></details>`;
  }).join('')}</div>`;
  items.forEach((question, index) => {
    const explanationSlot = app.querySelector<HTMLElement>(`[data-explanation="${index}"]`);
    if (!ses.interrupted) void findLegacyCodeExplanation(question.i, question.q, question.a).then(result => {
      if (!explanationSlot?.isConnected) return;
      if (result.status === 'current') explanationSlot.innerHTML = renderCodeExplanation(explanationMapper.toViewModel(result.explanation), `result-${index}`);
      else if (result.status === 'outdated') explanationSlot.textContent = 'Hay una explicación de una revisión anterior; no se muestra para evitar información desactualizada.';
    }).catch(() => {});
    const revision = questionContentRevision(question.q, question.a);
    const panel = app.querySelectorAll<HTMLElement>('.rv')[index];
    (highlights[index] || []).forEach(mark => {
      const root = mark.field === 'statement' ? panel.querySelector('.review-statement')
        : panel.querySelector(`.ro[data-answer-index="${Number(mark.field.slice(7))}"] .review-option-text`);
      if (!root) return;
      const resolved = resolveHighlight(mark, canonicalText(root), revision);
      if (resolved.stale) {
        const note = document.createElement('p'); note.className = 'sub stale-highlight';
        note.textContent = 'Una marca no coincide con el texto actual y no se ha movido.'; panel.append(note);
        return;
      }
      paintTextHighlight(root, resolved.start, resolved.end, mark.category, mark.id);
    });
  });
  app.querySelectorAll<El>('[data-rq]').forEach(el => reportBox(items[+el.dataset.rq!], el));
  $('#home').onclick = () => go('#/home');
  $('#result-strategy-load') && ($('#result-strategy-load').onclick = async () => {
    const output = $('#result-strategy-report'); if (!output) return;
    output.setAttribute('aria-busy', 'true'); output.textContent = 'Calculando con el historial detallado…';
    try { output.innerHTML = renderStrategyReport(await loadStrategyReportForPeriod(365)); }
    catch { if (output.isConnected) output.textContent = 'No se pudo leer el historial detallado. El resultado de esta sesión sigue disponible.'; }
    finally { if (output.isConnected) output.setAttribute('aria-busy', 'false'); }
  });
  $('#p2go') && ($('#p2go').onclick = () => go('#/sim2'));
  $('#again') && ($('#again').onclick = async () => startRun({ kind: 'rev', feedback: true, items: shuffle(items.filter((q, k) => ans[k] !== q.c)), titulo: 'Repetición de falladas' }));
};


// ───────── sesión rápida (~5 min) ─────────
async function quickSession() {
  const account = store.accountId();
  const r = await quickItems(isFull());
  if (account !== store.accountId()) return;
  if (!r.items.length) { toast(isFull() ? 'No hay preguntas nuevas ni repasos con esos filtros.' : 'No hay preguntas disponibles ahora mismo.'); return; }
  startRun({ kind: 'rev', feedback: true, items: r.items, titulo: r.titulo });
}
async function startRepaso() {
  const account = store.accountId();
  const r = await repasoItems();
  if (account !== store.accountId()) return;
  if (!r.items.length) { toast('No tienes repasos pendientes hoy.'); return; }
  startRun({ kind: 'rev', feedback: true, ...r });
}

// ───────── menú general ─────────
const GUEST_MENU = (G: any) => [['Estudiar', [G[0][1][0]]], G[3]];
async function openMenu() {
  if ($('#menuov')) return;
  await getMeta();
  const due = (await dueList()).length, nCards = Object.values(store.getCards()).filter(r => r[3] >= 0 && r[4] <= now()).length;
  const nErr = Object.values(store.getReports()).filter(r => r.st === 'abierto').length, vel = velocidad(store.getStats());
  const aqui = location.hash || '#/home';
  const G = [
    ['Estudiar', [
      ['⚡', 'Sesión rápida', '10 preguntas en unos 5 minutos', () => quickSession()],
      ['↻', 'Repaso de fallos', due ? due + (due === 1 ? ' pregunta toca repasar hoy' : ' preguntas toca repasar hoy') : 'Nada pendiente hoy', () => startRepaso()],
      ['▭', 'Tarjetas de repaso', nCards ? nCards + (nCards === 1 ? ' tarjeta vence hoy' : ' tarjetas vencen hoy') : 'Repetición espaciada', '#/cards'],
      ['✎', 'Test por tema', '10–40 preguntas con corrección inmediata', '#/test'],
      ['⏱', 'Simulacros', 'Completo, por examen o por tema', '#/sim'],
    ]],
    ['Entrenar un hábito', [
      ['🔎', 'Detective de trampas', 'Marca qué trampas esconde cada pregunta', '#/trampas'],
      ['👁', 'Lectura atenta', vel.n ? vel.n + ' fallos por velocidad' : 'Qué piden, palabras clave y respuesta', '#/lectura'],
      ['⚡', 'Pregunta relámpago', 'Una sola pregunta', '#/relampago'],
    ]],
    ['Seguimiento', [
      ['▤', 'Progreso', 'Mapa de dominio, simulacros y evolución', '#/stats'],
      ['☰', 'Temas vistos', store.getSeen().length + ' temas marcados', '#/temario'],
      ['✗', 'Preguntas falladas', falladasIds().length + ' para buscar y releer', '#/falladas'],
      ['⚠', 'Errores del banco', nErr ? nErr + ' por revisar' : 'Nada por revisar', '#/errores'],
    ]],
    ['La app', [
      ['⌂', 'Inicio', 'Resumen y cuenta atrás', '#/home'],
      ...(isOwner() ? [['🔑', 'Accesos', sync.status.reqs.length ? sync.status.reqs.length + ' solicitudes por revisar' : 'Quién puede usar la app', '#/acceso']] : []),
      ['⚙', 'Ajustes', NEWV ? 'Hay una versión nueva' : 'Cuenta, apariencia, copia y versión ' + APP_VERSION, '#/settings'],
      ['?', 'Ayuda', 'Motivos, práctica, simulacros y guardado', '#/ayuda'],
    ]],
  ];
  await showMenu((isFull() ? G : GUEST_MENU(G)) as MenuGroup[], aqui, go);
}

// ───────── mis trampas ─────────
// ───────── test por tema ─────────
routes.test = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const idx = await getIndex(); await getMeta();
  const cfg = store.getCfg().test || { sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] };
  const sel = new Set<string>(cfg.sel || []), org = new Set<Origin>(cfg.o || ['O', 'A', 'G']);
  let allTopics = typeof cfg.all === 'boolean' ? cfg.all : sel.size === 0;
  let themeQuery = ''; const openBlocks = new Set<string>(['T1']);
  const viewAccount = store.accountId();
  const bloques = [['T1', 'Bloque I · Organización del Estado'], ['T2', 'Bloque II · Informática básica'], ['T3', 'Bloque III · Desarrollo'], ['T4', 'Bloque IV · Sistemas y comunicaciones']];
  const draw = () => {
    app.innerHTML = `
    <h1>Test por tema${helpIconLink('sesiones', 'Ayuda sobre los controles del test')}</h1>
    <div class="card">
      <h2 class="h3">Terminar por</h2>
      <div class="seg" id="by">${[[0, 'Nº de preguntas'], [1, 'Tiempo']].map(([v, t]) => `<button class="${(cfg.pt ? 1 : 0) === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      ${cfg.pt ? `<div class="seg" id="mins">${[10, 20, 30, 45, 60].map(v => `<button class="${(cfg.min || 20) === v ? 'on' : ''}" data-v="${v}">${v} min</button>`).join('')}</div><p class="sub sm">Van saliendo preguntas hasta que se acaba el tiempo. Solo cuentan las que contestes.</p>`
      : `<div class="seg" id="n">${[10, 15, 25, 40].map(v => `<button class="${cfg.n === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>`}
      <h2 class="h3">Qué preguntas</h2>
      <div class="seg" id="mode">${[['nuevas', 'Nuevas primero'], ['aleatorio', 'Aleatorio'], ['falladas', 'Falladas'], ['dudosas', 'Dudosas'], ['trampas', 'Mis trampas']].map(([v, t]) => `<button class="${cfg.mode === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      ${cfg.mode === 'trampas' ? '<p class="sub sm">Saca preguntas de tus 3 trampas con más fallos (mínimo 5 respuestas por trampa): primero las que fallaste, luego las que no has visto.</p>' : ''}
      <h2 class="h3">Origen</h2>
      <div class="seg multi" id="org">${([['G', 'Generadas'], ['O', 'Oficiales'], ['A', 'Academia']] as const).map(([v, t]) => `<button class="${org.has(v) ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
    </div>
    <div class="card"><h2 class="h3">Temas <small>(${allTopics ? 'Todo el temario' : sel.size + ' elegidos'})</small></h2>
    <div class="seg" id="test-scope"><button id="test-all" class="${allTopics ? 'on' : ''}">Todo el temario</button><button id="test-custom" class="${!allTopics ? 'on' : ''}">Elegir temas</button></div>
    <label class="field" for="test-search">Buscar tema</label><input type="search" id="test-search" value="${esc(themeQuery)}" placeholder="Nombre o código del tema">
    <div class="row"><button class="btn sec" id="useSeen">Usar mis temas vistos (${store.getSeen().length})</button></div>
    ${bloques.map(([b, nom]) => `<details class="bl topic-block" data-test-block="${b}" ${openBlocks.has(b) || themeQuery ? 'open' : ''}><summary>${nom}</summary><div class="blh"><span>Seleccionar bloque</span><button class="ghost sm" data-b="${b}">todos</button></div>
      ${idx.temas.filter(t => t.id.startsWith(b)).map(t => `<label class="tm ${sel.has(t.id) ? 'on' : ''}"><input type="checkbox" data-t="${t.id}" ${sel.has(t.id) ? 'checked' : ''}><span><b>${t.id}</b> ${esc(t.nombre)}</span><small>${tstat(t.id, t.n)}</small></label>`).join('')}</details>`).join('')}
    </div>
    <div class="bar2 action-plan"><p class="sm" id="test-summary" role="status">${cfg.pt ? (cfg.min || 20) + ' min' : cfg.n + ' preguntas'} · ${allTopics ? 'Todo el temario' : sel.size ? [...sel].map(t => temaName(t)).join(', ') : 'Elige al menos un tema'} · ${[...org].map(o => ORIGEN[o as 'G'|'A'|'O']).join(', ')}</p><button class="btn" id="go" ${!allTopics && !sel.size ? 'disabled' : ''}>Empezar</button></div>`;
    $('#test-all').onclick = () => { allTopics = true; sel.clear(); save(); draw(); };
    $('#test-custom').onclick = () => { allTopics = false; save(); draw(); };
    const applySearch = () => { app.querySelectorAll<El>('.tm').forEach(el => { el.hidden = !fold(el.textContent).includes(fold(themeQuery)); }); app.querySelectorAll<HTMLDetailsElement>('[data-test-block]').forEach(el => { if (themeQuery) el.open = true; el.hidden = !Array.from(el.querySelectorAll<El>('.tm')).some(x => !x.hidden); }); };
    $('#test-search').oninput = e => { themeQuery = (e.target as El).value; applySearch(); };
    app.querySelectorAll<HTMLDetailsElement>('[data-test-block]').forEach(el => el.ontoggle = () => { if (!el.isConnected) return; el.open ? openBlocks.add(el.dataset.testBlock!) : openBlocks.delete(el.dataset.testBlock!); });
    applySearch();
    $('#by').onclick = e => { if ((e.target as El).dataset.v!) { cfg.pt = +(e.target as El).dataset.v!; save(); draw(); } };
    $('#n') && ($('#n').onclick = e => { if ((e.target as El).dataset.v!) { cfg.n = +(e.target as El).dataset.v!; save(); draw(); } });
    $('#mins') && ($('#mins').onclick = e => { if ((e.target as El).dataset.v!) { cfg.min = +(e.target as El).dataset.v!; save(); draw(); } });
    $('#mode').onclick = e => { const v = (e.target as El).dataset.v; if (v && ['nuevas', 'aleatorio', 'falladas', 'dudosas', 'trampas'].includes(v)) { cfg.mode = v as NonNullable<typeof cfg.mode>; save(); draw(); } };
    $('#org').onclick = e => { const v = (e.target as El).dataset.v; if (v === 'O' || v === 'A' || v === 'G') { org.has(v) ? org.delete(v) : org.add(v); if (!org.size) org.add(v); save(); draw(); } };
    app.querySelectorAll<El>('[data-t]').forEach(c => c.onchange = () => { allTopics = false; c.checked ? sel.add(c.dataset.t!) : sel.delete(c.dataset.t!); save(); draw(); });
    app.querySelectorAll<El>('[data-b]').forEach(b => b.onclick = () => { allTopics = false; const ids = idx.temas.filter(t => t.id.startsWith(b.dataset.b!)).map(t => t.id); const all = ids.every(i => sel.has(i)); ids.forEach(i => all ? sel.delete(i) : sel.add(i)); save(); draw(); });
    $('#useSeen').onclick = () => { const v = store.getSeen(); if (!v.length) { toast('Aún no has marcado temas vistos (pantalla «Temas vistos» en Inicio).'); return; } allTopics = false; sel.clear(); v.forEach(t => sel.add(t)); save(); draw(); };
    $('#go').onclick = guard(async () => {
      if (!allTopics && !sel.size) return toast('Elige al menos un tema o selecciona Todo el temario.');
      const temas = allTopics ? idx.temas.map(t => t.id) : [...sel];
      if (cfg.mode === 'trampas') {
        const r = await trapTest(cfg.pt ? 300 : cfg.n || 15, undefined, sel.size ? [...sel] : undefined);
        if (viewAccount !== store.accountId() || !$('#test-summary')) return;
        if (!r.items.length) { toast('Aún no hay datos de trampas: contesta al menos 5 preguntas de alguna trampa y falla alguna.'); return; }
        startRun({ kind: 'test', feedback: true, items: r.items, titulo: 'Mis trampas · ' + r.targets.map(k => TRAMPAS[k] || k).join(', '), ...(cfg.pt ? { limit: cfg.min || 20, porTiempo: true } : {}) }); return;
      }
      const items = await pick({ temas, origins: org, mode: cfg.mode || 'nuevas', n: cfg.pt ? 300 : cfg.n || 15 });
      if (viewAccount !== store.accountId() || !$('#test-summary')) return;
      if (!items.length) { toast(cfg.mode === 'falladas' ? 'No tienes falladas en esa selección.' : cfg.mode === 'dudosas' ? 'No tienes preguntas marcadas como dudosas ahí.' : 'No hay preguntas con ese filtro.'); return; }
      startRun({ kind: 'test', feedback: true, items, titulo: (sel.size === 1 ? temaName([...sel][0] as string) : 'Test') + (cfg.pt ? ' · ' + (cfg.min || 20) + ' min' : ''), ...(cfg.pt ? { limit: cfg.min || 20, porTiempo: true } : {}) });
    });
  };
  function save() { store.setCfg('test', { all: allTopics, sel: [...sel], n: cfg.n, mode: cfg.mode, o: [...org], pt: cfg.pt || 0, min: cfg.min || 20 }); }
  function tstat(t: any, n: any) {
    let v = 0, ok = 0, tot = 0;
    for (const id of META._by[t] || []) { const r = store.rec(id); if (r) { v++; ok += r[1]; tot += r[0]; } }
    return `${v}/${n}${tot ? ' · ' + pct(ok, tot) + '%' : ''}`;
  }
  draw();
};


// ───────── exámenes y simulacros por número ─────────
const EX_OFICIALES: Record<string, string> = {
  'TAIL2022-P1': 'Ingreso libre 2022 (conv. 2023)', 'TAI2024B-P1': 'Ingreso libre 2023-24 (conv. 2024)', 'L2018-P1': 'Ingreso libre 2018',
  'L2019-P1': 'Ingreso libre 2019', 'L2025A-P1': 'Ingreso libre 2025', 'L2025X-P1': 'Ingreso libre 2025 (extraordinario)',
  'P2018-P1': 'Promoción interna 2018', 'P2019-P1': 'Promoción interna 2019', 'P2022-P1': 'Promoción interna 2022 (conv. 2023)',
  'P2024A-P1': 'Promoción interna 2021-24 (conv. 2024)', 'P2025A-P1': 'Promoción interna 2025',
};
function listaExamenes() {
  const g: Record<string, any> = {};
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
    const c: Record<string, any> = {}; for (const id of g[k]) { const t = META[id][0]; c[t] = (c[t] || 0) + 1; }
    const tema = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    tests.push({ k, ids: g[k].sort(), tema, nombre: '' });
  }
  tests.sort((a, b) => a.tema.localeCompare(b.tema) || a.k.localeCompare(b.k));
  const vistos: Record<string, any> = {};
  for (const t of tests) { const n = vistos[t.tema] = (vistos[t.tema] || 0) + 1; t.nombre = `Test ${t.tema} · ${temaName(t.tema)}${tests.filter(x => x.tema === t.tema).length > 1 ? ' (' + n + ')' : ''}`; }
  return { sims, ofi, tests };
}
// «Exámenes» ya no es una pantalla aparte: son las pestañas «Por examen» y «Por tema» de Simulacros
routes.examenes = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen); store.setCfg('simtab', 'examen'); go('#/sim'); };

// ───────── simulacro ─────────
routes.sim = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const idx = await getIndex(); await getMeta();
  const cfg = Object.assign({ n: 80, min: 90, o: ['O', 'G'], parte2: true, scope: 'vistos' }, store.getCfg().sim || {});
  const seenN = store.getSeen().length;
  const simAccount = store.accountId();
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
      <div class="seg multi" id="org">${([['G', 'Generadas'], ['O', 'Oficiales'], ['A', 'Academia']] as const).map(([v, t]) => `<button class="${org.has(v) ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
      <label class="chk"><input type="checkbox" id="p2" ${cfg.parte2 ? 'checked' : ''}> Después, parte 2: elegir 1 de 2 supuestos prácticos (20 preguntas)</label>
    </div>
    <div class="note">Reparto por temas calcado a los exámenes oficiales. Cada fallo resta 1/3 de acierto; en blanco no resta. No hay corrección hasta el final.</div>
    <div class="bar2"><button class="btn" id="go">Empezar simulacro</button></div>`;
    $('#n').onclick = e => { if ((e.target as El).dataset.v!) { cfg.n = +(e.target as El).dataset.v!; if (cfg.n === 40 && cfg.min > 60) cfg.min = 45; if (cfg.n === 80 && cfg.min < 90) cfg.min = 90; save(); drawCompleto(); } };
    $('#scope').onclick = e => { const value = (e.target as El).dataset.v; if (value === 'vistos' || value === 'todos') { cfg.scope = value; save(); drawCompleto(); } };
    $('#min').onclick = e => { if ((e.target as El).dataset.v!) { cfg.min = +(e.target as El).dataset.v!; save(); drawCompleto(); } };
    $('#org').onclick = e => { const v = (e.target as El).dataset.v; if (v === 'O' || v === 'A' || v === 'G') { org.has(v) ? org.delete(v) : org.add(v); if (!org.size) org.add(v); save(); drawCompleto(); } };
    $<El>('#p2').onchange = e => { cfg.parte2 = (e.target as El).checked; save(); };
    $('#go').onclick = guard(async () => {
      const useSeen = cfg.scope !== 'todos' && seenN;
      const items = await simParte1(idx, org, cfg.n, useSeen ? new Set(store.getSeen()) : null);
      if (simAccount !== store.accountId() || !$('#simbody')) return;
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
  let exOrigin = 'all', exTurn = 'all', exYear = '';
  const grupos = (): [string, any[]][] => {
    if (tab === 'tema') return [['Tests de la academia', L2.tests]];
    return ([['Exámenes oficiales', L2.ofi], ['Simulacros de la academia', L2.sims]] as [string, any[]][]).map(([title, list]) => [title, list.filter(e =>
      (exOrigin === 'all' || (exOrigin === 'official' ? L2.ofi : L2.sims).includes(e)) &&
      (exTurn === 'all' || (exTurn === 'libre' ? e.nombre.startsWith('Ingreso libre') : e.nombre.startsWith('Promoción interna'))) &&
      (!exYear || e.nombre.includes(exYear)))] as [string, any[]]).filter(([, list]) => list.length);
  };
  const nf = (n: any) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const drawLista = () => {
    const ses = store.getSessions(), todos = grupos().flatMap(g => g[1]);
    let sel = store.getCfg().exsel; if (!todos.some(x => x.k === sel)) sel = todos[0]?.k;
    const info = (e: any) => { const h = ses.filter(x => x.titulo === e.nombre); return h.length ? { nota: h[0].nota, n: h.length, mejor: Math.max(...h.map(x => x.nota)) } : null; };
    const years = [...new Set(L2.ofi.flatMap(e => e.nombre.match(/20\d{2}/g) || []))].sort().reverse();
    $('#simbody').innerHTML = `${tab === 'examen' ? `<div class="card exam-filters"><label>Origen<select id="ex-origin"><option value="all" ${exOrigin === 'all' ? 'selected' : ''}>Todos</option><option value="official" ${exOrigin === 'official' ? 'selected' : ''}>Oficiales</option><option value="academy" ${exOrigin === 'academy' ? 'selected' : ''}>Academia</option></select></label><label>Turno<select id="ex-turn"><option value="all" ${exTurn === 'all' ? 'selected' : ''}>Todos</option><option value="libre" ${exTurn === 'libre' ? 'selected' : ''}>Ingreso libre</option><option value="promotion" ${exTurn === 'promotion' ? 'selected' : ''}>Promoción interna</option></select></label><label>Año en la referencia<select id="ex-year"><option value="">Todos</option>${years.map(y => `<option value="${y}" ${exYear === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div>` : ''}<p class="sub sm">Elige uno y contesta solo sus preguntas. Notas sobre 100; cada fallo resta 1/3.</p>
      ${grupos().map(([t, l]) => `<h2 class="h3">${esc(t)}</h2><div class="exlist">${l.map((e: any) => { const i = info(e); return `<button class="exrow ${e.k === sel ? 'on' : ''}" data-k="${esc(e.k)}" aria-pressed="${e.k === sel}"><span><b>${esc(e.nombre)}</b><small>${e.ids.length} preguntas${i && i.n > 1 ? ` · ${i.n} intentos · mejor ${nf(i.mejor)}` : ''}</small></span><em class="nt ${i ? (i.nota >= 50 ? 'ok' : 'mid') : ''}">${i ? nf(i.nota) : 'Sin hacer'}</em></button>`; }).join('')}</div>`).join('')}
      ${!todos.length ? '<p class="note">No hay exámenes con estos filtros. Prueba con otro año o turno.</p>' : ''}
      <div class="bar2"><button class="btn sec" data-m="est" ${!todos.length ? 'disabled' : ''}>Estudiar</button><button class="btn" data-m="sim">Examen · 90 min</button></div>`;
    for (const id of ['ex-origin', 'ex-turn', 'ex-year']) { const el = $('#' + id); if (el) el.onchange = () => { if (id === 'ex-origin') exOrigin = el.value; else if (id === 'ex-turn') exTurn = el.value; else exYear = el.value; drawLista(); $('#' + id)?.focus({ preventScroll: true }); }; }
    $('#simbody').querySelectorAll<El>('.exrow').forEach(b => b.onclick = () => { store.setCfg('exsel', b.dataset.k!); drawLista(); const n = $('#simbody').querySelector<El>('.exrow.on'); n && n.focus({ preventScroll: true }); });
    $('#simbody').querySelectorAll<El>('button[data-m]').forEach(b => b.onclick = guard(async () => {
      const ex = todos.find(x => x.k === sel); if (!ex) return;
      const items = (await byIds(ex.ids)).filter(q => !q.s);
      if (simAccount !== store.accountId() || !$('#simbody')) return;
      if (!items.length) { toast('No se pudieron cargar las preguntas.'); return; }
      if (b.dataset.m! === 'sim') startRun({ kind: 'sim', feedback: false, items, limit: 90, titulo: ex.nombre });
      else startRun({ kind: 'test', feedback: true, items, titulo: ex.nombre });
    }));
  };
  const shell = () => {
    app.innerHTML = `<h1>Simulacros${helpIconLink('simulacros', 'Ayuda sobre navegación y corrección de simulacros')}</h1><div class="seg tabs" id="simtabs" role="group" aria-label="Tipo de simulacro">${TABS.map(([v, t]) => `<button class="${tab === v ? 'on' : ''}" data-v="${v}" aria-pressed="${v === tab}">${t}</button>`).join('')}</div><div id="simbody"></div>`;
    $('#simtabs').onclick = e => { const b = (e.target as El).closest<El>('button'); if (!b || b.dataset.v! === tab) return; tab = b.dataset.v!; store.setCfg('simtab', tab); shell(); $('#simtabs .on').focus({preventScroll:true}); enter($('#simbody') as any); };
    tab === 'completo' ? drawCompleto() : drawLista();
  };
  shell();
};
let SIMCFG: any = null;
async function simParte1(idx: any, org: any, N: any, only: any) {
  const temas = idx.temas.filter((t: any) => !only || only.has(t.id));
  const pools: Record<string, any> = {};
  const ls = await Promise.all(temas.map((t: any) => getTema(t.id)));
  temas.forEach((t: any, i: any) => { pools[t.id] = shuffle(ls[i].filter((x: any) => allowed(x, org) && x.np !== 1)).sort((a: any, b: any) => (store.rec(a.i) ? 1 : 0) - (store.rec(b.i) ? 1 : 0)); });
  return composeSim(temas, pools, N);
}
// Parte 2 tras la parte 1: ofrece 2 supuestos
routes.sim2 = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const sup = await getSup();
  const ok = (Object.entries(sup) as [string, any][]).filter(([k, v]) => v.q.filter((x: any) => !x.r && x.np !== 1).length >= 18 && /libre/i.test(v.conv || '') && !/2018/.test(v.conv || ''));
  const two = shuffle(ok).slice(0, 2);
  app.innerHTML = `<h1>Parte 2 · Supuesto práctico</h1><div class="note">Elige uno de los dos supuestos. Son ejercicios reales de convocatorias anteriores.</div>
  ${two.map(([k, v], i) => `<div class="card"><h2 class="h3">Supuesto ${i + 1}</h2><div class="pre sm">${esc(v.texto.slice(0, 700))}${v.texto.length > 700 ? '…' : ''}</div><button class="btn" data-k="${k}">Elegir este supuesto</button></div>`).join('')}
  <button class="btn sec" id="skip">Saltar la parte 2</button>`;
  app.querySelectorAll<El>('[data-k]').forEach(b => b.onclick = () => {
    const v = sup[b.dataset.k!];
    const items = v.q.filter((x: any) => !x.r && x.np !== 1).slice(0, 20);
    startRun({ kind: 'sim', feedback: false, items, limit: SIMCFG?.min2 || 40, supTexto: v.texto, titulo: 'Simulacro · Parte 2 (supuesto)' });
  });
  $('#skip').onclick = () => go('#/home');
};


// ───────── avisar de error en el banco ─────────
function reportBox(q: any, host: El) {
  const show = () => {
    const r = store.getReports()[q.i];
    host.innerHTML = r && r.st === 'abierto' ? `<span class="rep ok">✓ Error anotado <button class="ghost sm" data-rep>editar</button></span>` : `<button class="ghost fl" data-rep>⚠ Avisar de error</button>`;
    host.querySelector<El>('[data-rep]')!.onclick = form;
  };
  const form = () => {
    const r = store.getReports()[q.i];
    host.innerHTML = `<div class="repf"><select data-m aria-label="Motivo del error">${MOTIVOS.map(m => `<option ${r && r.motivo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
      <input data-n aria-label="Qué falla" maxlength="300" placeholder="Qué falla (opcional)" value="${esc(r?.nota || '')}">
      <div class="row"><button class="btn" data-s>Guardar</button><button class="btn sec" data-c>Cancelar</button></div></div>`;
    host.querySelector<El>('[data-s]')!.onclick = () => { store.addReport(q.i, q.t, host.querySelector<El>('[data-m]')!.value, host.querySelector<El>('[data-n]')!.value.trim()); show(); };
    host.querySelector<El>('[data-c]')!.onclick = show;
  };
  show();
}
routes.errores = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
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
    $('#ef').onclick = e => { if ((e.target as El).dataset.v!) { store.setCfg('errf', (e.target as El).dataset.v!); } };
    app.querySelectorAll<El>('[data-st]').forEach(b => b.onclick = () => store.setReportState(b.dataset.id!, b.dataset.st! as any));
    $('#exp').onclick = () => {
      const out = all.map(([id, r]) => { const q = by.get(id) || null, c = cby.get(id) || null; return { id, tarjeta: c ? { pregunta: c.q, respuesta: c.a, ref: c.ref || null } : undefined, tema: r.tema, estado: r.st, motivo: r.motivo, nota: r.nota, origen: q ? ORIGEN[q.o] : null, enunciado: q?.q, opciones: q?.a, correcta: q ? L[q.c] : null, cita: q?.u || null, trampas: (q?.x || []).map(x => TRAMPAS[x] || x) }; });
      saveExportFile('errores-banco.json', JSON.stringify({ generado: new Date().toISOString(), errores: out }, null, 1), 'application/json');
    };
  };
  let sig = JSON.stringify(store.getReports()) + (store.getCfg().errf || '');
  routeScreen.cleanup = store.onChange(() => { const n = JSON.stringify(store.getReports()) + (store.getCfg().errf || ''); if (n !== sig) { sig = n; draw(); } });
  await draw();
};


// Las pantallas comparten navegación y limpieza; cada módulo conserva su estado de sesión.
const screen = { get cleanup() { return legacyScope().screen.cleanup; }, set cleanup(fn) { legacyScope().screen.cleanup = fn; } };
// ───────── preguntas falladas: buscar por texto o tema y releer el fragmento del temario ─────────
const fold = (t: any) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
routes.falladas = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  let active = true, tm: any;
  routeScreen.cleanup = () => { active = false; clearTimeout(tm); };
  await getMeta();
  if (!active) return;
  const qs = (await byIds(falladasIds())).sort((a, b) => (store.rec(b.i)?.[2] || 0) - (store.rec(a.i)?.[2] || 0));
  if (!active) return;
  const idx = await getIndex();
  if (!active) return;
  const F = { q: '', t: '', review: '', streak: '' };
  const fd = (ts: any) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const conteo: Record<string, any> = {}; qs.forEach(q => { conteo[q.t] = (conteo[q.t] || 0) + 1; });
  const filtra = () => {
    const stats = store.getStats();
    const items = qs.map(q => {
      const record = stats[q.i];
      return {
        value: q, id: q.i, topic: q.t, reviewed: record?.[11] === 1,
        streak: store.failureStreak(record), searchableText: [q.q, ...q.a, q.u, q.n].join(' '),
      };
    });
    return filterFailures(items, F);
  };
  const lista = () => {
    const L2 = filtra(), host = $('#flist'); if (!active || !host) return;
    $('#fcount').textContent = L2.length === qs.length ? `${qs.length} ${qs.length === 1 ? 'pregunta' : 'preguntas'}` : `${L2.length} de ${qs.length} ${qs.length === 1 ? 'pregunta' : 'preguntas'}`;
    const gr: Record<string, any> = {}; L2.forEach(q => (gr[q.t] ||= []).push(q));
    host.innerHTML = L2.length ? Object.keys(gr).sort().map(t => `<h2 class="h3">${esc(t)} · ${esc(temaName(t))} <small>(${gr[t].length})</small></h2><div class="card">${gr[t].map((q: any) => {
      const r = store.rec(q.i) || [0, 0, 0];
      return `<article class="failure-item" data-failure="${esc(q.i)}"><div class="failure-state"><label class="chk"><input type="checkbox" data-reviewed="${esc(q.i)}" ${r[11] ? 'checked' : ''}>Repasada en el temario</label><span class="streak-meter" aria-label="${Math.max(0, store.failureStreak(r))} de 3 aciertos seguidos">${Math.max(0, store.failureStreak(r))}/3</span></div><details class="rv f"><summary><i></i><span class="pre">${richHtml(q.q)}<br><small class="sub">Aciertos seguidos: ${Math.max(0, store.failureStreak(r))}/3 · <span data-review-status="${esc(q.i)}">${r[11] ? 'Temario repasado' : 'Pendiente de temario'}</span></small></span></summary>
      ${questionNotice(q)}${sourceHtml(q, VERIFIED_SOURCES)}
      ${q.supTexto ? `<details class="sup"><summary>Enunciado del supuesto</summary><div class="pre">${esc(q.supTexto)}</div></details>` : ''}
      ${q.cp ? `<div class="ctx pre">${richHtml(q.cp)}</div>` : ''}
      ${q.a.map((o: any, i: any) => `<div class="ro ${i === q.c ? 'ok' : ''}"><b>${L[i]}</b> ${richHtml(o)}${i === q.c ? ' <span class="sr">(Respuesta correcta)</span>' : ''}</div>`).join('')}
      ${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : '<p class="sm sub">Esta pregunta no tiene fragmento de temario asociado.</p>'}${q.n ? `<div class="cita"><span>Nota</span>${esc(q.n)}</div>` : ''}
      <p class="sm sub">Última actividad: ${fd(r[2])} · acertada ${r[1]} de ${r[0]} veces${q.y ? ' · ' + esc(q.y) : ''}</p></details></article>`;
    }).join('')}</div>`).join('')
      : '<div class="card"><p class="sub">Ninguna pregunta coincide con la búsqueda.</p></div>';
  };
  if (!qs.length) { app.innerHTML = `<h1>Falladas${helpIconLink('repaso', 'Ayuda sobre preguntas falladas y repaso')}</h1><div class="card"><p class="sub">Aún no tienes preguntas falladas. Cuando falles alguna aparecerá aquí para que la busques y releas el tema.</p></div><div class="row"><button class="btn sec" id="home">Inicio</button></div>`; $('#home').onclick = () => go('#/home'); return; }
  app.innerHTML = `<h1>Falladas${helpIconLink('repaso', 'Ayuda sobre preguntas falladas y repaso')}</h1>
  <p class="sub">Cada pregunta permanece hasta acertarla tres veces seguidas. Un fallo reinicia el contador; dejarla en blanco no cuenta. Marcar el temario no la quita de la lista.</p>
  <p class="sub" id="fcount"></p>
  <div class="card">
    <label class="sr" for="fq">Buscar en las preguntas falladas</label>
    <input id="fq" type="search" placeholder="Buscar: palabra, artículo, comando…" autocomplete="off" enterkeyhint="search">
    <label class="sr" for="ft">Filtrar por tema</label>
    <select id="ft"><option value="">Todos los temas</option>${idx.temas.filter(t => conteo[t.id]).map(t => `<option value="${esc(t.id)}">${esc(t.id)} · ${esc(t.nombre)} (${conteo[t.id]})</option>`).join('')}</select>
    <div class="row"><label for="freview">Repaso del temario<select id="freview"><option value="">Todos</option><option value="pending">Pendiente de temario</option><option value="reviewed">Repasada</option></select></label>
    <label for="fstreak">Aciertos seguidos<select id="fstreak"><option value="">Todas las rachas</option><option value="0">0 de 3</option><option value="1">1 de 3</option><option value="2">2 de 3</option></select></label></div>
  </div>
  <div id="flist"></div>
  <div class="bar2"><button class="btn" id="fgo">Practicar estas</button></div>`;
  $('#flist').onchange = e => {
    const input = (e.target as El).closest<El>('[data-reviewed]'); if (!input) return;
    const q = qs.find(q => q.i === input.dataset.reviewed!); if (!q) return;
    store.setReviewed(q.i, q.t, input.checked);
    const status = input.closest<El>('.failure-item')!.querySelector<El>('[data-review-status]');
    if (status) status.textContent = input.checked ? 'Temario repasado' : 'Pendiente de temario';
    if (F.review) lista();
  };
  $<El>('#fq').oninput = e => { F.q = (e.target as El).value; clearTimeout(tm); tm = setTimeout(lista, 150); };
  $<El>('#ft').onchange = e => { clearTimeout(tm); F.t = (e.target as El).value; lista(); };
  for (const [id, key] of [['freview', 'review'], ['fstreak', 'streak']] as const) $('#' + id).onchange = e => { clearTimeout(tm); F[key] = (e.target as El).value; lista(); };
  $('#fgo').onclick = () => { const L2 = filtra(); if (!L2.length) return toast('No hay preguntas con ese filtro.'); startRun({ kind: 'test', feedback: true, items: shuffle(L2).slice(0, 40), titulo: 'Falladas' + (F.t ? ' · ' + F.t : '') }); };
  lista();
};


registerTraining({ routes, go, route, pw, verifiedSources: VERIFIED_SOURCES }, screen);
const { allCards, curatedCards } = registerCards({ routes, go, pw, reportBox, verifiedSources: VERIFIED_SOURCES }, screen);
registerStats({ routes, go, trapTest, startRun, startRepaso, dominioTemas, getStrategyReport: loadStrategyReportForPeriod, renderStrategyReport });


registerSettings({ routes, go, allCards, curatedCards, getNewVersion: () => NEWV, checkUpdate, applyUpdate, listManualExportSessions, createManualAiExport, deleteManualStudyHistory }, screen);


// ───────── arranque ─────────
export function bootLegacy(firstPaint = firstLegacyPaint): () => void {
  const controller = new AbortController(), timers: ReturnType<typeof setTimeout>[] = [];
  let stopped = false, offUpdates: (() => void) | undefined;
  const listen = (target: EventTarget, event: string, fn: () => void) => target.addEventListener(event, fn, { signal: controller.signal });
  const offAccount = store.onAccountChange(() => go('#/home'));
  void (async () => {
    try { navigator.storage?.persist?.(); } catch (e) {}
    await recover(); if (stopped) return;
    listen(document, 'visibilitychange', () => {
      const visible = document.visibilityState === 'visible';
      setAttemptTrackingVisible(visible);
      if (!visible) { store.flushNow(); void flushAttemptTracking(); }
    });
    listen(window, 'pagehide', () => { setAttemptTrackingVisible(false); store.flushNow(); void flushAttemptTracking(); });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').then(reg => {
      if (!stopped) offUpdates = watchUpdates(reg);
    }).catch(() => {});
    await firstPaint; if (stopped) return;
    listen(window, 'pagehide', saveRun);
    listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') saveRun(); });
    resumeSaved().catch(() => {});
    timers.push(setTimeout(prefetchBanco, 4000));
    const aviso = async () => { const n = await checkUpdate(); if (n && !stopped) toast(`Hay una versión nueva (${n.version}).`, { label: 'Actualizar', fn: applyUpdate }); };
    timers.push(setTimeout(aviso, 6000));
    listen(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') void aviso(); });
    try { await getMeta(); if (!stopped) await sync.init({ temaOf, idsOfTema }); } catch (e) { console.error(e); }
  })();
  return () => { stopped = true; controller.abort(); timers.forEach(clearTimeout); offAccount(); offUpdates?.(); };
}

// Descarga el banco en segundo plano (2 a la vez) para que Test, Simulacro y Repaso arranquen sin esperar a la red
async function prefetchBanco() {
  if ((navigator as any).connection?.saveData || navigator.onLine === false || !window.caches) return;
  try {
    const idx = await getIndex(), c = await caches.open('tai-data');
    const cached = await Promise.all(idx.temas.map(t => c.match(`data/${t.id}.json`)));
    const falta = idx.temas.filter((_, index) => !cached[index]).map(t => `data/${t.id}.json`);
    const w = async () => { for (let u; (u = falta.shift());) { try { const response = await fetch(u); if (!response.ok) return; await response.arrayBuffer(); } catch (e) { return; } } };
    await Promise.all([w(), w()]);
  } catch (e) {}
}

// ───────── versión y actualización ─────────
let NEWV: any = null; // versión nueva detectada en el servidor (objeto de version.json)
async function checkUpdate() {
  try {
    const response = await fetch('version.json', { cache: 'no-store' });
    if (!response.ok) return undefined;
    const v = await response.json();
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
      if (w && w.state !== 'activated') await new Promise<void>(ok => { const t = setTimeout(ok, 6000); w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') { clearTimeout(t); ok(); } }); });
    }
  } catch (e) {}
  location.reload();
}

// aviso de nueva versión del service worker
function watchUpdates(reg: ServiceWorkerRegistration): () => void {
  const controller = new AbortController();
  const ready = (w: ServiceWorker) => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Hay una versión nueva.', { label: 'Actualizar', fn: applyUpdate }); }, { signal: controller.signal });
  if (reg.installing) ready(reg.installing);
  reg.addEventListener('updatefound', () => reg.installing && ready(reg.installing), { signal: controller.signal });
  return () => controller.abort();
}


/** Temporary composition only: the React views own rendering and events. */
export const studyServices: StudyServices = {
  access: {
    accountId: store.accountId, subscribe(listener) { const offSync = sync.onStatus(listener), offStore = store.onChange(listener); return () => { offSync(); offStore(); }; },
    async load() { await recover(); return { owner: isOwner(), error: sync.status.accessErr || undefined, requests: sync.status.reqs, grants: sync.status.grants }; },
    approve: async member => await sync.approve(member), reject: async uid => await sync.reject(uid), revoke: async uid => await sync.revoke(uid), confirm: ask, notify: toast,
  },
  markReady: () => painted(),
  home: {
    accountId: store.accountId,
    getActiveStudy() { const run = getCurrentRun(); return run ? { title: run.titulo || 'Test', position: run.idx, total: run.items.length } : null; },
    getAccess() { return { full: isFull(), level: accessLevel(), greeting: saludo(), state: sync.status.state, configured: sync.status.configured, signedIn: !!sync.status.user, pendingRequests: sync.status.access === 'propietario' ? sync.status.reqs.length : 0 }; },
    subscribe(listener) { const offStore = store.onChange(listener), offSync = sync.onStatus(listener), offEngine = subscribeEngine(listener); return () => { offStore(); offSync(); offEngine(); }; },
    async loadOverview() {
      await recover(); const index = await getIndex(); await getMeta();
      const stats = store.getStats(), dates = new Set<string>();
      let seen = 0, answers = 0;
      for (const id in stats) { seen++; answers += stats[id][0]; dates.add(new Date(stats[id][2]).toDateString()); }
      const due = (await dueList()).length;
      let streak = 0; const day = new Date();
      if (!dates.has(day.toDateString())) day.setDate(day.getDate() - 1);
      while (dates.has(day.toDateString())) { streak++; day.setDate(day.getDate() - 1); }
      const exam = store.getCfg().exam;
      const daysToExam = exam ? Math.max(0, Math.ceil((+new Date(exam + 'T09:00:00') - Date.now()) / 86400000)) : null;
      const mastery = dominioTemas(index);
      return { seen, total: index.n, answers, streak, daysToExam, due,
        completedSessions: store.getSessions().length,
        blocks: BLOQUES.map(([code, name]) => {
          const topics = mastery.filter(topic => topic.id.startsWith(code));
          return { name, total: topics.length, mastered: topics.filter(topic => topic.est === 'g').length,
            assessed: topics.filter(topic => topic.est !== 'n').length };
        }),
        cardsDue: Object.values(store.getCards()).filter(record => record[3] >= 0 && record[4] <= now()).length,
        quickCount: quickN(stats), slowCount: velocidad(stats).n, failures: falladasIds().length,
        studiedTopics: store.getSeen().length, topicCount: index.temas.length,
        assessedTopics: mastery.filter(topic => topic.est !== 'n').length,
        weakTopics: mastery.filter(topic => topic.est === 'r').length,
        masteredTopics: mastery.filter(topic => topic.est === 'g').length,
      };
    },
    quickSession, startReview: startRepaso, openMenu,
    login: sync.login, requestAccess: async () => await sync.requestAccess(), notify: toast,
  },
  topics: {
    accountId: store.accountId, getStudied: store.getSeen,
    setStudied(ids) { store.setSeen(ids); }, subscribe: store.onChange,
    async loadTopics() {
      await recover(); const index = await getIndex(); await getMeta();
      return index.temas.map(topic => {
        let answered = 0, correct = 0, total = 0;
        for (const id of META._by[topic.id] || []) { const record = store.rec(id); if (record) { answered++; correct += record[1]; total += record[0]; } }
        return { id: topic.id, name: topic.nombre, total: topic.n, answered, accuracy: total ? pct(correct, total) : null };
      });
    },
  },
};
