import { createElement } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { InitialAppLoadingProvider, useMarkInitialAppReady } from '../src/shared/ui/InitialAppLoading.js';

afterEach(() => {
  cleanup();
  document.body.classList.remove('is-initial-loading');
  document.getElementById('initial-loading')?.remove();
});

function Screen({ ready }) {
  useMarkInitialAppReady(ready);
  return createElement('h1', null, 'Inicio');
}

it('keeps the app unavailable until the initial screen is ready', () => {
  document.body.classList.add('is-initial-loading');
  const loader = document.createElement('div');
  loader.id = 'initial-loading';
  document.body.append(loader);
  const view = render(createElement(InitialAppLoadingProvider, null, createElement(Screen, { ready: false })));

  expect(document.body).toHaveClass('is-initial-loading');
  expect(view.container.querySelector('[aria-hidden="true"]')).toHaveAttribute('inert');
  expect(document.getElementById('initial-loading')).toBeInTheDocument();

  view.rerender(createElement(InitialAppLoadingProvider, null, createElement(Screen, { ready: true })));

  expect(document.body).not.toHaveClass('is-initial-loading');
  expect(view.container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  expect(document.getElementById('initial-loading')).not.toBeInTheDocument();
});
