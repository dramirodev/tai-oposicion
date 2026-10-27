import { describe, expect, it } from 'vitest';
import { explanationMapper } from '../../src/adapters/http/mappers/explanation.js';

const validDto = {
  i: 'AT303-P1-08',
  rev: 'fnv1a-00000000',
  lang: 'Java',
  status: 'draft',
  snippet: 'for (int i = 0; i < 0; i++) { }',
  result: { kind: 'output', value: '(sin salida)' },
  steps: [{ title: 'Inicialización', detail: 'i empieza en 0.' }],
  distractors: [{ option: 0, detail: 'El cuerpo no se ejecuta 16 veces.' }],
  limitation: 'Fragmento Java; no se ejecuta código en la app.',
  editorialNote: 'Pendiente de revisión editorial humana.',
  sources: [{ title: 'JLS, for statement', url: 'https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html#jls-14.14', section: '14.14' }],
};

describe('explanationMapper', () => {
  it('maps versioned plain text and source provenance into the domain model', () => {
    expect(explanationMapper.toDomain(validDto)).toEqual({
      ok: true,
      value: {
        questionId: 'AT303-P1-08', contentRevision: 'fnv1a-00000000', language: 'Java', editorialStatus: 'draft',
        snippet: validDto.snippet, result: { kind: 'output', value: '(sin salida)' },
        steps: [{ title: 'Inicialización', explanation: 'i empieza en 0.' }],
        distractors: [{ optionIndex: 0, explanation: 'El cuerpo no se ejecuta 16 veces.' }],
        limitation: 'Fragmento Java; no se ejecuta código en la app.',
        editorialNote: 'Pendiente de revisión editorial humana.',
        sources: [{ title: 'JLS, for statement', url: validDto.sources[0].url, section: '14.14' }],
      },
    });
  });

  it('round trips the versioned DTO without changing its stored fields', () => {
    const mapped = explanationMapper.toDomain(validDto);
    expect(mapped.ok).toBe(true);
    expect(explanationMapper.toDto(mapped.value)).toEqual(validDto);
  });

  it('returns a diagnostic for invalid source URLs without throwing', () => {
    const dto = structuredClone(validDto);
    dto.sources[0].url = 'javascript:alert(1)';
    expect(explanationMapper.toDomain(dto)).toEqual({ ok: false, reason: 'invalid-source-url' });
  });

  it('preserves diagnostics for invalid editorial fields and content sections', () => {
    const invalidStatus = structuredClone(validDto);
    invalidStatus.status = 'published';
    expect(explanationMapper.toDomain(invalidStatus)).toEqual({ ok: false, reason: 'invalid-editorial-status' });

    const invalidResult = structuredClone(validDto);
    invalidResult.result.value = 3;
    expect(explanationMapper.toDomain(invalidResult)).toEqual({ ok: false, reason: 'invalid-result' });

    const invalidStep = structuredClone(validDto);
    invalidStep.steps[0].detail = '';
    expect(explanationMapper.toDomain(invalidStep)).toEqual({ ok: false, reason: 'invalid-step' });

    const invalidCollection = structuredClone(validDto);
    invalidCollection.steps = null;
    expect(explanationMapper.toDomain(invalidCollection)).toEqual({ ok: false, reason: 'invalid-collections' });
  });

  it('keeps untrusted code as data for the presentation mapper to escape', () => {
    const dto = structuredClone(validDto);
    dto.snippet = '<script>alert(1)</script>';
    expect(explanationMapper.toDomain(dto)).toMatchObject({ ok: true, value: { snippet: '<script>alert(1)</script>' } });
  });
});
