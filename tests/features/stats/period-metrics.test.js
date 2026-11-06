import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import React from 'react';
import { PeriodMetricsPanel } from '../../../src/features/stats/PeriodMetricsPanel.js';
import { summarizeDetailedMetrics } from '../../../src/core/application/stats/detailed-metrics.js';
vi.mock('../../../src/features/stats/StatsCharts.js', () => ({ StatsStudyBars: () => React.createElement('div', null, 'Gráfico de prueba') }));
afterEach(cleanup);
const deferred = () => { let resolve; const promise = new Promise(value => { resolve = value; }); return { promise, resolve }; };
const value = query => summarizeDetailedMetrics({ archive: { attempts: [], events: [], sessions: [], createdAt: Date.now() }, query, questions: new Map(), catalogueRevision: 'synthetic' });
it('ignores late filters and invalidates visible derivatives immediately on history deletion', async () => {
  const first = deferred(), second = deferred(), third = deferred(); let changed;
  const queries = [];
  const stats = { accountId: () => 'A', getApprovedSectionLinkCount: () => 0,
    loadMetrics: vi.fn(query => { queries.push(query); return [first, second, third][queries.length - 1].promise; }),
    onMetricsChange: listener => { changed = listener; return () => {}; } };
  render(React.createElement(PeriodMetricsPanel, { stats, topics: [] }));
  fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: '7' } });
  await act(async () => { second.resolve({ ...value(queries[1]), completedSessions: 7 }); });
  await screen.findByText('Sesiones completadas con actividad');
  expect(screen.getByText('7', { selector: 'b' })).toBeTruthy();
  await act(async () => { first.resolve({ ...value(queries[0]), completedSessions: 99 }); });
  expect(screen.queryByText('99', { selector: 'b' })).toBeNull();
  act(() => changed());
  expect(screen.queryByText('7', { selector: 'b' })).toBeNull();
  await act(async () => { third.resolve(value(queries[2])); });
  await waitFor(() => expect(screen.getByText('Sin respuestas', { selector: 'b' })).toBeTruthy());
});
it('keeps an error distinct from a zero-valued result and offers refresh', async () => {
  const stats = { loadMetrics: vi.fn().mockRejectedValue(new Error('quota')), getApprovedSectionLinkCount: () => 0 };
  render(React.createElement(PeriodMetricsPanel, { stats, topics: [] }));
  expect(await screen.findByRole('alert')).toHaveTextContent('no se representa como cero');
  expect(screen.queryByText('Sin respuestas', { selector: 'b' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar métricas' }));
  await waitFor(() => expect(stats.loadMetrics).toHaveBeenCalledTimes(2));
});

import { AppServicesProvider } from '../../../src/shared/ui/study-services.js';
import { StatsPage } from '../../../src/features/stats/StatsPage.js';
it('keeps detailed metrics available when the legacy aggregate view fails', async () => {
  const stats = { getPreference: () => ({}), accountId: () => 'A', load: vi.fn().mockRejectedValue(new Error('legacy')),
    loadMetrics: vi.fn(async query => value(query)), loadWeekly: vi.fn().mockResolvedValue([]), getApprovedSectionLinkCount: () => 0 };
  render(React.createElement(AppServicesProvider, { value: { stats } }, React.createElement(StatsPage)));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el progreso');
  expect(await screen.findByText('Sin respuestas', { selector: 'b' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Resumen del periodo' })).toBeTruthy();
});
it('does not display account A metrics after switching to B during loading', async () => {
  const first = deferred(); let account = 'A', change;
  const stats = { getPreference: () => ({}), accountId: () => account, onAccountChange: listener => { change = listener; return () => {}; },
    load: vi.fn().mockRejectedValue(new Error('legacy')), loadWeekly: vi.fn().mockResolvedValue([]), getApprovedSectionLinkCount: () => 0,
    loadMetrics: vi.fn(query => account === 'A' ? first.promise : Promise.resolve({ ...value(query), completedSessions: 2 })) };
  render(React.createElement(AppServicesProvider, { value: { stats } }, React.createElement(StatsPage)));
  const query = stats.loadMetrics.mock.calls[0][0];
  act(() => { account = 'B'; change(); });
  await screen.findByText('2', { selector: 'b' });
  await act(async () => { first.resolve({ ...value(query), completedSessions: 99 }); });
  expect(screen.queryByText('99', { selector: 'b' })).toBeNull();
});
