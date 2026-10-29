import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ask, toast } from '../../shared/ui/dialog-actions.js';
import { saveExportFile } from '../../shared/ui/download-file.js';
import { useStudyService, type SettingsServices, type SettingsSnapshot } from '../../shared/ui/study-services.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';

interface AiExport {
  manifestText: string; markdown: string; totalBytes: number;
  partFiles: { fileName: string; content: string }[];
  manifest: { partCount: number; parts: { fileName: string; sessionCount: number; attemptCount: number; eventCount: number; sizeBytes: number; oversized: boolean }[] };
}
const count = (amount: number, singular: string, plural: string) => `${amount} ${amount === 1 ? singular : plural}`;
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export function SettingsPage() {
  const settings = useStudyService('settings');
  const snapshot = useSettingsSnapshot(settings);
  const navigate = useNavigate();
  return <>
    <h1>Ajustes</h1>
    <AccountSection settings={settings} snapshot={snapshot} />
    <AppearanceSection settings={settings} snapshot={snapshot} />
    <UpdateSection settings={settings} snapshot={snapshot} />
    {(snapshot.devRevealed || snapshot.devMode !== null) && <DeveloperSection settings={settings} snapshot={snapshot} />}
    <ExamSection settings={settings} snapshot={snapshot} />
    {snapshot.full && <TrainingScheduleSection settings={settings} snapshot={snapshot} />}
    {snapshot.full && <ReportsSection snapshot={snapshot} onOpen={() => navigate('/errores')} />}
    <OfflineSection settings={settings} snapshot={snapshot} />
    {snapshot.full && <AnkiSection settings={settings} />}
    <AiStudyExportSection settings={settings} />
    <BackupSection settings={settings} />
    <ResetSection settings={settings} />
    <DiagnosticsSection snapshot={snapshot} />
  </>;
}

function useSettingsSnapshot(settings: SettingsServices): SettingsSnapshot {
  const [snapshot, setSnapshot] = useState(() => settings.getSnapshot());
  useEffect(() => {
    let mounted = true;
    const refresh = () => { if (mounted) setSnapshot(settings.getSnapshot()); };
    const unsubscribe = settings.subscribe(refresh);
    void settings.load().then(refresh).catch(() => {});
    return () => { mounted = false; unsubscribe(); };
  }, [settings]);
  return snapshot;
}

function AccountSection({ settings, snapshot }: { settings: SettingsServices; snapshot: SettingsSnapshot }) {
  const [requesting, setRequesting] = useState(false);
  const message = accountMessage(snapshot.sync);
  const requestAccess = async () => {
    setRequesting(true);
    try { if (!await settings.requestAccess()) toast('No se pudo enviar la solicitud. Inténtalo de nuevo.'); }
    finally { setRequesting(false); }
  };
  return <section className="card"><h2 className="h3">Cuenta y sincronización</h2><p>{message}</p>
    {snapshot.sync.user && <p><small>{snapshot.sync.state}{snapshot.sync.lastSync ? ` · ${new Date(snapshot.sync.lastSync).toLocaleTimeString('es-ES')}` : ''}</small></p>}
    {snapshot.sync.user ? <button className="btn sec" onClick={() => void settings.logout()}>Cerrar sesión</button> : snapshot.sync.configured && <button className="btn" onClick={() => void settings.login()}>Entrar con Google</button>}
    <AccessStatus snapshot={snapshot} requesting={requesting} onRequest={() => void requestAccess()} />
    {snapshot.sync.error && <p className="r"><small>{snapshot.sync.error}</small></p>}
    {snapshot.sync.user && snapshot.full && snapshot.sync.state !== 'sincronizado' && snapshot.sync.state !== 'sincronizando…' && <><p>{snapshot.sync.detail && <small>{snapshot.sync.detail}</small>}</p><button className="btn sec" onClick={() => void settings.retrySync()}>Reintentar sincronización</button></>}
    <p><small>En este dispositivo: {count(snapshot.progress.questions, 'pregunta vista', 'preguntas vistas')} · {count(snapshot.progress.topics, 'tema visto', 'temas vistos')} · {count(snapshot.progress.sessions, 'sesión', 'sesiones')}</small></p>
  </section>;
}

function accountMessage(sync: SettingsSnapshot['sync']): string {
  if (sync.state === 'iniciando' || sync.state === 'comprobando sesión…') return 'Comprobando cuenta…';
  if (sync.state === 'sin conexión') return 'Sin conexión: ahora no se puede comprobar la cuenta.';
  if (!sync.configured) return 'El acceso a la cuenta no está disponible. Puedes conservar y exportar el progreso de este dispositivo.';
  return sync.user ? `Conectado como ${sync.user.name}` : 'Inicia sesión para tener el mismo historial en iPhone y iPad.';
}

function AccessStatus({ snapshot, requesting, onRequest }: { snapshot: SettingsSnapshot; requesting: boolean; onRequest(): void }) {
  if (snapshot.level === 'propietario') return <p><small>Propietario · acceso completo.</small> <Link to="/acceso">Gestionar accesos{snapshot.sync.requests.length ? ` (${snapshot.sync.requests.length} pendientes)` : ''}</Link></p>;
  if (snapshot.level === 'aprobado') return <p><small>Acceso completo aprobado.</small></p>;
  if (snapshot.level === 'pendiente') return <p><small>Acceso pendiente de aprobación. Puedes continuar con la sesión rápida; la cuenta se actualizará al recibir la aprobación.</small></p>;
  if (!snapshot.sync.user) return null;
  return <><p><small>Acceso limitado: solo la sesión rápida de 5 minutos.</small></p><button className="btn" disabled={requesting} onClick={onRequest}>{requesting ? 'Enviando…' : 'Pedir acceso completo'}</button></>;
}

function AppearanceSection({ settings, snapshot }: { settings: SettingsServices; snapshot: SettingsSnapshot }) {
  return <section className="card"><h2 className="h3">Lectura y apariencia</h2>
    <PreferenceGroup title="Tema" current={snapshot.ui.theme} values={[["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]]} onChange={value => settings.setPreference('theme', value)} />
    <PreferenceGroup title="Tamaño de letra" current={String(snapshot.ui.size)} values={[["0", "A"], ["1", "A+"], ["2", "A++"], ["3", "A+++"]]} onChange={value => settings.setPreference('size', value)} />
    <PreferenceGroup title="Lectura atenta" current={String(snapshot.ui.lectura)} values={[["0", "Normal"], ["1", "Resaltar clave"], ["2", "Resaltar + frenar"]]} onChange={value => settings.setPreference('lectura', value)} />
    <p><small>«Resaltar clave» marca NO, SALVO, EXCEPTO, absolutos y cifras. «Frenar» bloquea las opciones unos segundos según la longitud de la pregunta (en modo test).</small></p>
    <p><small>Teclado (iPad): 1–4 o A–D responden · Intro, → o espacio: siguiente · ←: anterior · B: en blanco · F: dudosa · P: pausa. Gestos: desliza a la izquierda para pasar y a la derecha para volver.</small></p>
    <p><small>Estas preferencias se guardan solo en este dispositivo.</small></p>
  </section>;
}

function UpdateSection({ settings, snapshot }: { settings: SettingsServices; snapshot: SettingsSnapshot }) {
  const taps = useRef(0);
  const [checking, setChecking] = useState(false);
  const checkUpdate = async () => {
    setChecking(true);
    try {
      const result = await settings.checkUpdate();
      if (result === undefined) toast('No se pudo comprobar: sin conexión.');
      else if (!result) toast('Ya tienes la última versión.');
    } finally { setChecking(false); }
  };
  const update = async () => {
    if (!snapshot.update) return checkUpdate();
    const approved = await ask(`Se recargará la app para pasar a la versión ${snapshot.update}. Lo que tengas en curso se guarda.`, 'Actualizar');
    if (approved) await settings.applyUpdate();
  };
  const revealDeveloper = () => {
    taps.current++;
    if (taps.current < 7) return;
    if (!settings.revealDev()) return;
    taps.current = 0; toast('Modo desarrollador activado');
  };
  return <section className="card"><h2 className="h3">Descargas y actualizaciones</h2>
    <button className="ghost sm" type="button" aria-label="Versión de la aplicación" onClick={revealDeveloper}>Versión <b>{snapshot.version}</b> <small>({snapshot.build})</small></button>
    <p className="sm">{snapshot.update ? `Hay una versión nueva: ${snapshot.update}.` : 'Comprueba si hay una versión nueva; si la hay, la app se recarga para usarla.'}</p>
    <button className={`btn ${snapshot.update ? '' : 'sec'}`} disabled={checking} onClick={() => void update()}>{checking ? 'Buscando…' : snapshot.update ? 'Actualizar ahora' : 'Buscar actualización'}</button>
  </section>;
}

function DeveloperSection({ settings, snapshot }: { settings: SettingsServices; snapshot: SettingsSnapshot }) {
  return <section className="card"><h2 className="h3">Modo desarrollador</h2><p className="sm">Vista de desarrollo local</p><div className="seg" role="group" aria-label="Modo desarrollador"><DevButton value={null} current={snapshot.devMode} label="Automático" onChange={settings.setDevMode} /><DevButton value="1" current={snapshot.devMode} label="Completo" onChange={settings.setDevMode} /><DevButton value="0" current={snapshot.devMode} label="Como invitado" onChange={settings.setDevMode} /></div><p><small>El modo completo está disponible en desarrollo local. En producción, el acceso depende de la cuenta autorizada.</small></p></section>;
}

function ExamSection({ settings, snapshot }: { settings: SettingsServices; snapshot: SettingsSnapshot }) {
  return <section className="card"><h2 className="h3">Objetivo de estudio</h2><label className="sm" htmlFor="exam-date">Fecha objetivo para la cuenta atrás (no confirma una convocatoria oficial)</label><input id="exam-date" type="date" value={snapshot.exam} onChange={event => settings.setExam(event.target.value)} /><p className="sm">Elige tu fecha de planificación; comprueba la fecha oficial en la convocatoria.</p></section>;
}

const trainingDays = [
  { index: 1, name: 'Lunes' }, { index: 2, name: 'Martes' }, { index: 3, name: 'Miércoles' },
  { index: 4, name: 'Jueves' }, { index: 5, name: 'Viernes' }, { index: 6, name: 'Sábado' }, { index: 0, name: 'Domingo' },
] as const;
const trainingActivities = [
  ['activeRecall', 'Active Recall con tarjetas'], ['topicTest', 'Preguntas de tema'],
  ['mixedTopicTest', 'Preguntas variadas de temas vistos'],
  ['failures', 'Revisión de preguntas falladas'], ['spacedReviews', 'Repasos vencidos'],
] as const;

function TrainingScheduleSection({ settings, snapshot }: { settings: SettingsServices; snapshot: SettingsSnapshot }) {
  const updateMinutes = (day: number, rawValue: string) => {
    const minutesByDay = [...snapshot.training.minutesByDay] as typeof snapshot.training.minutesByDay;
    const parsed = Number(rawValue);
    minutesByDay[day] = Number.isFinite(parsed) ? Math.max(0, Math.min(240, Math.round(parsed))) : 0;
    settings.setTrainingPreferences({ ...snapshot.training, minutesByDay });
  };
  const updateActivity = (activity: typeof trainingActivities[number][0], enabled: boolean) => {
    const activities = enabled
      ? [...new Set([...snapshot.training.activities, activity])]
      : snapshot.training.activities.filter(item => item !== activity);
    if (!activities.length) return;
    settings.setTrainingPreferences({ ...snapshot.training, activities });
  };
  return <section className="card"><h2 className="h3">Entrenamiento semanal</h2>
    <p>Este tiempo forma parte de tus horas de estudio. Un día con 0 minutos es descanso; el entrenador no acumula su carga para mañana.</p>
    <div className="training-schedule">{trainingDays.map(day => <label className="training-day" key={day.index}>
      <span>{day.name}</span><span className="training-minute-input"><input aria-label={`${day.name}: minutos de entrenamiento`} type="number" min="0" max="240" step="5" value={snapshot.training.minutesByDay[day.index]} onChange={event => updateMinutes(day.index, event.target.value)} /> min</span>
    </label>)}</div>
    <label className="training-intro">Día habitual de introducción de temas
      <select value={snapshot.training.introductionDay} onChange={event => settings.setTrainingPreferences({ ...snapshot.training, introductionDay: Number(event.target.value) })}>
        {trainingDays.map(day => <option key={day.index} value={day.index}>{day.name}</option>)}
      </select>
    </label>
    <label className="training-intro">Tema que estás introduciendo esta semana
      <select value={snapshot.training.introductionTopicId ?? ''} onChange={event => {
        const introductionTopicId = event.target.value || undefined;
        settings.setTrainingPreferences({ ...snapshot.training, introductionTopicId });
      }}>
        <option value="">Sin tema asignado</option>
        {snapshot.index?.topics?.map(topic => <option key={topic.id} value={topic.id}>{topic.id} · {topic.name}</option>)}
      </select>
    </label>
    <p className="sm">Al elegir un tema, el entrenador puede sugerir un estudio inicial provisional si aún no hay una marca de estudio ni respuestas. El temario completo se consulta en tus apuntes.</p>
    <fieldset className="training-activities"><legend>Actividades disponibles</legend>
      {trainingActivities.map(([activity, label]) => <label key={activity}><input type="checkbox" checked={snapshot.training.activities.includes(activity)} disabled={snapshot.training.activities.length === 1 && snapshot.training.activities[0] === activity} onChange={event => updateActivity(activity, event.target.checked)} /> {label}</label>)}
    </fieldset>
  </section>;
}

function ReportsSection({ snapshot, onOpen }: { snapshot: SettingsSnapshot; onOpen(): void }) {
  return <section className="card"><h2 className="h3">Errores del banco</h2><p>{snapshot.progress.openReports} por revisar. Anótalos con «Avisar de error» al contestar y exporta la lista para corregirlos.</p><button className="btn sec" onClick={onOpen}>Ver errores del banco</button></section>;
}

function OfflineSection({ settings, snapshot }: { settings: SettingsServices; snapshot: SettingsSnapshot }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  const download = async () => {
    const account = settings.accountId(); setDownloading(true); setProgress('Preparando descarga…');
    try {
      await settings.downloadOffline((done, total) => { if (active.current) setProgress(`Descargando… ${done}/${total} archivos`); }, () => active.current && settings.accountId() === account);
      if (active.current) { setProgress(''); toast('Descarga sin conexión completada.'); }
    } catch (error) {
      if (active.current) { setProgress(''); toast(error instanceof Error ? error.message : 'No se pudo completar la descarga.'); }
    } finally { if (active.current) setDownloading(false); }
  };
  return <section className="card"><h2 className="h3">Uso sin conexión</h2><p role="status" aria-live="polite">{progress || offlineDescription(snapshot)}</p><p className="sm">Se comprueban los archivos de preguntas, supuestos y tarjetas guardados en este navegador. El progreso permanece asociado a tu cuenta.</p><button className="btn sec" disabled={downloading} onClick={() => void download()}>{downloading ? 'Descargando…' : 'Descargar para uso sin conexión'}</button></section>;
}

function AnkiSection({ settings }: { settings: SettingsServices }) {
  const exportCards = async () => {
    try { saveExportFile('tai-tarjetas-anki.txt', await settings.exportAnki(), 'text/plain;charset=utf-8'); }
    catch { toast('No se pudieron exportar las tarjetas.'); }
  };
  return <section className="card"><h2 className="h3">Tarjetas</h2><p>Exporta las tarjetas curadas (y tus fallos convertidos en tarjeta) a Anki: texto separado por tabuladores, importable con «Archivo → Importar».</p><button className="btn sec" onClick={() => void exportCards()}>Exportar tarjetas a Anki (.txt)</button></section>;
}

function useAiStudyExport(settings: SettingsServices) {
  const [message, setMessage] = useState('');
  const [choices, setChoices] = useState<Awaited<ReturnType<typeof settings.findAiSessions>> | null>(null);
  const [artifact, setArtifact] = useState<AiExport | null>(null);
  const [from, setFrom] = useState(() => localDate(new Date(Date.now() - 90 * 86400000)));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [modes, setModes] = useState({ practice: true, simulation: true });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const sessionModes = () => [modes.practice ? 'practice' : null, modes.simulation ? 'simulation' : null].filter((mode): mode is 'practice' | 'simulation' => !!mode);
  const dateRange = (messageForInvalid: string) => {
    const start = Date.parse(`${from}T00:00:00.000Z`), end = Date.parse(`${to}T00:00:00.000Z`) + 86400000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error(messageForInvalid);
    return { from: start, to: end };
  };
  const findSessions = async () => {
    const account = settings.accountId();
    try {
      const range = dateRange('Elige un periodo válido y asegúrate de que «Hasta» sea posterior o igual a «Desde».');
      const selectedModes = sessionModes();
      if (!selectedModes.length) throw new Error('Selecciona práctica, simulacros o ambos.');
      setChoices(null); setArtifact(null); setMessage('Buscando sesiones completadas…');
      const result = await settings.findAiSessions(range.from, range.to, selectedModes);
      if (settings.accountId() !== account) return;
      setChoices(result); setSelectedIds(new Set(result.map(choice => choice.id)));
      setMessage(`${count(result.length, 'sesión completada', 'sesiones completadas')} disponibles.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron buscar las sesiones.'); }
  };
  const buildExport = async () => {
    const account = settings.accountId();
    try {
      const range = dateRange('Elige un periodo válido.');
      const selectedModes = sessionModes();
      if (!selectedModes.length || !selectedIds.size) throw new Error('Selecciona una modalidad y al menos una sesión.');
      setMessage('Preparando archivos…');
      const result = await settings.buildAiExport({ ...range, modes: selectedModes, sessionIds: [...selectedIds] }) as AiExport;
      if (settings.accountId() !== account) return;
      setArtifact(result); setMessage('Vista previa lista. Los archivos solo se guardan si pulsas cada botón de descarga.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo preparar la exportación.'); }
  };
  const deleteHistory = async () => {
    const account = settings.accountId();
    const approved = await ask('Se eliminarán del dispositivo los intentos, eventos y sesiones detalladas de este ámbito. Las estadísticas agregadas y las sesiones históricas permanecen. La marca de borrado se sincronizará con la cuenta cuando haya conexión; las copias descargadas previamente no se borran. ¿Continuar?', 'Borrar historial detallado', true);
    if (!approved || settings.accountId() !== account) return;
    try {
      const result = await settings.deleteAiHistory(); setChoices(null); setArtifact(null);
      setMessage(`Historial detallado borrado. ${result.accountSyncPending ? 'La marca de borrado queda pendiente de sincronizar con la cuenta.' : 'Borrado local del ámbito invitado.'}`);
      toast('El progreso agregado sigue intacto.');
    } catch { setMessage('No se pudo borrar el historial detallado.'); }
  };
  return { message, choices, artifact, from, to, modes, selectedIds, setFrom, setTo, setModes, setSelectedIds, findSessions, buildExport, deleteHistory };
}

function AiStudyExportSection({ settings }: { settings: SettingsServices }) {
  const ai = useAiStudyExport(settings);
  return <section className="card" id="ai-study-export"><h2 className="h3">Exportar análisis para IA</h2><p>Prepara archivos locales para revisarlos o compartirlos manualmente. No se envía nada. El JSON puede contener preguntas y soluciones de examen. Las explicaciones incluidas deben estar revisadas.</p>
    <div className="row"><label>Desde <input type="date" value={ai.from} onChange={event => ai.setFrom(event.target.value)} /></label><label>Hasta <input type="date" value={ai.to} onChange={event => ai.setTo(event.target.value)} /></label></div>
    <AiModes value={ai.modes} onChange={ai.setModes} />
    <button className="btn sec" onClick={() => void ai.findSessions()}>Buscar sesiones completadas</button>
    <AiSessionChoices choices={ai.choices} selectedIds={ai.selectedIds} onChange={ai.setSelectedIds} />
    <button className="btn" disabled={!ai.choices?.length} onClick={() => void ai.buildExport()}>Preparar vista previa y archivos</button><p role="status" aria-live="polite">{ai.message}</p>
    {ai.artifact && <AiExportPreview artifact={ai.artifact} onDownload={(name, content, type) => saveExportFile(name, content, type)} />}
    <hr /><p>El borrado afecta al historial detallado de este ámbito en el dispositivo y crea una marca para que las copias antiguas no lo restauren. Conserva estadísticas agregadas, falladas, sesiones históricas y el progreso de estudio. Las copias ya descargadas no se borran.</p><button className="btn danger" onClick={() => void ai.deleteHistory()}>Borrar historial detallado</button>
  </section>;
}

function AiModes({ value, onChange }: { value: { practice: boolean; simulation: boolean }; onChange(update: (current: { practice: boolean; simulation: boolean }) => { practice: boolean; simulation: boolean }): void }) {
  return <div className="seg" role="group" aria-label="Modalidades para exportar"><label><input type="checkbox" checked={value.practice} onChange={event => onChange(current => ({ ...current, practice: event.target.checked }))} /> Práctica</label><label><input type="checkbox" checked={value.simulation} onChange={event => onChange(current => ({ ...current, simulation: event.target.checked }))} /> Simulacros</label></div>;
}

function AiSessionChoices({ choices, selectedIds, onChange }: { choices: Awaited<ReturnType<SettingsServices['findAiSessions']>> | null; selectedIds: ReadonlySet<string>; onChange(update: (current: Set<string>) => Set<string>): void }) {
  if (choices === null) return <div className="ai-export-sessions" aria-live="polite" />;
  if (!choices.length) return <div className="ai-export-sessions" aria-live="polite"><p className="sub">No hay sesiones completadas con esos filtros.</p></div>;
  return <div className="ai-export-sessions" aria-live="polite">{choices.map(choice => <label className="ai-export-session" key={choice.id}><input type="checkbox" checked={selectedIds.has(choice.id)} onChange={event => onChange(current => { const next = new Set(current); if (event.target.checked) next.add(choice.id); else next.delete(choice.id); return next; })} /> {choice.mode === 'simulation' ? 'Simulacro' : 'Práctica'} · {new Date(choice.startedAt).toLocaleString('es-ES')} · {count(choice.attemptCount, 'pregunta', 'preguntas')}</label>)}</div>;
}

function BackupSection({ settings }: { settings: SettingsServices }) {
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBackup = async () => {
    const account = settings.accountId();
    try {
      const backup = await settings.exportBackup();
      if (settings.accountId() === account) saveExportFile('tai-progreso.json', backup, 'application/json');
    } catch { toast('No se pudo preparar la copia de seguridad.'); }
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
      setMessage(`Copia combinada: ${preview.summary} Guardada en este dispositivo. ${status}`);
      toast('Copia importada; el progreso anterior se conserva.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar la copia.';
      setMessage(message); toast(message);
    } finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  return <section className="card"><h2 className="h3">Copias de seguridad <HelpIconLink topic="progreso" label="Ayuda sobre guardado y sincronización" /></h2><p className="sm">Importar combina los registros válidos con tu progreso actual y conserva los ausentes en la copia. Revisa el resumen antes de confirmar.</p><p role="status">{message}</p><button className="btn sec" onClick={() => void exportBackup()}>Exportar progreso</button> <label className="btn sec file">Importar<input ref={fileRef} type="file" accept=".json" onChange={event => void importBackup(event.target.files?.[0])} /></label></section>;
}

function ResetSection({ settings }: { settings: SettingsServices }) {
  const reset = async () => {
    const account = settings.accountId();
    const approved = await ask('¿Borrar TODO el progreso de este dispositivo? (Si hay sesión iniciada, lo sincronizado en la nube se volverá a descargar.)', 'Borrar todo', true);
    if (approved && settings.accountId() === account) { settings.resetAll(); toast('Borrado'); }
  };
  return <section className="card"><h2 className="h3">Zona delicada</h2><button className="btn danger" onClick={() => void reset()}>Borrar progreso de este dispositivo</button></section>;
}

function DiagnosticsSection({ snapshot }: { snapshot: SettingsSnapshot }) {
  return <><details className="card"><summary>Diagnóstico técnico</summary><p>Versión: {snapshot.version} ({snapshot.build})</p><p>Dominio: {snapshot.sync.host || 'no disponible'} · autenticación: {snapshot.sync.authDomain || 'no disponible'}</p><p>Estado: {snapshot.sync.state}</p></details>{snapshot.index && <p className="sub">Banco: {snapshot.index.questions} preguntas + {snapshot.index.scenarios} de supuestos.</p>}</>;
}

function PreferenceGroup({ title, current, values, onChange }: { title: string; current: string; values: readonly (readonly [string, string])[]; onChange(value: string): void }) {
  return <><p className="sm">{title}</p><div className="seg" role="group" aria-label={title}>{values.map(([value, label]) => <button key={value} className={current === value ? 'on' : ''} aria-pressed={current === value} onClick={() => onChange(value)}>{label}</button>)}</div></>;
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
