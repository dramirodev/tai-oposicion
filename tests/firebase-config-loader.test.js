import { describe, expect, it, vi } from 'vitest';
import { loadFirebaseConfig } from '../src/adapters/firebase/firebase-config-loader.js';

const response = (body, ok = true, status = 200) => ({ ok, status, json: vi.fn().mockResolvedValue(body) });

describe('loadFirebaseConfig', () => {
  it('lee sin caché y devuelve la configuración cuando está disponible', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ apiKey: 'public-key' }));

    await expect(loadFirebaseConfig(fetcher)).resolves.toEqual({ config: { apiKey: 'public-key' }, loaded: true });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('firebase-config.json', { cache: 'no-cache' });
  });

  it('reintenta usando la caché del navegador si falla la lectura sin caché', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({}, false, 503))
      .mockResolvedValueOnce(response({ apiKey: 'cached-key' }));

    await expect(loadFirebaseConfig(fetcher)).resolves.toEqual({ config: { apiKey: 'cached-key' }, loaded: true });
    expect(fetcher).toHaveBeenNthCalledWith(1, 'firebase-config.json', { cache: 'no-cache' });
    expect(fetcher).toHaveBeenNthCalledWith(2, 'firebase-config.json', undefined);
  });

  it('indica que no se cargó si fallan ambas lecturas', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('offline'));

    await expect(loadFirebaseConfig(fetcher)).resolves.toEqual({ config: {}, loaded: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
