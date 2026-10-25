import { escapeHtml } from '../../shared/presentation/format.js';
import type { CodeExplanationVM } from './explanation-mapper.js';

export function renderCodeExplanation(viewModel: CodeExplanationVM, id = 'current'): string {
  return `<section class="card code-explanation" aria-labelledby="code-explanation-title-${escapeHtml(id)}">
    <h3 class="h3" id="code-explanation-title-${escapeHtml(id)}">${escapeHtml(viewModel.heading)}</h3>
    <p class="explanation-status"><span class="tag warn">${escapeHtml(viewModel.editorialLabel)}</span>${viewModel.editorialNote ? ` ${escapeHtml(viewModel.editorialNote)}` : ''}</p>
    <p class="sub">Lenguaje: ${escapeHtml(viewModel.language)}</p>
    <pre class="code-sample" tabindex="0"><code>${escapeHtml(viewModel.snippet)}</code></pre>
    <p><b>${escapeHtml(viewModel.resultLabel)}:</b></p>
    ${viewModel.resultValue !== undefined ? `<pre class="code-result"><code>${escapeHtml(viewModel.resultValue)}</code></pre>` : ''}
    <ol>${viewModel.steps.map(step => `<li><b>${escapeHtml(step.title)}</b><p>${escapeHtml(step.explanation)}</p></li>`).join('')}</ol>
    ${viewModel.distractors.length ? `<h4>Por qué no las otras opciones</h4><ul>${viewModel.distractors.map(item => `<li><b>${escapeHtml(String.fromCharCode(65 + item.optionIndex))}:</b> ${escapeHtml(item.explanation)}</li>`).join('')}</ul>` : ''}
    <p class="sub">${escapeHtml(viewModel.limitation)}</p>
    <ul class="explanation-sources">${viewModel.sources.map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>${source.section ? ` · ${escapeHtml(source.section)}` : ''}</li>`).join('')}</ul>
  </section>`;
}
