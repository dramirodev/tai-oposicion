import { expect, it } from 'vitest';
import { createSimulationAnalysisView } from '../src/app/composition/simulations/simulation-analysis-composition.js';

it('combines domain simulation analysis with the existing result presentation', () => {
  const html = createSimulationAnalysisView({
    correctIndices: [0, 0, 1, 1],
    answers: [0, 1, undefined, 0],
    answerSeconds: [30, 5, undefined, 120],
    timeLimitMinutes: 4,
    elapsedSeconds: 180,
  });

  expect(html).toContain('<h2>Ritmo y puntos</h2>');
  expect(html).toContain('Nota sin penalización</span><span>25</span>');
  expect(html).toContain('Tiempo usado</span><span>3:00 de 4:00 (75 %)');
  expect(html).toContain('Te atascaste en la 4 (120 s, fallada)');
  expect(html).toContain('Cada fallo resta 1/3');
});
