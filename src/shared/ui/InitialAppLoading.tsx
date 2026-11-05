import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const InitialAppReadyContext = createContext<() => void>(() => {});

/** Keeps the mounted route tree hidden and unavailable until its initial data is ready. */
export function InitialAppLoadingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const readyFrame = useRef<number | null>(null);
  const nextReadyFrame = useRef<number | null>(null);
  const markReady = useCallback(() => {
    if (readyFrame.current !== null || nextReadyFrame.current !== null || ready) return;
    // Keep the initial loading gate through a browser style/layout pass. WebKit
    // can retain stale ancestor styles when a subtree with native selects is
    // inserted in the same task as a visibility/theme change (WebKit 326092).
    readyFrame.current = requestAnimationFrame(() => {
      readyFrame.current = null;
      nextReadyFrame.current = requestAnimationFrame(() => {
        nextReadyFrame.current = null;
        setReady(true);
      });
    });
  }, [ready]);

  useEffect(() => () => {
    if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current);
    if (nextReadyFrame.current !== null) cancelAnimationFrame(nextReadyFrame.current);
    readyFrame.current = nextReadyFrame.current = null;
  }, []);

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
