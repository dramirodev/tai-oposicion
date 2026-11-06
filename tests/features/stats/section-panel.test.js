import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import React from 'react';
import { AcademySectionPerformancePanel } from '../../../src/features/stats/AcademySectionPerformancePanel.js';
afterEach(cleanup);
it('renders linked evidence without a mastery score and preserves the exact query on the action', async () => {
  const counts = { observedQuestions: 1, latestCorrect: 0, latestWrong: 1, answeredAttempts: 2, immediateRetryAttempts: 1,
    confidence: { sure: 0, betweenTwo: 0, guess: 0, notRecorded: 1 }, selfAssessment: { couldExplain: 0, needsHelp: 0, notRecorded: 1 } };
  const row = { sectionId: 'ci-fixture', topicId: 'T1.01', title: 'Apartado de prueba', materialPath: 'fixture.pdf', sourceHash: 'a', manifestRevision: 'fixture-v3', linkedQuestions: 4, observedDistinct: 1,
    practice: counts, simulation: { ...counts, observedQuestions: 0, latestWrong: 0, answeredAttempts: 0, immediateRetryAttempts: 0 } };
  const query = { fromInclusive: 1, toExclusive: 1000, timeZone: 'Europe/Madrid', topicId: 'T1.01', mode: 'practice' };
  const stats = { getApprovedSectionLinkCount: () => 4, loadAcademySectionPerformance: vi.fn().mockResolvedValue({ status: 'ready', rows: [row], staleLinks: 1 }), practiceSectionErrors: vi.fn().mockResolvedValue('active-session') };
  render(React.createElement(AcademySectionPerformancePanel, { stats, query }));
  fireEvent.click(screen.getByRole('button', { name: 'Cargar evidencia por apartado' }));
  expect(await screen.findByText(/Poca evidencia/)).toBeTruthy();
  expect(stats.loadAcademySectionPerformance).toHaveBeenCalledWith(query);
  fireEvent.click(screen.getByRole('button', { name: 'Repasar errores de este apartado' }));
  expect(await screen.findByText(/Hay una sesión activa/)).toBeTruthy();
  expect(stats.practiceSectionErrors).toHaveBeenCalledWith('ci-fixture', query);
  expect(screen.queryByText(/0 % de dominio/)).toBeNull();
});
