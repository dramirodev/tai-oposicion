import { createRoot, type Root } from 'react-dom/client';
import { useLayoutEffect, useState } from 'react';
import { richHtml } from '../../../src/shared/presentation/study-text.js';
import { StudyMarkup } from '../../../src/shared/ui/StudyMarkup.js';
import '../../../src/shared/styles/index.css';

interface Question {
  i: string;
  t: string;
  o?: string;
  q: string;
  a: string[];
  c: number;
  n?: string;
  u?: string;
  cp?: string;
  supTexto?: string;
}

interface Topic { id: string }
interface AuditApi {
  total: number;
  ids: string[];
  renderBatch(offset: number, size: number): Promise<void>;
}

declare global { interface Window { questionRenderAudit?: AuditApi; questionRenderReady?: Promise<void> } }

function RenderedQuestion({ question }: { question: Question }) {
  const textFields = [['explanation', question.n], ['reference', question.u], ['source', question.cp], ['scenario', question.supTexto]] as const;
  const markup = (value: string) => richHtml(value, true);
  const expectedCodeCount = (value: string) => new DOMParser().parseFromString(markup(value), 'text/html').querySelectorAll('code.cd').length;
  return <article className="card q" data-question-id={question.i} data-topic-id={question.t} data-origin={question.o || 'unknown'}>
    <h2>{question.i} · {question.t}</h2>
    <div className="enun pre" data-audit-field="statement" data-expected={question.q} data-expected-code-count={expectedCodeCount(question.q)}>
      <StudyMarkup html={markup(question.q)} languageContext={question.q} />
    </div>
    <div className="opts">{question.a.map((option, index) => <div className="option-control" key={`${question.i}-${index}`}>
      <button type="button" className={`opt${index === question.c ? ' ok' : ''}`} aria-pressed="false">
        <b>{'ABCD'[index] || String(index + 1)}</b><span className="pre" data-audit-field={`option-${index}`} data-expected={option} data-expected-code-count={expectedCodeCount(option)}><StudyMarkup html={markup(option)} languageContext={question.q} /></span>
        {index === question.c && <span className="sr">(respuesta correcta)</span>}
      </button>
    </div>)}</div>
    {textFields.map(([field, value]) => value ? <div className="ctx pre" data-audit-field={field} data-expected={value} data-expected-code-count={expectedCodeCount(value)} key={field}>
      <StudyMarkup html={markup(value)} languageContext={question.q} />
    </div> : null)}
  </article>;
}

function Batch({ questions }: { questions: readonly Question[] }) {
  return <section aria-label="Preguntas de la auditoría">{questions.map(question => <RenderedQuestion key={question.i} question={question} />)}</section>;
}

async function loadQuestions(): Promise<Question[]> {
  const indexResponse = await fetch('/data/index.json');
  if (!indexResponse.ok) throw new Error(`No se pudo cargar el índice: ${indexResponse.status}`);
  const index = await indexResponse.json() as { temas: Topic[] };
  const [topics, scenarios] = await Promise.all([Promise.all(index.temas.map(async ({ id }) => {
    const response = await fetch(`/data/${id}.json`);
    if (!response.ok) throw new Error(`No se pudo cargar ${id}: ${response.status}`);
    return await response.json() as Question[];
  })), fetch('/data/supuestos.json').then(async response => {
    if (!response.ok) throw new Error(`No se pudieron cargar los supuestos: ${response.status}`);
    return await response.json() as Record<string, { texto: string; q: Question[] }>;
  })]);
  const scenarioQuestions = Object.values(scenarios).flatMap(scenario => scenario.q.map(question => ({ ...question, supTexto: scenario.texto })));
  return [...topics.flat(), ...scenarioQuestions];
}

const rootElement = document.getElementById('audit-root');
if (!rootElement) throw new Error('Falta #audit-root');
const root: Root = createRoot(rootElement);
let questions: Question[] = [];
let setBatch: ((items: Question[]) => void) | undefined;
let resolveBatch: (() => void) | undefined;

function AuditRoot() {
  const [batch, updateBatch] = useState<Question[]>([]);
  setBatch = updateBatch;
  useLayoutEffect(() => {
    resolveBatch?.();
    resolveBatch = undefined;
  }, [batch]);
  return <Batch questions={batch} />;
}

root.render(<AuditRoot />);
window.questionRenderReady = loadQuestions().then(records => {
  questions = records;
  setBatch?.(records.slice(0, 1));
  window.questionRenderAudit = {
    total: records.length,
    ids: records.map(question => question.i),
    renderBatch: (offset, size) => new Promise(resolve => {
      resolveBatch = resolve;
      setBatch?.(questions.slice(offset, offset + size));
    }),
  };
});
