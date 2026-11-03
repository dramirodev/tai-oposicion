import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createAiStudyExportZip } from '../../src/shared/presentation/ai-study-export-zip.ts';

describe('createAiStudyExportZip', () => {
  it('incluye el manifiesto, el informe y todas las partes JSON con su contenido UTF-8', async () => {
    const archive = await createAiStudyExportZip({
      manifestText: '{"format":"tai-study-ai-export"}',
      markdown: '# Análisis de estudio\n',
      partFiles: [
        { fileName: 'tai-estudio-parte-001.json', content: '{"respuesta":"sí"}' },
        { fileName: 'tai-estudio-parte-002.json', content: '{"respuesta":"no"}' },
      ],
    });
    const files = unzipSync(archive);

    expect(Object.keys(files).sort()).toEqual([
      'tai-estudio-informe.md',
      'tai-estudio-manifiesto.json',
      'tai-estudio-parte-001.json',
      'tai-estudio-parte-002.json',
    ]);
    expect(strFromU8(files['tai-estudio-manifiesto.json'])).toBe('{"format":"tai-study-ai-export"}');
    expect(strFromU8(files['tai-estudio-informe.md'])).toBe('# Análisis de estudio\n');
    expect(strFromU8(files['tai-estudio-parte-001.json'])).toBe('{"respuesta":"sí"}');
    expect(strFromU8(files['tai-estudio-parte-002.json'])).toBe('{"respuesta":"no"}');
  });
});
