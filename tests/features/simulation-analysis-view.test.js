import { expect, it } from 'vitest';
import { analyzeSimulation } from '../../src/core/domain/simulation-analysis.js';
import { renderSimulationAnalysisView } from '../../src/features/simulation/simulation-analysis-view.js';

it('muestra las métricas y recomendaciones existentes en el informe del simulacro', () => {
  const analysis = analyzeSimulation({
    correct: [0, 1, 2, 3], answers: [0, 2, -1, 3], times: [10, 5, 0, 200],
    limitSeconds: 400, elapsedSeconds: 300,
  });
  const html = renderSimulationAnalysisView(analysis, 300, 400);

  expect(html).toContain('Nota sin penalización</span><span>50</span>');
  expect(html).toContain('Puntos que te restaron los fallos');
  expect(html).toContain('Tiempo usado</span><span>5:00 de 6:40 (75 %)');
  expect(html).toContain('Te atascaste en la 4 (200 s)');
  expect(html).toContain('Cada fallo resta 1/3');
});
