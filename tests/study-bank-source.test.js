import { beforeEach, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({ doc: vi.fn((database, ...path) => path.join('/')), getDoc: vi.fn() }));
vi.mock('firebase/firestore', () => firebase);

const source = await import('../src/adapters/firebase/study-bank-source.js');

beforeEach(() => {
  vi.clearAllMocks();
  source.configureStudyBankSource({}, () => true);
});

it('no consulta Firestore si falta el acceso a la cuenta', async () => {
  source.configureStudyBankSource({}, () => false);
  expect(await source.bankMeta()).toBeNull();
  expect(await source.bankFile('T1.01')).toBeNull();
  expect(firebase.getDoc).not.toHaveBeenCalled();
});

it('lee los hashes y los bytes del banco a través de la conexión configurada', async () => {
  firebase.getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ v: 1, files: { 'T1.01': 'hash' } }) })
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ z: { toUint8Array: () => new Uint8Array([1, 2, 3]) } }) });

  expect(await source.bankMeta()).toEqual({ v: 1, files: { 'T1.01': 'hash' } });
  expect(await source.bankFile('T1.01')).toEqual(new Uint8Array([1, 2, 3]));
  expect(firebase.doc).toHaveBeenNthCalledWith(1, {}, 'bank', 'meta');
  expect(firebase.doc).toHaveBeenNthCalledWith(2, {}, 'bank', 'f_T1.01');
});
