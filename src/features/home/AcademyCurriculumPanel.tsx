import { academyCurriculum } from '../../core/domain/academy-curriculum.generated.js';

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
  const topic = academyCurriculum.topics.find(entry => entry.id === topicId);
  if (!topic) return <p className="mt-2 mb-0 text-sm text-muted">No hay materiales de academia indexados para {topicId} en esta versión del catálogo.</p>;

  const materials = topic.files.filter(file => file.kind !== 'audio');
  const audio = topic.files.filter(file => file.kind === 'audio');
  const message = sourceStatusMessages[topic.sourceStatus] ?? sourceStatusMessages['outline-extracted-needs-review'];
  const materialPaths = [...new Set(topic.sections.map(section => section.materialPath))];

  return <details className="mt-3 rounded-[var(--r-s)] border border-line p-3">
    <summary className="min-h-11 cursor-pointer content-center font-semibold">Material de academia · {topic.sections.length} referencias de índice</summary>
    <p className="mt-2 mb-3 text-sm text-muted">{message} Los documentos permanecen en tu carpeta de Drive y no están copiados ni se abren desde la aplicación. Usa la ruta indicada para consultarlos.</p>
    {materials.length > 0 && <ul className="my-0 mb-3 list-disc ps-5 text-sm">
      {materials.map(file => <li key={file.path}><b>{materialLabels[file.kind] ?? 'Material'}</b>: <code className="break-all">{file.path}</code></li>)}
    </ul>}
    {materialPaths.length > 0 ? materialPaths.map(materialPath => <section className="mt-3" key={materialPath}>
      <h3 className="mb-1 text-sm">Índice extraído · <code className="break-all">{materialPath}</code></h3>
      <ul className="my-0 list-disc ps-5 text-sm">
        {topic.sections.filter(section => section.materialPath === materialPath).map(section => <li key={section.id}>{section.title} <span className="text-muted">(p. {section.printedPage})</span></li>)}
      </ul>
    </section>) : <p className="m-0 text-sm text-muted">No hay apartados extraíbles. Consulta los documentos listados o registra cobertura del tema completo.</p>}
    {audio.length > 0 && <p className="mt-3 mb-0 text-sm text-muted">También hay {audio.length} audio(s) en la carpeta del tema.</p>}
  </details>;
}
