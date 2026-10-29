export interface AppBootstrapDependencies {
  onAccountChange(listener: () => void): () => void;
  goHome(): void;
  recover(): Promise<unknown>;
  setAttemptTrackingVisible(visible: boolean): void;
  flushStore(): void;
  flushAttemptTracking(): Promise<unknown> | void;
  saveRun(): void;
  pauseTrainingSession?(): void;
  routeReady: Promise<void>;
  resumeSaved(): Promise<unknown> | void;
  prefetchBank(): Promise<unknown> | void;
  loadMetadataAndInitializeSync(): Promise<unknown>;
}

/** Coordinates browser lifecycle work while keeping app-specific operations at the composition boundary. */
export function bootAppServices(dependencies: AppBootstrapDependencies): () => void {
  const controller = new AbortController();
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopped = false;
  const listen = (target: EventTarget, event: string, listener: () => void) =>
    target.addEventListener(event, listener, { signal: controller.signal });
  const stopWatchingAccount = dependencies.onAccountChange(dependencies.goHome);

  void (async () => {
    try { navigator.storage?.persist?.(); } catch {}
    await dependencies.recover();
    if (stopped) return;

    listen(document, 'visibilitychange', () => {
      const visible = document.visibilityState === 'visible';
      dependencies.setAttemptTrackingVisible(visible);
      if (!visible) {
        dependencies.pauseTrainingSession?.();
        dependencies.flushStore();
        void dependencies.flushAttemptTracking();
      }
    });
    listen(window, 'pagehide', () => {
      dependencies.setAttemptTrackingVisible(false);
      dependencies.pauseTrainingSession?.();
      dependencies.flushStore();
      void dependencies.flushAttemptTracking();
    });

    if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('../sw.js').catch(() => {});
    }

    await dependencies.routeReady;
    if (stopped) return;
    listen(window, 'pagehide', dependencies.saveRun);
    listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') dependencies.saveRun();
    });
    void dependencies.resumeSaved();
    timers.push(setTimeout(() => { void dependencies.prefetchBank(); }, 4000));

    if (!stopped) {
      try { await dependencies.loadMetadataAndInitializeSync(); } catch (error) { console.error(error); }
    }
  })();

  return () => {
    stopped = true;
    controller.abort();
    timers.forEach(clearTimeout);
    stopWatchingAccount();
  };
}
