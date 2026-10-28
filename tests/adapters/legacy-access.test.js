import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accessLevel, configureAccessStatusReader, isFull, isOwner } from '../../src/adapters/legacy/access.js';

describe('legacy access adapter', () => {
  beforeEach(() => {
    localStorage.clear();
    configureAccessStatusReader(() => '');
  });

  afterEach(() => configureAccessStatusReader(() => ''));

  it('uses the active sync access before a remembered offline value', () => {
    localStorage.setItem('tai.acc:guest', 'invitado');
    configureAccessStatusReader(() => 'aprobado');

    expect(accessLevel()).toBe('aprobado');
    expect(isFull()).toBe(true);
    expect(isOwner()).toBe(false);
  });

  it('falls back to the remembered account access when sync has not resolved', () => {
    localStorage.setItem('tai.acc:guest', 'propietario');

    expect(accessLevel()).toBe('propietario');
    expect(isFull()).toBe(true);
    expect(isOwner()).toBe(true);
  });
});
