import * as sync from '../syncfacade.js';
import * as store from '../store.js';
import { esc, pct, quickN, velocidad } from '../logic.js';
import { META, getIndex, getMeta, now, dueList } from '../data.js';
import { $, app, guard } from '../ui.js';
import { BLOQUES } from '../labels.js';
export function registerHome({ routes, go, saludo, quickSession, startRepaso, openMenu, dominioTemas, falladasIds }, screen) {
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
  const nFall = falladasIds().length;
  const IC = { test: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>', sim: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9.5 3h5"/>', card: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M7 3h10"/>', det: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>', lec: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', rel: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', map: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', play: '<path d="M8 5v14l11-7z"/>', redo: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>' };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
  const row = (id, ico, t, sub, dis) => `<button class="lrow" id="${id}" ${dis ? 'disabled' : ''}><i aria-hidden="true">${ico}</i><span><b>${t}</b><small>${sub}</small></span></button>`;
  const tile = (id, k, t, sub, badge) => `<button class="tile" id="${id}"><i aria-hidden="true">${svg(k)}</i>${badge ? `<em class="bdg" aria-label="${badge} pendientes">${badge}</em>` : ''}<span><b>${t}</b><small>${sub}</small></span></button>`;
  app.innerHTML = `
  <div class="hhead"><div><h1 id="hola">${esc(saludo())}</h1>
    <div class="hsub"><b>${dd > 0 ? dd : 0} días</b> al examen · ${seen} de ${idx.n.toLocaleString("es-ES")} vistas${streak >= 2 ? ` · racha de ${streak} días` : ''}</div></div>
    <button class="iconbtn" id="menu" aria-label="Menú" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>
  <div class="hbar" role="img" aria-label="${pct(seen, idx.n)} % de las preguntas vistas"><i style="--from:0%;width:${Math.max(2, Math.min(100, pct(seen, idx.n)))}%"></i></div>
  <button class="cta" id="quick"><span><b class="ctt">Sesión rápida</b><small>5 min · ${quickN(st)} preguntas: ${due ? 'tus repasos pendientes (' + due + ') y ' : ''}nuevas de tus temas más débiles</small></span><i class="play" aria-hidden="true">${svg('play')}</i></button>
  ${due ? `<button class="repaso" id="rev"><i aria-hidden="true">${svg('redo')}</i><span><b>Repaso de fallos</b><small>${due} preguntas pendientes hoy</small></span></button>` : ''}
  <div class="tiles">
    ${tile('test', 'test', 'Test', 'por tema')}${tile('sim', 'sim', 'Simulacros', 'con tiempo')}${tile('cards', 'card', 'Tarjetas', nCards ? nCards + ' vencen' : 'repaso', nCards || '')}
    ${tile('trampas', 'det', 'Detective', 'de trampas')}${tile('lectura', 'lec', 'Lectura', vel.n ? vel.n + ' por velocidad' : 'atenta')}${tile('relam', 'rel', 'Relámpago', 'una pregunta')}
  </div>
  <div class="lgroup seg2">
    ${row('mapa', svg('map'), 'Mapa de dominio', (() => { const dm = dominioTemas(idx), c = k => dm.filter(x => x.est === k).length; return c('r') + c('y') + c('g') ? `${c('r')} por reforzar · ${c('g')} dominados` : 'Aparecerá cuando empieces a contestar'; })())}
    ${nFall ? row('falladas', svg('redo'), 'Preguntas falladas', nFall + ' para buscar y releer') : ''}
    ${row('temario', svg('list'), 'Temas vistos', store.getSeen().length ? store.getSeen().length + ' de ' + idx.temas.length : 'Marca lo que ya has estudiado')}
  </div>
<div id="syncnote"></div>`;
  // el aviso de cuenta se decide cuando Firebase ya ha arrancado (antes mostraba «no configurado» un instante al abrir)
  const paintNote = () => {
    const el = $('#syncnote'); if (!el) return; const st = sync.status.state;
    el.innerHTML = st === 'sin sesión' ? '<div class="note">Inicia sesión en <a href="#/settings">Ajustes</a> para sincronizar iPhone e iPad.</div>'
      : st === 'sin configurar' ? '<div class="note">Firebase aún no está configurado: el progreso se guarda solo en este dispositivo.</div>' : '';
  };
  const paintHola = () => { const h = $('#hola'); if (h) h.textContent = saludo(); };
  paintNote(); screen.cleanup = sync.onStatus(() => { paintNote(); paintHola(); });
  $('#quick').onclick = guard(() => quickSession());
  $('#rev') && ($('#rev').onclick = guard(startRepaso));
  $('#cards').onclick = () => go('#/cards');
  $('#lectura').onclick = () => go('#/lectura');
  $('#trampas').onclick = () => go('#/trampas');
  $('#relam').onclick = () => go('#/relampago');
  $('#mapa').onclick = () => go('#/stats');
  $('#temario').onclick = () => go('#/temario');
  $('#falladas') && ($('#falladas').onclick = () => go('#/falladas'));
  $('#test').onclick = () => go('#/test');
  $('#sim').onclick = () => go('#/sim');
  $('#menu').onclick = () => openMenu();
};


// ───────── temas vistos ─────────
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
  screen.cleanup = store.onChange(() => { const n = store.getSeen().join(); if (n !== sig) { sig = n; const y = window.scrollY; draw(); window.scrollTo(0, y); } });
  draw();
};




}
