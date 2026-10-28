import { bootAppServices, configureAppNavigation, studyServices } from './legacy-router.js';
import { AppServicesProvider } from './services.js';
import { configureRuntime } from './router/route-runtime.js';
import { Routes } from './router/Routes.js';
import { DialogProvider } from '../shared/ui/dialogs.js';
import { InitialAppLoadingProvider } from '../shared/ui/InitialAppLoading.js';

configureRuntime({ bootAppServices, configureAppNavigation, markReady: studyServices.markReady });

export function App() {
  return <DialogProvider><AppServicesProvider value={studyServices}><InitialAppLoadingProvider><Routes /></InitialAppLoadingProvider></AppServicesProvider></DialogProvider>;
}
