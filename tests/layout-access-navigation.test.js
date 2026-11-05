import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ full:true, listeners:new Set(), navigate:vi.fn() }));
vi.mock('react-router', () => ({ useNavigate:() => state.navigate }));
vi.mock('../src/app/composition/access-composition.js', () => ({ isFull:() => state.full, isOwner:() => false }));
vi.mock('../src/adapters/firebase/sync-status-store.js', () => ({ syncGateway:{ subscribe:listener => { state.listeners.add(listener); return () => state.listeners.delete(listener); } } }));
vi.mock('../src/app/access-events.js', () => ({ subscribeAccessChanges:() => () => {} }));
vi.mock('../src/app/composition/study/study-engine-composition.js', () => ({ hasActiveRun:() => false }));
import { useLayoutAccess } from '../src/app/layouts/layout-composition.js';
afterEach(() => { cleanup(); state.listeners.clear(); });
it.each([true, false])('actualiza el shell sin sobrescribir una navegación de cuenta al cambiar full desde %s', async initial => {
  state.full = initial;
  const navigate = state.navigate; navigate.mockClear();
  function Shell() {
    const access = useLayoutAccess();
    return createElement('output', null, access.full ? 'Completo' : 'Limitado');
  }
  render(createElement(Shell));
  await act(async () => { state.full = !initial; state.listeners.forEach(listener => listener()); });
  expect(screen.getByText(initial ? 'Limitado' : 'Completo')).toBeVisible();
  expect(navigate).not.toHaveBeenCalled();
});
