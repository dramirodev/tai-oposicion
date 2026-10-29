import type { AccessLevel } from './entities.js';

export function canUseFullApp(input: {
  localRuntime: boolean;
  developerMode: string | null;
  access: AccessLevel;
  authenticated: boolean;
}): boolean {
  if (input.localRuntime) return input.developerMode !== '0';
  return input.authenticated && (input.access === 'propietario' || input.access === 'aprobado');
}

export function canManageAccess(input: { localRuntime: boolean; access: AccessLevel; authenticated: boolean }): boolean {
  return input.access === 'propietario' && (input.localRuntime || input.authenticated);
}
