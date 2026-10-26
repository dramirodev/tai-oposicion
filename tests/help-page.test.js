import { afterEach, expect, it } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { HelpPage } from '../src/features/help/HelpPage.tsx';
import { FAILURE_HELP, HELP_SECTIONS } from '../src/features/help/content.ts';
let root;
afterEach(async () => { if (root) await act(() => root.unmount()); document.body.replaceChildren(); });
it('renders the offline guide and every historical failure category as React content', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(() => root.render(createElement(MemoryRouter, {initialEntries:['/ayuda?tema=repaso']}, createElement(HelpPage))));
  expect(host.querySelector('h1').textContent).toBe('Ayuda');
  for (const topic of FAILURE_HELP) expect(host.querySelector(`#${topic.id}`).textContent).toContain(topic.chooseInstead);
  for (const section of HELP_SECTIONS) {
    const rendered = host.querySelector(`#${section.id}`).textContent;
    for (const paragraph of section.body) expect(rendered).toContain(paragraph);
  }
  expect(host.textContent).toContain('no se muestran soluciones');
});
