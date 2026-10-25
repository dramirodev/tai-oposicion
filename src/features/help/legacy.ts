import { FAILURE_HELP, HELP_SECTIONS } from './content.js';
import { esc } from '../../legacy/logic.js';
import { legacyScope, type LegacyScreen } from '../../shared/ui/legacy-dom.js';

export function registerHelp(routes: Record<string, (...args: never[]) => unknown>, screen: LegacyScreen): void {
  routes.ayuda = function () {
    const { app } = legacyScope(screen);
    const selected = new URLSearchParams(location.hash.split('?')[1] || '').get('tema');
    app.innerHTML = `<h1>Ayuda</h1>
      <p class="sub">Guía de controles, progreso y motivos de fallo. Puedes consultarla sin conexión.</p>
      <section class="card" id="motivos"><h2 class="h3">¿Por qué fallé?</h2>
        <p>Este motivo es opcional. Registra lo que tú observaste; el tiempo de respuesta no permite saber por qué te equivocaste.</p>
        ${FAILURE_HELP.map(topic => `<article class="help-topic" id="${topic.id}"><h3>${esc(topic.title)}</h3><p>${esc(topic.meaning)}</p><p><b>Ejemplo:</b> ${esc(topic.example)}</p><p><b>Elige otro motivo si:</b> ${esc(topic.chooseInstead)}</p></article>`).join('')}
      </section>
      ${HELP_SECTIONS.map(section => `<section class="card" id="${section.id}"><h2 class="h3">${esc(section.title)}</h2><p>${esc(section.body)}</p></section>`).join('')}
      <p class="sub">Los datos anteriores mantienen su clasificación original. Esta guía no cambia tu progreso.</p>`;
    if (selected) requestAnimationFrame(() => app.querySelector(`#${CSS.escape(selected)}`)?.scrollIntoView({ block: 'start' }));
  };
}
