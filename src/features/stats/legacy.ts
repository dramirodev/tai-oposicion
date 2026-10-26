import * as store from '../../adapters/local/legacy-store.js';
import { esc, shuffle, fmtT, pct, dominioCalc, aggregateWeeks, slowList, simHistory, compareSessions, MOTIVOS_FALLO, cargaRepasos, motivosFallo, suertes, velocidad, CONSEJOS_LECTURA } from '../../legacy/logic.js';
import { META, getIndex, getMeta, now, byIds } from '../../adapters/http/legacy-data.js';
import { $, legacyScope, L, toast, type El } from '../../shared/ui/legacy-dom.js';
import { helpIconLink } from '../../shared/ui/help-icon-link.js';
import { falladasIds }  from '../../core/application/legacy-engine.js';
import { ORIGEN, TRAMPAS, TIPOS } from '../../shared/presentation/labels.js';
import { mountQuestionEvolution } from './question-evolution-view.js';
export function registerStats({ routes, go, trapTest, startRun, startRepaso, dominioTemas, getStrategyReport, renderStrategyReport, loadQuestionEvolution }: any) {
// ───────── mapa de dominio ─────────
// Estado por tema a partir de: precisión actual (último resultado de cada pregunta vista),
// cobertura (vistas / banco, con objetivo del 60 %) y frescura (días desde la última vez).
const ESTADO: Record<string, string> = { g: 'Dominado', y: 'A vigilar', r: 'Reforzar', n: 'Sin datos' };
const hace = (d: any) => d === null ? '—' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`;
function mapaHTML(dm: any, orden: any) {
  const ord: Record<string, number> = { r: 0, y: 1, g: 2, n: 3 };
  const l = dm.slice();
  if (orden === 'frios') l.sort((a: any, b: any) => (ord[a.est] - ord[b.est]) || ((b.dias ?? -1) - (a.dias ?? -1)));
  const c = (k: any) => dm.filter((x: any) => x.est === k).length;
  return `<div class="dmsum">${[['r','Reforzar'],['y','A vigilar'],['g','Dominado'],['n','Sin datos']].map(([state,label]) => `<span class="domain-key"><span class="dot ${state}" aria-hidden="true"></span>${c(state)} ${label}</span>`).join('')}</div>
  <div class="seg" id="dmord"><button class="${orden !== 'frios' ? 'on' : ''}" data-v="tema" aria-pressed="${orden !== 'frios'}">Por tema</button><button class="${orden === 'frios' ? 'on' : ''}" data-v="frios" aria-pressed="${orden === 'frios'}">Más urgentes primero</button></div>
  <div class="dm">${l.map((t: any) => `<button class="dmt ${t.est}" data-dt="${t.id}"><div class="dmh"><span class="dot ${t.est}"></span><b>${t.id}</b><small>${hace(t.dias)}</small></div><div class="dmn">${esc(t.nombre)}</div><div class="dmb"><i style="width:${t.score}%"></i></div><small>${ESTADO[t.est]} · ${esc(t.why)}${t.due ? ' · ' + t.due + ' repasos' : ''}</small></button>`).join('')}</div>
  <p class="legend">Rojo: precisión o cobertura bajas, o más de 30 días sin tocar. Ámbar: va bien pero falta práctica o lleva más de 2 semanas parado. Verde: precisión alta y reciente. La puntuación mezcla tu acierto actual (65 %) y las preguntas vistas respecto al 60 % del banco (35 %). Toca un tema para practicarlo.</p>`;
}
function bindMapa(root: El, dm: any, redraw: any) {
  root.querySelectorAll<El>('[data-dt]').forEach((b: any) => b.onclick = () => {
    const c = store.getCfg().test || { n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] };
    store.setCfg('test', { sel: [b.dataset.dt!], n: c.n || 15, mode: 'nuevas', o: c.o || ['O', 'A', 'G'] });
    go('#/test');
  });
  const o = root.querySelector<El>('#dmord'); if (o) o.onclick = (e: any) => { if ((e.target as El).dataset.v!) { const value = (e.target as El).dataset.v!; store.setCfg('dmord', value); redraw(); root.querySelector<HTMLElement>(`#dmord [data-v="${value}"]`)?.focus({ preventScroll: true }); } };
}



// ───────── historial de simulacros ─────────
function paintSims() {
  const el = $('#sims'); if (!el) return;
  const H = simHistory(store.getSessions());
  if (!H.length) { el.innerHTML = '<div class="card"><p class="sub">Aún no has hecho ningún simulacro. Cuando lo hagas verás aquí tu nota por intento y podrás comparar dos.</p></div>'; return; }
  const c = store.getCfg().simc || {};
  const P1 = H.filter(h => h.part === 'p1');
  const fmtD = (t: any) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const dlt = (d: any, u = '', menosEsMejor = false) => d === null ? '' : `<span class="${d === 0 ? '' : (d > 0) !== menosEsMejor ? 'g' : 'r'}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${d}${u}</span>`;
  let chart = '';
  if (P1.length) {
    const Wd = 340, Ht = 150, L0 = 34, R0 = 14, T0 = 14, B0 = 24, iw = Wd - L0 - R0, ih = Ht - T0 - B0;
    const vals = P1.map(h => h.nota), lo = Math.min(0, Math.floor(Math.min(...vals) / 10) * 10), hi = 100;
    const X = (i: any) => L0 + (P1.length === 1 ? iw / 2 : iw * i / (P1.length - 1)), Y = (v: any) => T0 + ih * (1 - (v - lo) / (hi - lo));
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
    const opt = (sel: any) => P1.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${fmtD(h.ts)} · ${esc(String(h.nota))}</option>`).join('');
    const C = compareSessions(P1[ia], P1[ib]);
    cmp = `<div class="row"><select id="sca" aria-label="Intento A">${opt(ia)}</select><select id="scb" aria-label="Intento B">${opt(ib)}</select></div>
      <p class="sm">Nota: <b>${dlt(C.dNota)}</b> · acierto ${dlt(C.dAcierto, ' pts')}${C.dSeg !== null ? ' · ritmo ' + dlt(C.dSeg, ' s/preg.', true) : ''}</p>
      <div class="table-scroll" role="region" aria-label="Tabla de progreso" tabindex="0"><table class="tb"><caption>Comparación de los intentos A y B por tema</caption><tr><th scope="col">Tema</th><th scope="col">A</th><th scope="col">B</th><th scope="col">Δ</th></tr>${C.rows.map(r => `<tr><td>${r.t}</td><td>${r.pa ?? '—'}</td><td>${r.pb ?? '—'}</td><td>${r.d === null ? '' : dlt(r.d)}</td></tr>`).join('')}</table></div>
      <p class="legend">A es el intento de la izquierda y B el de la derecha; Δ en puntos de acierto por tema.</p>`;
  }
  el.innerHTML = `<div class="card">${chart}<p class="legend">Nota de la parte 1 por intento (sobre 100).</p><h2 class="h3">Últimos intentos</h2>${rows}<h2 class="h3">Comparar dos intentos</h2>${cmp}</div>`;
  const sa = $('#sca'), sb = $('#scb');
  if (sa) sa.onchange = sb.onchange = () => { store.setCfg('simc', { a: +sa.value, b: +sb.value }); paintSims(); };
}

// ───────── evolución y preguntas lentas ─────────
function paintEvo(bankIndex: any) {
  const el = $('#evo'); if (!el) return;
  const c = Object.assign({ m: 'acierto', f: 'g', w: 12, tabla: false }, store.getCfg().evo || {});
  const save = () => store.setCfg('evo', c);
  const tipos = Object.keys(TIPOS);
  const opts = `<option value="g" ${c.f === 'g' ? 'selected' : ''}>Todo el temario</option>
    <optgroup label="Por tipo de pregunta">${tipos.map(k => `<option value="k:${k}" ${c.f === 'k:' + k ? 'selected' : ''}>${esc(TIPOS[k])}</option>`).join('')}</optgroup>
    <optgroup label="Por tema">${bankIndex.temas.map((t: any) => `<option value="t:${t.id}" ${c.f === 't:' + t.id ? 'selected' : ''}>${t.id} ${esc(t.nombre)}</option>`).join('')}</optgroup>`;
  const filt = c.m === 'tiempo' || c.f === 'g' ? {} : c.f.startsWith('t:') ? { tema: c.f.slice(2) } : { tipo: c.f.slice(2) };
  const W = aggregateWeeks(store.getSessions(), { ...filt, weeks: c.w });
  const key = c.m === 'tiempo' ? 'segPreg' : 'acierto';
  const pts = W.map((w, i) => ({ i, v: w[key], w })).filter(p => p.v !== null);
  const fmtD = (t: any) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const unit = c.m === 'tiempo' ? ' s' : ' %';
  let chart;
  if (!pts.length) chart = `<p class="sub">Aún no hay sesiones en este periodo${c.m !== 'tiempo' && c.f !== 'g' ? ' para este filtro (los tipos solo se guardan en sesiones nuevas)' : ''}.</p>`;
  else {
    const Wd = 340, H = 170, L = 34, R = 12, T = 14, B = 26, iw = Wd - L - R, ih = H - T - B;
    const max = c.m === 'tiempo' ? Math.max(10, Math.ceil(Math.max(...pts.map(p => p.v as number)) / 10) * 10) : 100;
    const X = (i: any) => L + (W.length === 1 ? iw / 2 : iw * i / (W.length - 1)), Y = (v: any) => T + ih * (1 - v / max);
    const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${Wd - R}" y1="${Y(max * f)}" y2="${Y(max * f)}" class="gl"/><text x="${L - 6}" y="${Y(max * f) + 4}" text-anchor="end" class="gt">${Math.round(max * f)}</text>`).join('');
    const line = pts.length > 1 ? `<polyline points="${pts.map(p => X(p.i) + ',' + Y(p.v)).join(' ')}" class="ln"/>` : '';
    const dots = pts.map(p => `<circle cx="${X(p.i)}" cy="${Y(p.v)}" r="4.5" class="pt"/>`).join('');
    const last = pts[pts.length - 1];
    const lab = `<text x="${Math.min(X(last.i), Wd - R - 2)}" y="${Y(last.v) - 9}" text-anchor="end" class="vl">${last.v}${unit.trim()}</text>`;
    const step = Math.ceil(W.length / 6);
    const xt = W.map((w, i) => i % step === (W.length - 1) % step ? `<text x="${X(i)}" y="${H - 6}" text-anchor="${i === W.length - 1 ? 'end' : 'middle'}" class="gt">${fmtD(w.start)}</text>` : '').join('');
    const cols = W.map((w, i) => `<rect x="${X(i) - iw / W.length / 2}" y="${T}" width="${iw / W.length}" height="${ih}" class="evolution-hit" data-i="${i}" tabindex="0" role="img" aria-label="Semana del ${fmtD(w.start)}: ${w.n ? (c.m === 'tiempo' ? (w.segPreg ?? '—') + ' s por pregunta' : w.acierto + ' % de acierto') : 'sin datos'}"/>`).join('');
    chart = `<div class="evo"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Evolución semanal">${grid}${line}${dots}${lab}${xt}${cols}</svg><div class="tip" id="tip" hidden></div></div>`;
  }
  const tabla = c.tabla ? `<div class="table-scroll" role="region" aria-label="Tabla de progreso" tabindex="0"><table class="tb"><caption>Evolución semanal: ${c.m === 'tiempo' ? 'tiempo por pregunta' : 'acierto'}</caption><tr><th scope="col">Semana</th><th scope="col">${c.m === 'tiempo' ? 'seg/preg.' : 'Acierto'}</th><th scope="col">Resp.</th></tr>${W.filter(w => w.n).map(w => `<tr><td>${fmtD(w.start)}</td><td>${w[key] ?? '—'}</td><td>${esc(String(w.n))}</td></tr>`).join('') || '<tr><td colspan="3">Sin datos</td></tr>'}</table></div>` : '';
  el.innerHTML = `<div class="card">
    <div class="seg" id="evm"><button class="${c.m !== 'tiempo' ? 'on' : ''}" data-v="acierto" aria-pressed="${c.m !== 'tiempo'}">Acierto</button><button class="${c.m === 'tiempo' ? 'on' : ''}" data-v="tiempo" aria-pressed="${c.m === 'tiempo'}">Tiempo por pregunta</button></div>
    <div class="row"><select id="evf" aria-label="Qué medir en la evolución" ${c.m === 'tiempo' ? 'disabled' : ''}>${opts}</select><select id="evw" aria-label="Número de semanas">${[8, 12, 26].map(v => `<option value="${v}" ${c.w === v ? 'selected' : ''}>${v} semanas</option>`).join('')}</select></div>
    ${chart}
    <p class="legend">${c.m === 'tiempo' ? 'Segundos medios por pregunta en tus sesiones (sin contar pausas).' : 'Porcentaje de aciertos por semana, sobre las preguntas contestadas en esa semana.'} <button class="ghost sm" id="evt" aria-expanded="${!!c.tabla}">${c.tabla ? 'Ocultar tabla' : 'Ver tabla'}</button></p>${tabla}</div>`;
  $('#evm').onclick = e => { const mode = (e.target as El).dataset.v; if (mode === 'acierto' || mode === 'tiempo') { c.m = mode; save(); paintEvo(bankIndex); $(`#evm [data-v="${c.m}"]`).focus({ preventScroll: true }); } };
  $<El>('#evf').onchange = e => { c.f = (e.target as El).value; save(); paintEvo(bankIndex); $('#evf').focus({ preventScroll: true }); };
  $<El>('#evw').onchange = e => { c.w = +(e.target as El).value; save(); paintEvo(bankIndex); $('#evw').focus({ preventScroll: true }); };
  $('#evt').onclick = () => { c.tabla = !c.tabla; save(); paintEvo(bankIndex); $('#evt').focus({ preventScroll: true }); };
  const tip = $('#tip');
  el.querySelectorAll<El>('.evolution-hit').forEach(r => {
    const show = () => { const w = W[+r.dataset.i!]; if (!w.n) { tip.hidden = true; return; } tip.hidden = false; tip.innerHTML = `<b>Semana del ${fmtD(w.start)}</b><br>${c.m === 'tiempo' ? (w.segPreg ?? '—') + ' s/pregunta' : w.acierto + ' % de acierto'}<br>${esc(String(w.n))} respuestas · ${esc(String(w.ses))} sesiones`; tip.style.left = Math.min(Math.max(8, 100 * (+r.dataset.i!) / Math.max(1, W.length - 1)), 70) + '%'; };
    r.onpointerenter = show; r.onpointerdown = show; r.onfocus = show;
  });
}
async function paintSlow() {
  const account = store.accountId();
  const el = $('#slow'); if (!el) return;
  const c = Object.assign({ ok: false }, store.getCfg().slow || {});
  const L = slowList(store.getStats(), { soloAcertadas: c.ok, limit: 15 });
  if (!L.length) { el.innerHTML = `<div class="card"><p class="sub">Aún no hay tiempos guardados. Se registran desde ahora, al contestar cada pregunta.</p></div>`; return; }
  const items = await byIds(L.map(x => x.id));
  if (account !== store.accountId() || !el.isConnected || $('#slow') !== el) return;
  const by = new Map(items.map(q => [q.i, q]));
  el.innerHTML = `<div class="card"><div class="seg" id="slf"><button class="${!c.ok ? 'on' : ''}" data-v="0" aria-pressed="${!c.ok}">Todas</button><button class="${c.ok ? 'on' : ''}" data-v="1" aria-pressed="${!!c.ok}">Las que aciertas</button></div>
    <p class="legend">Las que más tardas en contestar. Si las aciertas pero tardas mucho, probablemente aún no las dominas.</p>
    ${L.map(x => { const q = by.get(x.id); return `<div class="sl"><div class="slh"><b>${Math.round(x.avg)} s</b><small>${esc(q ? q.t : '')} · ${x.ok}/${x.n} aciertos${x.last === 1 ? ' · última ✓' : x.last === 0 ? ' · última ✗' : ''}</small></div><div class="sm">${esc(q ? q.q.slice(0, 140) + (q.q.length > 140 ? '…' : '') : x.id)}</div></div>`; }).join('')}
    <div class="row"><button class="btn" id="slgo">Practicar estas ${L.length}</button></div></div>`;
  $('#slf').onclick = e => { if ((e.target as El).dataset.v! !== undefined) { c.ok = (e.target as El).dataset.v! === '1'; store.setCfg('slow', c); paintSlow(); } };
  $('#slgo').onclick = () => startRun({ kind: 'test', feedback: true, items: shuffle(L.map(x => by.get(x.id)).filter(Boolean)), titulo: 'Preguntas lentas' });
}

// ───────── estadísticas ─────────
routes.stats = async function () {
  const { app, $, screen: routeScreen } = legacyScope();
  const account = store.accountId();
  const bankIndex = await getIndex(); await getMeta();
  if (account !== store.accountId()) return;
  const questionStats = store.getStats();
  const T: Record<string, number[]> = {}, TR: Record<string, number[]> = {}, OR: Record<string, number[]> = {}, TI: Record<string, number[]> = {};
  let n = 0, ok = 0;
  for (const id in questionStats) {
    const r = questionStats[id], m = META[id]; if (!m) continue;
    n += r[0]; ok += r[1];
    const err = r[0] - r[1];
    const a = T[m[0]] ||= [0, 0, 0]; a[0] += r[0]; a[1] += r[1]; a[2]++;
    (OR[m[1]] ||= [0, 0])[0] += r[0]; OR[m[1]][1] += r[1];
    if (m[2]) { (TI[m[2]] ||= [0, 0])[0] += r[0]; TI[m[2]][1] += r[1]; }
    for (const x of m[3]) { const b = TR[x] ||= [0, 0]; b[0] += r[0]; b[1] += err; }
  }
  const bar = (v: any, w = 100) => `<div class="bar"><i style="width:${v}%" class="${v >= 75 ? 'g' : v >= 50 ? 'y' : 'r'}"></i></div>`;
  const temas = bankIndex.temas.map(t => { const a = T[t.id] || [0, 0, 0]; return { ...t, int: a[0], ok: a[1], seen: a[2], p: pct(a[1], a[0]) }; });
  const weak = temas.filter(t => t.int >= 8).sort((a, b) => a.p - b.p).slice(0, 5);
  const ses = store.getSessions().slice(0, 12);
  const carga = cargaRepasos(questionStats, now(), 14), mx = Math.max(1, ...carga), mf = motivosFallo(questionStats), mft = mf.reduce((a, b) => a + b, 0);
  const diaL = (k: any) => { const d = new Date(now()); d.setDate(d.getDate() + k); return k === 0 ? 'hoy' : ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()] + d.getDate(); };
  const cargaHTML = `<div class="card"><div class="chart-scroll" role="region" aria-label="Repasos previstos en los próximos 14 días" tabindex="0"><div class="cg">${carga.map((v, k) => `<div class="cgc" title="${v} repasos"><small>${v || ''}</small><i class="${k === 0 && v ? 'hoy' : ''}" style="height:${Math.round(60 * v / mx)}px"></i><small>${diaL(k)}</small></div>`).join('')}</div></div>
    <p class="legend">Preguntas que vencen cada día (hoy incluye las atrasadas). Total en 14 días: ${carga.reduce((a, b) => a + b, 0)}.</p>
    ${mft ? `<h2 class="h3">Por qué fallas (último fallo)${helpIconLink('motivos', 'Ayuda sobre los motivos del fallo')}</h2>${[5, 7, 1, 2, 3, 4].map(m => `<div class="line"><span>${MOTIVOS_FALLO[m]}</span><span>${mf[m]} <small>(${pct(mf[m], mft)}%)</small></span></div>`).join('')}` : ''}
    ${suertes(questionStats) ? `<div class="line"><span>🍀 Aciertos por suerte (pendientes de repasar)</span><span>${suertes(questionStats)}</span></div>` : ''}</div>`;
  const paintMapa = () => { const dm = dominioTemas(bankIndex); const el = $('#mapa'); el.innerHTML = mapaHTML(dm, store.getCfg().dmord); bindMapa(el, dm, paintMapa); };
  app.innerHTML = `
  <h1>Progreso</h1>
  <section id="stats-summary" class="card" aria-label="Resumen de estudio"><h2 class="h3">Tu siguiente paso</h2>
    <p>${n ? `${n} ${n === 1 ? 'respuesta registrada' : 'respuestas registradas'} · ${pct(ok, n)}% de acierto.` : 'Empieza una sesión para descubrir qué temas necesitas reforzar.'} ${weak.length ? `Refuerza ${weak.map(t => t.id).join(', ')}.` : 'El mapa mostrará las prioridades a medida que practiques.'}</p>
    <div class="row"><button class="btn" id="progress-review" ${carga[0] ? '' : 'disabled'}>Repasar hoy · ${carga[0]}</button><button class="btn sec" id="progress-failures">Preguntas falladas · ${falladasIds().length}</button><button class="btn sec" id="progress-test">Practicar temas</button></div>
  </section>
  <div class="seg stats-sections" role="group" aria-label="Sección de progreso">${[['temas','Temas'],['sims','Simulacros'],['evo','Evolución']].map(([k,v]) => `<button data-stats-view="${k}" aria-controls="stats-${k}" aria-pressed="${k === 'temas'}" class="${k === 'temas' ? 'on' : ''}">${v}</button>`).join('')}</div>
  <section id="stats-temas" aria-label="Progreso por temas">
  <h2 class="domain-heading">Mapa de dominio</h2><div id="mapa"></div>
  <div id="vel"></div>
  <h2>Carga de repasos</h2><div id="carga"></div>
  <div class="grid"><div class="stat"><b>${n}</b><span>${n === 1 ? 'respuesta' : 'respuestas'}</span></div><div class="stat"><b>${pct(ok, n)}%</b><span>acierto</span></div></div>
  ${weak.length ? `<h2>Para reforzar</h2><div class="card">${weak.map(t => `<div class="line"><span><b>${t.id}</b> ${esc(t.nombre)}</span><span class="r">${t.p}%</span></div>`).join('')}</div>` : ''}
  <h2>Por tema</h2><div class="card">${temas.map(t => `<div class="trow"><div class="line"><span><b>${t.id}</b> ${esc(t.nombre)}</span><span>${t.int ? t.p + '%' : '—'}</span></div>${bar(t.int ? t.p : 0)}<small>${t.seen}/${t.n} vistas · ${t.int} respuestas</small></div>`).join('')}</div>
  <h2>Errores por tipo de trampa</h2><div class="card">${Object.entries(TR).filter(([, v]) => v[0] >= 5).sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0]).map(([k, v]) => `<div class="trow"><div class="line"><span>${esc(TRAMPAS[k] || k)}</span><span>${pct(v[1], v[0])}% fallos <small>(${v[0]})</small> <button class="ghost sm" data-trap="${k}">practicar</button></span></div>${bar(100 - pct(v[1], v[0]))}</div>`).join('') || '<p class="sub">Aún no hay datos suficientes (se necesitan ≥5 respuestas por trampa).</p>'}</div>
  <h2>Por origen y tipo</h2><div class="card">${Object.entries(OR).map(([k, v]) => `<div class="line"><span>${ORIGEN[k]}</span><span>${pct(v[1], v[0])}% <small>(${v[0]})</small></span></div>`).join('')}
  ${Object.entries(TI).map(([k, v]) => `<div class="line"><span>${TIPOS[k] || k}</span><span>${pct(v[1], v[0])}% <small>(${v[0]})</small></span></div>`).join('')}</div>
  </section>
  <section id="stats-sims" aria-label="Historial de simulacros" hidden><h2>Simulacros</h2><div id="sims"></div></section>
  <section id="stats-evo" aria-label="Evolución del estudio" hidden><h2>Evolución</h2><h3>Resultados de preguntas</h3><div id="attempt-evolution"><p class="sub" role="status">Cargando historial detallado…</p></div><div id="evo"></div><h2>Preguntas lentas</h2><div id="slow"></div>
    <h2>Analítica de estrategia</h2><div class="card"><p>Informe experimental sobre el historial detallado. Solo incluye sesiones completadas. Recomendaciones con al menos 20 respuestas en 3 sesiones; describen asociación observada, no causalidad.</p>
      <label for="strategy-period">Periodo</label><select id="strategy-period"><option value="30">Últimos 30 días</option><option value="90" selected>Últimos 90 días</option><option value="365">Último año</option></select>
      <button class="btn" id="strategy-load">Calcular informe</button><div id="strategy-report" aria-live="polite"></div>
    </div>
  </section>
  <h2>Últimas sesiones</h2><div class="card">${ses.map(s => `<div class="line"><span>${new Date(s.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${s.kind === 'sim' ? 'Simulacro' : s.kind === 'rev' ? 'Repaso' : 'Test'} ${esc(String(s.n))}p</span><span>${s.kind === 'sim' ? esc(String(s.nota)) + '/100' : pct(s.a, s.n) + '%'}</span></div>`).join('') || '<p class="sub">Sin sesiones todavía.</p>'}</div>`;
  $('#progress-review').onclick = () => startRepaso ? startRepaso() : go('#/falladas');
  $('#progress-failures').onclick = () => go('#/falladas');
  $('#progress-test').onclick = () => go('#/test');
  app.querySelectorAll<El>('[data-stats-view]').forEach(b => b.onclick = () => {
    const view = b.dataset.statsView!;
    app.querySelectorAll<El>('[data-stats-view]').forEach(x => { const active = x === b; x.setAttribute('aria-pressed', String(active)); x.classList.toggle('on', active); });
    ['temas', 'sims', 'evo'].forEach(k => { $('#stats-' + k).hidden = k !== view; });
  });
  app.querySelectorAll<El>('[data-trap]').forEach(b => b.onclick = async () => { const r = await trapTest(15, [+b.dataset.trap!]); if (!r.items.length) { toast('No hay preguntas con esa trampa.'); return; } startRun({ kind: 'test', feedback: true, items: r.items, titulo: 'Trampa: ' + (TRAMPAS[b.dataset.trap!] || b.dataset.trap!) }); });
  $('#strategy-load').onclick = async () => {
    const output = $('#strategy-report');
    if (!output || !getStrategyReport || !renderStrategyReport) { if (output) output.textContent = 'El informe detallado no está disponible en esta pantalla.'; return; }
    const days = Number($('#strategy-period').value), period = [30, 90, 365].includes(days) ? days : 90;
    output.setAttribute('aria-busy', 'true'); output.textContent = 'Calculando con el historial detallado…';
    try {
      const report = await getStrategyReport(period);
      if (!output.isConnected || account !== store.accountId()) return;
      output.innerHTML = renderStrategyReport(report);
    } catch { if (output.isConnected) output.textContent = 'No se pudo leer el historial detallado. El progreso agregado sigue disponible.'; }
    finally { if (output.isConnected) output.setAttribute('aria-busy', 'false'); }
  };
  $('#carga').innerHTML = cargaHTML;
  { const v = velocidad(questionStats), lentos = Object.keys(questionStats).filter(id => questionStats[id][8] >= 3 && questionStats[id][7] / questionStats[id][8] < 6).length;
    $('#vel').innerHTML = `<h2>Velocidad de lectura</h2><div class="card">${v.tot ? `<div class="line"><span>Fallos por velocidad</span><span><b>${v.n}</b> de ${v.tot} <small>(${v.p}%)</small></span></div>` : '<p class="sub">Aún no has etiquetado fallos. Al fallar, pulsa «Velocidad» si leíste deprisa.</p>'}
    ${v.p >= 15 ? '<p class="r"><b>Es un patrón relevante</b>: más de 1 de cada 7 fallos se debe a leer rápido. Prueba el modo «Resaltar + frenar» en Ajustes y el ejercicio de lectura atenta.</p>' : ''}
    <ul class="tips">${CONSEJOS_LECTURA.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <button class="btn" id="golec">👀 Entrenar lectura atenta</button></div>`;
    $('#golec').onclick = () => go('#/lectura'); }
  paintMapa();
  paintSims();
  paintEvo(bankIndex);
  paintSlow();
  void (async () => {
    const output = $('#attempt-evolution');
    if (!output || !loadQuestionEvolution) return;
    try {
      const weeks = await loadQuestionEvolution(12);
      if (output.isConnected && account === store.accountId()) mountQuestionEvolution(output, weeks);
    } catch {
      if (output.isConnected && account === store.accountId()) output.textContent = 'No se pudo leer el historial detallado. El resto del progreso sigue disponible.';
    }
  })();
};



}
