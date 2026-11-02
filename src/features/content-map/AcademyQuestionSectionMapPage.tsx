import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { academyCurriculumTopicLoaders } from '../../core/domain/academy-curriculum.generated.js';
import type { AcademyCurriculumTopic } from '../../core/domain/academy-curriculum-types.js';
import { isAcademyQuestionSectionManifest, resolveAcademyQuestionSectionLink, type AcademyQuestionSectionLink, type AcademyQuestionSectionManifest } from '../../core/domain/academy-question-section-map.js';
import { questionContentRevision } from '../../core/domain/attempts/highlights.js';
import type { QuestionRecord } from '../../core/domain/question-record.js';
import { saveExportFile } from '../../shared/ui/download-file.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { PageMessage } from '../../shared/ui/PageMessage.js';

const PREFIX = 'tai.academy-question-section-map:v1:';
const localRevision = () => Date.now();
const empty = (): AcademyQuestionSectionManifest => ({ schemaVersion: 1, revision: 'local-empty', links: [] });
const keyFor = (account: string | null) => PREFIX + (account || 'owner-local');
function readManifest(account: string | null): AcademyQuestionSectionManifest {
  try { const raw = localStorage.getItem(keyFor(account)); if (!raw) return empty(); const value: unknown = JSON.parse(raw); return isAcademyQuestionSectionManifest(value) ? value : empty(); }
  catch { return empty(); }
}
function persist(account: string | null, value: AcademyQuestionSectionManifest): boolean {
  try { localStorage.setItem(keyFor(account), JSON.stringify(value)); return true; } catch { return false; }
}
interface Loaded { id: string; topic: AcademyCurriculumTopic | null; questions: QuestionRecord[]; failed: boolean }
const toQuestion = (q: QuestionRecord) => ({ id: q.i, topicId: q.t, origin: q.o, statement: q.q, options: q.a, correctIndex: q.c });

export function AcademyQuestionSectionMapPage() {
  const access = useStudyService('access'), test = useStudyService('test');
  const resource = useMemo(() => ({ accountId: access.accountId, subscribe: access.subscribe, load: access.load }), [access]);
  const { value: overview, error: accessError } = useAccountResource(resource);
  const account = access.accountId();
  const [manifestState, setManifestState] = useState(() => ({ account, value: readManifest(account) }));
  const manifest = manifestState.account === account ? manifestState.value : readManifest(account);
  const [topics, setTopics] = useState<readonly { id: string; name: string }[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [topicId, setTopicId] = useState(''), [questionId, setQuestionId] = useState('');
  const [testPath, setTestPath] = useState(''), [sectionId, setSectionId] = useState('');
  const [testPage, setTestPage] = useState(''), [questionNumber, setQuestionNumber] = useState('');
  const [rationale, setRationale] = useState('');
  const [reviewer, setReviewer] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null), [message, setMessage] = useState('');
  usePageReady(!!overview || !!accessError);
  useEffect(() => {
    let live = true;
    void test.loadTopics().then(rows => { if (live) { setTopics(rows.map(({ id, name }) => ({ id, name }))); setCatalogError(false); } }).catch(() => { if (live) setCatalogError(true); });
    return () => { live = false; };
  }, [test]);
  useEffect(() => {
    let live = true;
    const loader = academyCurriculumTopicLoaders[topicId];
    if (!topicId || !loader) return () => { live = false; };
    void Promise.all([loader(), test.loadTopicQuestions(topicId)]).then(([module, questions]) => { if (live) setLoaded({ id: topicId, topic: module.academyCurriculumTopic, questions, failed: false }); })
      .catch(() => { if (live) setLoaded({ id: topicId, topic: null, questions: [], failed: true }); });
    return () => { live = false; };
  }, [test, topicId]);
  const current = loaded?.id === topicId ? loaded : null;
  const topic = current?.topic ?? null, questions = current?.questions ?? [];
  const question = questions.find(row => row.i === questionId);
  const testFile = topic?.files.find(file => file.path === testPath && file.kind === 'test' && file.sha256);
  const section = topic?.sections.find(row => row.id === sectionId && row.materialKind === 'syllabus' && row.sourceHash && row.outlineFingerprint);
  const revision = question ? questionContentRevision(question.q, question.a) : '';
  const duplicate = !!question && manifest.links.some(link => link.questionId === question.i && link.contentRevision === revision);
  const validPages = Number.isInteger(Number(testPage)) && Number(testPage) > 0 && (!questionNumber || (Number.isInteger(Number(questionNumber)) && Number(questionNumber) > 0));
  const canSave = !!question && !!testFile && !!section && !!reviewer.trim() && rationale.trim().length >= 10 && confirmed && validPages && !duplicate;
  const add = () => {
    if (!canSave || !question || !testFile || !section) return;
    const link: AcademyQuestionSectionLink = {
      status: 'approved', questionId: question.i, contentRevision: revision, topicId: question.t, sectionId: section.id,
      testEvidence: { path: testFile.path, sourceHash: testFile.sha256!, page: Number(testPage), ...(questionNumber ? { questionNumber: Number(questionNumber) } : {}) },
      sectionEvidence: { path: section.materialPath, sourceHash: section.sourceHash, outlineFingerprint: section.outlineFingerprint, page: section.printedPage },
      rationale: rationale.trim(),
      reviewedAt: localRevision(), reviewer: reviewer.trim(),
    };
    const hashes = new Map(topic!.files.filter(file => file.sha256).map(file => [file.path, file.sha256!]));
    if (!resolveAcademyQuestionSectionLink({ link, question: toQuestion(question), section, availableMaterialHashes: hashes })) { setMessage('Cambió el contenido o el material. Recarga el tema y revisa las referencias.'); return; }
    const next: AcademyQuestionSectionManifest = { schemaVersion: 1, revision: 'local-' + localRevision(), links: [...manifest.links, link] };
    if (!persist(account, next)) { setMessage('No se pudo guardar en este dispositivo. Exporta antes de cerrar.'); return; }
    setManifestState({ account, value: next }); setConfirmed(false); setMessage('Vínculo añadido al borrador local. Exporta el JSON para revisarlo en el repositorio.');
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
      if (!isAcademyQuestionSectionManifest(value)) { setMessage('El archivo no cumple el formato de manifiesto v1.'); return; }
      if (!persist(account, value)) { setMessage('No se pudo guardar el manifiesto importado.'); return; }
      setManifestState({ account, value }); setMessage('Manifiesto importado. La vigencia se comprueba al abrir cada tema.');
    } catch { setMessage('No se pudo leer el JSON seleccionado.'); }
  };
  if (accessError) return <PageMessage role="alert" title="No se pudo comprobar el acceso">La curación está disponible solo para el propietario. Recarga cuando haya conexión.</PageMessage>;
  if (!overview) return <PageLoading variant="access" />;
  if (!overview.owner) return <Navigate to="/home" replace />;
  const exportFile = () => saveExportFile('vinculos-pregunta-epigrafe-' + manifest.revision + '.json', JSON.stringify(manifest, null, 2), 'application/json');
  const topicLinks = manifest.links.filter(link => link.topicId === topicId);
  return <>
    <h1>Curar vínculos a epígrafes</h1>
    <p className="sub">Herramienta editorial local. Los PDF de Drive no se abren aquí: coteja cada pregunta y página en los documentos originales. El tema o la coincidencia de palabras no demuestran una relación.</p>
    <section className="card"><h2 className="h3">Borrador local · {manifest.links.length} vínculos</h2><p className="sm">Se guarda solo en este dispositivo y cuenta. No se sincroniza, publica ni usa para repasos o estadísticas.</p><div className="row"><button className="btn" type="button" onClick={exportFile}>Exportar JSON</button><label className="btn sec cursor-pointer">Importar manifiesto<input className="sr-only" type="file" accept="application/json,.json" onChange={event => { void importFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label></div></section>
    {catalogError ? <PageMessage role="alert" title="No se pudo cargar el catálogo">Comprueba la conexión y vuelve a intentarlo.</PageMessage> : <section className="card" aria-labelledby="map-form-title">
      <h2 className="h3" id="map-form-title">Revisar una asociación</h2>
      <label className="grid gap-1">Tema<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={topicId} onChange={event => { setTopicId(event.target.value); setQuestionId(''); setTestPath(''); setSectionId(''); }}><option value="">Selecciona un tema</option>{topics.map(row => <option key={row.id} value={row.id}>{row.id} · {row.name}</option>)}</select></label>
      {topicId && !current && <p role="status">Cargando preguntas y materiales…</p>}
      {current?.failed && <p role="alert">No se pudieron cargar preguntas completas e índice. Reintenta con conexión y acceso autorizado.</p>}
      {current && !current.failed && topic && <>
        <label className="mt-3 grid gap-1">Pregunta<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={questionId} onChange={event => setQuestionId(event.target.value)}><option value="">Selecciona pregunta ({questions.length})</option>{questions.map(row => <option key={row.i} value={row.i}>{row.i} · {row.q.replace(/\s+/g, ' ').slice(0, 100)}</option>)}</select></label>
        {question && <div className="my-2 rounded-md bg-[var(--surface-soft)] p-3"><p><b>{question.i}</b> · {question.o} · revisión {revision}</p><p>{question.q}</p>{question.a.map((option, index) => <p className="my-1" key={question.i + index}>{String.fromCharCode(65 + index)}. {option}{index === question.c ? ' · correcta en el banco' : ''}</p>)}</div>}
        <label className="mt-3 grid gap-1">PDF de test de Drive<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={testPath} onChange={event => setTestPath(event.target.value)}><option value="">Selecciona documento</option>{topic.files.filter(file => file.kind === 'test' && file.sha256).map(file => <option key={file.path} value={file.path}>{file.name}</option>)}</select></label>
        {testFile && <p className="sm">Ruta: <code>{testFile.path}</code> · SHA-256 {testFile.sha256}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="grid gap-1">Página del test<input className="min-h-11 rounded-md border border-line bg-surface px-2" type="number" min="1" step="1" value={testPage} onChange={event => setTestPage(event.target.value)} /></label><label className="grid gap-1">Número de pregunta (opcional)<input className="min-h-11 rounded-md border border-line bg-surface px-2" type="number" min="1" step="1" value={questionNumber} onChange={event => setQuestionNumber(event.target.value)} /></label></div>
        <label className="mt-3 grid gap-1">Epígrafe del temario<select className="min-h-11 rounded-md border border-line bg-surface px-2" value={sectionId} onChange={event => setSectionId(event.target.value)}><option value="">Selecciona apartado</option>{topic.sections.filter(row => row.materialKind === 'syllabus' && row.sourceHash && row.outlineFingerprint).map(row => <option key={row.id} value={row.id}>{row.title} · p. {row.printedPage} · {row.materialPath}</option>)}</select></label>
        {section && <p className="sm">Coteja en Drive: <code>{section.materialPath}</code>, p. {section.printedPage}. El índice extraído requiere revisión humana.</p>}
        <label className="mt-3 grid gap-1">Por qué corresponde esta pregunta al epígrafe<textarea className="min-h-20 rounded-md border border-line bg-surface p-2" value={rationale} onChange={event => setRationale(event.target.value)} maxLength={1000} /></label>
        <label className="mt-3 grid gap-1">Identificador del revisor<input className="min-h-11 rounded-md border border-line bg-surface px-2" value={reviewer} onChange={event => setReviewer(event.target.value)} maxLength={200} /></label>
        <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>He cotejado la pregunta y las páginas en los documentos de Drive; la asociación está revisada por una persona.</span></label>
        <button className="btn mt-3" type="button" disabled={!canSave} onClick={add}>{duplicate ? 'Esta versión ya está incluida' : 'Añadir al borrador local'}</button>
      </>}
    </section>}
    {topic && current && !current.failed && <section className="card"><h2 className="h3">Vínculos de {topicId}</h2>{topicLinks.length ? topicLinks.map(link => {
      const row = questions.find(item => item.i === link.questionId), mappedSection = topic.sections.find(item => item.id === link.sectionId);
      const currentLink = row && mappedSection ? resolveAcademyQuestionSectionLink({ link, question: toQuestion(row), section: mappedSection, availableMaterialHashes: new Map(topic.files.filter(file => file.sha256).map(file => [file.path, file.sha256!])) }) : undefined;
      return <article key={link.questionId + link.contentRevision} className="border-t border-line py-3"><p><b>{link.questionId}</b> → {mappedSection?.title ?? link.sectionId} · {currentLink ? 'vigente' : 'obsoleto/no localizado; no utilizable'} · {link.testEvidence.path}, p. {link.testEvidence.page}</p><p className="sm">Revisor: {link.reviewer} · {new Date(link.reviewedAt).toLocaleDateString('es-ES')} · {link.rationale}</p><button className="btn sec" type="button" onClick={() => remove(link)}>Retirar del borrador local</button></article>;
    }) : <p className="sm">Aún no hay vínculos para este tema.</p>}</section>}
    {message && <p className="card" role="status">{message}</p>}
  </>;
}
