import { afterEach, expect, it, vi } from 'vitest';
import { createAppUpdateController } from '../src/app/composition/updates/app-update-controller.js';

afterEach(() => vi.unstubAllGlobals());

it('detecta solo builds distintas y conserva el resultado si no puede consultar el servidor', async () => {
  const fetchVersion = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ version: '1.1.3', build: '1.1.3+current' }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ version: '1.1.3', build: '1.1.3+old' }), { status: 200 }))
    .mockResolvedValueOnce(new Response('', { status: 503 }));
  const updates = createAppUpdateController({ currentBuild: '1.1.3+current', saveRun: vi.fn(), flushProgress: vi.fn(), getRegistration: vi.fn(), reload: vi.fn(), fetchVersion, onUpdateReady: vi.fn() });

  expect(await updates.checkUpdate()).toBeNull();
  expect(await updates.checkUpdate()).toEqual({ version: '1.1.3', build: '1.1.3+old' });
  expect(await updates.checkUpdate()).toBeUndefined();
  expect(updates.getAvailableUpdate()).toEqual({ version: '1.1.3', build: '1.1.3+old' });
  expect(fetchVersion).toHaveBeenCalledWith('version.json', { cache: 'no-store' });
});

it('guarda sesión y progreso antes de activar el worker y recargar', async () => {
  const calls = [];
  const worker = new EventTarget();
  const observeWorker = vi.spyOn(worker, 'addEventListener');
  Object.defineProperty(worker, 'state', { configurable: true, value: 'installed', writable: true });
  worker.postMessage = vi.fn(message => calls.push(`message:${message}`));
  const registration = { waiting: worker, installing: null, update: vi.fn(async () => calls.push('update')), addEventListener: vi.fn() };
  const updates = createAppUpdateController({
    currentBuild: 'current', saveRun: () => calls.push('save-run'),
    flushProgress: async () => calls.push('flush-progress'),
    getRegistration: async () => registration, reload: () => calls.push('reload'), onUpdateReady: vi.fn(),
  });

  const applying = updates.applyUpdate();
  await vi.waitFor(() => expect(observeWorker).toHaveBeenCalledWith('statechange', expect.any(Function)));
  worker.state = 'activated';
  worker.dispatchEvent(new Event('statechange'));
  await applying;

  expect(calls).toEqual(['save-run', 'flush-progress', 'update', 'message:skip', 'reload']);
});

it('avisa cuando un worker nuevo queda instalado y deja de escuchar al desmontarse', () => {
  vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });
  const worker = new EventTarget();
  Object.defineProperty(worker, 'state', { configurable: true, value: 'installing', writable: true });
  const registration = new EventTarget();
  Object.defineProperty(registration, 'installing', { configurable: true, value: worker });
  const onUpdateReady = vi.fn();
  const updates = createAppUpdateController({ currentBuild: 'current', saveRun: vi.fn(), flushProgress: vi.fn(), getRegistration: vi.fn(), reload: vi.fn(), onUpdateReady });
  const stop = updates.watchUpdates(registration);

  worker.state = 'installed';
  worker.dispatchEvent(new Event('statechange'));
  expect(onUpdateReady).toHaveBeenCalledOnce();
  stop();
  worker.dispatchEvent(new Event('statechange'));
  expect(onUpdateReady).toHaveBeenCalledOnce();
});
