import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ask, toast } from '../../shared/ui/dialog-actions.js';
import { saveExportFile } from '../../shared/ui/download-file.js';
import { useStudyServices, type SettingsSnapshot } from '../../shared/ui/study-services.js';

interface AiExport {
  manifestText: string; markdown: string; totalBytes: number;
  partFiles: { fileName: string; content: string }[];
  manifest: { partCount: number; parts: { fileName: string; sessionCount: number; attemptCount: number; eventCount: number; sizeBytes: number; oversized: boolean }[] };
}
const count = (amount: number, singular: string, plural: string) => `${amount} ${amount === 1 ? singular : plural}`;
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export function SettingsPage() {
  const { settings } = useStudyServices();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(() => settings.getSnapshot());
  const [downloading, setDownloading] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [aiChoices, setAiChoices] = useState<Awaited<ReturnType<typeof settings.findAiSessions>> | null>(null);
  const [aiExport, setAiExport] = useState<AiExport | null>(null);
  const [aiFrom, setAiFrom] = useState(() => localDate(new Date(Date.now() - 90 * 86400000)));
  const [aiTo, setAiTo] = useState(() => localDate(new Date()));
  const [aiModes, setAiModes] = useState({ practice: true, simulation: true });
  const [selectedAiIds, setSelectedAiIds] = useState<Set<string>>(new Set());
  const developerTaps = useRef(0);
  const activeRef = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    activeRef.current = true;
    const off = settings.subscribe(() => { if (mounted) setSnapshot(settings.getSnapshot()); });
    void settings.load().then(() => { if (mounted) setSnapshot(settings.getSnapshot()); }).catch(() => {});
    return () => { mounted = false; off(); activeRef.current = false; };
  }, [settings]);

  const update = () => setSnapshot(settings.getSnapshot());
  const signedInMessage = snapshot.sync.state === 'iniciando' || snapshot.sync.state === 'comprobando sesión…'
    ? 'Comprobando cuenta…' : snapshot.sync.state === 'sin conexión' ? 'Sin conexión: ahora no se puede comprobar la cuenta.'
      : !snapshot.sync.configured ? 'El acceso a la cuenta no está disponible. Puedes conservar y exportar el progreso de este dispositivo.'
        : snapshot.sync.user ? `Conectado como ${snapshot.sync.user.name}` : 'Inicia sesión para tener el mismo historial en iPhone y iPad.';

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await settings.checkUpdate();
      if (result === undefined) toast('No se pudo comprobar: sin conexión.');
      else if (!result) toast('Ya tienes la última versión.');
      update();
    } finally { setCheckingUpdate(false); }
  };

  const download = async () => {
    const account = settings.accountId(); setDownloading(true); setOfflineProgress('Preparando descarga…');
    try {
      await settings.downloadOffline((done, total) => setOfflineProgress(`Descargando… ${done}/${total} archivos`), () => activeRef.current && settings.accountId() === account);
      setOfflineProgress(''); toast('Descarga sin conexión completada.'); update();
    } catch (error) {
      setOfflineProgress(''); toast(error instanceof Error ? error.message : 'No se pudo completar la descarga.'); update();
    } finally { setDownloading(false); }
  };

  const exportBackup = async () => {
    const account = settings.accountId();
    try {
      const backup = await settings.exportBackup();
      if (settings.accountId() === account) saveExportFile('tai-progreso.json', backup, 'application/json');
    }
    catch { toast('No se pudo preparar la copia de seguridad.'); }
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    const account = settings.accountId();
    try {
      if (file.size > 20e6) throw new Error('Archivo no válido: supera 20 MB');
      const preview = settings.previewBackup(await file.text());
      if (settings.accountId() !== account) return;
      if (!await ask(`${preview.summary} ¿Combinar esta copia con tu progreso?`, 'Importar copia')) return;
      if (settings.accountId() !== account) return;
      await settings.importBackup(preview.serialized, preview.attemptArchive);
      const status = settings.getSnapshot().sync.user ? 'Pendiente de sincronizar hasta que la cuenta confirme la sincronización.' : 'Pendiente de sincronizar hasta iniciar sesión con acceso aprobado.';
      setBackupMessage(`Copia combinada: ${preview.summary} Guardada en este dispositivo. ${status}`);
      toast('Copia importada; el progreso anterior se conserva.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar la copia.';
      setBackupMessage(message); toast(message);
    } finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  const findAiSessions = async () => {
    const account = settings.accountId();
    try {
      const from = Date.parse(`${aiFrom}T00:00:00.000Z`), to = Date.parse(`${aiTo}T00:00:00.000Z`) + 86400000;
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw new Error('Elige un periodo válido y asegúrate de que «Hasta» sea posterior o igual a «Desde».');
      const modes = [aiModes.practice ? 'practice' : null, aiModes.simulation ? 'simulation' : null].filter((mode): mode is 'practice' | 'simulation' => !!mode);
      if (!modes.length) throw new Error('Selecciona práctica, simulacros o ambos.');
      setAiChoices(null); setAiExport(null); setAiMessage('Buscando sesiones completadas…');
      const choices = await settings.findAiSessions(from, to, modes);
      if (settings.accountId() !== account) return;
      setAiChoices(choices); setSelectedAiIds(new Set(choices.map(choice => choice.id)));
      setAiMessage(`${count(choices.length, 'sesión completada', 'sesiones completadas')} disponibles.`);
    } catch (error) { setAiMessage(error instanceof Error ? error.message : 'No se pudieron buscar las sesiones.'); }
  };
  const buildAiExport = async () => {
    const account = settings.accountId();
    try {
      const from = Date.parse(`${aiFrom}T00:00:00.000Z`), to = Date.parse(`${aiTo}T00:00:00.000Z`) + 86400000;
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw new Error('Elige un periodo válido.');
      const modes = [aiModes.practice ? 'practice' : null, aiModes.simulation ? 'simulation' : null].filter((mode): mode is 'practice' | 'simulation' => !!mode);
      if (!modes.length || !selectedAiIds.size) throw new Error('Selecciona una modalidad y al menos una sesión.');
      setAiMessage('Preparando archivos…');
      const artifact = await settings.buildAiExport({ from, to, modes, sessionIds: [...selectedAiIds] }) as AiExport;
      if (settings.accountId() !== account) return;
      setAiExport(artifact);
      setAiMessage('Vista previa lista. Los archivos solo se guardan si pulsas cada botón de descarga.');
    } catch (error) { setAiMessage(error instanceof Error ? error.message : 'No se pudo preparar la exportación.'); }
  };
  const deleteAiHistory = async () => {
    const account = settings.accountId();
    const approved = await ask('Se eliminarán del dispositivo los intentos, eventos y sesiones detalladas de este ámbito. Las estadísticas agregadas y las sesiones históricas permanecen. La marca de borrado se sincronizará con la cuenta cuando haya conexión; las copias descargadas previamente no se borran. ¿Continuar?', 'Borrar historial detallado', true);
    if (!approved) return;
    if (settings.accountId() !== account) return;
    try {
      const outcome = await settings.deleteAiHistory(); setAiChoices(null); setAiExport(null);
      setAiMessage(`Historial detallado borrado. ${outcome.accountSyncPending ? 'La marca de borrado queda pendiente de sincronizar con la cuenta.' : 'Borrado local del ámbito invitado.'}`);
      toast('El progreso agregado sigue intacto.');
    } catch { setAiMessage('No se pudo borrar el historial detallado.'); }
  };
  const resetProgress = async () => {
    const account = settings.accountId();
    if (await ask('¿Borrar TODO el progreso de este dispositivo? (Si hay sesión iniciada, lo sincronizado en la nube se volverá a descargar.)', 'Borrar todo', true) && settings.accountId() === account) { settings.resetAll(); toast('Borrado'); }
  };

  return <>
    <h1>Ajustes</h1>
    <section className="card"><h2 className="h3">Cuenta y sincronización</h2><p>{signedInMessage}</p>
      {snapshot.sync.user && <p><small>{snapshot.sync.state}{snapshot.sync.lastSync ? ` · ${new Date(snapshot.sync.lastSync).toLocaleTimeString('es-ES')}` : ''}</small></p>}
      {snapshot.sync.user ? <button className="btn sec" onClick={() => void settings.logout()}>Cerrar sesión</button> : snapshot.sync.configured && <button className="btn" onClick={() => void settings.login()}>Entrar con Google</button>}
      {snapshot.level === 'propietario' && <p><small>Propietario · acceso completo.</small> <Link to="/acceso">Gestionar accesos{snapshot.sync.requests.length ? ` (${snapshot.sync.requests.length} pendientes)` : ''}</Link></p>}
      {snapshot.level === 'aprobado' && <p><small>Acceso completo aprobado.</small></p>}
      {snapshot.level === 'pendiente' && <p><small>Acceso pendiente de aprobación. Puedes continuar con la sesión rápida; la cuenta se actualizará al recibir la aprobación.</small></p>}
      {snapshot.level === 'invitado' && snapshot.sync.user && <><p><small>Acceso limitado: solo la sesión rápida de 5 minutos.</small></p><button className="btn" onClick={async event => { const button = event.currentTarget; button.disabled = true; const sent = await settings.requestAccess(); if (!sent) toast('No se pudo enviar la solicitud. Inténtalo de nuevo.'); update(); button.disabled = false; }}>Pedir acceso completo</button></>}
      {snapshot.sync.error && <p className="r"><small>{snapshot.sync.error}</small></p>}
      {snapshot.sync.user && snapshot.full && snapshot.sync.state !== 'sincronizado' && snapshot.sync.state !== 'sincronizando…' && <><p>{snapshot.sync.detail && <small>{snapshot.sync.detail}</small>}</p><button className="btn sec" onClick={() => void settings.retrySync()}>Reintentar sincronización</button></>}
      <p><small>En este dispositivo: {count(snapshot.progress.questions, 'pregunta vista', 'preguntas vistas')} · {count(snapshot.progress.topics, 'tema visto', 'temas vistos')} · {count(snapshot.progress.sessions, 'sesión', 'sesiones')}</small></p>
    </section>

    <section className="card"><h2 className="h3">Lectura y apariencia</h2>
      <PreferenceGroup title="Tema" current={snapshot.ui.theme} values={[["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]]} onChange={value => settings.setPreference('theme', value)} />
      <PreferenceGroup title="Tamaño de letra" current={String(snapshot.ui.size)} values={[["0", "A"], ["1", "A+"], ["2", "A++"], ["3", "A+++"]]} onChange={value => settings.setPreference('size', value)} />
      <PreferenceGroup title="Lectura atenta" current={String(snapshot.ui.lectura)} values={[["0", "Normal"], ["1", "Resaltar clave"], ["2", "Resaltar + frenar"]]} onChange={value => settings.setPreference('lectura', value)} />
      <p><small>«Resaltar clave» marca NO, SALVO, EXCEPTO, absolutos y cifras. «Frenar» bloquea las opciones unos segundos según la longitud de la pregunta (en modo test).</small></p>
      <p><small>Teclado (iPad): 1–4 o A–D responden · Intro, → o espacio: siguiente · ←: anterior · B: en blanco · F: dudosa · P: pausa. Gestos: desliza a la izquierda para pasar y a la derecha para volver.</small></p>
      <p><small>Estas preferencias se guardan solo en este dispositivo.</small></p>
    </section>

    <section className="card"><h2 className="h3">Descargas y actualizaciones</h2><button className="ghost sm" type="button" aria-label="Versión de la aplicación. Pulsa siete veces para activar el modo desarrollador." onClick={() => { developerTaps.current++; if (developerTaps.current >= 7) { settings.revealDev(); developerTaps.current = 0; toast('Modo desarrollador activado'); } }}>Versión <b>{snapshot.version}</b> <small>({snapshot.build})</small></button>
      <p className="sm">{snapshot.update ? `Hay una versión nueva: ${snapshot.update}.` : 'Comprueba si hay una versión nueva; si la hay, la app se recarga para usarla.'}</p>
      <button className={`btn ${snapshot.update ? '' : 'sec'}`} disabled={checkingUpdate} onClick={async () => { if (snapshot.update) { if (await ask(`Se recargará la app para pasar a la versión ${snapshot.update}. Lo que tengas en curso se guarda.`, 'Actualizar')) await settings.applyUpdate(); } else await checkUpdate(); }}>{checkingUpdate ? 'Buscando…' : snapshot.update ? 'Actualizar ahora' : 'Buscar actualización'}</button>
    </section>

    {(snapshot.devRevealed || snapshot.devMode !== null) && <section className="card"><h2 className="h3">Modo desarrollador</h2><p className="sm">Acceso en este dispositivo</p><div className="seg" role="group" aria-label="Modo desarrollador"><DevButton value={null} current={snapshot.devMode} label="Automático" onChange={settings.setDevMode} /><DevButton value="1" current={snapshot.devMode} label="Completo" onChange={settings.setDevMode} /><DevButton value="0" current={snapshot.devMode} label="Como invitado" onChange={settings.setDevMode} /></div><p><small>Automático: completo en localhost, para el propietario y los aprobados. «Como invitado» sirve para ver lo que ve alguien sin acceso.</small></p></section>}

    <section className="card"><h2 className="h3">Objetivo de estudio</h2><label className="sm" htmlFor="exam-date">Fecha objetivo para la cuenta atrás (no confirma una convocatoria oficial)</label><input id="exam-date" type="date" value={snapshot.exam} onChange={event => settings.setExam(event.target.value)} /><p className="sm">Elige tu fecha de planificación; comprueba la fecha oficial en la convocatoria.</p></section>
    {snapshot.full && <section className="card"><h2 className="h3">Errores del banco</h2><p>{snapshot.progress.openReports} por revisar. Anótalos con «Avisar de error» al contestar y exporta la lista para corregirlos.</p><button className="btn sec" onClick={() => navigate('/errores')}>Ver errores del banco</button></section>}
    <section className="card"><h2 className="h3">Uso sin conexión</h2><p role="status" aria-live="polite">{offlineProgress || offlineDescription(snapshot)}</p><p className="sm">Se comprueban los archivos de preguntas, supuestos y tarjetas guardados en este navegador. El progreso permanece asociado a tu cuenta.</p><button className="btn sec" disabled={downloading} onClick={() => void download()}>{downloading ? 'Descargando…' : 'Descargar para uso sin conexión'}</button></section>
    {snapshot.full && <section className="card"><h2 className="h3">Tarjetas</h2><p>Exporta las tarjetas curadas (y tus fallos convertidos en tarjeta) a Anki: texto separado por tabuladores, importable con «Archivo → Importar».</p><button className="btn sec" onClick={async () => { try { saveExportFile('tai-tarjetas-anki.txt', await settings.exportAnki(), 'text/plain;charset=utf-8'); } catch { toast('No se pudieron exportar las tarjetas.'); } }}>Exportar tarjetas a Anki (.txt)</button></section>}

    <section className="card" id="ai-study-export"><h2 className="h3">Exportar análisis para IA</h2><p>Prepara archivos locales para revisarlos o compartirlos manualmente. No se envía nada. El JSON puede contener preguntas y soluciones de examen. Las explicaciones incluidas deben estar revisadas.</p>
      <div className="row"><label>Desde <input type="date" value={aiFrom} onChange={event => setAiFrom(event.target.value)} /></label><label>Hasta <input type="date" value={aiTo} onChange={event => setAiTo(event.target.value)} /></label></div>
      <div className="seg" role="group" aria-label="Modalidades para exportar"><label><input type="checkbox" checked={aiModes.practice} onChange={event => setAiModes(value => ({ ...value, practice: event.target.checked }))} /> Práctica</label><label><input type="checkbox" checked={aiModes.simulation} onChange={event => setAiModes(value => ({ ...value, simulation: event.target.checked }))} /> Simulacros</label></div>
      <button className="btn sec" onClick={() => void findAiSessions()}>Buscar sesiones completadas</button>
      <div className="ai-export-sessions" aria-live="polite">{aiChoices === null ? null : aiChoices.length ? aiChoices.map(choice => <label className="ai-export-session" key={choice.id}><input type="checkbox" checked={selectedAiIds.has(choice.id)} onChange={event => setSelectedAiIds(current => { const next = new Set(current); if (event.target.checked) next.add(choice.id); else next.delete(choice.id); return next; })} /> {choice.mode === 'simulation' ? 'Simulacro' : 'Práctica'} · {new Date(choice.startedAt).toLocaleString('es-ES')} · {count(choice.attemptCount, 'pregunta', 'preguntas')}</label>) : <p className="sub">No hay sesiones completadas con esos filtros.</p>}</div>
      <button className="btn" disabled={!aiChoices?.length} onClick={() => void buildAiExport()}>Preparar vista previa y archivos</button><p role="status" aria-live="polite">{aiMessage}</p>
      {aiExport && <AiExportPreview artifact={aiExport} onDownload={(name, content, type) => saveExportFile(name, content, type)} />}
      <hr /><p>El borrado afecta al historial detallado de este ámbito en el dispositivo y crea una marca para que las copias antiguas no lo restauren. Conserva estadísticas agregadas, falladas, sesiones históricas y el progreso de estudio. Las copias ya descargadas no se borran.</p><button className="btn danger" onClick={() => void deleteAiHistory()}>Borrar historial detallado</button>
    </section>

    <section className="card"><h2 className="h3">Copias de seguridad <HelpIcon topic="progreso" label="Ayuda sobre guardado y sincronización" /></h2><p className="sm">Importar combina los registros válidos con tu progreso actual y conserva los ausentes en la copia. Revisa el resumen antes de confirmar.</p><p role="status">{backupMessage}</p><button className="btn sec" onClick={() => void exportBackup()}>Exportar progreso</button> <label className="btn sec file">Importar<input ref={fileRef} type="file" accept=".json" onChange={event => void importBackup(event.target.files?.[0])} /></label></section>
    <section className="card"><h2 className="h3">Zona delicada</h2><button className="btn danger" onClick={() => void resetProgress()}>Borrar progreso de este dispositivo</button></section>
    <details className="card"><summary>Diagnóstico técnico</summary><p>Versión: {snapshot.version} ({snapshot.build})</p><p>Dominio: {snapshot.sync.host || 'no disponible'} · autenticación: {snapshot.sync.authDomain || 'no disponible'}</p><p>Estado: {snapshot.sync.state}</p></details>
    {snapshot.index && <p className="sub">Banco: {snapshot.index.questions} preguntas + {snapshot.index.scenarios} de supuestos.</p>}
  </>;
}

function PreferenceGroup({ title, current, values, onChange }: { title: string; current: string; values: readonly (readonly [string, string])[]; onChange(value: string): void }) {
  return <><p className="sm">{title}</p><div className="seg" role="group" aria-label={title}>{values.map(([value, label]) => <button key={value} className={current === value ? 'on' : ''} aria-pressed={current === value} onClick={() => onChange(value)}>{label}</button>)}</div></>;
}

function HelpIcon({ topic, label }: { topic: string; label: string }) {
  return <Link className="help-icon-link" to={`/ayuda?tema=${encodeURIComponent(topic)}`} aria-label={label}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3 2.5V14M12 17h.01" /></svg></Link>;
}

function DevButton({ value, current, label, onChange }: { value: string | null; current: string | null; label: string; onChange(value: string | null): void }) {
  const active = current === value;
  return <button className={active ? 'on' : ''} aria-pressed={active} onClick={() => onChange(value)}>{label}</button>;
}

function offlineDescription(snapshot: SettingsSnapshot): string {
  const offline = snapshot.offline;
  if (!offline) return 'Comprobando archivos guardados…';
  if (offline.complete) return `Banco, supuestos y tarjetas disponibles sin conexión (${offline.total} archivos).${offline.completedAt ? ` Descarga verificada: ${new Date(offline.completedAt).toLocaleString('es-ES')}.` : ' Fecha de descarga no registrada.'}`;
  return `Descarga incompleta: faltan ${offline.missing.length} de ${offline.total} archivos. ${offline.missing.slice(0, 4).join(', ')}${offline.missing.length > 4 ? '…' : ''}`;
}

function AiExportPreview({ artifact, onDownload }: { artifact: AiExport; onDownload(name: string, content: string, type: string): void }) {
  const sessions = artifact.manifest.parts.reduce((sum, part) => sum + part.sessionCount, 0);
  const attempts = artifact.manifest.parts.reduce((sum, part) => sum + part.attemptCount, 0);
  const events = artifact.manifest.parts.reduce((sum, part) => sum + part.eventCount, 0);
  return <div className="card ai-export-preview"><p>Vista previa: {count(artifact.manifest.partCount, 'parte JSON', 'partes JSON')} · {count(sessions, 'sesión', 'sesiones')} · {count(attempts, 'intento', 'intentos')} · {events} eventos · {(artifact.totalBytes / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} KB en total.</p>
    <ul>{artifact.manifest.parts.map(part => <li key={part.fileName}>{part.fileName}: {part.sessionCount} sesiones, {part.attemptCount} intentos, {part.eventCount} eventos · {part.sizeBytes.toLocaleString('es-ES')} bytes{part.oversized ? ' · supera el tamaño preferido y se conserva completa' : ''}</li>)}</ul>
    <p>Incluye métricas, tiempos y calidad, estados, confianza, descartes, marcas, contenido disponible de la misma revisión y explicaciones revisadas.</p>
    <button className="btn sec" onClick={() => onDownload('tai-estudio-manifiesto.json', artifact.manifestText, 'application/json;charset=utf-8')}>Descargar manifiesto JSON</button> <button className="btn sec" onClick={() => onDownload('tai-estudio-informe.md', artifact.markdown, 'text/markdown;charset=utf-8')}>Descargar informe Markdown</button>
    {artifact.partFiles.map(part => <button className="btn sec" key={part.fileName} onClick={() => onDownload(part.fileName, part.content, 'application/json;charset=utf-8')}>Descargar {part.fileName}</button>)}
  </div>;
}
