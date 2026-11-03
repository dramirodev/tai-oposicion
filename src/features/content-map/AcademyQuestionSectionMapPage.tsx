import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { academyCurriculumTopicLoaders } from '../../core/domain/academy-curriculum.generated.js';
import type { AcademyCurriculumTopic } from '../../core/domain/academy-curriculum-types.js';
import { parseAcademyQuestionSectionManifest, resolveAcademyQuestionSectionLink, type AcademyQuestionSectionLink, type AcademyQuestionSectionManifest } from '../../core/domain/academy-question-section-map.js';
import { questionContentRevision } from '../../core/domain/attempts/highlights.js';
import { currentQuestionSourceCandidates } from '../../core/domain/academy-question-source-candidates.js';
import { academyQuestionSourceCandidates } from '../../core/domain/academy-question-source-candidates.generated.js';
import type { QuestionRecord } from '../../core/domain/question-record.js';
import { saveExportFile } from '../../shared/ui/download-file.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { PageMessage } from '../../shared/ui/PageMessage.js';

const PREFIX = 'tai.academy-question-section-map:v2:';
const LEGACY_PREFIX = 'tai.academy-question-section-map:v1:';
const localRevision = () => Date.now();
const empty = (): AcademyQuestionSectionManifest => ({ schemaVersion: 2, revision: 'local-empty', links: [] });
const keyFor = (account: string | null) => PREFIX + (account || 'owner-local');
const legacyKeyFor = (account: string | null) => LEGACY_PREFIX + (account || 'owner-local');
function readManifest(account: string | null): AcademyQuestionSectionManifest {
  try {
    for (const raw of [localStorage.getItem(keyFor(account)), localStorage.getItem(legacyKeyFor(account))]) {
      if (!raw) continue;
      try {
        const parsed = parseAcademyQuestionSectionManifest(JSON.parse(raw));
        if (parsed) return parsed;
      } catch { /* Keep trying the non-destructive legacy key. */ }
    }
    return empty();
  }
  catch { return empty(); }
}
function persist(account: string | null, value: AcademyQuestionSectionManifest): boolean {
  try { localStorage.setItem(keyFor(account), JSON.stringify(value)); return true; } catch { return false; }
}
interface LoadedQuestions { id: string; questions: QuestionRecord[]; failed: boolean }
interface LoadedTopic { id: string; topic: AcademyCurriculumTopic | null; failed: boolean }
const toQuestion = (q: QuestionRecord) => ({ id: q.i, topicId: q.t, origin: q.o, statement: q.q, options: q.a, correctIndex: q.c });
const testMaterialTextLabel = (status?: string) => status === 'extractable' ? 'texto extraíble (no integrado en la app)'
  : status === 'empty' ? 'sin texto extraíble' : status === 'error' ? 'error de extracción' : 'extracción no disponible';

export function AcademyQuestionSectionMapPage() {
  const access = useStudyService('access'), test = useStudyService('test');
  const resource = useMemo(() => ({ accountId: access.accountId, subscribe: access.subscribe, load: access.load }), [access]);
  const { value: overview, error: accessError } = useAccountResource(resource);
  const account = access.accountId();
  const [manifestState, setManifestState] = useState(() => ({ account, value: readManifest(account) }));
  const manifest = manifestState.account === account ? manifestState.value : readManifest(account);
  const [topics, setTopics] = useState<readonly { id: string; name: string }[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [topicId, setTopicId] = useState(''), [testTopicId, setTestTopicId] = useState(''), [sectionTopicId, setSectionTopicId] = useState('');
  const [questionId, setQuestionId] = useState(''), [testPath, setTestPath] = useState(''), [sectionId, setSectionId] = useState('');
  const [testPage, setTestPage] = useState(''), [questionNumber, setQuestionNumber] = useState('');
  const [rationale, setRationale] = useState('');
  const [reviewer, setReviewer] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [loadedQuestions, setLoadedQuestions] = useState<LoadedQuestions | null>(null);
  const [loadedTestTopic, setLoadedTestTopic] = useState<LoadedTopic | null>(null);
  const [loadedSectionTopic, setLoadedSectionTopic] = useState<LoadedTopic | null>(null);
  const [message, setMessage] = useState('');
  usePageReady(!!overview || !!accessError);
  useEffect(() => {
    let live = true;
    void test.loadTopics().then(rows => { if (live) { setTopics(rows.map(({ id, name }) => ({ id, name }))); setCatalogError(false); } }).catch(() => { if (live) setCatalogError(true); });
    return () => { live = false; };
  }, [test]);
  useEffect(() => {
    let live = true;
    if (!topicId) return () => { live = false; };
    void test.loadTopicQuestions(topicId).then(questions => { if (live) setLoadedQuestions({ id: topicId, questions, failed: false }); })
      .catch(() => { if (live) setLoadedQuestions({ id: topicId, questions: [], failed: true }); });
    return () => { live = false; };
  }, [test, topicId]);
  useEffect(() => {
    let live = true;
    const loader = academyCurriculumTopicLoaders[testTopicId];
    if (!testTopicId || !loader) return () => { live = false; };
    void loader().then(module => { if (live) setLoadedTestTopic({ id: testTopicId, topic: module.academyCurriculumTopic, failed: false }); })
      .catch(() => { if (live) setLoadedTestTopic({ id: testTopicId, topic: null, failed: true }); });
    return () => { live = false; };
  }, [testTopicId]);
  useEffect(() => {
    let live = true;
    const loader = academyCurriculumTopicLoaders[sectionTopicId];
    if (!sectionTopicId || !loader) return () => { live = false; };
    void loader().then(module => { if (live) setLoadedSectionTopic({ id: sectionTopicId, topic: module.academyCurriculumTopic, failed: false }); })
      .catch(() => { if (live) setLoadedSectionTopic({ id: sectionTopicId, topic: null, failed: true }); });
    return () => { live = false; };
  }, [sectionTopicId]);
  const currentQuestions = loadedQuestions?.id === topicId ? loadedQuestions : null;
  const currentTestTopic = loadedTestTopic?.id === testTopicId ? loadedTestTopic : null;
  const currentSectionTopic = loadedSectionTopic?.id === sectionTopicId ? loadedSectionTopic : null;
  const questions = currentQuestions?.questions ?? [];
  const testTopic = currentTestTopic?.topic ?? null;
  const sectionTopic = currentSectionTopic?.topic ?? null;
  const question = questions.find(row => row.i === questionId);
  const testFile = testTopic?.files.find(file => file.path === testPath && file.kind === 'test' && file.sha256);
  const section = sectionTopic?.sections.find(row => row.id === sectionId && row.materialKind === 'syllabus' && row.sourceHash && row.outlineFingerprint);
  const revision = question ? questionContentRevision(question.q, question.a) : '';
  const sourceCandidates = question ? currentQuestionSourceCandidates(academyQuestionSourceCandidates.questions[question.i], {
    id:question.i, topicId:question.t, contentRevision:revision,
  }) : [];
  const duplicate = !!question && manifest.links.some(link => link.questionId === question.i && link.contentRevision === revision);
  const validPages = Number.isInteger(Number(testPage)) && Number(testPage) > 0 && (!questionNumber || (Number.isInteger(Number(questionNumber)) && Number(questionNumber) > 0));
  const canSave = !!question && !!testFile && !!section && !!reviewer.trim() && rationale.trim().length >= 10 && confirmed && validPages && !duplicate;
  const add = () => {
    if (!canSave || !question || !testFile || !section) return;
    const link: AcademyQuestionSectionLink = {
      status: 'approved', questionId: question.i, contentRevision: revision,
      questionTopicId: question.t, testMaterialTopicId: testTopicId, sectionTopicId: section.topicId, sectionId: section.id,
      testEvidence: { path: testFile.path, sourceHash: testFile.sha256!, page: Number(testPage), ...(questionNumber ? { questionNumber: Number(questionNumber) } : {}) },
      sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, page: section.printedPage },
      rationale: rationale.trim(),
      reviewedAt: localRevision(), reviewer: reviewer.trim(),
    };
    const materials = new Map(testTopic!.files.filter(file => file.sha256).map(file => [file.path, { topicId: testTopicId, sourceHash: file.sha256! }]));
    if (!resolveAcademyQuestionSectionLink({ link, question: toQuestion(question), section, availableTestMaterials: materials })) { setMessage('Cambió el contenido o el material. Recarga los temas y revisa las referencias.'); return; }
    const next: AcademyQuestionSectionManifest = { schemaVersion: 2, revision: 'local-' + localRevision(), links: [...manifest.links, link] };
    if (!persist(account, next)) { setMessage('No se pudo guardar en este dispositivo. Exporta antes de cerrar.'); return; }
    setManifestState({ account, value: next }); setConfirmed(false); setMessage('Vínculo añadido al borrador local. Exporta el JSON para revisarlo en el repositorio.');
  };
  const selectSourceCandidate = (source: { topicId:string; path:string }, page: number) => {
    setTestTopicId(source.topicId);
    setTestPath(source.path);
    setTestPage(String(page));
    setQuestionNumber('');
    setMessage('Referencia de fuente preseleccionada. Abre y coteja el PDF de Drive; la coincidencia no propone ni aprueba un epígrafe.');
  };
  const remove = (link: AcademyQuestionSectionLink) => {
    const next = { ...manifest, revision: 'local-' + localRevision(), links: manifest.links.filter(item => item !== link) };
    if (!persist(account, next)) { setMessage('No se pudo actualizar el borrador local.'); return; }
    setManifestState({ account, value: next }); setMessage('Vínculo retirado del borrador local.');
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const normalized = parseAcademyQuestionSectionManifest(value);
      if (!normalized) { setMessage('El archivo no cumple el formato de manifiesto v1/v2.'); return; }
      if (!persist(account, normalized)) { setMessage('No se pudo guardar el manifiesto importado.'); return; }
      setManifestState({ account, value: normalized });
      const upgradedLegacy = !!value && typeof value === 'object' && !Array.isArray(value)
        && (value as Record<string, unknown>).schemaVersion === 1;
      setMessage(upgradedLegacy
        ? 'Manifiesto v1 importado como v2; conserva los tres temas iguales y deja intacto el archivo de origen. Comprueba vigencia al abrir los temas.'
        : 'Manifiesto v2 importado. Comprueba vigencia al abrir los temas.');
    } catch { setMessage('No se pudo leer el JSON seleccionado.'); }
  };
  if (accessError) return <PageMessage role="alert" title="No se pudo comprobar el acceso">La curación está disponible solo para el propietario. Recarga cuando haya conexión.</PageMessage>;
  if (!overview) return <PageLoading variant="access" />;
  if (!overview.owner) return <Navigate to="/home" replace />;
  const exportFile = () => saveExportFile('vinculos-pregunta-epigrafe-' + manifest.revision + '.json', JSON.stringify(manifest, null, 2), 'application/json');
  const topicLinks = manifest.links.filter(link => link.questionTopicId === topicId);
  return <>
    <h1>Curar vínculos a epígrafes</h1>
    <p className="sub">Herramienta editorial local. Los PDF de Drive no se abren aquí: coteja cada pregunta y página en los documentos originales. El tema o la coincidencia de palabras no demuestran una relación.</p>
    <section className="card"><h2 className="h3">Borrador local · {manifest.links.length} vínculos</h2><p className="sm">Se guarda solo en este dispositivo y cuenta. No se sincroniza, publica ni usa para repasos o estadísticas.</p><div className="row"><button className="btn" type="button" onClick={exportFile}>Exportar JSON</button><label className="btn sec cursor-pointer">Importar manifiesto<input className="sr-only" type="file" accept="application/json,.json" onChange={event => { void importFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label></div></section>
    {catalogError ? <PageMessage role="alert" title="No se pudo cargar el catálogo">Comprueba la conexión y vuelve a intentarlo.</PageMessage> : <section className="card" aria-labelledby="map-form-title">
      <h2 className="h3" id="map-form-title">Revisar una asociación</h2>
      <p className="sm">El banco de la pregunta, el PDF de origen y el epígrafe de destino pueden pertenecer a temas distintos. Esto registra una revisión manual, no deduce una relación.</p>
      <label className="grid gap-1">Tema de la pregunta<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={topicId} onChange={event => { setTopicId(event.target.value); setQuestionId(''); }}><option value="">Selecciona un tema</option>{topics.map(row => <option key={row.id} value={row.id}>{row.id} · {row.name}</option>)}</select></label>
      <label className="mt-3 grid gap-1">Tema del PDF de origen<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={testTopicId} onChange={event => { setTestTopicId(event.target.value); setTestPath(''); }}><option value="">Selecciona el tema de Drive</option>{topics.map(row => <option key={row.id} value={row.id}>{row.id} · {row.name}</option>)}</select></label>
      <label className="mt-3 grid gap-1">Tema del epígrafe de destino<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={sectionTopicId} onChange={event => { setSectionTopicId(event.target.value); setSectionId(''); }}><option value="">Selecciona el tema del temario</option>{topics.map(row => <option key={row.id} value={row.id}>{row.id} · {row.name}</option>)}</select></label>
      {topicId && !currentQuestions && <p role="status">Cargando preguntas…</p>}
      {testTopicId && !currentTestTopic && <p role="status">Cargando PDF del tema de origen…</p>}
      {sectionTopicId && !currentSectionTopic && <p role="status">Cargando epígrafes del tema destino…</p>}
      {currentQuestions?.failed && <p role="alert">No se pudieron cargar las preguntas. Reintenta con conexión y acceso autorizado.</p>}
      {currentTestTopic?.failed && <p role="alert">No se pudieron cargar los documentos del tema de origen.</p>}
      {currentSectionTopic?.failed && <p role="alert">No se pudieron cargar los epígrafes del tema de destino.</p>}
      {currentQuestions && !currentQuestions.failed && <>
        <label className="mt-3 grid gap-1">Pregunta<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={questionId} onChange={event => setQuestionId(event.target.value)}><option value="">Selecciona pregunta ({questions.length})</option>{questions.map(row => <option key={row.i} value={row.i}>{row.i} · {row.q.replace(/\s+/g, ' ').slice(0, 100)}</option>)}</select></label>
        {question && <div className="my-2 rounded-md bg-[var(--surface-soft)] p-3"><p><b>{question.i}</b> · {question.o} · revisión {revision}</p><p>{question.q}</p>{question.a.map((option, index) => <p className="my-1" key={question.i + index}>{String.fromCharCode(65 + index)}. {option}{index === question.c ? ' · correcta en el banco' : ''}</p>)}</div>}
        {sourceCandidates.length > 0 && <fieldset className="mt-3 rounded-md border border-line p-3"><legend className="px-1 font-semibold">Coincidencias candidatas en tests de Drive · {sourceCandidates.reduce((sum, candidate) => sum + candidate.sources.reduce((count, source) => count + source.pages.length, 0), 0)}</legend><p className="my-1 text-sm text-muted">Coincidencia exacta del enunciado tras normalizar Unicode, mayúsculas y espacios. La página es física del PDF y puede repetirlo en otro contexto: coteja el documento. No propone ni aprueba un epígrafe.</p><div className="grid gap-2">{sourceCandidates.flatMap(candidate => candidate.sources.flatMap(match => {
          const source = academyQuestionSourceCandidates.materials[match.materialIndex];
          return source ? match.pages.map(page => <button className="btn sec justify-self-start" key={`${candidate.contentRevision}:${source.path}:${page}`} type="button" onClick={() => selectSourceCandidate(source, page)}>Preseleccionar {source.topicId} · {source.path} · PDF p. {page} (física)</button>) : [];
        }))}</div></fieldset>}
        <label className="mt-3 grid gap-1">PDF de test de Drive<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={testPath} onChange={event => { setTestPath(event.target.value); setTestPage(''); setQuestionNumber(''); }}><option value="">Selecciona documento</option>{(testTopic?.files ?? []).filter(file => file.kind === 'test' && file.sha256).map(file => <option key={file.path} value={file.path}>{file.name} · {testMaterialTextLabel(file.textExtractionStatus)}</option>)}</select></label>
        {testFile && <p className="my-2 text-sm text-muted">La señal indica texto extraíble y páginas con texto, no que las preguntas sean legibles o estén verificadas. El PDF permanece en Drive; la aplicación no incorpora su cuerpo. Abre la ruta <code>{testFile.path}</code> para cotejar manualmente.</p>}
        {testFile && <p className="sm">Origen: {testTopicId} · ruta <code>{testFile.path}</code> · SHA-256 {testFile.sha256}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="grid gap-1">Página física del PDF de test<input className="min-h-11 rounded-md border border-line bg-surface px-2" type="number" min="1" step="1" value={testPage} onChange={event => setTestPage(event.target.value)} /></label><label className="grid gap-1">Número de pregunta (opcional)<input className="min-h-11 rounded-md border border-line bg-surface px-2" type="number" min="1" step="1" value={questionNumber} onChange={event => setQuestionNumber(event.target.value)} /></label></div>
        <label className="mt-3 grid gap-1">Epígrafe del temario<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={sectionId} onChange={event => setSectionId(event.target.value)}><option value="">Selecciona apartado</option>{(sectionTopic?.sections ?? []).filter(row => row.materialKind === 'syllabus' && row.sourceHash && row.outlineFingerprint).map(row => <option key={row.id} value={row.id}>{row.title} · p. {row.printedPage} · {row.materialPath}</option>)}</select></label>
        {section && <p className="sm">Coteja en Drive: <code>{section.materialPath}</code>, p. {section.printedPage}. El índice extraído requiere revisión humana.</p>}
        <label className="mt-3 grid gap-1">Por qué corresponde esta pregunta al epígrafe<textarea className="min-h-20 rounded-md border border-line bg-surface p-2" value={rationale} onChange={event => setRationale(event.target.value)} maxLength={1000} /></label>
        <label className="mt-3 grid gap-1">Identificador del revisor<input className="min-h-11 rounded-md border border-line bg-surface px-2" value={reviewer} onChange={event => setReviewer(event.target.value)} maxLength={200} /></label>
        <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>He cotejado la pregunta y las páginas en los documentos de Drive; la asociación está revisada por una persona.</span></label>
        <button className="btn mt-3" type="button" disabled={!canSave} onClick={add}>{duplicate ? 'Esta versión ya está incluida' : 'Añadir al borrador local'}</button>
      </>}
    </section>}
    {currentQuestions && !currentQuestions.failed && <section className="card"><h2 className="h3">Vínculos de preguntas {topicId}</h2>{topicLinks.length ? topicLinks.map(link => {
      const row = questions.find(item => item.i === link.questionId);
      const mappedSection = sectionTopic?.sections.find(item => item.id === link.sectionId && link.sectionTopicId === sectionTopicId);
      const availableTestMaterials = new Map((testTopic?.files ?? []).filter(file => file.sha256).map(file => [file.path, { topicId: testTopicId, sourceHash: file.sha256! }]));
      const sourceSelected = testTopic?.id === link.testMaterialTopicId;
      const destinationSelected = sectionTopic?.id === link.sectionTopicId;
      const currentLink = row && mappedSection && sourceSelected && destinationSelected ? resolveAcademyQuestionSectionLink({ link, question: toQuestion(row), section: mappedSection, availableTestMaterials }) : undefined;
      const linkStatus = !sourceSelected || !destinationSelected ? 'selecciona los temas de origen y destino para comprobar vigencia' : currentLink ? 'vigente' : 'obsoleto/no localizado; no utilizable';
      return <article key={link.questionId + link.contentRevision} className="border-t border-line py-3"><p><b>{link.questionId}</b> · pregunta {link.questionTopicId} → tema fuente {link.testMaterialTopicId}, p. {link.testEvidence.page} → {link.sectionTopicId} · {mappedSection?.title ?? link.sectionId} · {linkStatus}</p><p className="sm">Revisor: {link.reviewer} · {new Date(link.reviewedAt).toLocaleDateString('es-ES')} · {link.rationale}</p><button className="btn sec" type="button" onClick={() => remove(link)}>Retirar del borrador local</button></article>;
    }) : <p className="sm">Aún no hay vínculos para este tema.</p>}</section>}
    {message && <p className="card" role="status">{message}</p>}
  </>;
}
