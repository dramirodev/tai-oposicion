import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { AcademyCurriculumFile, AcademyCurriculumSection, AcademyCurriculumTopic } from '../../core/domain/academy-curriculum-types.js';
import { academyCurriculumTopicLoaders } from '../../core/domain/academy-curriculum.generated.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { canScheduleSectionFollowUp, isCurrentAcademyMaterialSelection, sectionCoverage, sectionFollowUps, sectionRecallHistory, type AcademyMaterialOpenEvent, type AcademySectionStudyEvent, type AcademyTopicProgressSnapshot } from '../../core/domain/academy-study-progress.js';
import type { AcademyMaterialPdfCopy } from '../../core/domain/academy-material-copy.js';

interface LoadedTopic {
  topicId: string;
  topic: AcademyCurriculumTopic | null;
  failed: boolean;
}

interface LocalPdfSelection {
  scope: string;
  selectedAt: number;
  topicId: string;
  path: string;
  sourceHash: string;
  name: string;
  sizeBytes: number;
  url: string;
  blob: Blob;
  persisted: boolean;
}

const materialLabels: Record<string, string> = {
  syllabus: 'Temario', review: 'Repaso o resumen', notes: 'Notas', exercise: 'Ejercicios', audio: 'Audio',
};

function extractionLabel(file: AcademyCurriculumFile): string | null {
  if (file.extension !== '.pdf') return null;
  if (file.textExtractionStatus === 'extractable') return `PDF con texto extraíble · ${file.extractableTextPages ?? 0} páginas con texto · ${file.extractableTextCharacters ?? 0} caracteres`;
  if (file.textExtractionStatus === 'empty') return 'PDF sin texto extraíble en esta inspección';
  if (file.textExtractionStatus === 'error') return 'No se pudo inspeccionar el texto del PDF';
  return 'Extracción de texto no disponible para esta versión del catálogo';
}

const sourceStatusMessages: Record<string, string> = {
  'outline-extracted-needs-review': 'Se ha extraído el índice del temario. Aún requiere revisión humana antes de tratarlo como estructura validada.',
  'primary-and-alternative': 'Hay una versión principal y otra alternativa; se muestran referencias de ambas para que puedas elegir la vigente.',
  'multiple-volumes-or-syllabi': 'Hay varios volúmenes o temarios; se muestran sus índices por separado y no se presupone cuál es la edición vigente.',
  'alternative-only': 'Solo se encontró un archivo marcado como versión alternativa; verifica si es el material que usa la academia.',
  'no-syllabus-file': 'No se encontró un archivo identificado como temario. Los materiales disponibles se enumeran sin inventar apartados.',
  'syllabus-without-extractable-outline': 'Se encontró un temario, pero no se pudo extraer un índice legible del PDF.',
};

function createEventId(): string {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function SectionStudyUnit({
  section, events, materialOpenEvents, sessionId, activityId, record, targetSectionId, onCompleteSectionRecall,
}: {
  section: AcademyCurriculumSection;
  events: readonly AcademySectionStudyEvent[];
  materialOpenEvents: readonly AcademyMaterialOpenEvent[];
  sessionId?: string;
  activityId?: string;
  record(event: AcademySectionStudyEvent): boolean;
  targetSectionId?: string | null;
  onCompleteSectionRecall?: () => Promise<void>;
}) {
  const matching = events.filter(event => event.sectionId === section.id && event.sourceHash === section.sourceHash && event.materialPath === section.materialPath);
  const matchingOpens = materialOpenEvents.filter(event => event.sectionId === section.id && event.sourceHash === section.sourceHash && event.materialPath === section.materialPath)
    .sort((first, second) => first.occurredAt - second.occurredAt || first.id.localeCompare(second.id));
  const coverage = sectionCoverage(matching);
  const [message, setMessage] = useState('');
  const [dueDateKey, setDueDateKey] = useState(() => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  });
  const saving = useRef(false);
  const sectionElement = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (targetSectionId !== section.id || !sectionElement.current) return;
    sectionElement.current.open = true;
    window.requestAnimationFrame(() => sectionElement.current?.scrollIntoView({ behavior:'smooth', block:'center' }));
  }, [targetSectionId, section.id]);
  const base = () => ({
    id: createEventId(), topicId: section.topicId, sectionId: section.id, materialPath: section.materialPath,
    sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, occurredAt: Math.max(Date.now(), ...matching.map(item => item.occurredAt + 1)),
    ...(sessionId ? { trainingSessionId: sessionId } : {}), ...(activityId ? { trainingActivityId: activityId } : {}),
  });
  const addCoverage = (value: 'not-started' | 'partial' | 'covered') => {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const saved = record({ ...base(), kind: 'coverage', coverage: value });
      setMessage(saved ? 'Cobertura guardada.' : 'No se pudo guardar la cobertura en este dispositivo.');
    } finally { saving.current = false; setBusy(false); }
  };
  const addSelfCheck = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true);
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const saved = record({
        ...base(), kind: 'self-check',
        timing: form.get('timing') as 'assisted' | 'immediate' | 'delayed',
        rating: form.get('rating') as 'not-recalled' | 'partial' | 'recalled',
      });
      setMessage(saved ? 'Autoevaluación guardada; no es una corrección objetiva.' : 'No se pudo guardar la autoevaluación en este dispositivo.');
      formElement.reset();
    } finally { saving.current = false; setBusy(false); }
  };
  const scheduleFollowUp = (sourceSelfCheckEventId: string) => {
    if (saving.current || !canScheduleSectionFollowUp(matching, sourceSelfCheckEventId)) return;
    saving.current = true; setBusy(true);
    try {
      const saved = record({ ...base(), kind: 'follow-up', followUpId: sourceSelfCheckEventId, sourceSelfCheckEventId, dueDateKey, status: 'scheduled', sectionTitle:section.title, printedPage:section.printedPage });
      setMessage(saved ? `Comprobación programada para el ${dueDateKey}. La fecha es una elección tuya, no un intervalo automático.` : 'No se pudo guardar la comprobación en este dispositivo.');
    } finally { saving.current = false; setBusy(false); }
  };
  const changeFollowUpStatus = (followUpId: string, status: 'completed' | 'cancelled') => {
    if (saving.current) return;
    const current = sectionFollowUps(matching).find(item => item.followUpId === followUpId && item.status === 'scheduled');
    if (!current) return;
    saving.current = true; setBusy(true);
    try {
      const saved = record({ ...base(), kind: 'follow-up', followUpId, sourceSelfCheckEventId: current.sourceSelfCheckEventId, dueDateKey: current.dueDateKey, status, ...(current.sectionTitle ? { sectionTitle:current.sectionTitle } : {}), ...(current.printedPage !== undefined ? { printedPage:current.printedPage } : {}) });
      setMessage(saved ? (status === 'completed' ? 'Comprobación marcada como realizada.' : 'Comprobación cancelada; el historial se conserva.') : 'No se pudo actualizar la comprobación.');
    } finally { saving.current = false; setBusy(false); }
  };
  const history = sectionRecallHistory(matching);
  const followUps = sectionFollowUps(matching);
  const coverageLabel = coverage === 'covered' ? 'cubierto' : coverage === 'partial' ? 'parcial' : 'sin iniciar';
  const timingLabel = { assisted: 'con ayuda', immediate: 'inmediato', delayed: 'diferido' };
  const ratingLabel = { 'not-recalled': 'no lo recordé', partial: 'lo recordé parcialmente', recalled: 'lo recordé' };
  return <details ref={sectionElement} id={section.id} className="my-1 rounded-md border border-line px-2 py-1">
    <summary className="min-h-10 cursor-pointer content-center">{section.title} <span className="text-muted">(p. {section.printedPage} · cobertura {coverageLabel})</span></summary>
    <div className="pb-2 ps-1">
      <p className="my-1 text-sm text-muted">Registra lo que has cubierto por tu cuenta. La cobertura no acredita comprensión ni recuerdo.</p>
      {matchingOpens.length > 0 && <p className="my-1 text-xs text-muted">Aperturas solicitadas de este PDF: {matchingOpens.length}; última: {new Date(matchingOpens.at(-1)!.occurredAt).toLocaleString()}. Esto no confirma lectura.</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn sec" type="button" disabled={busy} onClick={() => addCoverage('partial')}>Marcar parcial</button>
        <button className="btn sec" type="button" disabled={busy} onClick={() => addCoverage('covered')}>Marcar cubierto</button>
        {coverage !== 'not-started' && <button className="btn sec" type="button" disabled={busy} onClick={() => addCoverage('not-started')}>Volver a sin iniciar</button>}
      </div>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={addSelfCheck}>
        <label className="grid gap-1 text-sm">Comprobación
          <select name="timing" defaultValue="immediate" className="min-h-10 rounded-md border border-line bg-surface px-2">
            <option value="assisted">Con ayuda</option><option value="immediate">Al terminar</option><option value="delayed">Días después (ya comprobado)</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Autoevaluación
          <select name="rating" defaultValue="partial" className="min-h-10 rounded-md border border-line bg-surface px-2">
            <option value="not-recalled">No lo recordé</option><option value="partial">Parcialmente</option><option value="recalled">Lo recordé</option>
          </select>
        </label>
        <button className="btn" type="submit" disabled={busy}>Guardar comprobación</button>
      </form>
      <p className="my-1 text-xs text-muted">“Días después” describe una comprobación que ya hiciste. Para elegir cuándo volver, usa la fecha de próxima comprobación tras guardar.</p>
      {message && <p className="my-2 text-sm" role="status">{message}</p>}
      {onCompleteSectionRecall && targetSectionId === section.id && sessionId && activityId && <div className="mt-3 rounded-md border border-brand/40 p-3">
        <p className="my-1 text-sm">Primero intenta explicar este apartado sin mirar. Consulta el material solo para resolver dudas y cierra la comprobación al terminar.</p>
        <button className="btn" type="button" disabled={busy} onClick={async () => { if (saving.current) return; saving.current = true; setBusy(true); try { await onCompleteSectionRecall(); } finally { saving.current = false; setBusy(false); } }}>Terminar comprobación y volver a la sesión</button>
      </div>}
      {followUps.length > 0 && <div className="mt-2 text-sm"><p className="my-1 font-semibold">Comprobaciones posteriores</p><ul className="my-1 list-disc ps-5">{followUps.map(item => <li key={item.followUpId}>{item.dueDateKey} · {item.status === 'scheduled' ? 'pendiente' : item.status === 'completed' ? 'realizada' : 'cancelada'}{item.status === 'scheduled' && <span className="ms-2 inline-flex flex-wrap gap-2"><button className="text-link underline" type="button" disabled={busy} onClick={() => changeFollowUpStatus(item.followUpId, 'completed')}>Marcar realizada</button><button className="text-link underline" type="button" disabled={busy} onClick={() => changeFollowUpStatus(item.followUpId, 'cancelled')}>Cancelar</button></span>}</li>)}</ul></div>}
      {history.filter(item => canScheduleSectionFollowUp(matching, item.id)).at(-1) && <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); const latest = [...history].reverse().find(item => canScheduleSectionFollowUp(matching, item.id)); if (latest) scheduleFollowUp(latest.id); }}>
        <label className="grid gap-1 text-sm">Próxima comprobación · fecha elegida
          <input aria-label="Fecha de próxima comprobación" type="date" min={(() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`; })()} value={dueDateKey} onChange={event => setDueDateKey(event.currentTarget.value)} className="min-h-10 rounded-md border border-line bg-surface px-2" />
        </label>
        <button className="btn sec" type="submit" disabled={busy || !dueDateKey}>Programar desde la última autoevaluación</button>
      </form>}
      <details className="mt-2">
        <summary className="min-h-9 cursor-pointer content-center text-sm">Historial de autoevaluaciones · {history.length}</summary>
        {history.length ? <ul className="my-1 list-disc ps-5 text-sm">{history.map(item => <li key={item.id}>{new Date(item.occurredAt).toLocaleString()} · {timingLabel[item.timing]} · {ratingLabel[item.rating]} · autoevaluación</li>)}</ul>
          : <p className="my-1 text-sm text-muted">Todavía no hay comprobaciones registradas.</p>}
      </details>
    </div>
  </details>;
}

type AcademyCurriculumPanelProps = { topicId: string; hasStudyMarker: boolean; sessionId?: string; activityId?: string; onCompleteSectionRecall?: () => Promise<void> };

export function AcademyCurriculumPanel(props: AcademyCurriculumPanelProps) {
  const academyProgress = useStudyService('academyStudyProgress');
  const accountId = useSyncExternalStore(academyProgress.subscribe, academyProgress.accountId, academyProgress.accountId);
  return <AcademyCurriculumPanelContent key={`${props.topicId}:${accountId ?? 'guest'}`} {...props} />;
}

function AcademyCurriculumPanelContent({ topicId, hasStudyMarker, sessionId, activityId, onCompleteSectionRecall }: AcademyCurriculumPanelProps) {
  const [draft, setDraft] = useState<{ topicId: string; paths: string[] } | null>(null);
  const [notice, setNotice] = useState('');
  const [pdfSelections, setPdfSelections] = useState<Record<string, LocalPdfSelection>>({});
  const [savedPdfState, setSavedPdfState] = useState<{ scope:string; topicId:string; entries:AcademyMaterialPdfCopy[] }>({ scope:'', topicId:'', entries:[] });
  const [pdfNotice, setPdfNotice] = useState<{ topicId: string; path: string; text: string } | null>(null);
  const pdfObjectUrls = useRef(new Map<string, string>());
  const pdfGeneration = useRef(0);
  const [searchParams] = useSearchParams();
  const targetSectionId = searchParams.get('sectionId');
  const materialPanel = useRef<HTMLDetailsElement>(null);
  const academyProgress = useStudyService('academyStudyProgress');
  const accountId = academyProgress.accountId();
  const pdfScope = accountId ? `uid:${accountId}` : 'guest';
  const savedPdfs = savedPdfState.scope === pdfScope && savedPdfState.topicId === topicId ? savedPdfState.entries : [];
  const progressResource = useMemo(() => ({
    accountId: academyProgress.accountId,
    subscribe: academyProgress.subscribe,
    load: () => academyProgress.loadTopicProgress(topicId),
  }), [academyProgress, topicId]);
  const progressResourceState = useAccountResource(progressResource);
  const progress: AcademyTopicProgressSnapshot = progressResourceState.value ?? { selection: null, events: [], materialOpenEvents: [] };
  const [loaded, setLoaded] = useState<LoadedTopic | null>(null);
  const loader = academyCurriculumTopicLoaders[topicId];
  useEffect(() => () => {
    pdfGeneration.current++;
    pdfObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
    pdfObjectUrls.current.clear();
  }, [topicId, pdfScope]);
  const chooseLocalPdf = async (file: File | undefined, materialPath: string, expectedHash: string) => {
    const generation = ++pdfGeneration.current;
    const oldUrl = pdfObjectUrls.current.get(materialPath);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    pdfObjectUrls.current.delete(materialPath);
    setPdfSelections(current => { const next = { ...current }; delete next[materialPath]; return next; });
    setPdfNotice({ topicId, path:materialPath, text:'Comprobando que el PDF coincide con esta versión…' });
    if (!file || !file.size) { setPdfNotice({ topicId, path:materialPath, text:'El archivo está vacío o no se pudo seleccionar.' }); return; }
    try {
      const fileBytes = await file.arrayBuffer();
      if (String.fromCharCode(...new Uint8Array(fileBytes.slice(0, 5))) !== '%PDF-') { setPdfNotice({ topicId, path:materialPath, text:'El archivo seleccionado no parece ser un PDF válido.' }); return; }
      if (!globalThis.crypto?.subtle) { setPdfNotice({ topicId, path:materialPath, text:'Este navegador no permite verificar el archivo localmente. No se abrió.' }); return; }
      const actualHash = await sha256(fileBytes);
      if (generation !== pdfGeneration.current) return;
      if (actualHash !== expectedHash.toLowerCase()) { setPdfNotice({ topicId, path:materialPath, text:'La versión del PDF no coincide con el catálogo actual. No se abrió.' }); return; }
      const url = URL.createObjectURL(file);
      pdfObjectUrls.current.set(materialPath, url);
      setPdfSelections(current => ({ ...current, [materialPath]: { scope:pdfScope, selectedAt:Date.now(), topicId, path:materialPath, sourceHash:actualHash, name:file.name, sizeBytes:file.size, url, blob:file, persisted:false } }));
      setPdfNotice({ topicId, path:materialPath, text:'PDF verificado. Se abrirá en una pestaña nueva; todavía no se ha guardado.' });
    } catch {
      if (generation === pdfGeneration.current) setPdfNotice({ topicId, path:materialPath, text:'No se pudo leer o verificar el PDF. Puedes seguir usando el índice y abrir la ruta de Drive.' });
    }
  };
  useEffect(() => {
    let active = true;
    if (loader) void loader().then(module => {
      if (active) setLoaded({ topicId, topic: module.academyCurriculumTopic, failed: false });
    }).catch(() => {
      if (active) setLoaded({ topicId, topic: null, failed: true });
    });
    return () => { active = false; };
  }, [loader, topicId]);
  useEffect(() => {
    const generation = ++pdfGeneration.current;
    let active = true;
    const topic = loaded?.topicId === topicId ? loaded.topic : null;
    if (!topic) return () => { active = false; };
    void academyProgress.listLocalPdfs(topicId).then(async entries => {
      if (!active || generation !== pdfGeneration.current || academyProgress.accountId() !== accountId) return;
      setSavedPdfState({ scope:pdfScope, topicId, entries });
      for (const entry of entries) {
        const source = topic.files.find(file => file.path === entry.materialPath && file.sha256 === entry.sourceHash && file.extension === '.pdf');
        const expectedHash = source?.sha256?.toLowerCase();
        if (!source || !expectedHash) continue;
        if (!globalThis.crypto?.subtle || Object.prototype.toString.call(entry.pdfBytes) !== '[object ArrayBuffer]' || entry.mimeType !== 'application/pdf' || entry.pdfBytes.byteLength !== entry.sizeBytes) {
          setPdfNotice({ topicId, path:entry.materialPath, text:'No se pudo verificar esta copia local en el navegador. Puedes volver a elegir el archivo esperado o eliminar la copia guardada.' });
          continue;
        }
        const bytes = entry.pdfBytes;
        if (!active || generation !== pdfGeneration.current || academyProgress.accountId() !== accountId) return;
        if (String.fromCharCode(...new Uint8Array(bytes.slice(0, 5))) !== '%PDF-' || await sha256(bytes) !== expectedHash) {
          setPdfNotice({ topicId, path:entry.materialPath, text:'La copia guardada no supera la verificación del catálogo. Puedes eliminarla y volver a elegir el PDF.' });
          continue;
        }
        const blob = new Blob([bytes], { type:'application/pdf' });
        const url = URL.createObjectURL(blob);
        pdfObjectUrls.current.set(entry.materialPath, url);
        setPdfSelections(current => ({ ...current, [entry.materialPath]: { scope:pdfScope, selectedAt:entry.importedAt, topicId, path:entry.materialPath, sourceHash:entry.sourceHash, name:entry.name, sizeBytes:entry.sizeBytes, url, blob, persisted:true } }));
      }
    }).catch(() => {
      if (active && generation === pdfGeneration.current) setPdfNotice({ topicId, path:'', text:'No se pudieron consultar las copias PDF locales. Puedes elegir de nuevo el archivo; las copias no se han borrado.' });
    });
    return () => { active = false; };
  }, [loaded?.topicId, loaded?.topic, topicId, pdfScope, accountId, academyProgress]);
  useEffect(() => {
    if (targetSectionId && loaded?.topicId === topicId && materialPanel.current) {
      materialPanel.current.open = true;
      window.requestAnimationFrame(() => document.getElementById(targetSectionId)?.scrollIntoView({ behavior:'smooth', block:'center' }));
    }
  }, [targetSectionId, loaded, topicId]);

  if (!loader) return <p className="mt-2 mb-0 text-sm text-muted">No hay materiales de academia indexados para {topicId} en esta versión del catálogo.</p>;
  if (!loaded || loaded.topicId !== topicId) return <p className="mt-2 mb-0 text-sm text-muted" role="status">Cargando índice de materiales…</p>;
  if (loaded.failed) return <p className="mt-2 mb-0 text-sm text-muted" role="alert">No se pudo cargar el índice de este tema. Si estás sin conexión, puede que aún no se haya guardado en el dispositivo; vuelve a intentarlo con conexión. Puedes seguir consultando el tema.</p>;
  const topic = loaded.topic;
  if (!topic) return <p className="mt-2 mb-0 text-sm text-muted">No hay materiales de academia indexados para {topicId} en esta versión del catálogo.</p>;

  const materials = topic.files.filter(file => file.kind !== 'audio');
  const audio = topic.files.filter(file => file.kind === 'audio');
  const message = sourceStatusMessages[topic.sourceStatus] ?? sourceStatusMessages['outline-extracted-needs-review'];
  const curriculumSections = topic.sections.filter(section => section.materialKind === 'syllabus');
  const supplementalSections = topic.sections.filter(section => section.materialKind !== 'syllabus');
  const materialPaths = [...new Set(topic.sections.map(section => section.materialPath))];
  const selectionCurrent = isCurrentAcademyMaterialSelection(topic, progress.selection);
  const selectedPaths = selectionCurrent ? progress.selection?.materials.map(material => material.path) ?? [] : [];
  const draftPaths = draft?.topicId === topicId ? draft.paths : selectedPaths;
  const staleSelection = !!progress.selection && !selectionCurrent;
  const progressError = progressResourceState.error;
  const setMaterialSelected = (path: string, checked: boolean) => setDraft(previous => {
    const paths = previous?.topicId === topicId ? previous.paths : selectedPaths;
    return { topicId, paths: checked ? [...new Set([...paths, path])] : paths.filter(value => value !== path) };
  });
  const saveSelection = () => {
    const references = topic.files.filter(file => draftPaths.includes(file.path) && topic.sections.some(section => section.materialPath === file.path))
      .map(file => ({
        path: file.path,
        sourceHash: file.sha256!,
        outlineFingerprint: file.outlineFingerprint!,
        outlineStructureFingerprint: file.outlineStructureFingerprint!,
        role: file.kind === 'syllabus' ? 'syllabus' as const : 'supplementary' as const,
      }));
    const saved = academyProgress.selectMaterials(topicId, references);
    setNotice(saved ? 'Materiales guardados para el seguimiento de este tema.' : 'No se pudo guardar la selección en este dispositivo.');
    if (saved) setDraft(null);
  };
  const recordEvent = (event: AcademySectionStudyEvent) => academyProgress.record(event);
  const recordMaterialOpen = (section: AcademyCurriculumSection, occurredAt: number) => {
    const event: AcademyMaterialOpenEvent = {
      id:createEventId(), topicId:section.topicId, sectionId:section.id, materialPath:section.materialPath,
      sourceHash:section.sourceHash, outlineFingerprint:section.outlineFingerprint, page:section.printedPage,
      occurredAt, ...(sessionId ? { trainingSessionId:sessionId } : {}), ...(activityId ? { trainingActivityId:activityId } : {}),
    };
    const saved = academyProgress.recordMaterialOpen(event);
    setPdfNotice({ topicId, path:section.materialPath, text:saved
      ? `Apertura de la página ${section.printedPage} registrada; esto no acredita lectura ni cobertura.`
      : 'El PDF se abrirá, pero no se pudo registrar esta apertura en el historial.' });
  };
  const saveLocalPdf = async (selection: LocalPdfSelection) => {
    if (selection.scope !== pdfScope || academyProgress.accountId() !== accountId) {
      setPdfNotice({ topicId, path:selection.path, text:'La cuenta ha cambiado. El PDF permanece solo en memoria y no se ha guardado.' });
      return;
    }
    try {
      const entry: AcademyMaterialPdfCopy = { topicId, materialPath:selection.path, sourceHash:selection.sourceHash,
        name:selection.name, mimeType:'application/pdf', sizeBytes:selection.sizeBytes, importedAt:selection.selectedAt, pdfBytes:await selection.blob.arrayBuffer() };
      await academyProgress.saveLocalPdf(entry);
      if (academyProgress.accountId() !== accountId) return;
      setSavedPdfState(current => ({ scope:pdfScope, topicId, entries:[...(current.scope === pdfScope && current.topicId === topicId ? current.entries : []).filter(item => item.materialPath !== entry.materialPath || item.sourceHash !== entry.sourceHash), entry] }));
      setPdfSelections(current => ({ ...current, [entry.materialPath]: { ...selection, persisted:true } }));
      setPdfNotice({ topicId, path:entry.materialPath, text:'Copia guardada solo en este dispositivo. No está cifrada ni se sincroniza con la cuenta.' });
    } catch {
      setPdfNotice({ topicId, path:selection.path, text:'No se pudo guardar la copia local (puede faltar espacio o estar bloqueado el almacenamiento). El PDF actual seguirá disponible hasta cerrar esta vista.' });
    }
  };
  const removeLocalPdf = async (entry: AcademyMaterialPdfCopy) => {
    if (academyProgress.accountId() !== accountId) return;
    try {
      await academyProgress.removeLocalPdf(entry.topicId, entry.materialPath, entry.sourceHash);
      if (academyProgress.accountId() !== accountId) return;
      setSavedPdfState(current => ({ scope:pdfScope, topicId, entries:(current.scope === pdfScope && current.topicId === topicId ? current.entries : []).filter(item => item.materialPath !== entry.materialPath || item.sourceHash !== entry.sourceHash) }));
      const selected = pdfSelections[entry.materialPath];
      if (selected?.sourceHash === entry.sourceHash) {
        URL.revokeObjectURL(selected.url);
        pdfObjectUrls.current.delete(entry.materialPath);
      }
      setPdfSelections(current => {
        if (current[entry.materialPath]?.sourceHash !== entry.sourceHash) return current;
        const next = { ...current };
        delete next[entry.materialPath];
        return next;
      });
      setPdfNotice({ topicId, path:entry.materialPath, text:'Copia local eliminada. El historial y el seguimiento de estudio no han cambiado.' });
    } catch {
      setPdfNotice({ topicId, path:entry.materialPath, text:'No se pudo eliminar la copia PDF local. Inténtalo de nuevo.' });
    }
  };
  const filesByPath = new Map(topic.files.map(file => [file.path, file]));
  const currentPdfNotice = pdfNotice?.topicId === topicId ? pdfNotice : null;
  const outlineFingerprintFor = (path: string) => {
    const file = filesByPath.get(path);
    return file && 'outlineFingerprint' in file ? file.outlineFingerprint : undefined;
  };
  const matchingOutlineMessage = (materialPath: string) => {
    const current = filesByPath.get(materialPath);
    if (!current || !('outlineStructureFingerprint' in current)) return undefined;
    const matching = topic.files.find(file => file.path !== materialPath
      && 'outlineStructureFingerprint' in file
      && file.outlineStructureFingerprint === current.outlineStructureFingerprint);
    if (!matching) return undefined;
    return outlineFingerprintFor(matching.path) === outlineFingerprintFor(materialPath)
      ? 'Otro archivo tiene los mismos títulos y páginas de índice. Solo se comparan títulos y páginas; el contenido del documento no se ha comparado y no se elige una edición.'
      : 'Otro archivo tiene los mismos títulos en el mismo orden, pero cambia la paginación. Solo se comparan índices; el contenido del documento no se ha comparado y no se elige una edición.';
  };
  const materialInspection = (materialPath: string, sections: readonly AcademyCurriculumSection[]) => {
    const file = filesByPath.get(materialPath);
    if (!file) return null;
    return <>
      <p className="my-1 text-sm text-muted">{extractionLabel(file) ?? 'Este archivo no es PDF; el catálogo conserva su ruta y metadatos.'}. El catálogo integrado conserva solo metadatos e índice; el PDF se guarda en este dispositivo únicamente si eliges guardarlo. La extracción técnica no verifica que el contenido sea explicativo, completo ni vigente.</p>
      {file.extension === '.pdf' && file.sha256 && <div className="my-2 grid justify-items-start gap-2">
        <label className="btn sec min-h-11 cursor-pointer">Elegir este PDF desde Drive<input className="sr-only" type="file" accept="application/pdf,.pdf" aria-label={`Elegir PDF ${file.name}`} onChange={event => { const selected = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void chooseLocalPdf(selected, materialPath, file.sha256!); }} /></label>
        {currentPdfNotice?.path === materialPath && <p className="m-0 text-sm text-muted" role="status">{currentPdfNotice.text}</p>}
        {pdfSelections[materialPath]?.topicId === topicId && pdfSelections[materialPath]?.scope === pdfScope && pdfSelections[materialPath]?.sourceHash === file.sha256 && (() => {
          const selection = pdfSelections[materialPath];
          return <>
            <p className="m-0 text-xs text-muted">{selection.name} · {(selection.sizeBytes / (1024 * 1024)).toFixed(2)} MiB · {selection.persisted ? 'guardado en este dispositivo' : 'solo en memoria de esta vista'}</p>
            {!selection.persisted ? <button className="btn sec" type="button" onClick={() => void saveLocalPdf(selection)}>Guardar PDF en este dispositivo para retomar</button>
              : <p className="m-0 text-sm text-muted">Copia local no cifrada, separada de la sincronización de la cuenta.</p>}
            <ul className="m-0 grid gap-1 ps-5">{sections.filter(section => section.materialPath === materialPath).map(section => <li key={section.id}><a className="text-link underline" href={`${selection.url}#page=${section.printedPage}`} target="_blank" rel="noopener noreferrer" onClick={() => recordMaterialOpen(section, Date.now())}>Abrir {section.title} · página {section.printedPage}</a></li>)}</ul>
          </>;
        })()}
      </div>}
    </>;
  };
  const renderOutlineGroup = (sections: typeof topic.sections, heading: string, context: string) => {
    const paths = [...new Set(sections.map(section => section.materialPath))];
    if (!paths.length) return null;
    return <section className="mt-3" aria-label={heading}>
      <h3 className="mb-1 text-sm">{heading}</h3>
      {paths.map(materialPath => <div className="mt-2" key={materialPath}>
        <h4 className="mb-1 text-sm font-medium"><code className="break-all">{materialPath}</code></h4>
        {matchingOutlineMessage(materialPath) && <p className="my-1 text-sm text-muted">{matchingOutlineMessage(materialPath)}</p>}
        {materialInspection(materialPath, sections)}
        {draftPaths.includes(materialPath) ? <div className="mt-2">
          {sections.filter(section => section.materialPath === materialPath).map(section => <SectionStudyUnit key={section.id} section={section} events={progress.events} materialOpenEvents={progress.materialOpenEvents} sessionId={sessionId} activityId={activityId} record={recordEvent} targetSectionId={targetSectionId} onCompleteSectionRecall={onCompleteSectionRecall} />)}
        </div> : <ul className="my-0 list-disc ps-5 text-sm">{sections.filter(section => section.materialPath === materialPath).map(section => <li id={section.id} key={section.id}>{section.title} <span className="text-muted">(p. {section.printedPage})</span></li>)}</ul>}
      </div>)}
      <p className="mt-2 mb-0 text-sm text-muted">{context}</p>
    </section>;
  };

  return <details ref={materialPanel} className="mt-3 rounded-[var(--r-s)] border border-line p-3">
    <summary className="min-h-11 cursor-pointer content-center font-semibold">Material de academia · {topic.sections.length} referencias de índice</summary>
    <p className="mt-2 mb-3 text-sm text-muted">{message} Elige el PDF de tu carpeta Drive para verificarlo y abrirlo en otra pestaña. Por defecto solo se conserva en memoria; puedes optar por guardar una copia local para retomar. No se cifra ni se sincroniza, y puedes eliminarla aquí.</p>
    {currentPdfNotice?.path === '' && <p className="my-2 text-sm text-muted" role="alert">{currentPdfNotice.text}</p>}
    {hasStudyMarker && <div className="my-3 rounded-md bg-surface-soft p-3">
      <p className="my-0 mb-2 text-sm">Las preguntas disponibles están clasificadas por tema, no por este apartado. La práctica siguiente registra respuestas y correcciones del tema completo.</p>
      <Link className="btn" to={`/test?topic=${encodeURIComponent(topicId)}`}>Practicar preguntas del tema</Link>
    </div>}
    {materials.length > 0 && <ul className="my-0 mb-3 list-disc ps-5 text-sm">
      {materials.map(file => <li key={file.path}><b>{materialLabels[file.kind] ?? 'Material'}</b>: <code className="break-all">{file.path}</code>{extractionLabel(file) && <span className="text-muted"> · {extractionLabel(file)}</span>}</li>)}
    </ul>}
    {!!progressError && <p className="my-2 text-sm text-muted" role="alert">No se pudo leer el progreso local de este tema. Puedes consultar el índice; el progreso no se ha modificado.</p>}
    {staleSelection && <p className="my-2 text-sm text-muted" role="status">Cambió la versión de algún material seleccionado. El historial anterior se conserva separado; revisa y guarda de nuevo los archivos actuales para continuar el seguimiento.</p>}
    {targetSectionId && !topic.sections.some(section => section.id === targetSectionId) && <p className="my-2 text-sm text-muted" role="status">Este apartado ya no aparece en el índice de la versión actual. El seguimiento anterior se conserva; revisa la selección de material antes de volver a programarlo.</p>}
    {(curriculumSections.length + supplementalSections.length > 0) && <fieldset className="my-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-semibold">Elegir material para registrar cobertura</legend>
      <p className="my-1 text-sm text-muted">La selección queda ligada al hash del archivo. El material complementario no se presenta como temario completo.</p>
      <div className="grid gap-1">{materialPaths.map(materialPath => {
        const file = filesByPath.get(materialPath);
        return <label className="flex min-h-10 items-center gap-2 text-sm" key={materialPath}>
          <input type="checkbox" checked={draftPaths.includes(materialPath)} onChange={event => setMaterialSelected(materialPath, event.currentTarget.checked)} />
          <code className="break-all">{materialPath}</code>{file?.kind !== 'syllabus' && <span className="text-muted">(complementario)</span>}
        </label>;
      })}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="btn" type="button" onClick={saveSelection}>Guardar materiales elegidos</button>
        <span className="text-sm text-muted">{draftPaths.length} material(es) seleccionado(s)</span>
      </div>
      {notice && <p className="my-2 text-sm" role="status">{notice}</p>}
    </fieldset>}
    {savedPdfs.length > 0 && <section className="my-3 rounded-md border border-line p-3" aria-label="Copias locales de PDF">
      <h3 className="m-0 text-sm font-semibold">Copias guardadas en este dispositivo</h3>
      <p className="my-1 text-xs text-muted">Solo accesibles desde esta cuenta lógica de la aplicación, sin cifrado: cualquier persona con acceso al navegador puede leerlas. No entran en el backup ni en Firebase.</p>
      <ul className="m-0 grid gap-2 ps-5 text-sm">{savedPdfs.map(entry => {
        const current = topic.files.some(file => file.path === entry.materialPath && file.sha256 === entry.sourceHash);
        return <li key={`${entry.materialPath}:${entry.sourceHash}`}><code className="break-all">{entry.name}</code> · {(entry.sizeBytes / (1024 * 1024)).toFixed(2)} MiB · {current ? 'versión vigente' : 'versión antigua o material ausente'} <button className="ms-2 text-link underline" type="button" onClick={() => void removeLocalPdf(entry)}>Eliminar copia local</button></li>;
      })}</ul>
    </section>}
    {renderOutlineGroup(curriculumSections, 'Índices extraídos de temarios', 'Son candidatos a estructura del tema, pendientes de confirmar con la versión usada por la academia.')}
    {renderOutlineGroup(supplementalSections, 'Índices extraídos de material complementario', 'Estos índices describen el documento indicado; no prueban que sea el programa completo del tema.')}
    {materialPaths.length === 0 && <p className="m-0 text-sm text-muted">No se pudo extraer un índice. Consulta los documentos listados; la aplicación no inventa apartados.</p>}
    {audio.length > 0 && <p className="mt-3 mb-0 text-sm text-muted">También hay {audio.length} audio(s) en la carpeta del tema.</p>}
  </details>;
}
