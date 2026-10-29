import { describe, expect, it } from 'vitest';
import { localFirebaseEmulators } from '../src/adapters/firebase/local-emulator-config.ts';

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
