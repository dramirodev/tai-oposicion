import { describe, expect, it } from 'vitest';
import { FAILURE_REASONS } from '../../src/shared/presentation/study-labels.ts';
import { FAILURE_HELP, HELP_SECTIONS } from '../../src/features/help/content.ts';

describe('help content', () => {
  it('explica cada motivo histórico sin renombrar sus códigos', () => {
    const historicalReasons = [1, 2, 3, 4, 5, 7].map(code => FAILURE_REASONS[code]);
    expect(FAILURE_HELP.map(topic => topic.title)).toEqual(historicalReasons);
    expect(FAILURE_HELP.every(topic => topic.meaning && topic.example && topic.chooseInstead)).toBe(true);
  });

  it('cubre las guías principales de la aplicación', () => {
    expect(HELP_SECTIONS.map(section => section.id)).toEqual([
      'acceso', 'inicio', 'sesiones', 'puntuacion', 'simulacros', 'temario', 'repaso', 'tarjetas',
      'entrenamientos', 'errores', 'progreso', 'evolucion', 'explicaciones', 'material-visual',
      'estrategia', 'ajustes', 'offline', 'copias',
    ]);
    expect(HELP_SECTIONS.every(section => section.title && section.body.length > 0)).toBe(true);
  });

  it('explica el entrenamiento adaptativo sin dar por hecho que la app contiene el temario', () => {
    const introduction = HELP_SECTIONS.find(section => section.id === 'inicio');
    expect(introduction.body.join(' ')).toContain('la lectura de apuntes o la reconstrucción mental no se observa directamente');
    expect(introduction.body.join(' ')).toMatch(/los tests, repasos y preguntas se limitan a los temas que has marcado como vistos/i);
    expect(introduction.body.join(' ')).toContain('los umbrales y el reparto de minutos son reglas iniciales del producto');
    expect(introduction.body.join(' ')).toMatch(/no tiene cronómetro/i);
    expect(introduction.body.join(' ')).toMatch(/días de descanso no acumulan actividades/i);
    expect(introduction.body.join(' ')).toMatch(/al completarla, vuelve a Planificación para continuar/i);
    expect(introduction.body.join(' ')).toMatch(/se sincroniza con la cuenta cuando hay acceso aprobado y las reglas de Firebase publicadas/i);
  });
});
