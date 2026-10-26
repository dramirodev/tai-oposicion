import { saveExportFile } from '../../shared/ui/download-file.js';
import * as sync from '../../adapters/firebase/sync-facade.js';
import * as store from '../../adapters/local/legacy-store.js';
import { esc, normUi } from '../../legacy/logic.js';
import { getIndex } from '../../adapters/http/legacy-data.js';
import { inspectOffline, downloadOffline, type OfflineState } from '../../adapters/offline/cache.js';
import { cleanCfg } from '../../adapters/local/config.js';
import { $, legacyScope, toast, ask, type El } from '../../shared/ui/legacy-dom.js';
import { APP_VERSION, APP_BUILD } from '../../app/build-info.js';
import { isFull, accessLevel, devMode, setDevMode, devRevealed, revealDev } from '../../adapters/legacy/access.js';
import { notifyAccessChange } from '../../app/access-events.js';
import { exportAttemptArchive } from '../../core/application/attempts/export-attempt-archive.js';
import { importAttemptArchive } from '../../core/application/attempts/import-attempt-archive.js';
import { localAttemptRepository } from '../../adapters/local/attempt-repository.js';
import { attemptArchiveMapper } from '../../adapters/local/mappers/attempt-archive.js';
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
  let attemptArchive;
  let invalidAttempts = 0;
  if (raw.attemptHistory !== undefined) {
    const mapped = attemptArchiveMapper.toDomain(raw.attemptHistory);
    if (!mapped.ok) throw new Error(`El historial de intentos de la copia no es válido: ${mapped.reason}`);
    attemptArchive = mapped.value.archive;
    invalidAttempts = mapped.value.invalidRecords;
  }
  const serialized = JSON.stringify({stats,sessions,cards,reports,...(raw.seen ? {seen:store.cleanSeen(raw.seen)} : {}),...(raw.cfg ? {cfg:cleanCfg(raw.cfg)} : {}),...(attemptArchive ? {attemptHistory:attemptArchiveMapper.toDto(attemptArchive)} : {})});
  return {added,updated,preserved,ignored,serialized,attemptArchive,invalidAttempts,sessions:sessions.length,cards:Object.keys(cards).length,reports:Object.keys(reports).length,settings:!!raw.cfg};
}
const count = (itemCount: number, one: string, many: string) => `${itemCount} ${itemCount === 1 ? one : many}`;
export function registerSettings({ routes, go, allCards, getNewVersion, checkUpdate, applyUpdate, listManualExportSessions, createManualAiExport, deleteManualStudyHistory }: any, screen: any) {
// ───────── ajustes ─────────
routes.settings = async function () {
  const { app, $: item, screen: routeScreen } = legacyScope(screen);
  let active = true, generation = 0, downloading = false;
  const routeAccount = store.accountId();
  const exportToday = new Date().toISOString().slice(0, 10);
  const exportFrom = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  let exportChoices: { id: string; mode: 'practice' | 'simulation'; startedAt: number; endedAt?: number; attemptCount: number }[] | null = null;
  let exportArtifact: { manifestText: string; markdown: string; partFiles: { fileName: string; content: string }[]; totalBytes: number; manifest: { partCount: number; parts: { fileName: string; sessionCount: number; attemptCount: number; eventCount: number; sizeBytes: number; oversized: boolean }[] } } | null = null;
  let exportMessage = '';
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
    const syncStatus = sync.status; const ui = normUi(store.getCfg().ui); const full = isFull(), lvl = accessLevel(), dm = devMode();
    app.innerHTML = `
    <h1>Ajustes</h1>
    <div class="card"><h2 class="h3">Cuenta y sincronización</h2>
      ${syncStatus.state === 'iniciando' || syncStatus.state === 'comprobando sesión…' ? '<p>Comprobando cuenta…</p>' : syncStatus.state === 'sin conexión' ? '<p>Sin conexión: ahora no se puede comprobar la cuenta.</p>' : !sync.status.configured ? '<p>El acceso a la cuenta no está disponible. Puedes conservar y exportar el progreso de este dispositivo.</p>' :
        syncStatus.user ? `<p>Conectado como <b>${esc(syncStatus.user.name)}</b><br><small>${esc(syncStatus.state)}${syncStatus.lastSync ? ' · ' + new Date(syncStatus.lastSync).toLocaleTimeString('es-ES') : ''}</small></p>${accesoHtml(syncStatus, lvl)}<button class="btn sec" id="out">Cerrar sesión</button>` :
          '<p>Inicia sesión para tener el mismo historial en iPhone y iPad.</p><button class="btn" id="in">Entrar con Google</button>'}
      ${syncStatus.error ? `<p class="r"><small>${esc(syncStatus.error)}</small></p>` : ''}
      ${syncStatus.user && (lvl === 'propietario' || lvl === 'aprobado') && syncStatus.state !== 'sincronizado' && syncStatus.state !== 'sincronizando…' ? `${syncStatus.detail ? `<p><small>${esc(syncStatus.detail)}</small></p>` : ''}<button class="btn sec" id="retrySync">Reintentar sincronización</button>` : ''}
      <p><small>En este dispositivo: ${count(Object.keys(store.getStats()).length, 'pregunta vista', 'preguntas vistas')} · ${count(store.getSeen().length, 'tema visto', 'temas vistos')} · ${count(store.getSessions().length, 'sesión', 'sesiones')}</small></p>

    </div>
    <div class="card"><h2 class="h3">Lectura y apariencia</h2>
      <p class="sm">Tema</p>
      <div class="seg" id="th">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([textValue, text]) => `<button class="${ui.theme === textValue ? 'on' : ''}" aria-pressed="${ui.theme === textValue}" data-v="${textValue}">${text}</button>`).join('')}</div>
      <p class="sm">Tamaño de letra</p>
      <div class="seg" id="fz">${['A', 'A+', 'A++', 'A+++'].map((text, index) => `<button class="${ui.size === index ? 'on' : ''}" aria-pressed="${ui.size === index}" data-v="${index}">${text}</button>`).join('')}</div>
      <p class="sm">Lectura atenta <small>(contra los fallos por leer deprisa)</small></p>
      <div class="seg" id="lec">${[[0, 'Normal'], [1, 'Resaltar clave'], [2, 'Resaltar + frenar']].map(([textValue, text]) => `<button class="${ui.lectura === textValue ? 'on' : ''}" aria-pressed="${ui.lectura === textValue}" data-v="${textValue}">${text}</button>`).join('')}</div>
      <p><small>«Resaltar clave» marca NO, SALVO, EXCEPTO, absolutos y cifras. «Frenar» bloquea las opciones unos segundos según la longitud de la pregunta (en modo test).</small></p>
      <p><small>Teclado (iPad): 1–4 o A–D responden · Intro, → o espacio: siguiente · ←: anterior · B: en blanco · F: dudosa · P: pausa. Gestos: desliza a la izquierda para pasar y a la derecha para volver.</small></p>
      <p><small>Se guarda solo en este dispositivo.</small></p>
    </div>
    <div class="card"><h2 class="h3">Descargas y actualizaciones</h2>
      <p id="ver">Versión <b>${esc(APP_VERSION)}</b> <small>(${esc(APP_BUILD.split('+')[1] || APP_BUILD)})</small></p>
      <p id="updmsg" class="sm">${getNewVersion() ? `Hay una versión nueva: <b>${esc(getNewVersion().version)}</b>.` : 'Comprueba si hay una versión nueva; si la hay, la app se recarga para usarla.'}</p>
      <button class="btn ${getNewVersion() ? '' : 'sec'}" id="upd">${getNewVersion() ? 'Actualizar ahora' : 'Buscar actualización'}</button></div>
    ${devRevealed() || dm ? `<div class="card"><h2 class="h3">Modo desarrollador</h2><p class="sm">Acceso en este dispositivo</p><div class="seg" id="dev">${[[null, 'Automático'], ['1', 'Completo'], ['0', 'Como invitado']].map(([textValue, text]) => `<button class="${(dm ?? null) === textValue ? 'on' : ''}" aria-pressed="${(dm ?? null) === textValue}" data-v="${textValue}">${text}</button>`).join('')}</div><p><small>Automático: completo en localhost, para el propietario y los aprobados. «Como invitado» sirve para ver lo que ve alguien sin acceso.</small></p></div>` : ''}
    <div class="card"><h2 class="h3">Objetivo de estudio</h2><label class="sm" for="exd">Fecha objetivo para la cuenta atrás (no confirma una convocatoria oficial)</label><input type="date" id="exd" value="${esc(store.getCfg().exam || '')}"><p class="sm">Elige tu fecha de planificación; comprueba la fecha oficial en la convocatoria.</p></div>
    ${full ? `<div class="card"><h2 class="h3">Errores del banco</h2><p>${Object.values(store.getReports()).filter(result => result.st === 'abierto').length} por revisar. Anótalos con «Avisar de error» al contestar y exporta la lista para corregirlos.</p><button class="btn sec" id="errs">Ver errores del banco</button></div>` : ''}
    <div class="card"><h2 class="h3">Uso sin conexión</h2><p id="off" role="status" aria-live="polite">${esc(offlineHtml())}</p><p class="sm">Se comprueban los archivos de preguntas, supuestos y tarjetas guardados en este navegador. El progreso permanece asociado a tu cuenta.</p><button class="btn sec" id="dl">Descargar para uso sin conexión</button></div>
    ${full ? `<div class="card"><h2 class="h3">Tarjetas</h2><p>Exporta las tarjetas curadas (y tus fallos convertidos en tarjeta) a Anki: texto separado por tabuladores, importable con «Archivo → Importar».</p><button class="btn sec" id="anki">Exportar tarjetas a Anki (.txt)</button></div>` : ''}
    <div class="card" id="ai-study-export"><h2 class="h3">Exportar análisis para IA</h2><p>Prepara archivos locales para revisarlos o compartirlos manualmente. No se envía nada. El JSON puede contener preguntas y soluciones de examen. Las explicaciones incluidas deben estar revisadas.</p>
      <div class="row"><label>Desde <input type="date" id="ai-export-from" value="${exportFrom}"></label><label>Hasta <input type="date" id="ai-export-to" value="${exportToday}"></label></div>
      <div class="seg" role="group" aria-label="Modalidades para exportar"><label><input type="checkbox" id="ai-export-practice" checked> Práctica</label><label><input type="checkbox" id="ai-export-simulation" checked> Simulacros</label></div>
      <button class="btn sec" id="ai-export-find">Buscar sesiones completadas</button>
      <div id="ai-export-sessions" class="ai-export-sessions" aria-live="polite">${exportChoices === null ? '' : exportChoices.length ? exportChoices.map((choice, index) => `<label class="ai-export-session"><input type="checkbox" data-ai-export-session="${esc(choice.id)}" checked> ${choice.mode === 'simulation' ? 'Simulacro' : 'Práctica'} · ${new Date(choice.startedAt).toLocaleString('es-ES')} · ${count(choice.attemptCount, 'pregunta', 'preguntas')}</label>`).join('') : '<p class="sub">No hay sesiones completadas con esos filtros.</p>'}</div>
      <button class="btn" id="ai-export-build" ${!exportChoices?.length ? 'disabled' : ''}>Preparar vista previa y archivos</button>
      <p id="ai-export-status" role="status" aria-live="polite">${esc(exportMessage)}</p>
      ${exportArtifact ? `<div class="card ai-export-preview"><p>Vista previa: ${count(exportArtifact.manifest.partCount, 'parte JSON', 'partes JSON')} · ${count(exportArtifact.manifest.parts.reduce((sum, part) => sum + part.sessionCount, 0), 'sesión', 'sesiones')} · ${count(exportArtifact.manifest.parts.reduce((sum, part) => sum + part.attemptCount, 0), 'intento', 'intentos')} · ${(exportArtifact.totalBytes / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} KB en total.</p><ul>${exportArtifact.manifest.parts.map(part => `<li>${esc(part.fileName)}: ${part.sessionCount} sesiones, ${part.attemptCount} intentos, ${part.eventCount} eventos · ${part.sizeBytes.toLocaleString('es-ES')} bytes${part.oversized ? ' · supera el tamaño preferido y se conserva completa' : ''}</li>`).join('')}</ul><p>Incluye métricas, tiempos y calidad, estados, confianza, descartes, marcas, contenido disponible de la misma revisión y explicaciones revisadas.</p><button class="btn sec" id="ai-export-download-manifest">Descargar manifiesto JSON</button> <button class="btn sec" id="ai-export-download-markdown">Descargar informe Markdown</button>${exportArtifact.partFiles.map((part, index) => `<button class="btn sec" data-ai-export-part="${index}">Descargar ${esc(part.fileName)}</button>`).join('')}</div>` : ''}
      <hr><p>El borrado afecta al historial detallado de este ámbito en el dispositivo y crea una marca para que las copias antiguas no lo restauren. Conserva estadísticas agregadas, falladas, sesiones históricas y el progreso de estudio. Las copias ya descargadas no se borran.</p><button class="btn danger" id="ai-history-delete">Borrar historial detallado</button>
    </div>
    <div class="card"><h2 class="h3">Copias de seguridad</h2><p class="sm">Importar combina los registros válidos con tu progreso actual y conserva los ausentes en la copia. Revisa el resumen antes de confirmar. <a href="#/ayuda?tema=progreso">Ayuda de guardado y sincronización</a></p><p id="importmsg" role="status">${esc(importMessage)}</p><button class="btn sec" id="ex">Exportar progreso</button> <label class="btn sec file">Importar<input type="file" id="im" accept=".json"></label></div>
    <div class="card"><h2 class="h3">Zona delicada</h2><button class="btn danger" id="rs">Borrar progreso de este dispositivo</button></div>
    <details class="card" id="diagnostic"><summary>Diagnóstico técnico</summary><p>Versión: ${esc(APP_BUILD)}</p><p>Dominio: ${esc(syncStatus.host || 'no disponible')} · autenticación: ${esc(syncStatus.authDomain || 'no disponible')}</p><p>Estado: ${esc(syncStatus.state)}</p></details>
    <p class="sub">Banco: ${idx.n} preguntas + ${idx.nsup} de supuestos.</p>`;
    let taps = 0, tt: any = 0;
    item('#ver').onclick = () => { clearTimeout(tt); tt = setTimeout(() => taps = 0, 1500); if (++taps >= 7 && !devRevealed()) { revealDev(); toast('Modo desarrollador activado'); draw(); } };
    item('#dev') && (item('#dev').onclick = event => { const element = (event.target as El).closest<El>('button'); if (element) { setDevMode(element.dataset.v! === 'null' ? null : element.dataset.v!); notifyAccessChange(); draw(); } });
    item('#req') && (item<El>('#req').onclick = async event => { (event.target as El).disabled = true; (event.target as El).textContent = 'Enviando…'; const sent = await sync.requestAccess(); if (!alive()) return; if (!sent) toast('No se pudo enviar la solicitud. Inténtalo de nuevo.'); draw(); });
    item('#in') && (item('#in').onclick = () => sync.login());
    item('#out') && (item('#out').onclick = () => sync.logout());
    item('#retrySync') && (item('#retrySync').onclick = () => sync.retry());
    item('#errs') && (item('#errs').onclick = () => go('#/errores'));
    item('#upd').onclick = async () => {
      if (!getNewVersion()) {
        item<El>('#upd').disabled = true; item('#upd').textContent = 'Buscando…';
        const count = await checkUpdate();
        if (!alive()) return;
        if (count === undefined) { toast('No se pudo comprobar: sin conexión.'); } else if (!count) { toast('Ya tienes la última versión.'); }
        draw(); return;
      }
      if (await ask(`Se recargará la app para pasar a la versión ${getNewVersion().version}. Lo que tengas en curso se guarda.`, 'Actualizar') && alive()) applyUpdate();
    };
    item<El>('#exd').onchange = event => { if (/^\d{4}-\d\d-\d\d$/.test((event.target as El).value)) store.setCfg('exam', (event.target as El).value); };
    item('#th').onclick = event => { const element = (event.target as El).closest<El>('button'); if (element) { store.setCfg('ui', { ...normUi(store.getCfg().ui), theme: element.dataset.v! }); draw(); } };
    item('#lec').onclick = event => { const element = (event.target as El).closest<El>('button'); if (element) { store.setCfg('ui', { ...normUi(store.getCfg().ui), lectura: +element.dataset.v! }); draw(); } };
    item('#fz').onclick = event => { const element = (event.target as El).closest<El>('button'); if (element) { store.setCfg('ui', { ...normUi(store.getCfg().ui), size: +element.dataset.v! }); draw(); } };
    item<El>('#dl').disabled = downloading;
    item('#dl').onclick = () => download();
    const exportDates = () => {
      const fromValue = item<El>('#ai-export-from').value, toValue = item<El>('#ai-export-to').value;
      if (!/^\d{4}-\d\d-\d\d$/.test(fromValue) || !/^\d{4}-\d\d-\d\d$/.test(toValue)) throw new Error('Elige un periodo válido.');
      const from = Date.parse(`${fromValue}T00:00:00.000Z`), to = Date.parse(`${toValue}T00:00:00.000Z`) + 86400000;
      if (to <= from) throw new Error('La fecha «Hasta» debe ser igual o posterior a «Desde».');
      const modes = [item('#ai-export-practice').checked ? 'practice' : null, item('#ai-export-simulation').checked ? 'simulation' : null].filter(Boolean);
      if (!modes.length) throw new Error('Selecciona práctica, simulacros o ambos.');
      return { from, to, modes };
    };
    item('#ai-export-find').onclick = async () => {
      try {
        const filters = exportDates();
        exportMessage = 'Buscando sesiones completadas…'; exportArtifact = null; draw();
        const choices = await listManualExportSessions(filters.from, filters.to, filters.modes);
        exportChoices = choices;
        if (!alive()) return;
        exportMessage = `${count(choices.length, 'sesión completada', 'sesiones completadas')} disponibles.`; draw();
      } catch (error) { exportMessage = (error as Error).message; draw(); }
    };
    item('#ai-export-build').onclick = async () => {
      try {
        const filters = exportDates();
        const sessionIds = [...app.querySelectorAll<HTMLInputElement>('[data-ai-export-session]:checked')].map(input => input.dataset.aiExportSession!);
        if (!sessionIds.length) throw new Error('Selecciona al menos una sesión.');
        exportMessage = 'Preparando archivos…'; draw();
        exportArtifact = await createManualAiExport({ ...filters, sessionIds });
        if (!alive()) return;
        exportMessage = 'Vista previa lista. Los archivos solo se guardan si pulsas cada botón de descarga.'; draw();
      } catch (error) { exportMessage = (error as Error).message; draw(); }
    };
    item('#ai-export-download-manifest') && (item('#ai-export-download-manifest').onclick = () => exportArtifact && saveExportFile('tai-estudio-manifiesto.json', exportArtifact.manifestText, 'application/json;charset=utf-8'));
    item('#ai-export-download-markdown') && (item('#ai-export-download-markdown').onclick = () => exportArtifact && saveExportFile('tai-estudio-informe.md', exportArtifact.markdown, 'text/markdown;charset=utf-8'));
    app.querySelectorAll<HTMLButtonElement>('[data-ai-export-part]').forEach(button => button.onclick = () => {
      const part = exportArtifact?.partFiles[Number(button.dataset.aiExportPart)];
      if (part) saveExportFile(part.fileName, part.content, 'application/json;charset=utf-8');
    });
    item('#ai-history-delete').onclick = async () => {
      if (!(await ask('Se eliminarán del dispositivo los intentos, eventos y sesiones detalladas de este ámbito. Las estadísticas agregadas y las sesiones históricas permanecen. La marca de borrado se sincronizará con la cuenta cuando haya conexión; las copias descargadas previamente no se borran. ¿Continuar?', 'Borrar historial detallado', true))) return;
      if (!alive()) return;
      try {
        const result = await deleteManualStudyHistory();
        if (!alive()) return;
        exportChoices = null; exportArtifact = null;
        exportMessage = `Historial detallado borrado. ${result.accountSyncPending ? 'La marca de borrado queda pendiente de sincronizar con la cuenta.' : 'Borrado local del ámbito invitado.'}`;
        draw(); toast('El progreso agregado sigue intacto.');
      } catch { if (alive()) { exportMessage = 'No se pudo borrar el historial detallado.'; draw(); } }
    };
    item('#anki') && (item('#anki').onclick = async () => {
      const cs = await allCards(); if (!alive()) return; const callback = (item: any) => String(item).replace(/[\t\r\n]+/g, ' ');
      const txt = '#separator:tab\n#html:false\n#tags column:4\n' + cs.map((question: any) => [callback(question.q), callback(question.a), callback(question.ref || ''), callback((question.t || '').replace('.', '_') + ' ' + (question.tipo || ''))].join('\t')).join('\n');
      saveExportFile('tai-tarjetas-anki.txt', txt, 'text/plain;charset=utf-8');
    });
    item('#ex').onclick = async () => {
      const attemptHistory = await exportAttemptArchive(localAttemptRepository, routeAccount || 'guest', Date.now());
      if (!alive()) return;
      const backup = JSON.parse(store.exportAll());
      backup.attemptHistory = attemptArchiveMapper.toDto(attemptHistory);
      saveExportFile('tai-progreso.json', JSON.stringify(backup), 'application/json');
    };
    item<El>('#im').onchange = async event => {
      const file = (event.target as El).files?.[0], owner = store.accountId();
      if (!file || !alive()) return;
      try {
        if (file.size > 20e6) throw new Error('Archivo no válido: supera 20 MB');
        const txt = await file.text();
        if (!alive() || owner !== store.accountId()) return;
        const priorValue = previewImport(txt);
        const summary = `${count(priorValue.added, 'pregunta nueva', 'preguntas nuevas')}, ${count(priorValue.updated, 'pregunta actualizada', 'preguntas actualizadas')} y ${count(priorValue.preserved, 'pregunta conservada', 'preguntas conservadas')}. ${count(priorValue.sessions, 'sesión válida', 'sesiones válidas')}, ${count(priorValue.cards, 'tarjeta válida', 'tarjetas válidas')} y ${count(priorValue.reports, 'aviso válido', 'avisos válidos')}. ${count(priorValue.attemptArchive?.attempts.length || 0, 'intento detallado', 'intentos detallados')}. ${count(priorValue.ignored + priorValue.invalidAttempts, 'registro descartado por no ser válido', 'registros descartados por no ser válidos')}.${priorValue.settings ? ' También se importarán los ajustes válidos de la copia.' : ''}`;
        if (!(await ask(summary + ' ¿Combinar esta copia con tu progreso?', 'Importar copia'))) return;
        if (!alive() || owner !== store.accountId()) return;
        store.importAll(priorValue.serialized);
        if (priorValue.attemptArchive) {
          await importAttemptArchive(localAttemptRepository, owner || 'guest', priorValue.attemptArchive);
          if (!alive() || owner !== store.accountId()) return;
        }
        importMessage = `Copia combinada: ${summary} Guardada en este dispositivo. ${sync.status.user ? 'Pendiente de sincronizar hasta que la cuenta confirme la sincronización.' : 'Pendiente de sincronizar hasta iniciar sesión con acceso aprobado.'}`;
        draw(); toast('Copia importada; el progreso anterior se conserva.');
      } catch (error: any) { if (alive()) { importMessage = error.message; draw(); toast(error.message); } }
    };
    if (focusGroup && focusValue !== undefined) {
      const button = Array.from(document.getElementById(focusGroup)?.querySelectorAll<HTMLButtonElement>('button') || []).find(button => button.dataset.v === focusValue);
      button?.focus({preventScroll:true});
    }
    item('#rs').onclick = async () => { const owner = store.accountId(); if (await ask('¿Borrar TODO el progreso de este dispositivo? (Si hay sesión iniciada, lo sincronizado en la nube se volverá a descargar.)', 'Borrar todo', true) && alive() && owner === store.accountId()) { store.resetAll(); toast('Borrado'); } };
  };
  const accesoHtml = (state: any, lvl: any) => lvl === 'propietario' ? `<p><small>Propietario · acceso completo.</small> <a href="#/acceso">Gestionar accesos${state.reqs.length ? ' (' + state.reqs.length + ' pendientes)' : ''}</a></p>`
    : lvl === 'aprobado' ? '<p><small>Acceso completo aprobado.</small></p>'
    : lvl === 'pendiente' ? '<p><small>Acceso pendiente de aprobación. Puedes continuar con la sesión rápida; la cuenta se actualizará al recibir la aprobación.</small></p>'
    : '<p><small>Acceso limitado: solo la sesión rápida de 5 minutos.</small></p><button class="btn" id="req">Pedir acceso completo</button>';
  async function download() {
    if (downloading || !alive()) return;
    downloading = true; draw();
    const current = generation;
    try {
      offline = await downloadOffline(idx, (done, total) => {
        if (alive() && current === generation) item('#off').textContent = `Descargando… ${done}/${total} archivos`;
      }, alive);
    } catch (error: any) {
      if (alive()) { offline = await inspectOffline(idx).catch(() => null); importMessage = ''; if (alive()) { item('#off').textContent = 'Descarga incompleta: ' + error.message; toast(error.message); } }
    } finally { downloading = false; if (alive()) { item<El>('#dl').disabled = false; if (offline?.complete) item('#off').textContent = offlineHtml(); } }
  }
  const off = sync.onStatus(draw);
  routeScreen.cleanup = () => { active = false; generation++; off(); offAccount(); };
  draw();
  void inspectOffline(idx).then(result => { if (alive() && !downloading) { offline = result; item('#off').textContent = offlineHtml(); } }).catch(() => { if (alive() && !downloading) item('#off').textContent = 'No se pudo comprobar la descarga. Este navegador puede tener el almacenamiento bloqueado.'; });
};



}
