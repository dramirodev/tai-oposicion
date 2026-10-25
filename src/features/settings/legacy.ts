import * as sync from '../../adapters/firebase/sync-facade.js';
import * as store from '../../adapters/local/legacy-store.js';
import { esc, normUi } from '../../legacy/logic.js';
import { getIndex } from '../../adapters/http/legacy-data.js';
import { inspectOffline, downloadOffline, type OfflineState } from '../../adapters/offline/cache.js';
import { cleanCfg } from '../../adapters/local/config.js';
import { $, app, legacyScope, toast, ask, type El } from '../../shared/ui/legacy-dom.js';
import { APP_VERSION, APP_BUILD } from '../../app/build-info.js';
import { isFull, accessLevel, devMode, setDevMode, devRevealed, revealDev } from '../../adapters/legacy/access.js';
import { notifyAccessChange } from '../../app/access-events.js';
// La previsualización usa los mismos validadores que la importación, sin modificar el almacén.
export function previewImport(txt: string) {
  if (txt.length > 20e6) throw new Error('Archivo no válido: supera 20 MB');
  let raw: any;
  try { raw = JSON.parse(txt); } catch { throw new Error('Archivo no válido: JSON ilegible'); }
  if (!raw || typeof raw !== 'object' || !raw.stats || typeof raw.stats !== 'object' || Array.isArray(raw.stats)) throw new Error('Archivo no válido');
  const stats = store.cleanStats(raw.stats), sessions = store.cleanSessions(raw.sessions), cards = store.cleanCards(raw.cards), reports = store.cleanReports(raw.reports);
  let added = 0, updated = 0, preserved = 0;
  for (const id of Object.keys(stats)) {
    const old = store.rec(id);
    if (!old) added++;
    else if (store.needsSync(stats[id], old)) updated++;
    else preserved++;
  }
  preserved += Object.keys(store.getStats()).filter(id => !stats[id]).length;
  const ignored = Object.keys(raw.stats).length - Object.keys(stats).length;
  const serialized = JSON.stringify({stats,sessions,cards,reports,...(raw.seen ? {seen:store.cleanSeen(raw.seen)} : {}),...(raw.cfg ? {cfg:cleanCfg(raw.cfg)} : {})});
  return {added,updated,preserved,ignored,serialized,sessions:sessions.length,cards:Object.keys(cards).length,reports:Object.keys(reports).length,settings:!!raw.cfg};
}
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export function registerSettings({ routes, go, allCards, getNewVersion, checkUpdate, applyUpdate }: any, screen: any) {
// ───────── ajustes ─────────
routes.settings = async function () {
  const { app, $, screen: routeScreen } = legacyScope(screen);
  let active = true, generation = 0, downloading = false;
  const routeAccount = store.accountId();
  const alive = () => active && store.accountId() === routeAccount;
  const offAccount = store.onAccountChange(() => { active = false; generation++; });
  routeScreen.cleanup = () => { active = false; offAccount(); };
  const idx = await getIndex();
  if (!alive()) return;
  let offline: OfflineState | null = null;
  let importMessage = '';
  const offlineHtml = () => !offline ? 'Comprobando archivos guardados…' : offline.complete
    ? `Banco, supuestos y tarjetas disponibles sin conexión (${offline.total} archivos).${offline.completedAt ? ' Descarga verificada: ' + new Date(offline.completedAt).toLocaleString('es-ES') + '.' : ' Fecha de descarga no registrada.'}`
    : `Descarga incompleta: faltan ${offline.missing.length} de ${offline.total} archivos. ${offline.missing.slice(0, 4).join(', ')}${offline.missing.length > 4 ? '…' : ''}`;
  const draw = () => {
    if (!alive()) return;
    generation++;
    const focused = document.activeElement as HTMLElement | null;
    const focusGroup = focused?.closest('.seg')?.id, focusValue = focused?.dataset.v;
    const s = sync.status; const ui = normUi(store.getCfg().ui); const full = isFull(), lvl = accessLevel(), dm = devMode();
    app.innerHTML = `
    <h1>Ajustes</h1>
    <div class="card"><h2 class="h3">Cuenta y sincronización</h2>
      ${s.state === 'iniciando' || s.state === 'comprobando sesión…' ? '<p>Comprobando cuenta…</p>' : s.state === 'sin conexión' ? '<p>Sin conexión: ahora no se puede comprobar la cuenta.</p>' : !sync.status.configured ? '<p>El acceso a la cuenta no está disponible. Puedes conservar y exportar el progreso de este dispositivo.</p>' :
        s.user ? `<p>Conectado como <b>${esc(s.user.name)}</b><br><small>${esc(s.state)}${s.lastSync ? ' · ' + new Date(s.lastSync).toLocaleTimeString('es-ES') : ''}</small></p>${accesoHtml(s, lvl)}<button class="btn sec" id="out">Cerrar sesión</button>` :
          '<p>Inicia sesión para tener el mismo historial en iPhone y iPad.</p><button class="btn" id="in">Entrar con Google</button>'}
      ${s.error ? `<p class="r"><small>${esc(s.error)}</small></p>` : ''}
      ${s.user && (lvl === 'propietario' || lvl === 'aprobado') && s.state !== 'sincronizado' && s.state !== 'sincronizando…' ? `${s.detail ? `<p><small>${esc(s.detail)}</small></p>` : ''}<button class="btn sec" id="retrySync">Reintentar sincronización</button>` : ''}
      <p><small>En este dispositivo: ${count(Object.keys(store.getStats()).length, 'pregunta vista', 'preguntas vistas')} · ${count(store.getSeen().length, 'tema visto', 'temas vistos')} · ${count(store.getSessions().length, 'sesión', 'sesiones')}</small></p>

    </div>
    <div class="card"><h2 class="h3">Lectura y apariencia</h2>
      <p class="sm">Tema</p>
      <div class="seg" id="th">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) => `<button class="${ui.theme === v ? 'on' : ''}" aria-pressed="${ui.theme === v}" data-v="${v}">${t}</button>`).join('')}</div>
      <p class="sm">Tamaño de letra</p>
      <div class="seg" id="fz">${['A', 'A+', 'A++', 'A+++'].map((t, i) => `<button class="${ui.size === i ? 'on' : ''}" aria-pressed="${ui.size === i}" data-v="${i}">${t}</button>`).join('')}</div>
      <p class="sm">Lectura atenta <small>(contra los fallos por leer deprisa)</small></p>
      <div class="seg" id="lec">${[[0, 'Normal'], [1, 'Resaltar clave'], [2, 'Resaltar + frenar']].map(([v, t]) => `<button class="${ui.lectura === v ? 'on' : ''}" aria-pressed="${ui.lectura === v}" data-v="${v}">${t}</button>`).join('')}</div>
      <p><small>«Resaltar clave» marca NO, SALVO, EXCEPTO, absolutos y cifras. «Frenar» bloquea las opciones unos segundos según la longitud de la pregunta (en modo test).</small></p>
      <p><small>Teclado (iPad): 1–4 o A–D responden · Intro, → o espacio: siguiente · ←: anterior · B: en blanco · F: dudosa · P: pausa. Gestos: desliza a la izquierda para pasar y a la derecha para volver.</small></p>
      <p><small>Se guarda solo en este dispositivo.</small></p>
    </div>
    <div class="card"><h2 class="h3">Descargas y actualizaciones</h2>
      <p id="ver">Versión <b>${esc(APP_VERSION)}</b> <small>(${esc(APP_BUILD.split('+')[1] || APP_BUILD)})</small></p>
      <p id="updmsg" class="sm">${getNewVersion() ? `Hay una versión nueva: <b>${esc(getNewVersion().version)}</b>.` : 'Comprueba si hay una versión nueva; si la hay, la app se recarga para usarla.'}</p>
      <button class="btn ${getNewVersion() ? '' : 'sec'}" id="upd">${getNewVersion() ? 'Actualizar ahora' : 'Buscar actualización'}</button></div>
    ${devRevealed() || dm ? `<div class="card"><h2 class="h3">Modo desarrollador</h2><p class="sm">Acceso en este dispositivo</p><div class="seg" id="dev">${[[null, 'Automático'], ['1', 'Completo'], ['0', 'Como invitado']].map(([v, t]) => `<button class="${(dm ?? null) === v ? 'on' : ''}" aria-pressed="${(dm ?? null) === v}" data-v="${v}">${t}</button>`).join('')}</div><p><small>Automático: completo en localhost, para el propietario y los aprobados. «Como invitado» sirve para ver lo que ve alguien sin acceso.</small></p></div>` : ''}
    <div class="card"><h2 class="h3">Objetivo de estudio</h2><label class="sm" for="exd">Fecha objetivo para la cuenta atrás (no confirma una convocatoria oficial)</label><input type="date" id="exd" value="${esc(store.getCfg().exam || '')}"><p class="sm">Elige tu fecha de planificación; comprueba la fecha oficial en la convocatoria.</p></div>
    ${full ? `<div class="card"><h2 class="h3">Errores del banco</h2><p>${Object.values(store.getReports()).filter(r => r.st === 'abierto').length} por revisar. Anótalos con «Avisar de error» al contestar y exporta la lista para corregirlos.</p><button class="btn sec" id="errs">Ver errores del banco</button></div>` : ''}
    <div class="card"><h2 class="h3">Uso sin conexión</h2><p id="off" role="status" aria-live="polite">${esc(offlineHtml())}</p><p class="sm">Se comprueban los archivos de preguntas, supuestos y tarjetas guardados en este navegador. El progreso permanece asociado a tu cuenta.</p><button class="btn sec" id="dl">Descargar para uso sin conexión</button></div>
    ${full ? `<div class="card"><h2 class="h3">Tarjetas</h2><p>Exporta las tarjetas curadas (y tus fallos convertidos en tarjeta) a Anki: texto separado por tabuladores, importable con «Archivo → Importar».</p><button class="btn sec" id="anki">Exportar tarjetas a Anki (.txt)</button></div>` : ''}
    <div class="card"><h2 class="h3">Copias de seguridad</h2><p class="sm">Importar combina los registros válidos con tu progreso actual y conserva los ausentes en la copia. Revisa el resumen antes de confirmar.</p><p id="importmsg" role="status">${esc(importMessage)}</p><button class="btn sec" id="ex">Exportar progreso</button> <label class="btn sec file">Importar<input type="file" id="im" accept=".json"></label></div>
    <div class="card"><h2 class="h3">Zona delicada</h2><button class="btn danger" id="rs">Borrar progreso de este dispositivo</button></div>
    <details class="card" id="diagnostic"><summary>Diagnóstico técnico</summary><p>Versión: ${esc(APP_BUILD)}</p><p>Dominio: ${esc(s.host || 'no disponible')} · autenticación: ${esc(s.authDomain || 'no disponible')}</p><p>Estado: ${esc(s.state)}</p></details>
    <p class="sub">Banco: ${idx.n} preguntas + ${idx.nsup} de supuestos.</p>`;
    let taps = 0, tt: any = 0;
    $('#ver').onclick = () => { clearTimeout(tt); tt = setTimeout(() => taps = 0, 1500); if (++taps >= 7 && !devRevealed()) { revealDev(); toast('Modo desarrollador activado'); draw(); } };
    $('#dev') && ($('#dev').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { setDevMode(b.dataset.v! === 'null' ? null : b.dataset.v!); notifyAccessChange(); draw(); } });
    $('#req') && ($<El>('#req').onclick = async e => { (e.target as El).disabled = true; (e.target as El).textContent = 'Enviando…'; const sent = await sync.requestAccess(); if (!alive()) return; if (!sent) toast('No se pudo enviar la solicitud. Inténtalo de nuevo.'); draw(); });
    $('#in') && ($('#in').onclick = () => sync.login());
    $('#out') && ($('#out').onclick = () => sync.logout());
    $('#retrySync') && ($('#retrySync').onclick = () => sync.retry());
    $('#errs') && ($('#errs').onclick = () => go('#/errores'));
    $('#upd').onclick = async () => {
      if (!getNewVersion()) {
        $<El>('#upd').disabled = true; $('#upd').textContent = 'Buscando…';
        const n = await checkUpdate();
        if (!alive()) return;
        if (n === undefined) { toast('No se pudo comprobar: sin conexión.'); } else if (!n) { toast('Ya tienes la última versión.'); }
        draw(); return;
      }
      if (await ask(`Se recargará la app para pasar a la versión ${getNewVersion().version}. Lo que tengas en curso se guarda.`, 'Actualizar') && alive()) applyUpdate();
    };
    $<El>('#exd').onchange = e => { if (/^\d{4}-\d\d-\d\d$/.test((e.target as El).value)) store.setCfg('exam', (e.target as El).value); };
    $('#th').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), theme: b.dataset.v! }); draw(); } };
    $('#lec').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), lectura: +b.dataset.v! }); draw(); } };
    $('#fz').onclick = e => { const b = (e.target as El).closest<El>('button'); if (b) { store.setCfg('ui', { ...normUi(store.getCfg().ui), size: +b.dataset.v! }); draw(); } };
    $<El>('#dl').disabled = downloading;
    $('#dl').onclick = () => download();
    $('#anki') && ($('#anki').onclick = async () => {
      const cs = await allCards(); if (!alive()) return; const f = (t: any) => String(t).replace(/[\t\r\n]+/g, ' ');
      const txt = '#separator:tab\n#html:false\n#tags column:4\n' + cs.map((c: any) => [f(c.q), f(c.a), f(c.ref || ''), f((c.t || '').replace('.', '_') + ' ' + (c.tipo || ''))].join('\t')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })); a.download = 'tai-tarjetas-anki.txt'; a.click();
    });
    $('#ex').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([store.exportAll()], { type: 'application/json' })); a.download = 'tai-progreso.json'; a.click(); };
    $<El>('#im').onchange = async e => {
      const file = (e.target as El).files?.[0], owner = store.accountId();
      if (!file || !alive()) return;
      try {
        if (file.size > 20e6) throw new Error('Archivo no válido: supera 20 MB');
        const txt = await file.text();
        if (!alive() || owner !== store.accountId()) return;
        const p = previewImport(txt);
        const summary = `${count(p.added, 'pregunta nueva', 'preguntas nuevas')}, ${count(p.updated, 'pregunta actualizada', 'preguntas actualizadas')} y ${count(p.preserved, 'pregunta conservada', 'preguntas conservadas')}. ${count(p.sessions, 'sesión válida', 'sesiones válidas')}, ${count(p.cards, 'tarjeta válida', 'tarjetas válidas')} y ${count(p.reports, 'aviso válido', 'avisos válidos')}. ${count(p.ignored, 'registro de pregunta descartado por no ser válido', 'registros de preguntas descartados por no ser válidos')}.${p.settings ? ' También se importarán los ajustes válidos de la copia.' : ''}`;
        if (!(await ask(summary + ' ¿Combinar esta copia con tu progreso?', 'Importar copia'))) return;
        if (!alive() || owner !== store.accountId()) return;
        store.importAll(p.serialized);
        importMessage = `Copia combinada: ${summary} Guardada en este dispositivo. ${sync.status.user ? 'Pendiente de sincronizar hasta que la cuenta confirme la sincronización.' : 'Pendiente de sincronizar hasta iniciar sesión con acceso aprobado.'}`;
        draw(); toast('Copia importada; el progreso anterior se conserva.');
      } catch (x: any) { if (alive()) { importMessage = x.message; draw(); toast(x.message); } }
    };
    if (focusGroup && focusValue !== undefined) {
      const button = Array.from(document.getElementById(focusGroup)?.querySelectorAll<HTMLButtonElement>('button') || []).find(b => b.dataset.v === focusValue);
      button?.focus({preventScroll:true});
    }
    $('#rs').onclick = async () => { const owner = store.accountId(); if (await ask('¿Borrar TODO el progreso de este dispositivo? (Si hay sesión iniciada, lo sincronizado en la nube se volverá a descargar.)', 'Borrar todo', true) && alive() && owner === store.accountId()) { store.resetAll(); toast('Borrado'); } };
  };
  const accesoHtml = (s: any, lvl: any) => lvl === 'propietario' ? `<p><small>Propietario · acceso completo.</small> <a href="#/acceso">Gestionar accesos${s.reqs.length ? ' (' + s.reqs.length + ' pendientes)' : ''}</a></p>`
    : lvl === 'aprobado' ? '<p><small>Acceso completo aprobado.</small></p>'
    : lvl === 'pendiente' ? '<p><small>Acceso pendiente de aprobación. Puedes continuar con la sesión rápida; la cuenta se actualizará al recibir la aprobación.</small></p>'
    : '<p><small>Acceso limitado: solo la sesión rápida de 5 minutos.</small></p><button class="btn" id="req">Pedir acceso completo</button>';
  async function download() {
    if (downloading || !alive()) return;
    downloading = true; draw();
    const current = generation;
    try {
      offline = await downloadOffline(idx, (done, total) => {
        if (alive() && current === generation) $('#off').textContent = `Descargando… ${done}/${total} archivos`;
      }, alive);
    } catch (e: any) {
      if (alive()) { offline = await inspectOffline(idx).catch(() => null); importMessage = ''; if (alive()) { $('#off').textContent = 'Descarga incompleta: ' + e.message; toast(e.message); } }
    } finally { downloading = false; if (alive()) { $<El>('#dl').disabled = false; if (offline?.complete) $('#off').textContent = offlineHtml(); } }
  }
  const off = sync.onStatus(draw);
  routeScreen.cleanup = () => { active = false; generation++; off(); offAccount(); };
  draw();
  void inspectOffline(idx).then(result => { if (alive() && !downloading) { offline = result; $('#off').textContent = offlineHtml(); } }).catch(() => { if (alive() && !downloading) $('#off').textContent = 'No se pudo comprobar la descarga. Este navegador puede tener el almacenamiento bloqueado.'; });
};



}
