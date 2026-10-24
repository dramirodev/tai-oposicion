import * as sync from '../syncfacade.js';
import * as store from '../store.js';
import { esc, normUi } from '../logic.js';
import { getIndex, getMeta, getTema, getSup } from '../data.js';
import { $, app, toast, ask, notice, type El } from '../ui.js';
import { APP_VERSION, APP_BUILD } from '../version.js';
import { isFull, isOwner, accessLevel, devMode, setDevMode, devRevealed, revealDev } from '../access.js';
export function registerSettings({ routes, go, allCards, curatedCards, getNewVersion, checkUpdate, applyUpdate }: any, screen: any) {
// ───────── ajustes ─────────
routes.settings = async function () {
  const idx = await getIndex();
  const draw = () => {
    const s = sync.status; const ui = normUi(store.getCfg().ui); const full = isFull(), lvl = accessLevel(), dm = devMode();
    app.innerHTML = `
    <h1>Ajustes</h1>
    <div class="card"><h2 class="h3">Cuenta y sincronización</h2>
      ${s.state === 'iniciando' || s.state === 'comprobando sesión…' ? '<p>Comprobando cuenta…</p>' : s.state === 'sin conexión' ? '<p>Sin conexión: ahora no se puede comprobar la cuenta.</p>' : !sync.status.configured ? '<p>Firebase no está configurado todavía (ver README).</p>' :
        s.user ? `<p>Conectado como <b>${esc(s.user.name)}</b><br><small>${esc(s.state)}${s.lastSync ? ' · ' + new Date(s.lastSync).toLocaleTimeString('es-ES') : ''}</small></p>${accesoHtml(s, lvl)}<button class="btn sec" id="out">Cerrar sesión</button>` :
          '<p>Inicia sesión para tener el mismo historial en iPhone y iPad.</p><button class="btn" id="in">Entrar con Google</button>'}
      ${s.error ? `<p class="r"><small>${esc(s.error)}</small></p>` : ''}
      ${s.user && (lvl === 'propietario' || lvl === 'aprobado') && s.state !== 'sincronizado' && s.state !== 'sincronizando…' ? `${s.detail ? `<p><small>${esc(s.detail)}</small></p>` : ''}<button class="btn sec" id="retrySync">Reintentar sincronización</button>` : ''}
      <p><small>En este dispositivo: ${Object.keys(store.getStats()).length} preguntas vistas · ${store.getSeen().length} temas vistos · ${store.getSessions().length} sesiones</small></p>
      ${sync.status.configured ? `<p><small>Dominio: ${esc(sync.status.host)} · auth: ${esc(sync.status.authDomain)}</small></p>` : ''}
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
    <div class="card"><h2 class="h3">Versión de la app</h2>
      <p id="ver">Versión <b>${esc(APP_VERSION)}</b> <small>(${esc(APP_BUILD.split('+')[1] || APP_BUILD)})</small></p>
      <p id="updmsg" class="sm">${getNewVersion() ? `Hay una versión nueva: <b>${esc(getNewVersion().version)}</b>.` : 'Comprueba si hay una versión nueva; si la hay, la app se recarga para usarla.'}</p>
      <button class="btn ${getNewVersion() ? '' : 'sec'}" id="upd">${getNewVersion() ? 'Actualizar ahora' : 'Buscar actualización'}</button></div>
    ${devRevealed() || dm ? `<div class="card"><h2 class="h3">Modo desarrollador</h2><p class="sm">Acceso en este dispositivo</p><div class="seg" id="dev">${[[null, 'Automático'], ['1', 'Completo'], ['0', 'Como invitado']].map(([v, t]) => `<button class="${(dm ?? null) === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div><p><small>Automático: completo en localhost, para el propietario y los aprobados. «Como invitado» sirve para ver lo que ve alguien sin acceso.</small></p></div>` : ''}
    <div class="card"><h2 class="h3">Fecha del examen</h2><label class="sm" for="exd">Para la cuenta atrás de Inicio</label><input type="date" id="exd" value="${esc(store.getCfg().exam || '2027-06-01')}"></div>
    ${full ? `<div class="card"><h2 class="h3">Errores del banco</h2><p>${Object.values(store.getReports()).filter(r => r.st === 'abierto').length} por revisar. Anótalos con «Avisar de error» al contestar y exporta la lista para corregirlos.</p><button class="btn sec" id="errs">Ver errores del banco</button></div>` : ''}
    <div class="card"><h2 class="h3">Uso sin conexión</h2><p id="off">Pulsa para descargar todo el banco en el dispositivo (≈9 MB).</p><button class="btn sec" id="dl">Descargar para uso sin conexión</button></div>
    ${full ? `<div class="card"><h2 class="h3">Tarjetas</h2><p>Exporta las tarjetas curadas (y tus fallos convertidos en tarjeta) a Anki: texto separado por tabuladores, importable con «Archivo → Importar».</p><button class="btn sec" id="anki">Exportar tarjetas a Anki (.txt)</button></div>` : ''}
    <div class="card"><h2 class="h3">Copia de seguridad</h2><button class="btn sec" id="ex">Exportar progreso</button> <label class="btn sec file">Importar<input type="file" id="im" accept=".json"></label></div>
    <div class="card"><h2 class="h3">Zona delicada</h2><button class="btn danger" id="rs">Borrar progreso de este dispositivo</button></div>
    <p class="sub">Banco: ${idx.n} preguntas + ${idx.nsup} de supuestos.</p>`;
    let taps = 0, tt: any = 0;
    $('#ver').onclick = () => { clearTimeout(tt); tt = setTimeout(() => taps = 0, 1500); if (++taps >= 7 && !devRevealed()) { revealDev(); toast('Modo desarrollador activado'); draw(); } };
    $('#dev') && ($('#dev').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { setDevMode(b.dataset.v! === 'null' ? null : b.dataset.v!); draw(); } });
    $('#req') && ($<El>('#req').onclick = async e => { (e.target as El).disabled = true; (e.target as El).textContent = 'Enviando…'; if (!(await sync.requestAccess())) toast('No se pudo enviar la solicitud. Inténtalo de nuevo.'); draw(); });
    $('#in') && ($('#in').onclick = () => sync.login());
    $('#out') && ($('#out').onclick = () => sync.logout());
    $('#retrySync') && ($('#retrySync').onclick = () => sync.retry());
    $('#errs') && ($('#errs').onclick = () => go('#/errores'));
    $('#upd').onclick = async () => {
      if (!getNewVersion()) {
        $<El>('#upd').disabled = true; $('#upd').textContent = 'Buscando…';
        const n = await checkUpdate();
        if (n === undefined) { toast('No se pudo comprobar: sin conexión.'); } else if (!n) { toast('Ya tienes la última versión.'); }
        draw(); return;
      }
      if (await ask(`Se recargará la app para pasar a la versión ${getNewVersion().version}. Lo que tengas en curso se guarda.`, 'Actualizar')) applyUpdate();
    };
    $<El>('#exd').onchange = e => { if (/^\d{4}-\d\d-\d\d$/.test((e.target as El).value)) store.setCfg('exam', (e.target as El).value); };
    $('#th').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), theme: b.dataset.v! }); draw(); } };
    $('#lec').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), lectura: +b.dataset.v! }); draw(); } };
    $('#fz').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), size: +b.dataset.v! }); draw(); } };
    $('#dl').onclick = async () => {
      if (await yaDescargado()) { await notice('Todo el banco de preguntas, los supuestos y las tarjetas ya están guardados en este dispositivo. Puedes estudiar sin conexión.', 'Datos ya descargados'); return; }
      download();
    };
    $('#anki') && ($('#anki').onclick = async () => {
      const cs = await allCards(); const f = (t: any) => String(t).replace(/[\t\r\n]+/g, ' ');
      const txt = '#separator:tab\n#html:false\n#tags column:4\n' + cs.map((c: any) => [f(c.q), f(c.a), f(c.ref || ''), f((c.t || '').replace('.', '_') + ' ' + (c.tipo || ''))].join('\t')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })); a.download = 'tai-tarjetas-anki.txt'; a.click();
    });
    $('#ex').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([store.exportAll()], { type: 'application/json' })); a.download = 'tai-progreso.json'; a.click(); };
    $<El>('#im').onchange = async e => { try { store.importAll(await (e.target as El).files![0].text()); toast('Progreso importado'); } catch (x: any) { toast(x.message); } };
    $('#rs').onclick = async () => { if (await ask('¿Borrar TODO el progreso de este dispositivo? (Si hay sesión iniciada, lo sincronizado en la nube se volverá a descargar.)', 'Borrar todo', true)) { store.resetAll(); toast('Borrado'); } };
  };
  const accesoHtml = (s: any, lvl: any) => lvl === 'propietario' ? `<p><small>Propietario · acceso completo.</small> <a href="#/acceso">Gestionar accesos${s.reqs.length ? ' (' + s.reqs.length + ' pendientes)' : ''}</a></p>`
    : lvl === 'aprobado' ? '<p><small>Acceso completo aprobado.</small></p>'
    : lvl === 'pendiente' ? '<p><small>Has pedido acceso completo; está pendiente de aprobación.</small></p>'
    : '<p><small>Acceso limitado: solo la sesión rápida de 5 minutos.</small></p><button class="btn" id="req">Pedir acceso completo</button>';
  // ¿Está ya todo en la caché del dispositivo? (temas, supuestos, índices y tarjetas)
  async function yaDescargado() {
    try {
      if (!window.caches) return false;
      const c = await caches.open('tai-data');
      const need = ['data/index.json', 'data/meta.json', 'data/supuestos.json', 'cards/index.json', ...idx.temas.map(t => `data/${t.id}.json`)];
      const ci = await c.match('cards/index.json');
      if (ci) { try { Object.keys((await ci.clone().json()).temas || {}).forEach(t => need.push(`cards/${t}.json`)); } catch (e) {} }
      for (const u of need) if (!(await c.match(u, { ignoreSearch: true }))) return false;
      return true;
    } catch (e) { return false; }
  }
  async function download() {
    const el = $('#off'); let k = 0;
    try {
      await Promise.all(idx.temas.map(t => getTema(t.id).then(() => { k++; el.textContent = `Descargando… ${k}/${idx.temas.length}`; })));
      await getSup(); await getMeta(); await curatedCards();
      el.textContent = 'Listo: todo el banco está disponible sin conexión.';
    } catch (e: any) { el.textContent = 'Error de descarga: ' + e.message; }
  }
  const off = sync.onStatus(draw);
  screen.cleanup = off;
  draw();
};



}
