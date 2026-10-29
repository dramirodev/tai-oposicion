import { expect, it } from 'vitest';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import { HelpPage } from '../src/features/help/HelpPage.tsx';
import { FAILURE_HELP, HELP_SECTIONS } from '../src/features/help/content.ts';
it('renders the offline guide and every historical failure category as React content', async () => {
  const { container } = render(createElement(MemoryRouter, {initialEntries:['/ayuda?tema=repaso']}, createElement(HelpPage)));
  expect(screen.getByRole('heading', { level: 1, name: 'Ayuda' })).toBeInTheDocument();
  for (const topic of FAILURE_HELP) expect(container.querySelector(`#${topic.id}`).textContent).toContain(topic.chooseInstead);
  for (const section of HELP_SECTIONS) {
    const rendered = container.querySelector(`#${section.id}`).textContent;
    for (const paragraph of section.body) expect(rendered).toContain(paragraph);
  }
  expect(screen.getByText(/no se muestran soluciones/i)).toBeInTheDocument();
});

it('keeps help instructions aligned with current menu labels and measured study behavior', () => {
  const section = (id) => HELP_SECTIONS.find(item => item.id === id)?.body.join(' ') || '';
  expect(section('acceso')).toContain('abre «Accesos» en el menú');
  expect(section('inicio')).toContain('10 preguntas y suele llevar unos cinco minutos; no tiene cronómetro');
  expect(section('inicio')).toContain('«Temas vistos»');
  expect(section('inicio')).toContain('la lectura de apuntes o la reconstrucción mental no se observa directamente');
  expect(section('inicio')).toContain('checkpoint se conserva en este dispositivo');
  expect(section('inicio')).toContain('cinco sesiones completadas más recientes y permite desplegar hasta 30 sesiones guardadas');
  expect(section('inicio')).toContain('vista «Mes» para programar una comprobación futura');
  expect(section('inicio')).toContain('no necesita ni enlaza PDFs');
  expect(section('errores')).toContain('En el menú abre «Errores del banco»');
});
