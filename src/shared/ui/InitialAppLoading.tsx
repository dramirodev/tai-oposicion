import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

const InitialAppReadyContext = createContext<() => void>(() => {});

/** Keeps the mounted route tree hidden and unavailable until its initial data is ready. */
export function InitialAppLoadingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  useLayoutEffect(() => {
    document.body.classList.toggle('is-initial-loading', !ready);
    if (!ready) return;
    document.getElementById('initial-loading')?.remove();
    document.querySelector<HTMLElement>('#app h1')?.focus({ preventScroll: true });
  }, [ready]);

  return <InitialAppReadyContext.Provider value={markReady}>
    <div aria-hidden={ready ? undefined : true} inert={!ready}>
      {children}
    </div>
  </InitialAppReadyContext.Provider>;
}

/** Marks the first screen ready after its required session and data checks finish. */
export function useMarkInitialAppReady(ready: boolean): void {
  const markReady = useContext(InitialAppReadyContext);
  useLayoutEffect(() => {
    if (ready) markReady();
  }, [markReady, ready]);
}

export function useInitialAppReadySignal(): () => void {
  return useContext(InitialAppReadyContext);
}
