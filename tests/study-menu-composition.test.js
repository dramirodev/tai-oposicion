import { expect, it, vi } from 'vitest';
import { createStudyMenuGroups } from '../src/app/composition/navigation/study-menu-composition.js';
import { menuActionIcons } from '../src/app/navigation-icons.js';

function input(overrides = {}) {
  return {
    fullAccess: true, owner: true, pendingQuestions: 2, readingSpeedFailures: 4,
    openReports: 5, seenTopics: 6, failedQuestions: 7, accessRequests: 8, updateAvailable: false,
    actions: { quickSession: vi.fn(), startReview: vi.fn() },
    ...overrides,
  };
}

it('builds the full menu with navigation icons, study summaries and owner access', () => {
  const groups = createStudyMenuGroups(input());

  expect(groups.map(([title]) => title)).toEqual(['Estudiar', 'Entrenar un hábito', 'Seguimiento', 'La app']);
  expect(groups[0][1][0][0]).toBe(menuActionIcons.quick);
  expect(groups[0][1].map(([, title]) => title)).not.toContain('Tarjetas de repaso');
  expect(groups[0][1].map(([, title]) => title)).toContain('Test por tema');
  expect(groups[2][1][1][2]).toBe('Mapa de dominio, simulacros y evolución');
  expect(groups[3][1].find(([, title]) => title === 'Accesos')?.[2]).toBe('8 solicitudes por revisar');
});

it('keeps only quick study and app navigation for guests', () => {
  const groups = createStudyMenuGroups(input({ fullAccess: false, owner: false }));

  expect(groups.map(([title]) => title)).toEqual(['Estudiar', 'La app']);
  expect(groups[0][1]).toHaveLength(1);
  expect(groups[0][1][0][1]).toBe('Sesión rápida');
  expect(groups[1][1].map(([, title]) => title)).toEqual(['Inicio', 'Ajustes', 'Ayuda']);
});

it('uses singular copy and shows update state when applicable', () => {
  const groups = createStudyMenuGroups(input({ pendingQuestions: 1, updateAvailable: true, owner: false }));

  expect(groups[0][1][1][2]).toBe('1 pregunta toca repasar hoy');
  expect(groups[3][1].find(([, title]) => title === 'Ajustes')?.[2]).toBe('Hay una versión nueva');
});
