import { bootAppServices, configureAppNavigation, studyServices } from './legacy-router.js';
import { AppServicesProvider } from './services.js';
import { configureRuntime } from './route-runtime.js';
import { Routes } from './Routes.js';
import { DialogProvider } from '../shared/ui/dialogs.js';

configureRuntime({ bootAppServices, configureAppNavigation, markReady: studyServices.markReady });

export function App() {
  return <DialogProvider><AppServicesProvider value={studyServices}><Routes /></AppServicesProvider></DialogProvider>;
}
