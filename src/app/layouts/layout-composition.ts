import { useSyncExternalStore } from 'react';
import { isFull, isOwner } from '../composition/access-composition.js';
import { syncGateway } from '../../adapters/firebase/sync-status-store.js';
import { subscribeAccessChanges } from '../access-events.js';
import { isGuestNavigationRoute } from '../router/route-access.js';

const subscribe = (notify: () => void) => {
  const stopSync = syncGateway.subscribe(notify);
  const stopAccess = subscribeAccessChanges(notify);
  return () => { stopSync(); stopAccess(); };
};

export { isGuestNavigationRoute };

/** Composes account, access and study-session state for the application shell. */
export function useLayoutAccess() {
  const full = useSyncExternalStore(subscribe, isFull);
  const owner = useSyncExternalStore(subscribe, isOwner);
  // Access subscriptions already rerender the shell. Navigating to the old path here
  // would cancel the account-change redirect (for example, logout → Home).

  return { full, owner };
}
