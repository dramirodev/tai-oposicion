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
