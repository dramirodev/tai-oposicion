import { useEffect, useState } from 'react';
import type { AcademyCurriculumTopic } from '../../core/domain/academy-curriculum-types.js';
import { academyCurriculumTopicLoaders } from '../../core/domain/academy-curriculum.generated.js';

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

export function AcademyCurriculumPanel({ topicId }: { topicId: string }) {
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
        <ul className="my-0 list-disc ps-5 text-sm">
          {sections.filter(section => section.materialPath === materialPath).map(section => <li key={section.id}>{section.title} <span className="text-muted">(p. {section.printedPage})</span></li>)}
        </ul>
      </div>)}
      <p className="mt-2 mb-0 text-sm text-muted">{context}</p>
    </section>;
  };

  return <details className="mt-3 rounded-[var(--r-s)] border border-line p-3">
    <summary className="min-h-11 cursor-pointer content-center font-semibold">Material de academia · {topic.sections.length} referencias de índice</summary>
    <p className="mt-2 mb-3 text-sm text-muted">{message} Los documentos permanecen en tu carpeta de Drive y no están copiados ni se abren desde la aplicación. Usa la ruta indicada para consultarlos.</p>
    {materials.length > 0 && <ul className="my-0 mb-3 list-disc ps-5 text-sm">
      {materials.map(file => <li key={file.path}><b>{materialLabels[file.kind] ?? 'Material'}</b>: <code className="break-all">{file.path}</code></li>)}
    </ul>}
    {renderOutlineGroup(curriculumSections, 'Índices extraídos de temarios', 'Son candidatos a estructura del tema, pendientes de confirmar con la versión usada por la academia.')}
    {renderOutlineGroup(supplementalSections, 'Índices extraídos de material complementario', 'Estos índices describen el documento indicado; no prueban que sea el programa completo del tema.')}
    {materialPaths.length === 0 && <p className="m-0 text-sm text-muted">No se pudo extraer un índice. Consulta los documentos listados; la aplicación no inventa apartados.</p>}
    {audio.length > 0 && <p className="mt-3 mb-0 text-sm text-muted">También hay {audio.length} audio(s) en la carpeta del tema.</p>}
  </details>;
}
