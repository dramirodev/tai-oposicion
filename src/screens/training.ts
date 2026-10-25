import { questionNotice, sourceHtml } from '../study-ui.js';
import * as store from '../core/store.js';
import { esc, richHtml, shuffle, pct, normUi, hiliteHtml, claveSpans, pideNegativa, minLectura, velocidad, CONSEJOS_LECTURA } from '../core/logic.js';
import { META, getMeta, temaName, now, pick, dueList, byIds } from '../core/data.js';
import { $, app, legacyScope, L, ask, focusHeading, type El } from '../ui.js';
import { TRAMPAS, TRAMPA_EXPL } from '../core/labels.js';
export function registerTraining({ routes, go, route, pw }: any, screen: any) {
let generation = 0;
let TRUN: any = null, LRUN: any = null;
store.onAccountChange(() => { generation++; TRUN = null; LRUN = null; screen.cleanup?.(); });
const recentKey = () => 'tai.lrec:' + (store.accountId() || 'guest');
const warning = (q: any) => questionNotice(q) + sourceHtml(q);

// ───────── pregunta relámpago (enlace #/relampago, pensado para avisos) ─────────
routes.relampago = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const mine = generation; await getMeta(); if (mine !== generation) return; const st = store.getStats();
  const lucky = Object.keys(st).filter(id => (st[id][9] === 6 || st[id][9] === 8) && META[id]);
  const due = await dueList(); if (mine !== generation) return;
  const fallos = Object.keys(st).filter(id => st[id][5] === 0 && META[id]);
  const pool = [...shuffle(lucky).slice(0, 5), ...due.slice(0, 5), ...shuffle(fallos).slice(0, 5)];
  const cand = pool.length ? pool : shuffle(Object.keys(META).filter(k => k !== '_by')).slice(0, 10);
  let q: any = null;
  for (const q0 of await byIds(shuffle(cand).slice(0, 8))) if (!q0.s && !q0.cp) { q = q0; break; }
  if (mine !== generation) return;
  if (!q) { app.innerHTML = '<div class="card"><p>No hay pregunta disponible.</p></div>'; return; }
  const why = lucky.includes(q.i) ? '🍀 Marcada como suerte' : due.includes(q.i) ? '⏰ Toca repasarla' : fallos.includes(q.i) ? '↩ La fallaste' : '🆕 Nueva';
  const LEC = normUi(store.getCfg().ui).lectura, kw = (x: any) => richHtml(x, !!LEC), t0 = Date.now();
  app.innerHTML = `<h1>⚡ Pregunta relámpago</h1><div class="sub">${why}</div>
  <div class="card q"><div class="meta"><span class="tag">${esc(q.t)} · ${esc(temaName(q.t))}</span></div>
  ${warning(q)}<div class="enun pre">${kw(q.q)}</div>
  <div class="opts">${q.a.map((o: any, i: number) => `<button class="opt" data-i="${i}"><b>${L[i]}</b><span class="pre">${kw(o)}</span></button>`).join('')}</div><div id="fb"></div></div>
  <div class="bar2" id="bar"><button class="btn sec" id="skip">Ahora no</button></div>`;
  $('#skip').onclick = () => go('#/home');
  app.querySelectorAll<El>('.opt').forEach(b => b.onclick = () => {
    if (mine !== generation || b.disabled) return;
    const i = +b.dataset.i!, ok = i === q.c;
    store.record(q.i, q.t, ok ? 1 : 0, now(), Math.max(1, Math.round((Date.now() - t0) / 1000)));
    app.querySelectorAll<El>('.opt').forEach((x, k) => { x.disabled = true; x.classList.add('dis'); if (k === q.c) x.classList.add('ok'); else if (k === i) x.classList.add('bad'); });
    $('#fb').innerHTML = `<div class="fb ${ok ? 'good' : 'wrong'}"><b>${ok ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>${L[q.c]}</b>${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}${q.n ? `<div class="cita"><span>Nota</span>${esc(q.n)}</div>` : ''}${q.x?.length ? `<div class="trap">Trampa: ${q.x.map((x: any) => esc(TRAMPAS[x] || x)).join(' · ')}</div>` : ''}</div>`;
    $('#bar').innerHTML = '<button class="btn" id="more">Otra →</button><button class="btn sec" id="home">Inicio</button>';
    $('#more').onclick = () => route(); $('#home').onclick = () => go('#/home');
    $('#more').focus({preventScroll:true});
  });
};

// mezcla aleatoria: cada grupo aporta hasta k ids prioritarios y el resto rellena hasta n; las ids de `rec` solo se usan si faltan
const mezclaIds = (grupos: any, resto: any, n = 40, rec = new Set()) => {
  const fresh = (a: any) => [...shuffle(a.filter((id: any) => !rec.has(String(id)))), ...shuffle(a.filter((id: any) => rec.has(String(id))))];
  const pick = grupos.flatMap(([a, k]: any) => fresh(a).slice(0, k)), got = new Set(pick);
  return [...pick, ...fresh(resto).filter(id => !got.has(id)).slice(0, n)];
};

// ───────── detective de trampas: ejercicio ─────────
routes.trampas = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const mine = generation; await getMeta(); if (mine !== generation) return;
  if (!TRUN) {
    const st = store.getStats();
    const ids = Object.keys(META).filter(id => id !== '_by' && (META[id][3] || []).length);
    const fail = ids.filter(id => st[id] && st[id][5] === 0), rest = ids.filter(id => !fail.includes(id));
    const items = (await byIds(mezclaIds([[fail, 4]], rest))).filter(q => !q.s && q.x?.length).slice(0, 8);
    if (mine !== generation) return;
    TRUN = { items, k: 0, res: [] };
  }
  const R = TRUN; const ALL = Object.keys(TRAMPAS).map(Number);
  function draw() {
    if (mine !== generation || R !== TRUN) return;
    if (R.k >= R.items.length) return end();
    // Las etiquetas del banco también describen opciones: siempre deben verse al evaluar.
    const q = R.items[R.k], good = new Set<any>((q.x as any[]).map(Number));
    const dis = shuffle(ALL.filter(k => !good.has(k))).slice(0, Math.max(3, 8 - good.size));
    const chips = shuffle([...good, ...dis]), sel = new Set<any>();
    app.innerHTML = `<div class="qhead"><button class="ghost" id="exit" aria-label="Salir">✕</button><div class="prog"><div ${pw(100 * R.k / R.items.length)}></div></div><div class="cnt">${R.k + 1}/${R.items.length}</div></div>
    <h1 class="sub">🕵️ Detective de trampas</h1>
    <p class="sm" id="md">Lee el enunciado y todas las opciones: las trampas pueden estar en cualquiera de ellos.</p>
    <div class="card q"><div class="meta"><span class="tag">${esc(q.t)} · ${esc(temaName(q.t))}</span></div>
      ${warning(q)}${q.cp ? `<div class="ctx pre">${richHtml(q.cp)}</div>` : ''}
      <div class="enun pre">${richHtml(q.q, true)}</div>
      <div class="opts">${q.a.map((o: any, i: any) => `<div class="opt dis" id="o${i}"><b>${L[i]}</b><span class="pre">${richHtml(o, true)}</span></div>`).join('')}</div>
      <p><b>¿Qué trampas ves aquí?</b> <small>Marca todas las que apliquen (${good.size === 1 ? 'hay 1' : 'hay varias'} posible${good.size === 1 ? '' : 's'}).</small></p>
      <div class="mot" id="chips">${chips.map((k: any) => `<button aria-pressed="false" data-k="${k}">${esc(TRAMPAS[k])}</button>`).join('')}</div>
      <div id="fb"></div></div>
    <div class="bar2"><button class="btn" id="chk">Comprobar</button></div>`;
    $('#exit').onclick = async () => { if (await ask('¿Salir del ejercicio?', 'Salir') && mine === generation) { TRUN = null; go('#/home'); } };
    $('#chips').onclick = e => { const b = (e.target as El).closest<El>('button'); if (!b || b.disabled) return; const k = +b.dataset.k!; sel.has(k) ? sel.delete(k) : sel.add(k); b.setAttribute('aria-pressed', String(b.classList.toggle('on'))); };
    $('#chk').onclick = () => {
      if (mine !== generation || R !== TRUN) return;
      if ($('#chk').dataset.done!) { R.k++; draw(); window.scrollTo(0, 0); return; }
      let hit = 0, fa = 0, miss = 0; const td = { ...(store.getCfg().tdet || {}) };
      app.querySelectorAll<El>('#chips button').forEach(b => {
        const k = +b.dataset.k!, on = sel.has(k), g = good.has(k); b.disabled = true; b.classList.remove('on');
        if (g && on) { hit++; b.classList.add('ok'); b.textContent = '✔ ' + b.textContent; }
        else if (g) { miss++; b.classList.add('sug'); b.textContent = '○ ' + b.textContent + ' (no la viste)'; }
        else if (on) { fa++; b.classList.add('bad'); b.textContent = '✖ ' + b.textContent + ' (falsa alarma)'; }
      });
      for (const k of good) { const a = td[k] ? [...td[k]] : [0, 0]; a[0]++; if (sel.has(k)) a[1]++; td[k] = a; }
      store.setCfg('tdet', td);
      R.res.push({ hit, miss, fa, n: good.size, x: [...good] });
      const correctOption = $('#o' + q.c); correctOption?.classList.add('ok');
      $('#fb').innerHTML = `<div class="fb ${miss || fa ? 'wrong' : 'good'}"><b>${!miss && !fa ? '¡Detectadas todas!' : `Detectaste ${hit} de ${good.size}${fa ? ` y marcaste ${fa} de más` : ''}.`}</b> Respuesta correcta: <b>${L[q.c]}</b>
        ${[...good].map(k => `<div class="trapx ${sel.has(k) ? 'hit' : 'miss'}"><b>${sel.has(k) ? 'Detectada' : 'No la viste'}: ${esc(TRAMPAS[k] || k)}</b><p>${esc(TRAMPA_EXPL[k] || '')}</p></div>`).join('')}${[...sel].filter(k => !good.has(k)).map(k => `<div class="trapx fa"><b>Falsa alarma: ${esc(TRAMPAS[k] || k)}</b><p>No aplica aquí. ${esc(TRAMPA_EXPL[k] || '')}</p></div>`).join('')}
        ${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}${q.n ? `<div class="cita"><span>Nota</span>${esc(q.n)}</div>` : ''}
        </div>`;
      $('#chk').textContent = R.k + 1 === R.items.length ? 'Terminar →' : 'Siguiente →'; $('#chk').dataset.done = '1';
      $('#chk').focus({preventScroll:true});
      $('#fb').scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    };
    focusHeading();
  }
  function end() {
    const n = R.res.length, tot = R.res.reduce((a: any, r: any) => a + r.n, 0), hit = R.res.reduce((a: any, r: any) => a + r.hit, 0), fa = R.res.reduce((a: any, r: any) => a + r.fa, 0);
    const td: Record<string, number[]> = store.getCfg().tdet || {};
    const rows = (Object.entries(td) as [string, number[]][]).filter(([, v]) => v[0] >= 3).sort((a, b) => a[1][1] / a[1][0] - b[1][1] / b[1][0]).slice(0, 6);
    app.innerHTML = `<h1>Detective de trampas</h1><div class="grid"><div class="stat"><b>${hit}/${tot}</b><span>trampas detectadas</span></div><div class="stat"><b>${fa}</b><span>falsas alarmas</span></div></div>
    <div class="card"><h2 class="h3">Las que más se te escapan</h2>${rows.length ? rows.map(([k, v]) => `<div class="line"><span>${esc(TRAMPAS[k] || k)}</span><span>${pct(v[1], v[0])}% <small>(${v[1]}/${v[0]})</small></span></div>`).join('') : '<p class="sub">Aparecerá cuando hayas visto cada trampa ≥3 veces.</p>'}</div>
    <div class="bar2"><button class="btn" id="again">Otra tanda</button><button class="btn sec" id="home">Inicio</button></div>`;
    TRUN = null; $('#again').onclick = () => route(); $('#home').onclick = () => go('#/home');
    focusHeading();
  }
  draw();
};

// ───────── lectura atenta: ejercicio ─────────
routes.lectura = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  const mine = generation; await getMeta(); if (mine !== generation) return; const st = store.getStats();
  if (!LRUN) {
    const vel = velocidad(st).ids;
    let recent: any[] = []; try { const r = JSON.parse(localStorage.getItem(recentKey()) || '[]'); if (Array.isArray(r)) recent = r.map(String); } catch { }
    const rec = new Set(recent), velS = new Set(vel);
    const fallos = Object.keys(st).filter(id => st[id][5] === 0 && !velS.has(id));
    const fS = new Set(fallos);
    const rest = Object.keys(META).filter(k => k !== '_by' && META[k] && !velS.has(k) && !fS.has(k));
    const ids = mezclaIds([[vel, 3], [fallos, 2]], rest, 40, rec);
    const got = new Map((await byIds(ids)).filter(q => !q.s && !q.cp).map(q => [String(q.i), q]));
    if (mine !== generation) return;
    const ok = ids.map(id => got.get(String(id))).filter(Boolean);
    const items = shuffle(ok.slice(0, 8));
    if (!items.length) { app.innerHTML = `<h1>Lectura atenta</h1><div class="card"><p>No hay preguntas disponibles ahora mismo. Comprueba la conexión e inténtalo de nuevo.</p></div><div class="bar2"><button class="btn" id="retry">Reintentar</button><button class="btn sec" id="home">Inicio</button></div>`; $('#retry').onclick = () => route(); $('#home').onclick = () => go('#/home'); return; }
    LRUN = { items, k: 0, step: 0, res: [], mark: new Set() };
  }
  const R = LRUN; let gt: any = null;
  routeScreen.cleanup = () => clearInterval(gt);
  const words = (t: any) => t.split(/(\s+)/);
  function draw() {
    clearInterval(gt);
    if (mine !== generation || R !== LRUN) return;
    if (R.k >= R.items.length) return end();
    const q = R.items[R.k], neg = pideNegativa(q.q);
    const head = `<div class="qhead"><button class="ghost" id="exit" aria-label="Salir">✕</button><div class="prog"><div ${pw(100 * R.k / R.items.length)}></div></div><div class="cnt">${R.k + 1}/${R.items.length}</div></div><h1 class="sub">Lectura atenta · paso ${R.step + 1} de 3</h1>`;
    if (R.step === 0) {
      app.innerHTML = `${head}<div class="card q">${warning(q)}<div class="enun pre">${richHtml(q.q)}</div><p><b>1. ¿Qué te piden?</b> Antes de ver las opciones.</p>
        <div class="opts"><button class="opt" data-v="0"><b>✔</b><span>La opción CORRECTA / VERDADERA</span></button><button class="opt" data-v="1"><b>✖</b><span>La INCORRECTA / FALSA / la excepción</span></button></div><div id="fb0"></div></div>`;
      app.querySelectorAll<El>('.opt').forEach(b => b.onclick = () => {
        if (mine !== generation || R !== LRUN || b.disabled) return;
        const ok = (+b.dataset.v! === 1) === neg; R.pideOk = ok; b.classList.add(ok ? 'ok' : 'bad'); if (!ok) app.querySelectorAll<El>('.opt').forEach(x => { if (x !== b) x.classList.add('ok'); });
        $('#fb0').innerHTML = `<div class="fb ${ok ? 'good' : 'wrong'}"><b>${ok ? '¡Bien leído!' : 'Ojo: lo habías leído al revés.'}</b> Te piden la opción <b>${neg ? 'INCORRECTA / excepción' : 'CORRECTA'}</b>.</div><div class="bar2"><button class="btn" id="n0">Siguiente →</button></div>`;
        app.querySelectorAll<El>('.opt').forEach(x => x.disabled = true); $('#n0').focus({preventScroll:true}); $('#n0').onclick = () => { R.step = 1; R.mark = new Set(); draw(); };
      });
    } else if (R.step === 1) {
      const toks = words(q.q), spans = claveSpans(q.q); let pos = 0, wi = 0, key = [];
      const html = toks.map((t: any) => { const a = pos; pos += t.length; if (/^\s+$/.test(t) || !t) return esc(t); const id = wi++; const k = spans.some(([x, y]) => a >= x && a < y); if (k) key.push(id); return `<button type="button" class="tk" tabindex="${id === 0 ? 0 : -1}" aria-pressed="false" data-id="${id}" data-k="${k ? 1 : 0}">${esc(t)}</button>`; }).join('');
      app.innerHTML = `${head}<div class="card q">${warning(q)}<p><b>2. Toca las palabras que cambian el sentido</b> (negaciones, excepciones, absolutos, cifras y plazos).</p><p id="word-help" class="sm">Con teclado: usa las flechas para moverte, Inicio y Fin para ir a los extremos, y Espacio o Intro para marcar. Tabulador sale del grupo.</p><div class="enun pre tks" role="group" aria-label="Palabras del enunciado" aria-describedby="word-help">${html}</div><div id="fb1"></div><div class="bar2"><button class="btn sec" id="none">No contiene</button><button class="btn" id="chk">Continuar</button></div></div>`;
      const wordButtons = [...app.querySelectorAll<El>('.tk')];
      const focusWord = (index: number) => wordButtons.forEach((el, i) => { el.tabIndex = i === index ? 0 : -1; if (i === index) el.focus(); });
      wordButtons.forEach((el, i) => {
        el.onclick = () => { if (mine !== generation || R !== LRUN || $('#chk').dataset.done) return; focusWord(i); el.setAttribute('aria-pressed', String(el.classList.toggle('on'))); };
        el.onkeydown = e => {
          if (mine !== generation || R !== LRUN) return;
          const offset = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (offset || e.key === 'Home' || e.key === 'End') { e.preventDefault(); focusWord(e.key === 'Home' ? 0 : e.key === 'End' ? wordButtons.length - 1 : (i + offset + wordButtons.length) % wordButtons.length); }
          else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); el.click(); }
        };
      });
      $('#none').onclick = () => { if (mine !== generation || R !== LRUN) return; app.querySelectorAll<El>('.tk.on').forEach(el => { el.classList.remove('on'); el.setAttribute('aria-pressed', 'false'); }); $('#chk').dataset.claim = 'none'; $('#chk').click(); $('#chk').focus({preventScroll:true}); };
      $('#chk').onclick = () => {
        if (mine !== generation || R !== LRUN) return;
        if ($('#chk').dataset.done!) { R.step = 2; draw(); return; }
        const claimNone = $('#chk').dataset.claim! === 'none'; $('#none').remove();
        let hit = 0, miss = 0, extra = 0;
        app.querySelectorAll<El>('.tk').forEach(el => { const on = el.classList.contains('on'), k = el.dataset.k! === '1'; if (k) { el.classList.add('key'); on ? hit++ : miss++; } else if (on) extra++; });
        R.marcadas = [hit, key.length];
        if (claimNone) {
          const okN = key.length === 0;
          R.marcadas = [0, key.length];
          $('#fb1').innerHTML = `<div class="fb ${okN ? 'good' : 'wrong'}">${okN ? '<b>Correcto:</b> no hay palabras clave destacables. Lo importante es entender bien qué pide.' : `<b>Ojo:</b> sí había ${key.length} palabra${key.length === 1 ? '' : 's'} clave (resaltada${key.length === 1 ? '' : 's'}). Mira qué cambia el sentido.`}</div>`;
          $('#chk').textContent = 'Ver opciones →'; $('#chk').dataset.done = '1'; return;
        }
        $('#fb1').innerHTML = `<div class="fb ${miss ? 'wrong' : 'good'}">${key.length ? `Detectaste <b>${hit}</b> de <b>${key.length}</b> palabras clave${miss ? ' (las que faltaban están resaltadas)' : ''}.` : 'Esta pregunta no tiene palabras clave destacables: lo importante es entender bien qué pide.'}${extra ? ` Marcaste ${extra} que no eran clave.` : ''}</div>`;
        $('#chk').textContent = 'Ver opciones →'; $('#chk').dataset.done = '1';
      };
    } else {
      const need = minLectura(q); R.t0 = Date.now();
      app.innerHTML = `${head}<div class="card q">${warning(q)}<div class="enun pre">${richHtml(q.q, true)}</div><p class="sm"><b>3. Lee las cuatro opciones enteras</b> antes de responder.</p><div class="opts">${q.a.map((o: any, i: any) => `<button class="opt" data-i="${i}" disabled><b>${L[i]}</b><span class="pre">${richHtml(o, true)}</span></button>`).join('')}</div><div class="gate" id="gate"></div><div id="fb2"></div></div>`;
      const upd = () => { if (mine !== generation || R !== LRUN) return clearInterval(gt); const l = Math.ceil(need - (Date.now() - R.t0) / 1000), g = $<El>('#gate'); if (!g) return clearInterval(gt); if (l <= 0) { clearInterval(gt); g.remove(); app.querySelectorAll<El>('.opt').forEach(b => b.disabled = false); } else g.textContent = `Lectura mínima: ${l} s`; };
      upd(); gt = setInterval(upd, 400);
      app.querySelectorAll<El>('.opt').forEach(b => b.onclick = () => {
        if (mine !== generation || R !== LRUN || b.disabled) return;
        const i = +b.dataset.i!, ok = i === q.c, secs = Math.max(1, Math.round((Date.now() - R.t0) / 1000));
        store.record(q.i, q.t, ok ? 1 : 0, now(), secs);
        try { let r = JSON.parse(localStorage.getItem(recentKey()) || '[]'); if (!Array.isArray(r)) r = []; localStorage.setItem(recentKey(), JSON.stringify([String(q.i), ...r.filter((x: any) => String(x) !== String(q.i))].slice(0, 80))); } catch { }
        R.res.push({ q: q.i, ok, pide: R.pideOk, marc: R.marcadas });
        app.querySelectorAll<El>('.opt').forEach((x, k) => { x.disabled = true; x.classList.add('dis'); if (k === q.c) x.classList.add('ok'); else if (k === i) x.classList.add('bad'); });
        $('#fb2').innerHTML = `<div class="fb ${ok ? 'good' : 'wrong'}"><b>${ok ? '¡Correcto!' : 'Incorrecto'}</b> · Respuesta: <b>${L[q.c]}</b>${q.u ? `<div class="cita"><span>Temario</span>${hiliteHtml(q.u, q.a[q.c])}</div>` : ''}</div><div class="bar2"><button class="btn" id="n2">${R.k + 1 === R.items.length ? 'Terminar' : 'Siguiente'} →</button></div>`;
        $('#n2').focus({preventScroll:true});
        $('#n2').onclick = () => { R.k++; R.step = 0; draw(); window.scrollTo(0, 0); };
      });
    }
    $('#exit').onclick = async () => { if (await ask('¿Salir del ejercicio?', 'Salir') && mine === generation) { LRUN = null; go('#/home'); } };
    focusHeading();
  }
  function end() {
    const n = R.res.length, ok = R.res.filter((r: any) => r.ok).length, pide = R.res.filter((r: any) => r.pide).length;
    const ms = R.res.reduce((a: any, r: any) => [a[0] + (r.marc?.[0] || 0), a[1] + (r.marc?.[1] || 0)], [0, 0]);
    app.innerHTML = `<h1>Lectura atenta</h1><div class="grid"><div class="stat"><b>${ok}/${n}</b><span>aciertos</span></div><div class="stat"><b>${pide}/${n}</b><span>«qué piden» bien</span></div><div class="stat"><b>${ms[1] ? pct(ms[0], ms[1]) + '%' : '—'}</b><span>palabras clave</span></div></div>
    <div class="card"><h2 class="h3">Método de 3 pasos</h2><ul class="tips">${CONSEJOS_LECTURA.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
    <div class="bar2"><button class="btn" id="again">Otra tanda</button><button class="btn sec" id="home">Inicio</button></div>`;
    LRUN = null; $('#again').onclick = () => route(); $('#home').onclick = () => go('#/home');
    focusHeading();
  }
  draw();
};



}
