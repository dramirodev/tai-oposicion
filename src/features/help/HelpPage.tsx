import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FAILURE_HELP, HELP_SECTIONS } from './content.js';

export function HelpPage() {
  const root = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const [tocOpen, setTocOpen] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 761px)').matches);
  const selected = params.get('tema');
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 761px)');
    const syncOpenState = () => setTocOpen(desktop.matches);
    desktop.addEventListener('change', syncOpenState);
    return () => desktop.removeEventListener('change', syncOpenState);
  }, []);
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      const section = Array.from(root.current?.querySelectorAll<HTMLElement>('[id]') || []).find(element => element.id === selected);
      section?.scrollIntoView?.({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  return <div ref={root}>
    <h1>Ayuda</h1>
    <p className="sub">Guía práctica para empezar, usar las herramientas de estudio y entender cómo se guarda tu progreso. Si abres esta guía antes de desconectarte, podrás volver a consultarla sin conexión.</p>
    <nav className="card help-toc" aria-label="Contenido de ayuda">
      <details open={tocOpen} onToggle={event => setTocOpen(event.currentTarget.open)}>
        <summary><span className="h3">En esta guía</span></summary>
        <ul>{HELP_SECTIONS.map(section => <li key={section.id}><Link to={`?tema=${section.id}`}>{section.title}</Link></li>)}<li><Link to="?tema=marcas">Subrayados, confianza y opciones</Link></li><li><Link to="?tema=motivos">Motivos de fallo</Link></li></ul>
      </details>
    </nav>
    <section className="card" id="marcas"><h2 className="h3">Subrayados y señales opcionales</h2>
      <p>En una pregunta puedes seleccionar texto con ratón, teclado o mantener pulsado en una pantalla táctil y marcarlo como <b>Clave</b> o <b>Duda</b>. También puedes quitar una marca. La selección no responde a la pregunta; se conserva el formato del código y la marca queda asociada a este intento.</p>
      <p>Antes de responder puedes registrar tu confianza como <b>Seguro</b>, <b>Entre dos</b> o <b>Adivino</b> y descartar/restaurar opciones para ayudarte a razonar. Son acciones voluntarias y no cambian la puntuación. En la revisión del resultado aparecen las marcas y descartes de ese intento.</p>
      <p>En simulacros las herramientas solo registran lo que eliges explícitamente. No muestran soluciones ni recomendaciones mientras el simulacro sigue abierto.</p>
    </section>
    <section className="card" id="motivos"><h2 className="h3">¿Por qué fallé?</h2>
      <p>Este motivo es opcional. Registra lo que tú observaste; el tiempo de respuesta no permite saber por qué te equivocaste.</p>
      {FAILURE_HELP.map(topic => <article className="help-topic" id={topic.id} key={topic.id}><h3>{topic.title}</h3><p>{topic.meaning}</p><p><b>Ejemplo:</b> {topic.example}</p><p><b>Elige otro motivo si:</b> {topic.chooseInstead}</p></article>)}
    </section>
    {HELP_SECTIONS.map(section => <section className="card" id={section.id} key={section.id}><h2 className="h3">{section.title}</h2>{section.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
    <p className="sub">Los datos anteriores mantienen su clasificación original. Esta guía no cambia tu progreso.</p>
  </div>;
}
