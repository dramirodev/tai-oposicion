import { canManageAccess, canUseFullApp } from '../../core/domain/access-policy.js';
import { localStudyProgressGateway } from '../../adapters/local/progress-repository.js';
import { isDevelopmentUiRevealed, developmentMode, readRememberedAccess, rememberAccessForAccount, revealDevelopmentUi, setDevelopmentMode } from '../../adapters/local/access-preferences.js';
import { syncGateway } from '../../adapters/firebase/sync-status-store.js';

const localRuntime = import.meta.env.DEV || (typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));

export function createAccessCapabilities(dependencies: {
  accountId(): string | null;
  syncAccess(): ReturnType<typeof syncGateway.getSnapshot>['access'];
  rememberedAccess(accountId: string | null): ReturnType<typeof readRememberedAccess>;
  developerMode(): string | null;
  localRuntime: boolean;
}) {
  const accessLevel = () => dependencies.syncAccess()
    || dependencies.rememberedAccess(dependencies.accountId()) || 'invitado';
  return {
    accessLevel,
    isFull: () => canUseFullApp({ localRuntime: dependencies.localRuntime, developerMode: dependencies.developerMode(), access: accessLevel(), authenticated: dependencies.accountId() !== null }),
    isOwner: () => canManageAccess({ localRuntime: dependencies.localRuntime, access: accessLevel(), authenticated: dependencies.accountId() !== null }),
  };
}

const capabilities = createAccessCapabilities({
  accountId: localStudyProgressGateway.accountId,
  syncAccess: () => syncGateway.getSnapshot().access,
  rememberedAccess: readRememberedAccess,
  developerMode: developmentMode,
  localRuntime,
});
export const { accessLevel, isFull, isOwner } = capabilities;

export const devMode = developmentMode;
export const setDevMode = setDevelopmentMode;
export const devRevealed = isDevelopmentUiRevealed;
export const revealDev = revealDevelopmentUi;

syncGateway.subscribe(snapshot => {
  if (snapshot.access) rememberAccessForAccount(localStudyProgressGateway.accountId(), snapshot.access);
});
