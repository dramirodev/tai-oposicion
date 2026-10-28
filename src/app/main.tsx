import '../shared/styles/index.css';
import { runStartupUpdateGate } from './composition/updates/startup-update-gate.js';
import { APP_BUILD } from './build-info.js';

let stopApp: (() => void) | undefined;

void (async () => {
  await runStartupUpdateGate(APP_BUILD);
  const app = await import('./start-app.js');
  stopApp = app.unmountApp;
})();

export function unmountApp(): void {
  stopApp?.();
}
