import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accessLevel, canManageAccess, canUseFullApp, configureAccessAccountReader, configureAccessStatusReader, isFull, isOwner } from '../../src/adapters/legacy/access.js';

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

  it('allows the full interface locally without creating an authenticated account', () => {
    expect(accessLevel()).toBe('invitado');
    expect(isFull()).toBe(true);
    expect(isOwner()).toBe(false);
    expect(canUseFullApp({ localRuntime: true, developerMode: null, access: 'invitado', authenticated: false })).toBe(true);
    expect(canUseFullApp({ localRuntime: true, developerMode: '0', access: 'invitado', authenticated: false })).toBe(false);
  });

  it('requires an authenticated, approved account for full access in production', () => {
    expect(canUseFullApp({ localRuntime: false, developerMode: '1', access: 'propietario', authenticated: false })).toBe(false);
    expect(canUseFullApp({ localRuntime: false, developerMode: '1', access: 'aprobado', authenticated: true })).toBe(true);
    expect(canUseFullApp({ localRuntime: false, developerMode: null, access: 'invitado', authenticated: true })).toBe(false);
  });

  it('does not grant owner controls from a cached role without a production session', () => {
    expect(canManageAccess({ localRuntime: false, access: 'propietario', authenticated: false })).toBe(false);
    expect(canManageAccess({ localRuntime: false, access: 'propietario', authenticated: true })).toBe(true);
  });
});
