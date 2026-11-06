import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { VISUAL_THEMES, normalizeVisualTheme } from '../src/shared/presentation/visual-themes.js';
import { normalizeUiPreferences } from '../src/shared/presentation/ui-preferences.js';
import { cleanCfg } from '../src/adapters/local/config.js';
import { normalizeTrainingPreferences, buildDailyTrainingPlan } from '../src/core/domain/study-training-plan.js';

const bootstrap = readFileSync('public/startup-theme.js', 'utf8');
function startup() { (0, eval)(bootstrap); }
beforeEach(() => { localStorage.clear(); vi.stubGlobal('matchMedia', () => ({ matches: false })); });

describe('identidades visuales y compatibilidad', () => {
  it.each([undefined, null, '', 'unknown', 1, {}, []])('elige neobrutalismo para una elección ausente o inválida: %s', value => {
    expect(normalizeVisualTheme(value)).toBe('soft-brutalism');
  });
  it('conserva el significado de Precisión y separa los antiguos modos de color', () => {
    expect(normalizeUiPreferences({ visualTheme:'precision', theme:'dark' })).toMatchObject({ visualTheme:'classic', theme:'dark' });
    expect(normalizeUiPreferences({ theme:'dark' })).toMatchObject({ visualTheme:'soft-brutalism', theme:'dark' });
  });
  it.each(VISUAL_THEMES)('persiste $id en el esquema existente y lo aplica antes de React por cuenta', ({ id }) => {
    const saved = cleanCfg({ ui: { visualTheme:id, theme:'dark', size:2, lectura:1 } });
    localStorage.setItem('tai.account', 'student-a');
    localStorage.setItem('tai.v1:student-a', JSON.stringify({ cfg:saved }));
    startup();
    expect(document.documentElement.dataset.visualTheme).toBe(id);
    expect(document.documentElement.dataset.colorScheme).toBe('dark');
    expect(normalizeUiPreferences(saved.ui)).toEqual({ visualTheme:id, theme:'dark', size:2, lectura:1 });
    localStorage.setItem('tai.account', 'student-b');
    startup();
    expect(document.documentElement.dataset.visualTheme).toBe('soft-brutalism');
    localStorage.setItem('tai.account', 'student-a');
    startup();
    expect(document.documentElement.dataset.visualTheme).toBe(id);
    expect(JSON.parse(localStorage.getItem('tai.v1:student-a')).cfg).toEqual(saved);
  });
  it('se recupera de snapshots ilegibles sin sobrescribir los datos', () => {
    localStorage.setItem('tai.v1:guest', '{invalid');
    startup();
    expect(document.documentElement.dataset.visualTheme).toBe('soft-brutalism');
    expect(localStorage.getItem('tai.v1:guest')).toBe('{invalid');
  });
});

it('ninguna preferencia antigua genera nuevas actividades de recuerdo libre', () => {
  const input = { activities:['activeRecall'], activityVersion:3 };
  const preferences = normalizeTrainingPreferences(input);
  expect(preferences.activities).not.toContain('activeRecall');
  const plan = buildDailyTrainingPlan({ preferences, weekday:1, dueCount:10, failureCount:4, weakTopicCount:1, studiedTopicIds:['T1.01'] });
  expect(plan.activities.length).toBeGreaterThan(0);
  expect(plan.activities.every(item => item.activity !== 'activeRecall' && !item.sectionRecall)).toBe(true);
  expect(input.activities).toEqual(['activeRecall']);
});
