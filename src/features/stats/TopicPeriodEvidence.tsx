import { useEffect, useState } from 'react';
import type { MetricsQuestionEvidence } from '../../core/application/stats/detailed-metrics.js';
import type { StatsServices } from '../../shared/ui/study-services.js';

function Questions({ questions, stats }: { questions: readonly MetricsQuestionEvidence[]; stats: StatsServices }) {
  const [statements, setStatements] = useState<readonly { id: string; statement: string; currentCompatible?: boolean }[] | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const start = page * 20;
  useEffect(() => {
    let active = true;
    const selected = questions.slice(start, start + 20);
    const account = stats.accountId?.();
    void stats.loadQuestionStatements(selected.map(question => question.questionId), Object.fromEntries(selected.map(question => [question.questionId, question.semanticRevision ?? ''])))
      .then(value => { if (active && account === stats.accountId?.()) setStatements(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [questions, start, stats]);
  return <div>
    <p>Último resultado ordinario dentro del periodo. Las preguntas antiguas sin revisión semántica suficiente conservan su ID, pero no se les atribuye el contenido actual.</p>
    {error && <p role="status">No se pudieron cargar los enunciados. Los IDs y resultados registrados siguen disponibles.</p>}
    <ul>{questions.slice(start, start + 20).map(question => {
      const current = statements?.find(row => row.id === question.questionId);
      return <li key={question.questionId} className="my-2"><b>{question.questionId}</b> · {question.mode === 'practice' ? 'Práctica' : 'Simulacro'} · {question.outcome === 'correct' ? 'Acierto' : 'Fallo'}<br />
        {current?.currentCompatible ? current.statement : statements ? 'Versión histórica sin contenido compatible comprobado.' : 'Comprobando versión actual…'}
      </li>;
    })}</ul>
    <div className="row"><button className="btn sec" disabled={page === 0} onClick={() => { setStatements(null); setError(false); setPage(value => value - 1); }}>Anterior</button><span>{page + 1} / {Math.max(1, Math.ceil(questions.length / 20))}</span><button className="btn sec" disabled={start + 20 >= questions.length} onClick={() => { setStatements(null); setError(false); setPage(value => value + 1); }}>Siguiente</button></div>
  </div>;
}
export function TopicPeriodEvidence({ questions, stats }: { questions: readonly MetricsQuestionEvidence[]; stats: StatsServices }) {
  const [open, setOpen] = useState(false);
  if (!questions.length) return <p>Sin respuestas ordinarias registradas para este tema y periodo.</p>;
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Ver evidencia · {questions.length} preguntas</summary>{open && <Questions questions={questions} stats={stats} />}</details>;
}
