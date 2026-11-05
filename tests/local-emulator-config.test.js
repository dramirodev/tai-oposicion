import { describe, expect, it } from 'vitest';
import { localFirebaseEmulators, configureFirebaseEmulatorRuntime, isFirebaseEmulatorRuntime } from '../src/adapters/firebase/local-emulator-config.ts';

const config = { taiEmulators: { authHost:'127.0.0.1', authPort:9099, firestoreHost:'localhost', firestorePort:8080 } };

describe('configuración de emuladores de Firebase local', () => {
  it('activa ambos emuladores solo con endpoints de loopback explícitos', () => {
    expect(localFirebaseEmulators(config, 'localhost')).toEqual(config.taiEmulators);
    expect(localFirebaseEmulators(config, '127.0.0.1')).toEqual(config.taiEmulators);
  });

  it('nunca redirige Firebase desde un dominio remoto ni acepta destinos remotos', () => {
    expect(localFirebaseEmulators(config, 'tai-oposicion.firebaseapp.com')).toBeNull();
    expect(localFirebaseEmulators({ taiEmulators:{ ...config.taiEmulators, authHost:'attacker.example' } }, 'localhost')).toBeNull();
    expect(localFirebaseEmulators({ taiEmulators:{ ...config.taiEmulators, firestoreHost:'attacker.example' } }, 'localhost')).toBeNull();
  });

  it('rechaza puertos fuera del rango TCP', () => {
    expect(localFirebaseEmulators({ taiEmulators:{ ...config.taiEmulators, authPort:0 } }, 'localhost')).toBeNull();
    expect(localFirebaseEmulators({ taiEmulators:{ ...config.taiEmulators, firestorePort:65_536 } }, 'localhost')).toBeNull();
  });
});

it('rechaza una configuración de emuladores incompleta, remota o de producción antes de inicializar Firebase', () => {
  for (const value of [{ projectId:'demo-tai-auth' }, { ...config, projectId:'production' }, { projectId:'demo-tai-auth', taiEmulators:{} }]) {
    expect(() => configureFirebaseEmulatorRuntime(value, 'localhost')).toThrow();
  }
  expect(() => configureFirebaseEmulatorRuntime({ ...config, projectId:'demo-tai-auth' }, 'remote.example')).toThrow();
  configureFirebaseEmulatorRuntime({ ...config, projectId:'demo-tai-auth' }, 'localhost');
  expect(isFirebaseEmulatorRuntime()).toBe(true);
  configureFirebaseEmulatorRuntime({}, 'localhost');
  expect(isFirebaseEmulatorRuntime()).toBe(false);
});
