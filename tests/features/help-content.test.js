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
});
