import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accessLevel, configureAccessAccountReader, configureAccessStatusReader, isFull, isOwner } from '../../src/adapters/legacy/access.js';

describe('legacy access adapter', () => {
  beforeEach(() => {
    localStorage.clear();
    configureAccessAccountReader(() => null);
    configureAccessStatusReader(() => '');
  });

  afterEach(() => {
    configureAccessAccountReader(() => null);
    configureAccessStatusReader(() => '');
  });

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

  it('reads the offline access value for the account supplied by app composition', () => {
    localStorage.setItem('tai.acc:guest', 'propietario');
    localStorage.setItem('tai.acc:account-2', 'aprobado');
    let account = 'account-2';
    configureAccessAccountReader(() => account);

    expect(accessLevel()).toBe('aprobado');
    account = 'account-3';
    expect(accessLevel()).toBe('invitado');
  });
});
