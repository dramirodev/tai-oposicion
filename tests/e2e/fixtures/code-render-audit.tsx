import { createRoot, type Root } from 'react-dom/client';
import { useLayoutEffect, useState } from 'react';
import { hiliteHtml, richHtml } from '../../../src/shared/presentation/study-text.js';
import { questionNotice } from '../../../src/shared/presentation/study-content.js';
import { StudyMarkup } from '../../../src/shared/ui/StudyMarkup.js';
import { inferCodeLanguage } from '../../../src/shared/ui/study-code-language.js';
import { explanationMapper as explanationViewMapper } from '../../../src/features/explanations/explanation-mapper.js';
import { explanationMapper as explanationDomainMapper } from '../../../src/adapters/http/mappers/explanation.js';
import { renderCodeExplanation } from '../../../src/features/explanations/legacy-view.js';
import '../../../src/shared/styles/index.css';

interface BankQuestion {
  i: string; t: string; o: string; q: string; a: string[]; c: number;
  n?: string; u?: string; cp?: string; supTexto?: string; np?: number; s?: string;
}
interface Topic { id: string; }
interface Scenario { texto: string; conv?: string; q: BankQuestion[]; }
interface CardRecord { id: string; t: string; q: string; a: string; ref?: string; nota?: string; cp?: string; supTexto?: string; }
interface ExplanationDto { i: string; }
interface AuditField {
  name: string;
  sourceText: string;
  html: string;
  outputText: string;
  fragments: string[];
  directCode?: boolean;
}
interface AuditRecord {
  path: string;
  id: string;
  kind: 'question' | 'scenario' | 'card' | 'explanation';
  origin?: string;
  fields: AuditField[];
  explanationHtml?: string;
}
interface AuditSummary {
  scannedFiles: number;
  records: Record<string, number>;
  originCounts: Record<string, number>;
  fieldsScanned: number;
  fieldsWithCode: number;
  fragmentCount: number;
  recordsWithCode: number;
  byField: Record<string, number>;
  bySource: Record<string, number>;
  byLanguage: Record<string, number>;
  codeCases: { path: string; id: string; field: string; fragmentIndex: number; text: string; language: string }[];
}
interface AuditApi extends AuditSummary {
  total: number;
  renderBatch(offset: number, size: number): Promise<void>;
  renderIndexes(indexes: number[]): Promise<void>;
}

declare global { interface Window { codeRenderAudit?: AuditApi; codeRenderReady?: Promise<void>; codeRenderError?: string; } }

function htmlText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

function markupField(name: string, value: string | undefined, html = value ? richHtml(value, true) : ''): AuditField | null {
  if (!value || !html) return null;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const fragments = Array.from(document.querySelectorAll('code.cd'), code => code.textContent || '');
  return { name, sourceText: value, html, outputText: document.body.textContent || '', fragments };
}

function questionFields(question: BankQuestion, scenarioText?: string): AuditField[] {
  const fields: AuditField[] = [];
  const statement = markupField('enunciado', question.q);
  if (statement) fields.push(statement);
  question.a.forEach((option, index) => {
    const field = markupField(`opcion_${index + 1}`, option);
    if (field) fields.push(field);
  });
  const notice = questionNotice({ n: question.n, np: question.np, i: question.i });
  if (notice) {
    const field = markupField('nota_feedback', question.n || '', notice);
    if (field) fields.push(field);
  }
  if (question.u) {
    const field = markupField('cita_feedback', question.u, hiliteHtml(question.u, question.a[question.c] || ''));
    if (field) fields.push(field);
  }
  const context = markupField('contexto', question.cp);
  if (context) fields.push(context);
  const assumption = markupField('texto_supuesto', scenarioText || question.supTexto);
  if (assumption) fields.push(assumption);
  return fields;
}

function directCodeField(name: string, value: string | undefined): AuditField | null {
  if (!value) return null;
  const html = `<pre class="${name === 'fragmento' ? 'code-sample' : 'code-result'}"><code>${value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')}</code></pre>`;
  return { name, sourceText: value, html, outputText: value, fragments: [value], directCode: true };
}

function explanationFields(raw: ExplanationDto): AuditField[] {
  const mapped = explanationDomainMapper.toDomain(raw);
  if (!mapped.ok) throw new Error(`Explicación inválida ${raw.i}: ${mapped.reason}`);
  const explanation = mapped.value;
  const fields: AuditField[] = [];
  const snippet = directCodeField('fragmento', explanation.snippet);
  if (snippet) fields.push(snippet);
  const result = directCodeField('resultado.valor', explanation.result.value);
  if (result) fields.push(result);
  explanation.steps.forEach((step, index) => {
    for (const [name, value] of [[`pasos.${index}.titulo`, step.title], [`pasos.${index}.detalle`, step.explanation]] as const) {
      const field = markupField(name, value);
      if (field) fields.push(field);
    }
  });
  explanation.distractors.forEach((item, index) => {
    const field = markupField(`distractores.${index}.detalle`, item.explanation);
    if (field) fields.push(field);
  });
  for (const [name, value] of [['nota_editorial', explanation.editorialNote], ['limitacion', explanation.limitation], ...explanation.sources.flatMap((source, index) => [[`fuentes.${index}.titulo`, source.title], [`fuentes.${index}.seccion`, source.section] as const])] as const) {
    const field = markupField(name, value);
    if (field) fields.push(field);
  }
  return fields;
}

function fieldHasCode(field: AuditField): boolean { return field.fragments.length > 0; }

function AuditFieldView({ field, letter }: { field: AuditField; letter?: string }) {
  if (field.name.startsWith('opcion_')) return <div className="option-control"><button className="opt" type="button" aria-pressed="false"><b>{letter}</b><span className="pre audit-field" data-audit-field={field.name} data-expected={field.outputText} data-expected-source={field.sourceText} data-expected-code-count={field.fragments.length}><StudyMarkup html={field.html} /></span></button></div>;
  const content = <div className="audit-field" data-audit-field={field.name} data-expected={field.outputText} data-expected-source={field.sourceText} data-expected-code-count={field.fragments.length}><StudyMarkup html={field.html} /></div>;
  if (field.name === 'enunciado') return <div className="enun pre">{content}</div>;
  if (field.name === 'nota_feedback') return <div className="ctx pre">{content}</div>;
  if (field.name === 'cita_feedback') return <div className="cita">{content}</div>;
  if (field.name === 'contexto') return <div className="ctx pre">{content}</div>;
  if (field.name === 'texto_supuesto') return <details className="sup scenario-context" open><summary>Enunciado del supuesto</summary><div className="pre">{content}</div></details>;
  if (field.name === 'pregunta') return <div className="enun pre">{content}</div>;
  if (field.name === 'respuesta') return <div className="card-answer"><small>Respuesta</small><div className="pre">{content}</div></div>;
  if (field.name === 'referencia') return <div className="cita"><span>Temario</span>{content}</div>;
  if (field.name === 'nota') return <div className="cita"><span>Nota</span>{content}</div>;
  return content;
}

function RenderedRecord({ record }: { record: AuditRecord }) {
  if (record.kind === 'explanation') return <article className="card q" data-audit-record={record.id} data-source-path={record.path} data-record-kind={record.kind}>
    <h2>{record.id} · explicación</h2><div className="code-explanation-slot audit-field" data-audit-field="explicacion_completa" data-expected={htmlText(record.explanationHtml || '')} data-expected-code-count={record.fields.reduce((total, field) => total + field.fragments.length, 0)}><StudyMarkup html={record.explanationHtml || ''} /></div>
  </article>;
  return <article className={`card q${record.kind === 'scenario' ? ' with-sup' : ''}`} data-audit-record={record.id} data-source-path={record.path} data-record-kind={record.kind}>
    <h2>{record.id}{record.origin ? ` · ${record.origin}` : ''}</h2>
    {record.kind === 'scenario' && record.fields.map(field => <AuditFieldView key={field.name} field={field} />)}
    {record.kind === 'question' && <>
      {record.fields.filter(field => field.name === 'enunciado').map(field => <AuditFieldView key={field.name} field={field} />)}
      <div className="opts">{record.fields.filter(field => field.name.startsWith('opcion_')).map((field, index) => <AuditFieldView key={field.name} field={field} letter={'ABCD'[index] || String(index + 1)} />)}</div>
      {record.fields.filter(field => !field.name.startsWith('opcion_') && field.name !== 'enunciado').map(field => <AuditFieldView key={field.name} field={field} />)}
    </>}
    {record.kind === 'card' && <>
      {record.fields.filter(field => ['pregunta', 'texto_supuesto', 'contexto'].includes(field.name)).map(field => <AuditFieldView key={field.name} field={field} />)}
      {record.fields.filter(field => ['respuesta', 'nota', 'referencia'].includes(field.name)).map(field => <AuditFieldView key={field.name} field={field} />)}
    </>}
  </article>;
}

function AuditBatch({ records }: { records: readonly AuditRecord[] }) {
  return <section aria-label="Fragmentos reales de código del banco TAI">{records.map(record => <RenderedRecord key={`${record.path}:${record.id}`} record={record} />)}</section>;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo leer ${url}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function loadAudit(): Promise<{ records: AuditRecord[]; summary: AuditSummary }> {
  const index = await getJson<{ temas: Topic[] }>('/data/index.json');
  const topicData = await Promise.all(index.temas.map(async topic => ({ path: `public/data/${topic.id}.json`, rows: await getJson<BankQuestion[]>(`/data/${topic.id}.json`) })));
  const scenarios = await getJson<Record<string, Scenario>>('/data/supuestos.json');
  const cardsIndex = await getJson<{ temas: Record<string, number> }>('/cards/index.json');
  const cardData = await Promise.all(Object.keys(cardsIndex.temas).map(async id => ({ path: `public/cards/${id}.json`, rows: await getJson<CardRecord[]>(`/cards/${id}.json`) })));
  const explanations = await getJson<ExplanationDto[]>('/explanations/index.json');
  const scenarioById = scenarios;
  const records: AuditRecord[] = [];
  const summary: AuditSummary = { scannedFiles: topicData.length + 1 + cardData.length + 1, records: {}, originCounts: {}, fieldsScanned: 0, fieldsWithCode: 0, fragmentCount: 0, recordsWithCode: 0, byField: {}, bySource: {}, byLanguage: {}, codeCases: [] };
  const append = (record: AuditRecord) => {
    summary.records[record.kind] = (summary.records[record.kind] || 0) + 1;
    if (record.origin) summary.originCounts[record.origin] = (summary.originCounts[record.origin] || 0) + 1;
    summary.fieldsScanned += record.fields.length;
    const codedFields = record.fields.filter(fieldHasCode);
    if (codedFields.length) {
      summary.recordsWithCode++;
      for (const field of codedFields) {
        summary.fieldsWithCode++;
        summary.byField[field.name] = (summary.byField[field.name] || 0) + field.fragments.length;
        summary.bySource[record.kind] = (summary.bySource[record.kind] || 0) + field.fragments.length;
        for (const [fragmentIndex, text] of field.fragments.entries()) {
          const language = inferCodeLanguage(text);
          summary.fragmentCount++;
          summary.byLanguage[language] = (summary.byLanguage[language] || 0) + 1;
          summary.codeCases.push({ path: record.path, id: record.id, field: field.name, fragmentIndex, text, language });
        }
      }
      records.push(record);
    }
  };

  for (const { path, rows } of topicData) for (const question of rows) append({ path, id: question.i, kind: 'question', origin: question.o, fields: questionFields(question, question.s ? scenarioById[question.s]?.texto : undefined) });
  let scenarioQuestionCount = 0;
  for (const [id, scenario] of Object.entries(scenarios)) {
    const scenarioFields = [markupField('convocatoria', scenario.conv), markupField('texto_supuesto', scenario.texto)].filter((field): field is AuditField => field !== null);
    if (scenarioFields.length) append({ path: 'public/data/supuestos.json', id, kind: 'scenario', origin: 'O', fields: scenarioFields });
    for (const question of scenario.q) {
      scenarioQuestionCount++;
      append({ path: 'public/data/supuestos.json', id: question.i, kind: 'question', origin: question.o, fields: questionFields(question, scenario.texto) });
    }
  }
  for (const { path, rows } of cardData) for (const card of rows) {
    const fields = [markupField('pregunta', card.q), markupField('respuesta', card.a), markupField('referencia', card.ref), markupField('nota', card.nota), markupField('contexto', card.cp), markupField('texto_supuesto', card.supTexto)].filter((field): field is AuditField => field !== null);
    append({ path, id: card.id, kind: 'card', origin: card.src, fields });
  }
  for (const raw of explanations) {
    const mapped = explanationDomainMapper.toDomain(raw);
    if (!mapped.ok) throw new Error(`Explicación inválida ${raw.i}: ${mapped.reason}`);
    const vm = explanationViewMapper.toViewModel(mapped.value);
    const explanationHtml = renderCodeExplanation(vm, raw.i);
    append({ path: 'public/explanations/index.json', id: raw.i, kind: 'explanation', origin: mapped.value.language, fields: explanationFields(raw), explanationHtml });
  }
  summary.records.question = topicData.reduce((total, topic) => total + topic.rows.length, 0) + scenarioQuestionCount;
  summary.records.scenario = Object.keys(scenarios).length;
  summary.records.card = cardData.reduce((total, topic) => total + topic.rows.length, 0);
  summary.records.explanation = explanations.length;
  summary.originCounts.O = topicData.flatMap(topic => topic.rows).concat(Object.values(scenarios).flatMap(scenario => scenario.q)).filter(q => q.o === 'O').length;
  summary.originCounts.A = topicData.flatMap(topic => topic.rows).filter(q => q.o === 'A').length;
  summary.originCounts.G = topicData.flatMap(topic => topic.rows).filter(q => q.o === 'G').length;
  return { records, summary };
}

const rootElement = document.getElementById('audit-root');
if (!rootElement) throw new Error('Falta #audit-root');
const root: Root = createRoot(rootElement);
let records: AuditRecord[] = [];
let setBatch: ((items: AuditRecord[]) => void) | undefined;
let resolveBatch: (() => void) | undefined;

function AuditRoot() {
  const [batch, updateBatch] = useState<AuditRecord[]>([]);
  setBatch = updateBatch;
  useLayoutEffect(() => { resolveBatch?.(); resolveBatch = undefined; }, [batch]);
  return <AuditBatch records={batch} />;
}

root.render(<AuditRoot />);
window.codeRenderReady = loadAudit().then(({ records: loaded, summary }) => {
  records = loaded;
  window.codeRenderAudit = {
    ...summary,
    total: records.length,
    renderBatch: (offset, size) => new Promise(resolve => { resolveBatch = resolve; setBatch?.(records.slice(offset, offset + size)); }),
    renderIndexes: indexes => new Promise(resolve => { resolveBatch = resolve; setBatch?.(indexes.map(index => records[index]).filter((record): record is AuditRecord => !!record)); }),
  };
  setBatch?.(records.slice(0, 1));
}).catch(error => { window.codeRenderError = error instanceof Error ? error.message : String(error); throw error; });
