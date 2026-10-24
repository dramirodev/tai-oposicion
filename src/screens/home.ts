import * as sync from '../core/syncfacade.js';
import * as store from '../core/store.js';
import { esc, pct, quickN, velocidad } from '../core/logic.js';
import { META, getIndex, getMeta, now, dueList } from '../core/data.js';
import { $, app, guard, toast, type El } from '../ui.js';
import { state } from '../core/engine.js';
import { BLOQUES } from '../core/labels.js';
import { isFull, accessLevel } from '../core/access.js';
export function registerHome({ routes, go, saludo, quickSession, startRepaso, openMenu, dominioTemas, falladasIds }: any, screen: any) {
// ───────── inicio ─────────
routes.home = async function () {
  const account = store.accountId();
  const idx = await getIndex(); await getMeta();
  if (account !== store.accountId()) return;
  const st = store.getStats();
  let seen = 0, n = 0, ok = 0, dias = new Set();
  for (const id in st) { seen++; n += st[id][0]; ok += st[id][1]; dias.add(new Date(st[id][2]).toDateString()); }
  const due = (await dueList()).length;
  if (account !== store.accountId()) return;
  let streak = 0; const d = new Date();
  if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (dias.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  const exam = store.getCfg().exam; const ex = exam ? new Date(exam + 'T09:00:00') : null; const dd = ex ? Math.max(0, Math.ceil((+ex - Date.now()) / 86400000)) : null;
  const nCards = Object.values(store.getCards()).filter(r => r[3] >= 0 && r[4] <= now()).length;
  const vel = velocidad(st);
  const nFall = falladasIds().length;
  const full = isFull();
  const IC: Record<string, string> = { test: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>', sim: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9.5 3h5"/>', card: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M7 3h10"/>', det: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>', lec: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', rel: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', map: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', play: '<path d="M8 5v14l11-7z"/>', redo: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>' };
  const svg = (k: any) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
  const row = (id: any, ico: any, t: any, sub: any, dis?: any) => `<button class="lrow" id="${id}" ${dis ? 'disabled' : ''}><i aria-hidden="true">${ico}</i><span><b>${t}</b><small>${sub}</small></span></button>`;
  const tile = (id: any, k: any, t: any, sub: any, badge?: any) => `<button class="tile" id="${id}"><i aria-hidden="true">${svg(k)}</i>${badge ? `<em class="bdg" aria-label="${badge} ${badge === 1 ? 'pendiente' : 'pendientes'}">${badge}</em>` : ''}<span><b>${t}</b><small>${sub}</small></span></button>`;
  app.innerHTML = `
  <div class="hhead"><div><h1 id="hola">${esc(saludo())}</h1>
    <div class="hsub">${dd !== null ? `<b>${dd} ${dd === 1 ? 'día' : 'días'}</b> hasta tu fecha objetivo · <a href="#/settings">Cambiar fecha</a>` : '<a href="#/settings">Configurar fecha objetivo</a>'} · ${seen} de ${idx.n.toLocaleString("es-ES")} preguntas vistas${streak >= 2 ? ` · racha de ${streak} días` : ''}</div></div>
    <button class="iconbtn" id="menu" aria-label="Menú" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>
  <div class="hbar" role="img" aria-label="${pct(seen, idx.n)} % de las preguntas vistas"><i style="--from:0%;width:${Math.max(2, Math.min(100, pct(seen, idx.n)))}%"></i></div>
  ${state.run ? `<button class="cta" id="continue"><span><b>Continuar sesión</b><small>${esc(state.run.titulo || 'Práctica en curso')} · pregunta ${state.run.idx + 1} de ${state.run.items.length}</small></span>${svg('play')}</button>` : ''}
  ${full ? `<div class="study-priorities">${row('rev', svg('redo'), 'Repasar hoy', due ? `${due} ${due === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}` : 'No hay preguntas pendientes hoy', !due)}${row('falladas', svg('redo'), 'Preguntas falladas', nFall ? `${nFall} ${nFall === 1 ? 'pregunta por afianzar' : 'preguntas por afianzar'} · tres aciertos seguidos` : 'No hay preguntas falladas', !nFall)}</div>` : ''}
  ${!n ? '<p class="note">Empieza con una sesión rápida; después marca los temas que hayas estudiado y consulta tu progreso.</p>' : ''}
  <button class="cta" id="quick"><span><b class="ctt">Sesión rápida</b><small>${!full ? '5 min · una pregunta de cada tema, distintas cada vez' : `5 min · ${quickN(st)} preguntas: ${due ? 'tus repasos pendientes (' + due + ') y ' : ''}nuevas de tus temas más débiles`}</small></span><i class="play" aria-hidden="true">${svg('play')}</i></button>
  ${full ? `<div class="tiles">
    ${tile('test', 'test', 'Test', 'por tema')}${tile('sim', 'sim', 'Simulacros', 'con tiempo')}${tile('cards', 'card', 'Tarjetas', nCards ? nCards + (nCards === 1 ? ' pendiente' : ' pendientes') : 'repaso', nCards || '')}
  </div>
  <details class="training-group"><summary>Entrenamientos</summary><div class="tiles">
    ${tile('trampas', 'det', 'Detective', 'de trampas')}${tile('lectura', 'lec', 'Lectura', vel.n ? vel.n + ' por velocidad' : 'atenta')}${tile('relam', 'rel', 'Relámpago', 'una pregunta')}
  </div></details>
  <div class="lgroup seg2">
    ${row('mapa', svg('map'), 'Mapa de dominio', (() => { const dm = dominioTemas(idx), c = (k: any) => dm.filter((x: any) => x.est === k).length; return c('r') + c('y') + c('g') ? `${c('r')} por reforzar · ${c('g')} dominados` : 'Aparecerá cuando empieces a contestar'; })())}
    ${row('temario', svg('list'), 'Temas estudiados', store.getSeen().length ? store.getSeen().length + ' de ' + idx.temas.length : 'Marca lo que ya has estudiado')}
  </div>
` : `<div class="card guest" id="guest"></div>`}
<div id="syncnote"></div>`;
  // el aviso de cuenta se decide cuando Firebase ya ha arrancado (antes mostraba «no configurado» un instante al abrir)
  const paintNote = () => {
    const el = $('#syncnote'); if (!el) return; const stt = sync.status.state;
    const pend = sync.status.access === 'propietario' && sync.status.reqs.length;
    el.innerHTML = pend ? `<div class="note"><a href="#/acceso">${pend} ${pend === 1 ? 'persona pide' : 'personas piden'} acceso a la app</a></div>`
      : !full ? '' : stt === 'sin sesión' ? '<div class="note">Inicia sesión en <a href="#/settings">Ajustes</a> para sincronizar iPhone e iPad.</div>'
      : stt === 'sin configurar' ? '<div class="note">Firebase aún no está configurado: el progreso se guarda solo en este dispositivo.</div>' : '';
    const g = $('#guest'); if (!g) return;
    const u = sync.status.user, lvl = accessLevel();
    g.innerHTML = `<h2 class="h3">${!u ? 'Sesión sin iniciar' : lvl === 'pendiente' ? 'Acceso pendiente' : 'Solicita acceso completo'}</h2>
      <p>Sin acceso completo solo puedes hacer la sesión rápida de 5 minutos. El resto (test por tema, simulacros, tarjetas, estadísticas…) lo desbloquea el propietario de la app.</p>
      ${!u ? (sync.status.configured || stt === 'iniciando' || stt === 'comprobando sesión…' ? '<button class="btn" id="gin">Entrar con Google</button>' : '')
        : lvl === 'pendiente' ? '<p><b>Solicitud enviada.</b> Cuando se apruebe se desbloqueará todo; esta pantalla se actualiza sola.</p>'
        : '<button class="btn" id="greq">Pedir acceso completo</button>'}`;
    $('#gin') && ($('#gin').onclick = () => sync.login());
    $('#greq') && ($<El>('#greq').onclick = async e => { (e.target as El).disabled = true; (e.target as El).textContent = 'Enviando…'; if (!(await sync.requestAccess())) { paintNote(); toast('No se pudo enviar la solicitud. Inténtalo de nuevo.'); } });
  };
  const paintHola = () => { const h = $('#hola'); if (h) h.textContent = saludo(); };
  paintNote(); screen.cleanup = sync.onStatus(() => { paintNote(); paintHola(); });
  $('#continue') && ($('#continue').onclick = () => go('#/quiz'));
  $('#quick').onclick = guard(() => quickSession());
  $('#rev') && ($('#rev').onclick = guard(startRepaso));
  $('#cards') && ($('#cards').onclick = () => go('#/cards'));
  $('#lectura') && ($('#lectura').onclick = () => go('#/lectura'));
  $('#trampas') && ($('#trampas').onclick = () => go('#/trampas'));
  $('#relam') && ($('#relam').onclick = () => go('#/relampago'));
  $('#mapa') && ($('#mapa').onclick = () => go('#/stats'));
  $('#temario') && ($('#temario').onclick = () => go('#/temario'));
  $('#falladas') && ($('#falladas').onclick = () => go('#/falladas'));
  $('#test') && ($('#test').onclick = () => go('#/test'));
  $('#sim') && ($('#sim').onclick = () => go('#/sim'));
  $('#menu').onclick = () => openMenu();
};


// ───────── temas vistos ─────────
routes.temario = async function () {
  const account = store.accountId();
  const idx = await getIndex(); await getMeta();
  if (account !== store.accountId()) return;
  let query = '';
  const open = new Set<string>(BLOQUES.map(([b]) => b));
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const draw = () => {
    const sel = new Set(store.getSeen());
    const visible = idx.temas.filter(t => normalize(t.id + ' ' + t.nombre).includes(normalize(query.trim())));
    const tstat = (t: string, n: number) => { let v = 0, ok = 0, tot = 0; for (const id of META._by[t] || []) { const r = store.rec(id); if (r) { v++; ok += r[1]; tot += r[0]; } } return `${v}/${n} preguntas contestadas${tot ? ' · ' + pct(ok, tot) + '% de acierto' : ''}`; };
    app.innerHTML = `<h1>Temas vistos</h1>
    <p class="sub">Marca los temas que ya has estudiado. Tus marcas seleccionan el temario disponible en simulacros y en «mis temas vistos». Las preguntas contestadas se cuentan aparte: contestar una pregunta no marca el tema como estudiado.</p>
    <div class="selection-summary" role="status">${sel.size} de ${idx.temas.length} temas estudiados · ${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'}</div>
    <label class="field" for="topic-search">Buscar tema por nombre o código</label><input id="topic-search" type="search" value="${esc(query)}" placeholder="Ej. redes o T1.01" autocomplete="off">
    <div class="row"><button class="btn sec" id="all">Marcar todos los temas</button><button class="btn sec" id="none">Quitar todas las marcas</button></div>
    <div class="card">${BLOQUES.map(([b, nom]) => { const ts = visible.filter(t => t.id.startsWith(b)); if (!ts.length) return ''; return `<details class="bl topic-block" data-block="${b}" ${open.has(b) || query ? 'open' : ''}><summary>${nom} · ${ts.filter(t => sel.has(t.id)).length}/${ts.length} estudiados</summary><button class="ghost sm" data-b="${b}">${ts.every(t => sel.has(t.id)) ? 'Desmarcar' : 'Marcar'} temas ${query ? 'filtrados de este bloque' : 'del bloque'}</button>
    ${ts.map(t => `<label class="tm ${sel.has(t.id) ? 'on' : ''}"><input type="checkbox" data-t="${t.id}" ${sel.has(t.id) ? 'checked' : ''}><span><b>${t.id}</b> ${esc(t.nombre)}</span><small>${tstat(t.id, t.n)}</small></label>`).join('')}</details>`; }).join('') || '<p class="sub">No hay temas que coincidan con la búsqueda.</p>'}</div>
    <div class="bar2"><button class="btn" id="sim">Ir al simulacro</button></div>`;
    $('#topic-search').oninput = e => { query = (e.target as El).value; redraw('#topic-search'); };
    app.querySelectorAll<HTMLDetailsElement>('[data-block]').forEach(d => d.ontoggle = () => { if (!d.isConnected) return; d.open ? open.add(d.dataset.block!) : open.delete(d.dataset.block!); });
    app.querySelectorAll<El>('[data-t]').forEach(c => c.onchange = () => { const x = new Set(store.getSeen()); c.checked ? x.add(c.dataset.t!) : x.delete(c.dataset.t!); store.setSeen([...x]); });
    app.querySelectorAll<El>('[data-b]').forEach(b => b.onclick = () => { const ids = visible.filter(t => t.id.startsWith(b.dataset.b!)).map(t => t.id); const x = new Set(store.getSeen()); const all = ids.every(i => x.has(i)); ids.forEach(i => all ? x.delete(i) : x.add(i)); store.setSeen([...x]); });
    $('#all').onclick = () => store.setSeen(idx.temas.map(t => t.id));
    $('#none').onclick = () => store.setSeen([]);
    $('#sim').onclick = () => go('#/sim');
  };
  const redraw = (focusSelector?: string) => {
    const active = document.activeElement as HTMLElement | null;
    const focus = focusSelector || (active?.dataset.t ? `[data-t="${active.dataset.t}"]` : active?.dataset.b ? `[data-b="${active.dataset.b}"]` : active?.id ? '#' + active.id : '');
    app.querySelectorAll<HTMLDetailsElement>('[data-block]').forEach(d => { d.open ? open.add(d.dataset.block!) : open.delete(d.dataset.block!); });
    const y = window.scrollY; draw();
    if (focus) app.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
    window.scrollTo(0, y);
  };
  let sig = store.getSeen().join();
  screen.cleanup = store.onChange(() => { if (account !== store.accountId()) return; const n = store.getSeen().join(); if (n !== sig) { sig = n; redraw(); } });
  draw();
};




}
