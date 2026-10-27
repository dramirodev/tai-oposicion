export interface AppUpdate {
  version: string;
  build: string;
}

export interface AppUpdateDependencies {
  currentBuild: string;
  saveRun(): void;
  flushProgress(): Promise<unknown>;
  getRegistration(): Promise<ServiceWorkerRegistration | undefined>;
  reload(): void;
  fetchVersion?: (url: string, options: RequestInit) => Promise<Response>;
  onUpdateReady(): void;
}

/** Coordinates version checks and service-worker updates at the application boundary. */
export function createAppUpdateController(dependencies: AppUpdateDependencies) {
  let availableUpdate: AppUpdate | null = null;

  async function checkUpdate(): Promise<AppUpdate | null | undefined> {
    try {
      const request = dependencies.fetchVersion || fetch;
      const response = await request('version.json', { cache: 'no-store' });
      if (!response.ok) return undefined;
      const value: unknown = await response.json();
      const manifest = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      availableUpdate = typeof manifest.version === 'string'
        && typeof manifest.build === 'string'
        && manifest.build
        && manifest.build !== dependencies.currentBuild
        ? { version: manifest.version, build: manifest.build }
        : null;
      return availableUpdate;
    } catch {
      return undefined;
    }
  }

  async function applyUpdate(): Promise<void> {
    dependencies.saveRun();
    try { await dependencies.flushProgress(); } catch { /* Reload still proceeds if persistence is unavailable. */ }
    try {
      const registration = await dependencies.getRegistration();
      if (registration) {
        await registration.update();
        registration.waiting?.postMessage('skip');
        const worker = registration.installing || registration.waiting;
        if (worker && worker.state !== 'activated') {
          await new Promise<void>(resolve => {
            const finish = () => { clearTimeout(timeout); worker.removeEventListener('statechange', onStateChange); resolve(); };
            const onStateChange = () => { if (worker.state === 'activated' || worker.state === 'redundant') finish(); };
            const timeout = setTimeout(finish, 6000);
            worker.addEventListener('statechange', onStateChange);
          });
        }
      }
    } catch { /* The active worker can still serve the app; reload applies what is available. */ }
    dependencies.reload();
  }

  function watchUpdates(registration: ServiceWorkerRegistration): () => void {
    const controller = new AbortController();
    const watch = (worker: ServiceWorker) => worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker?.controller) dependencies.onUpdateReady();
    }, { signal: controller.signal });
    if (registration.installing) watch(registration.installing);
    registration.addEventListener('updatefound', () => {
      if (registration.installing) watch(registration.installing);
    }, { signal: controller.signal });
    return () => controller.abort();
  }

  return {
    checkUpdate,
    applyUpdate,
    watchUpdates,
    getAvailableUpdate: () => availableUpdate,
  };
}
