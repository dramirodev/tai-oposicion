import { useId } from 'react';
import type { CodeExplanation } from '../../core/domain/explanations.js';
import { codeExplanationPresenter } from '../presentation/code-explanation.js';
import { richHtml } from '../presentation/study-text.js';
import { StudyCode } from './StudyCode.js';
import { StudyMarkup } from './StudyMarkup.js';

export function CodeExplanationView({ explanation }: { explanation: CodeExplanation }) {
  const titleId = `code-explanation-${useId().replaceAll(':', '')}`;
  const view = codeExplanationPresenter.toViewModel(explanation);
  return <section className="card code-explanation" aria-labelledby={titleId}>
    <h3 className="h3" id={titleId}>{view.heading}</h3>
    <div className="explanation-status"><span className="tag warn">{view.editorialLabel}</span>{view.editorialNote && <StudyMarkup html={richHtml(view.editorialNote)} languageContext={view.language} />}</div>
    <p className="sub">Lenguaje: {view.language}</p>
    <pre className="code-sample my-3 max-w-full overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere]" tabIndex={0}><StudyCode code={view.snippet} language={view.language} className="block max-w-full p-3 text-[length:var(--fs-m)] leading-6 whitespace-inherit [overflow-wrap:anywhere] rounded-[var(--r-s)]" languageContext={view.language} block /></pre>
    <p><b>{view.resultLabel}:</b></p>
    {view.resultValue !== undefined && <pre className="code-result my-3 max-w-full overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere]"><StudyCode code={view.resultValue} language={view.language} className="block max-w-full p-3 text-[length:var(--fs-m)] leading-6 whitespace-inherit [overflow-wrap:anywhere] rounded-[var(--r-s)]" languageContext={view.language} block /></pre>}
    <ol>{view.steps.map((step, index) => <li key={index}><StudyMarkup html={richHtml(step.title)} languageContext={view.language} /><StudyMarkup html={richHtml(step.explanation)} languageContext={view.language} /></li>)}</ol>
    {view.distractors.length > 0 && <><h4>Por qué no las otras opciones</h4><ul>{view.distractors.map(item => <li key={item.optionIndex}><b>{String.fromCharCode(65 + item.optionIndex)}:</b> <StudyMarkup html={richHtml(item.explanation)} languageContext={view.language} /></li>)}</ul></>}
    <div className="sub"><StudyMarkup html={richHtml(view.limitation)} languageContext={view.language} /></div>
    <ul className="explanation-sources">{view.sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer"><StudyMarkup html={richHtml(source.title)} languageContext={view.language} /></a>{source.section && <> · <StudyMarkup html={richHtml(source.section)} languageContext={view.language} /></>}</li>)}</ul>
  </section>;
}
