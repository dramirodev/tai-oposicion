import { act, createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { InitialAppLoadingProvider, useMarkInitialAppReady } from '../src/shared/ui/InitialAppLoading.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.classList.remove('is-initial-loading');
  document.getElementById('initial-loading')?.remove();
});

function Screen({ ready }) {
  useMarkInitialAppReady(ready);
  return createElement('h1', null, 'Inicio');
}

it('keeps the app unavailable through two browser frames after the initial screen is ready', () => {
  const frames = [];
  const cancelled = [];
  let nextId = 0;
  vi.stubGlobal('requestAnimationFrame', callback => {
    const frame = { id:++nextId, callback };
    frames.push(frame);
    return frame.id;
  });
  vi.stubGlobal('cancelAnimationFrame', id => cancelled.push(id));

  document.body.classList.add('is-initial-loading');
  const loader = document.createElement('div');
  loader.id = 'initial-loading';
  document.body.append(loader);
  const view = render(createElement(InitialAppLoadingProvider, null, createElement(Screen, { ready: false })));

  expect(document.body).toHaveClass('is-initial-loading');
  expect(view.container.querySelector('[aria-hidden="true"]')).toHaveAttribute('inert');
  expect(document.getElementById('initial-loading')).toBeInTheDocument();

  view.rerender(createElement(InitialAppLoadingProvider, null, createElement(Screen, { ready: true })));

  expect(frames).toHaveLength(1);
  expect(document.body).toHaveClass('is-initial-loading');
  act(() => frames.shift().callback(16));
  expect(frames).toHaveLength(1);
  expect(document.body).toHaveClass('is-initial-loading');
  act(() => frames.shift().callback(32));

  expect(document.body).not.toHaveClass('is-initial-loading');
  expect(view.container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  expect(document.getElementById('initial-loading')).not.toBeInTheDocument();
  expect(cancelled).toEqual([]);
});

it('cancels pending readiness frames on unmount', () => {
  const frames = [];
  const cancelled = [];
  let nextId = 0;
  vi.stubGlobal('requestAnimationFrame', callback => {
    const frame = { id:++nextId, callback };
    frames.push(frame);
    return frame.id;
  });
  vi.stubGlobal('cancelAnimationFrame', id => cancelled.push(id));

  const view = render(createElement(InitialAppLoadingProvider, null, createElement(Screen, { ready: true })));
  expect(frames).toHaveLength(1);
  view.unmount();
  expect(cancelled).toEqual([1]);
  expect(document.body).toHaveClass('is-initial-loading');
});
