import type { AppFirebaseOptions, FirebaseEmulatorEndpoints } from './firebase-config-loader.js';

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
