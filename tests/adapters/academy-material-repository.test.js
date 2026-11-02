import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createAcademyMaterialRepository } from '../../src/adapters/local/academy-material-repository.js';

describe('repositorio local de materiales de academia', () => {
  it('aísla por cuenta, tema, ruta y revisión; conserva el Blob y permite borrarlo', async () => {
    const repository = createAcademyMaterialRepository(`academy-materials-test-${crypto.randomUUID()}`);
    const pdfBytes = new TextEncoder().encode('%PDF-fixture').buffer;
    const entry = {
      topicId: 'T1.01', materialPath: 'temario.pdf', sourceHash: 'a'.repeat(64),
      name: 'temario.pdf', mimeType: 'application/pdf', sizeBytes: pdfBytes.byteLength, importedAt: 42, pdfBytes,
    };
    await repository.save('uid:account-a', entry);

    expect(await repository.list('uid:account-a', 'T1.01')).toHaveLength(1);
    expect((await repository.get('uid:account-a', 'T1.01', 'temario.pdf', 'a'.repeat(64)))?.pdfBytes.byteLength).toBe(pdfBytes.byteLength);
    expect(await repository.get('uid:account-b', 'T1.01', 'temario.pdf', 'a'.repeat(64))).toBeUndefined();
    expect(await repository.get('uid:account-a', 'T1.01', 'temario.pdf', 'b'.repeat(64))).toBeUndefined();
    expect(await repository.list('uid:account-a', 'T1.01')).toHaveLength(1);
    await repository.remove('uid:account-a', 'T1.01', 'temario.pdf', 'a'.repeat(64));
    expect(await repository.list('uid:account-a', 'T1.01')).toHaveLength(0);
  });
});
