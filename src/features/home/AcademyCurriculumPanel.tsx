import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { AcademyCurriculumSection, AcademyCurriculumTopic } from '../../core/domain/academy-curriculum-types.js';
import { academyCurriculumTopicLoaders } from '../../core/domain/academy-curriculum.generated.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { isCurrentAcademyMaterialSelection, sectionCoverage, sectionRecallHistory, type AcademySectionStudyEvent, type AcademyTopicProgressSnapshot } from '../../core/domain/academy-study-progress.js';

interface LoadedTopic {
  topicId: string;
  topic: AcademyCurriculumTopic | null;
  failed: boolean;
}

const materialLabels: Record<string, string> = {
  syllabus: 'Temario', review: 'Repaso o resumen', notes: 'Notas', exercise: 'Ejercicios', audio: 'Audio',
};

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

function SectionStudyUnit({
  section, events, sessionId, activityId, record,
}: {
  section: AcademyCurriculumSection;
  events: readonly AcademySectionStudyEvent[];
  sessionId?: string;
  activityId?: string;
  record(event: AcademySectionStudyEvent): boolean;
}) {
  const matching = events.filter(event => event.sectionId === section.id && event.sourceHash === section.sourceHash && event.materialPath === section.materialPath);
  const coverage = sectionCoverage(matching);
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const base = () => ({
    id: createEventId(), topicId: section.topicId, sectionId: section.id, materialPath: section.materialPath,
    sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, occurredAt: Date.now(),
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
  const history = sectionRecallHistory(matching);
  const coverageLabel = coverage === 'covered' ? 'cubierto' : coverage === 'partial' ? 'parcial' : 'sin iniciar';
  const timingLabel = { assisted: 'con ayuda', immediate: 'inmediato', delayed: 'diferido' };
  const ratingLabel = { 'not-recalled': 'no lo recordé', partial: 'lo recordé parcialmente', recalled: 'lo recordé' };
  return <details className="my-1 rounded-md border border-line px-2 py-1">
    <summary className="min-h-10 cursor-pointer content-center">{section.title} <span className="text-muted">(p. {section.printedPage} · cobertura {coverageLabel})</span></summary>
    <div className="pb-2 ps-1">
      <p className="my-1 text-sm text-muted">Registra lo que has cubierto por tu cuenta. La cobertura no acredita comprensión ni recuerdo.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn sec" type="button" disabled={busy} onClick={() => addCoverage('partial')}>Marcar parcial</button>
        <button className="btn sec" type="button" disabled={busy} onClick={() => addCoverage('covered')}>Marcar cubierto</button>
        {coverage !== 'not-started' && <button className="btn sec" type="button" disabled={busy} onClick={() => addCoverage('not-started')}>Volver a sin iniciar</button>}
      </div>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={addSelfCheck}>
        <label className="grid gap-1 text-sm">Comprobación
          <select name="timing" defaultValue="immediate" className="min-h-10 rounded-md border border-line bg-surface px-2">
            <option value="assisted">Con ayuda</option><option value="immediate">Al terminar</option><option value="delayed">Días después</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Autoevaluación
          <select name="rating" defaultValue="partial" className="min-h-10 rounded-md border border-line bg-surface px-2">
            <option value="not-recalled">No lo recordé</option><option value="partial">Parcialmente</option><option value="recalled">Lo recordé</option>
          </select>
        </label>
        <button className="btn" type="submit" disabled={busy}>Guardar comprobación</button>
      </form>
      {message && <p className="my-2 text-sm" role="status">{message}</p>}
      <details className="mt-2">
        <summary className="min-h-9 cursor-pointer content-center text-sm">Historial de autoevaluaciones · {history.length}</summary>
        {history.length ? <ul className="my-1 list-disc ps-5 text-sm">{history.map(item => <li key={item.id}>{new Date(item.occurredAt).toLocaleString()} · {timingLabel[item.timing]} · {ratingLabel[item.rating]} · autoevaluación</li>)}</ul>
          : <p className="my-1 text-sm text-muted">Todavía no hay comprobaciones registradas.</p>}
      </details>
    </div>
  </details>;
}

export function AcademyCurriculumPanel({ topicId, hasStudyMarker, sessionId, activityId }: { topicId: string; hasStudyMarker: boolean; sessionId?: string; activityId?: string }) {
  const [draft, setDraft] = useState<{ topicId: string; paths: string[] } | null>(null);
  const [notice, setNotice] = useState('');
  const academyProgress = useStudyService('academyStudyProgress');
  const progressResource = useMemo(() => ({
    accountId: academyProgress.accountId,
    subscribe: academyProgress.subscribe,
    load: () => academyProgress.loadTopicProgress(topicId),
  }), [academyProgress, topicId]);
  const progressResourceState = useAccountResource(progressResource);
  const progress: AcademyTopicProgressSnapshot = progressResourceState.value ?? { selection: null, events: [] };
  const [loaded, setLoaded] = useState<LoadedTopic | null>(null);
  const loader = academyCurriculumTopicLoaders[topicId];
  useEffect(() => {
    let active = true;
    if (loader) void loader().then(module => {
      if (active) setLoaded({ topicId, topic: module.academyCurriculumTopic, failed: false });
    }).catch(() => {
      if (active) setLoaded({ topicId, topic: null, failed: true });
    });
    return () => { active = false; };
  }, [loader, topicId]);

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
  const filesByPath = new Map(topic.files.map(file => [file.path, file]));
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
  const renderOutlineGroup = (sections: typeof topic.sections, heading: string, context: string) => {
    const paths = [...new Set(sections.map(section => section.materialPath))];
    if (!paths.length) return null;
    return <section className="mt-3" aria-label={heading}>
      <h3 className="mb-1 text-sm">{heading}</h3>
      {paths.map(materialPath => <div className="mt-2" key={materialPath}>
        <h4 className="mb-1 text-sm font-medium"><code className="break-all">{materialPath}</code></h4>
        {matchingOutlineMessage(materialPath) && <p className="my-1 text-sm text-muted">{matchingOutlineMessage(materialPath)}</p>}
        {draftPaths.includes(materialPath) ? <div className="mt-2">
          {sections.filter(section => section.materialPath === materialPath).map(section => <SectionStudyUnit key={section.id} section={section} events={progress.events} sessionId={sessionId} activityId={activityId} record={recordEvent} />)}
        </div> : <ul className="my-0 list-disc ps-5 text-sm">{sections.filter(section => section.materialPath === materialPath).map(section => <li key={section.id}>{section.title} <span className="text-muted">(p. {section.printedPage})</span></li>)}</ul>}
      </div>)}
      <p className="mt-2 mb-0 text-sm text-muted">{context}</p>
    </section>;
  };

  return <details className="mt-3 rounded-[var(--r-s)] border border-line p-3">
    <summary className="min-h-11 cursor-pointer content-center font-semibold">Material de academia · {topic.sections.length} referencias de índice</summary>
    <p className="mt-2 mb-3 text-sm text-muted">{message} Los documentos permanecen en tu carpeta de Drive y no están copiados ni se abren desde la aplicación. Usa la ruta indicada para consultarlos.</p>
    {hasStudyMarker && <div className="my-3 rounded-md bg-surface-soft p-3">
      <p className="my-0 mb-2 text-sm">Las preguntas disponibles están clasificadas por tema, no por este apartado. La práctica siguiente registra respuestas y correcciones del tema completo.</p>
      <Link className="btn" to={`/test?topic=${encodeURIComponent(topicId)}`}>Practicar preguntas del tema</Link>
    </div>}
    {materials.length > 0 && <ul className="my-0 mb-3 list-disc ps-5 text-sm">
      {materials.map(file => <li key={file.path}><b>{materialLabels[file.kind] ?? 'Material'}</b>: <code className="break-all">{file.path}</code></li>)}
    </ul>}
    {!!progressError && <p className="my-2 text-sm text-muted" role="alert">No se pudo leer el progreso local de este tema. Puedes consultar el índice; el progreso no se ha modificado.</p>}
    {staleSelection && <p className="my-2 text-sm text-muted" role="status">Cambió la versión de algún material seleccionado. El historial anterior se conserva separado; revisa y guarda de nuevo los archivos actuales para continuar el seguimiento.</p>}
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
    {renderOutlineGroup(curriculumSections, 'Índices extraídos de temarios', 'Son candidatos a estructura del tema, pendientes de confirmar con la versión usada por la academia.')}
    {renderOutlineGroup(supplementalSections, 'Índices extraídos de material complementario', 'Estos índices describen el documento indicado; no prueban que sea el programa completo del tema.')}
    {materialPaths.length === 0 && <p className="m-0 text-sm text-muted">No se pudo extraer un índice. Consulta los documentos listados; la aplicación no inventa apartados.</p>}
    {audio.length > 0 && <p className="mt-3 mb-0 text-sm text-muted">También hay {audio.length} audio(s) en la carpeta del tema.</p>}
  </details>;
}
