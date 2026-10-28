interface VersionManifest {
  version: string;
  build: string;
}

const UPDATE_TIMEOUT_MS = 15_000;
const VERSION_CHECK_TIMEOUT_MS = 3_000;

async function fetchAvailableVersion(currentBuild: string): Promise<VersionManifest | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch('version.json', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object') return null;
    const manifest = value as Record<string, unknown>;
    return typeof manifest.version === 'string'
      && typeof manifest.build === 'string'
      && manifest.build
      && manifest.build !== currentBuild
      ? { version: manifest.version, build: manifest.build }
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function waitForActivation(worker: ServiceWorker): Promise<void> {
  if (worker.state === 'activated') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', onStateChange);
      if (error) reject(error);
      else resolve();
    };
    const onStateChange = () => {
      if (worker.state === 'activated') finish();
      if (worker.state === 'redundant') finish(new Error('La actualización no se pudo instalar.'));
    };
    const timeout = setTimeout(() => finish(new Error('La actualización está tardando más de lo esperado.')), UPDATE_TIMEOUT_MS);
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  });
}

async function installAvailableUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    location.reload();
    return;
  }

  const serviceWorker = navigator.serviceWorker;
  const registration = await serviceWorker.getRegistration()
    ?? await serviceWorker.register(new URL('sw.js', document.baseURI).href);
  await registration.update();

  let worker = registration.waiting || registration.installing;
  if (worker) {
    if (registration.waiting) worker.postMessage('skip');
    await waitForActivation(worker);
  }

  // A worker may have activated while update() was resolving.
  worker = registration.waiting || registration.installing;
  if (worker) {
    if (registration.waiting) worker.postMessage('skip');
    await waitForActivation(worker);
  }

  location.reload();
}

/** Holds the app behind the initial loading screen until the user handles a known update. */
export async function runStartupUpdateGate(currentBuild: string): Promise<void> {
  const update = await fetchAvailableVersion(currentBuild);
  if (!update) return;

  const progress = document.getElementById('initial-loading-progress');
  const dialog = document.getElementById('initial-update-dialog');
  const version = document.getElementById('initial-update-version');
  const status = document.getElementById('initial-update-status');
  const updateButton = document.getElementById('initial-update-confirm');
  const continueButton = document.getElementById('initial-update-continue');
  if (!(dialog instanceof HTMLElement)
    || !(version instanceof HTMLElement)
    || !(status instanceof HTMLElement)
    || !(updateButton instanceof HTMLButtonElement)
    || !(continueButton instanceof HTMLButtonElement)) return;

  if (progress instanceof HTMLElement) progress.hidden = true;
  version.textContent = `Versión ${update.version}`;
  dialog.hidden = false;
  updateButton.focus();

  await new Promise<void>(resolve => {
    let updating = false;
    continueButton.addEventListener('click', () => resolve(), { once: true });
    updateButton.addEventListener('click', async () => {
      if (updating) return;
      updating = true;
      updateButton.disabled = true;
      continueButton.disabled = true;
      status.textContent = 'Preparando la actualización…';
      try {
        await installAvailableUpdate();
      } catch {
        status.textContent = 'No se pudo completar la actualización. Puedes reintentar o entrar con la versión actual.';
        updateButton.disabled = false;
        continueButton.disabled = false;
        updateButton.focus();
        updating = false;
      }
    });
  });

  dialog.hidden = true;
  if (progress instanceof HTMLElement) progress.hidden = false;
}
