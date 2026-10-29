import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canManageAccess, canUseFullApp } from '../../src/core/domain/access-policy.js';
import { createAccessCapabilities } from '../../src/app/composition/access-composition.js';
import { readRememberedAccess, rememberAccessForAccount } from '../../src/adapters/local/access-preferences.js';

describe('política y preferencias de acceso', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('prefiere el estado de sincronización y usa el nivel recordado si falta', () => {
    rememberAccessForAccount(null, 'invitado');
    const accountId = () => null;
    let currentSyncAccess = '';
    const access = createAccessCapabilities({
      accountId,
      syncAccess: () => currentSyncAccess,
      rememberedAccess: readRememberedAccess,
      developerMode: () => null,
      localRuntime: false,
    });
    expect(access.accessLevel()).toBe('invitado');
    rememberAccessForAccount(null, 'propietario');
    expect(access.accessLevel()).toBe('propietario');
    currentSyncAccess = 'aprobado';
    expect(access.accessLevel()).toBe('aprobado');
  });

  it('aísla el acceso recordado por cuenta', () => {
    rememberAccessForAccount(null, 'propietario');
    rememberAccessForAccount('account-2', 'aprobado');
    let account = 'account-2';
    const access = createAccessCapabilities({ accountId: () => account, syncAccess: () => '', rememberedAccess: readRememberedAccess, developerMode: () => null, localRuntime: false });
    expect(access.accessLevel()).toBe('aprobado');
    account = 'account-3';
    expect(access.accessLevel()).toBe('invitado');
  });

  it('permite la interfaz completa localmente sin crear una sesión autenticada', () => {
    const access = createAccessCapabilities({ accountId: () => null, syncAccess: () => '', rememberedAccess: () => undefined, developerMode: () => null, localRuntime: true });
    expect(access.isFull()).toBe(true);
    expect(access.isOwner()).toBe(false);
    expect(canUseFullApp({ localRuntime: true, developerMode: '0', access: 'invitado', authenticated: false })).toBe(false);
  });

  it('requiere autenticación y acceso aprobado en producción', () => {
    expect(canUseFullApp({ localRuntime: false, developerMode: '1', access: 'propietario', authenticated: false })).toBe(false);
    expect(canUseFullApp({ localRuntime: false, developerMode: '1', access: 'aprobado', authenticated: true })).toBe(true);
    expect(canUseFullApp({ localRuntime: false, developerMode: null, access: 'invitado', authenticated: true })).toBe(false);
    expect(canManageAccess({ localRuntime: false, access: 'propietario', authenticated: false })).toBe(false);
    expect(canManageAccess({ localRuntime: false, access: 'propietario', authenticated: true })).toBe(true);
  });
});
