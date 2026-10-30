import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preserveUnusableProgressSnapshot } from '../../src/adapters/local/progress-snapshot-storage.js';

beforeEach(() => localStorage.clear());
afterEach(() => vi.resetModules());

describe('preserveUnusableProgressSnapshot', () => {
  it('guarda una copia del texto guardado antes de que lo sustituya un estado vacío', () => {
    localStorage.setItem('tai.v1:guest', '{"stats": {broken');

    expect(preserveUnusableProgressSnapshot('tai.v1:guest')).toBe(true);

    expect(localStorage.getItem('tai.v1:guest.unreadable')).toBe('{"stats": {broken');
  });

  it('conserva la primera copia: una lectura posterior no la machaca con otro texto', () => {
    localStorage.setItem('tai.v1:guest', 'primer texto dañado');
    preserveUnusableProgressSnapshot('tai.v1:guest');
    localStorage.setItem('tai.v1:guest', 'segundo texto dañado');

    expect(preserveUnusableProgressSnapshot('tai.v1:guest')).toBe(false);

    expect(localStorage.getItem('tai.v1:guest.unreadable')).toBe('primer texto dañado');
  });

  it('no crea nada cuando no había ningún snapshot guardado', () => {
    expect(preserveUnusableProgressSnapshot('tai.v1:guest')).toBe(false);
    expect(localStorage.getItem('tai.v1:guest.unreadable')).toBeNull();
  });

  it('no falla si el almacenamiento está lleno', () => {
    localStorage.setItem('tai.v1:guest', 'x');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });

    expect(preserveUnusableProgressSnapshot('tai.v1:guest')).toBe(false);

    setItem.mockRestore();
  });
});

describe('arranque con un snapshot de progreso ilegible', () => {
  it('conserva una copia del texto dañado en vez de perderlo al guardar el estado vacío', async () => {
    localStorage.setItem('tai.v1:guest', '{"stats": {broken');

    await import('../../src/adapters/local/legacy-store.js');

    expect(localStorage.getItem('tai.v1:guest.unreadable')).toBe('{"stats": {broken');
  });

  it('no deja copia cuando el snapshot es válido', async () => {
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats: {}, sessions: [], cfg: {}, seen: { t: [], ts: 0 } }));

    await import('../../src/adapters/local/legacy-store.js');

    expect(localStorage.getItem('tai.v1:guest.unreadable')).toBeNull();
  });
});
