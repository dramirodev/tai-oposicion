import { expect, it } from 'vitest';
import { auditQuestionBank } from '../scripts/audit-bank.mjs';

it('resume estructura, procedencia y riesgos sin afirmar revisión semántica automática', () => {
  const generated = {
    id: 'G-1', tema: 'T2.01', tipo: 'D', dificultad: 2, familia: 'family-1',
    enunciado: '¿Qué memoria es volátil?', opciones: { a: 'SRAM', b: 'ROM', c: 'EEPROM', d: 'EPROM' }, correcta: 'a',
    revision: { estado: 'verificada_parcial' },
    cita_temario: [{ fuente: 'T2.01.pdf', pagina: 45, texto: 'La memoria volátil necesita corriente.' }],
  };
  const academy = {
    id: 'A-1', tema: 'T2.01', tipo: 'D', dificultad: 2, enunciado: generated.enunciado,
    opciones: { a: 'SRAM', b: 'SRAM', c: 'EEPROM', d: 'EPROM' }, correcta: 'b',
  };

  const report = auditQuestionBank([
    { source: 'generated', file: 'banco_generado_T2.01.json', metadata: { total: 3, familias: 1 }, questions: [generated] },
    { source: 'academy', questions: [academy] },
  ]);

  expect(report.counts.total).toBe(2);
  expect(report.counts.byReviewState.verificada_parcial).toBe(1);
  expect(report.generatedFamilyCount).toBe(1);
  expect(report.repeatedStatementGroups).toBe(1);
  expect(report.issues.map(issue => issue.kind)).toContain('duplicate-options-review');
  expect(report.issues.map(issue => issue.kind)).toContain('family-size-review');
  expect(report.issues).toContainEqual(expect.objectContaining({
    kind: 'generated-metadata-total-mismatch', file: 'banco_generado_T2.01.json', declaredTotal: 3, actualTotal: 1,
  }));
  expect(report.generatedSourceMetadata[0]).toMatchObject({ declaredFamilies: 1, actualFamilies: 1 });
  expect(report.semanticReview).toContain('PDF fuente del temario');
});

it('detecta caracteres de codificación dañada en preguntas y opciones', () => {
  const report = auditQuestionBank([{
    source: 'academy',
    questions: [{
      id: 'OCR-1', tema: 'T2.01', enunciado: '¿Qué indica �?',
      opciones: { a: 'Respuesta A', b: 'Respuesta B', c: 'Respuesta C', d: 'Respuesta D' }, correcta: 'a',
    }, {
      id: 'OCR-2', tema: 'T2.01', enunciado: 'Pregunta válida',
      opciones: { a: 'Texto Ã© roto', b: 'Respuesta B', c: 'Respuesta C', d: 'Respuesta D' }, correcta: 'a',
    }],
  }]);

  expect(report.issues).toContainEqual(expect.objectContaining({ kind: 'suspicious-text-encoding', id: 'OCR-1', field: 'enunciado' }));
  expect(report.issues).toContainEqual(expect.objectContaining({ kind: 'suspicious-text-encoding', id: 'OCR-2', field: 'opciones.a' }));
});

it('no agrupa comandos cuyos flags distinguen mayúsculas y minúsculas', () => {
  const question = (id, enunciado) => ({
    id, tema: 'T3.10', tipo: 'D', dificultad: 1, familia: id,
    enunciado, opciones: { a: 'A', b: 'B', c: 'C', d: 'D' }, correcta: 'a',
    revision: { estado: 'verificada' },
    cita_temario: [{ fuente: 'T3.10.pdf', pagina: 1, texto: 'git branch -d elimina ramas fusionadas; -D fuerza el borrado.' }],
  });
  const report = auditQuestionBank([{ source: 'generated', metadata: { total: 2, familias: 2 }, questions: [
    question('G-LOWER', 'git branch -d <rama> elimina la rama:'),
    question('G-UPPER', 'git branch -D <rama> elimina la rama:'),
  ] }]);

  expect(report.repeatedStatementGroups).toBe(0);
});

it('acepta citas con URL externa verificable aunque no tengan número de página', () => {
  const report = auditQuestionBank([{ source: 'generated', metadata: { total: 1, familias: 1 }, questions: [{
    id: 'G-URL', tema: 'T3.08', tipo: 'D', dificultad: 1, familia: 'G-URL', enunciado: 'Pregunta externa',
    opciones: { a: 'A', b: 'B', c: 'C', d: 'D' }, correcta: 'a', revision: { estado: 'verificada' },
    cita_temario: [{ fuente: 'Documentación oficial', texto: 'Descripción consultada. https://example.org/docs' }],
  }] }]);

  expect(report.issues.map(issue => issue.kind)).not.toContain('untraceable-citation');
});
