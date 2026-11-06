import type { AppFirebaseOptions, FirebaseEmulatorEndpoints } from './firebase-config-loader.js';

export const EMULATOR_OWNER_EMAIL = 'tai-supertest@example.test';

let emulatorRuntime = false;
export const isFirebaseEmulatorRuntime = (): boolean => emulatorRuntime;

export function configureFirebaseEmulatorRuntime(config: AppFirebaseOptions, hostname: string): FirebaseEmulatorEndpoints | null {

  emulatorRuntime = false;
  const endpoints = localFirebaseEmulators(config, hostname);
  if ((config.taiEmulators || config.projectId === 'demo-tai-auth') && (config.projectId !== 'demo-tai-auth' || !endpoints)) {
    throw new Error('Firebase Emulator requires demo-tai-auth and explicit loopback endpoints');
  }
  emulatorRuntime = !!endpoints;
  return endpoints;
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

/** Only explicit emulator endpoints on a local hostname may replace Firebase services. */
export function localFirebaseEmulators(config: AppFirebaseOptions, hostname: string): FirebaseEmulatorEndpoints | null {
  if (!loopbackHosts.has(hostname)) return null;
  const endpoints = config.taiEmulators;
  if (!endpoints || !loopbackHosts.has(endpoints.authHost ?? '') || !loopbackHosts.has(endpoints.firestoreHost ?? '')) return null;
  if (!Number.isInteger(endpoints.authPort) || endpoints.authPort! < 1 || endpoints.authPort! > 65_535
    || !Number.isInteger(endpoints.firestorePort) || endpoints.firestorePort! < 1 || endpoints.firestorePort! > 65_535) return null;
  return {
    authHost: endpoints.authHost!, authPort: endpoints.authPort!,
    firestoreHost: endpoints.firestoreHost!, firestorePort: endpoints.firestorePort!,
  };
}
