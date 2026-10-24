import * as store from '../store.js';
import { esc, richHtml, pct, swipeDir, pickCards, cardStats, cardFromQuestion } from '../logic.js';
import { j, getIndex, getMeta, temaOf, getTema, temaName, now } from '../data.js';
import { $, app, toast, type El } from '../ui.js';
export function registerCards({ routes, go, pw, reportBox }: any, screen: any) {
// ───────── tarjetas (flashcards) ─────────
let CARDIDX: any; const cardCache = new Map<string, any>(); let CRUN: any = null;
store.onAccountChange(() => { CRUN = null; });
async function curatedCards() {
  if (CARDIDX === undefined) { try { CARDIDX = (await j('cards/index.json')).temas || {}; } catch (e) { return []; } } // sin caché del fallo: se reintenta
  const out: any[] = [], ts = Object.keys(CARDIDX);
  for (const t of ts) if (!cardCache.has(t)) cardCache.set(t, j(`cards/${t}.json`).catch(e => { cardCache.delete(t); return []; }));
  const lists = await Promise.all(ts.map(t => cardCache.get(t))); // en paralelo: antes eran peticiones una tras otra
  ts.forEach((t, i) => { for (const c of lists[i]) if (c && c.id && c.q && c.a && !c.revisar) out.push({ ...c, t }); });
  return out;
}
async function falloCards() {
  await getMeta(); const out: any[] = [];
  const ids = Object.keys(store.getCards()).filter(id => id.startsWith('FC-Q-')).map(id => [id.slice(5), temaOf(id.slice(5))]).filter(x => x[1]);
  const temas = new Map<string, any[]>(await Promise.all([...new Set(ids.map(x => x[1] as string))].map(async (t): Promise<[string, any[]]> => [t, await getTema(t)])));
  for (const [qid, t] of ids) { const q = temas.get(t as string)!.find((x: any) => x.i === qid); if (q) out.push(cardFromQuestion(q)); }
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
    $('#cn') && ($('#cn').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('cardsc', { ...cfg, n: +b.dataset.v! }); cfg.n = +b.dataset.v!; draw(); } });
    $('#cs') && ($('#cs').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('cardsc', { ...cfg, scope: b.dataset.v! }); cfg.scope = b.dataset.v!; draw(); } });
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
  const grade = (g: any) => {
    if (R !== CRUN || !R.rev) return;
    store.gradeCard(R.items[R.idx].id, g, now()); R.res[g]++; R.idx++; R.rev = false; draw(); window.scrollTo(0, 0);
  };
  const show = () => {
    if (R.rev) return;
    R.rev = true; draw();
    const answer = $('.fa'), reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const scroll = () => { if (answer?.isConnected) answer.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); };
    scroll();
    // El giro cambia el rectángulo visible: reajustar cuando alcance su altura final.
    if (answer && !reduced) answer.addEventListener('animationend', scroll, { once: true });
  };
  const onKey = (e: any) => {
    // Enter/Espacio deben activar el control enfocado mediante el comportamiento nativo.
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as El).closest?.('button,a,[role="button"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as El).tagName || '')) return;
    const k = e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (!R.rev) show(); }
    else if (R.rev && (k === '1' || k === 'ArrowLeft')) { e.preventDefault(); grade(0); }
    else if (R.rev && k === '2') { e.preventDefault(); grade(1); }
    else if (R.rev && (k === '3' || k === 'ArrowRight')) { e.preventDefault(); grade(2); }
  };
  let tx: any = null;
  const onTs = (e: any) => { const t = e.touches[0]; tx = e.touches.length === 1 && t.clientX > 24 && t.clientX < innerWidth - 24 && !(e.target as El).closest<El>('button,details,input,textarea') ? [t.clientX, t.clientY] : null; };
  const onTe = (e: any) => { if (!tx) return; const t = e.changedTouches[0]; const d = swipeDir(t.clientX - tx[0], t.clientY - tx[1]); tx = null; if (R.rev && d === 'next') grade(0); else if (R.rev && d === 'prev') grade(2); };
  document.addEventListener('keydown', onKey); document.addEventListener('touchstart', onTs, { passive: true }); document.addEventListener('touchend', onTe, { passive: true });
  screen.cleanup = () => { document.removeEventListener('keydown', onKey); document.removeEventListener('touchstart', onTs); document.removeEventListener('touchend', onTe); };

  function draw() {
    if (R.idx >= R.items.length) return fin();
    const c = R.items[R.idx];
    app.innerHTML = `
    <div class="qhead"><button class="ghost" id="exit" aria-label="Salir">✕</button><div class="prog" role="progressbar" aria-label="Progreso" aria-valuemin="0" aria-valuemax="${R.items.length}" aria-valuenow="${R.idx}"><div ${pw(100 * R.idx / R.items.length)}></div></div><div class="cnt">${R.idx + 1}/${R.items.length}</div></div>
    <div class="card q fc" id="fc">
      <div class="meta"><span class="tag">${esc(c.t)} · ${esc(temaName(c.t))}</span>${c.tipo ? `<span class="tag">${esc(c.tipo)}</span>` : ''}${c.caduca ? '<span class="tag warn">Puede caducar</span>' : ''}</div>
      <div class="enun pre">${richHtml(c.q)}</div>
      ${R.rev ? `<div class="fa"><small>Respuesta</small><div class="pre">${richHtml(c.a)}</div>
        ${c.nota ? `<div class="cita"><span>Nota</span>${esc(c.nota)}</div>` : ''}
        ${c.ref ? `<div class="cita"><span>Temario</span>${esc(c.ref)}</div>` : ''}
        <div class="repw" id="crep"></div>
        ${c.src === 'fallo' ? '<button class="ghost fl" id="quit">🗑 Quitar esta tarjeta</button>' : ''}</div>` : '<div class="fh">Toca para ver la respuesta</div>'}
    </div>
    <div class="bar2">${R.rev ? NOMBRE.map((t, g) => `<button class="btn ${g === 0 ? 'bad' : g === 1 ? 'sec' : ''}" data-g="${g}">${t}</button>`).join('') : '<button class="btn" id="show">Mostrar respuesta</button>'}</div>
    ${R.rev ? '<p class="sub fgl">Teclado 1·2·3 · deslizar ← Fallé · → Lo sabía</p>' : ''}`;
    $('#exit').onclick = () => { CRUN = null; go('#/home'); };
    $('#show') && ($('#show').onclick = show);
    $('#fc').onclick = e => { if (!R.rev && !(e.target as El).closest<El>('button')) show(); };
    app.querySelectorAll<El>('[data-g]').forEach(b => b.onclick = () => grade(+b.dataset.g!));
    $('#crep') && reportBox({ i: c.id, t: c.t }, $('#crep'));
    $('#quit') && ($('#quit').onclick = () => { store.removeCard(c.id); R.items.splice(R.idx, 1); R.rev = false; draw(); });
  }
  function fin() {
    const rs = R.res, tot = rs[0] + rs[1] + rs[2];
    const sig = Object.values(store.getCards()).filter(r => r[3] >= 0 && r[4] > now()).map(r => r[4]).sort((a, b) => a - b)[0];
    CRUN = null; screen.cleanup && screen.cleanup(); screen.cleanup = null;
    app.innerHTML = `<h1>Sesión terminada</h1>
    <div class="grid"><div class="stat"><b>${rs[2]}</b><span>lo sabía</span></div><div class="stat"><b>${rs[1]}</b><span>dudaba</span></div><div class="stat"><b>${rs[0]}</b><span>fallé</span></div><div class="stat"><b>${pct(rs[2], tot)}%</b><span>retención</span></div></div>
    <p class="sub">${rs[0] + rs[1] ? 'Las que fallaste o dudaste vuelven en 2 días.' : '¡Todas recordadas!'}${sig ? ' Próximo repaso: ' + new Date(sig).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) + '.' : ''}</p>
    <button class="btn" id="otra">Otra sesión</button> <button class="btn sec" id="ini">Inicio</button>`;
    $('#otra').onclick = () => go('#/cards'); $('#ini').onclick = () => go('#/home');
  }
  draw();
}


return { allCards, curatedCards };
}
