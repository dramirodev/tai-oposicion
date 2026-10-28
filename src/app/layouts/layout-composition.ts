import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { NavigateFunction } from 'react-router';
import { configureAccessAccountReader, configureAccessStatusReader, isFull, isOwner, GUEST_ROUTES } from '../../adapters/legacy/access.js';
import { syncGateway } from '../../adapters/firebase/legacy-sync-state.js';
import { accountId } from '../../adapters/local/legacy-store.js';
import { hasActiveRun } from '../composition/study/study-engine-composition.js';
import { subscribeAccessChanges } from '../access-events.js';

configureAccessAccountReader(accountId);
configureAccessStatusReader(() => syncGateway.getSnapshot().access);

const subscribe = (notify: () => void) => {
  const stopSync = syncGateway.subscribe(notify);
  const stopAccess = subscribeAccessChanges(notify);
  return () => { stopSync(); stopAccess(); };
};

export const isGuestNavigationRoute = (route: string): boolean => GUEST_ROUTES.has(route);

/** Composes account, access and study-session state for the application shell. */
export function useLayoutAccess(pathname: string, navigate: NavigateFunction) {
  const full = useSyncExternalStore(subscribe, isFull);
  const owner = useSyncExternalStore(subscribe, isOwner);
  const previousFull = useRef(full);

  useEffect(() => {
    if (previousFull.current === full) return;
    previousFull.current = full;
    if (!hasActiveRun()) void navigate(pathname);
  }, [full, navigate, pathname]);

  return { full, owner };
}
