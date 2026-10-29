import type { FirebaseOptions } from 'firebase/app';

export interface FirebaseEmulatorEndpoints {
  authHost: string;
  authPort: number;
  firestoreHost: string;
  firestorePort: number;
}

export type AppFirebaseOptions = FirebaseOptions & { taiEmulators?: Partial<FirebaseEmulatorEndpoints> };

export interface FirebaseConfigLoadResult {
  config: AppFirebaseOptions;
  loaded: boolean;
}

/** Loads the existing public Firebase configuration, retrying with the browser cache. */
export async function loadFirebaseConfig(fetcher: typeof fetch = (...args) => fetch(...args)): Promise<FirebaseConfigLoadResult> {
  let config: FirebaseOptions = {};
  let loaded = false;

  const read = async (options?: RequestInit): Promise<FirebaseOptions> => {
    const response = await fetcher('firebase-config.json', options);
    if (!response.ok) throw new Error(`No se pudo cargar la configuración (${response.status}).`);
    return await response.json() as AppFirebaseOptions;
  };

  try {
    config = await read({ cache: 'no-cache' });
    loaded = true;
  } catch {
    try {
      config = await read();
      loaded = true;
    } catch {
      // Mantener el estado offline existente: no configuración leída no significa sin configurar.
    }
  }

  return { config, loaded };
}
