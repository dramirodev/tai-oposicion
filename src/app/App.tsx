import { createHashRouter, RouterProvider } from 'react-router';
import { bootLegacy, configureLegacyRouter, studyServices } from './legacy-router.js';
import { Layout } from './Layout.js';
import { LegacyRoute } from './LegacyRoute.js';
import { DialogProvider } from '../shared/ui/dialogs.js';
import { AppServicesProvider } from './services.js';
import { AccessPage } from '../features/access/AccessPage.js';
import { HelpPage } from '../features/help/HelpPage.js';
import { HomePage } from '../features/home/HomePage.js';
import { TopicsPage } from '../features/home/TopicsPage.js';
import { ReactScreen } from './ReactScreen.js';
const names = [ 'quiz', 'result', 'test', 'sim', 'sim2', 'examenes', 'cards', 'stats', 'settings', 'falladas', 'errores', 'lectura', 'relampago', 'trampas'];
let legacyRefreshSeq = 0;
let stopLegacy: (() => void) | undefined;
export const router = createHashRouter([{ element: <AppServicesProvider value={studyServices}><Layout /></AppServicesProvider>, children: [
  { index: true, element: <ReactScreen home><HomePage /></ReactScreen> },
  { path: 'home/*', element: <ReactScreen home><HomePage /></ReactScreen> },
  { path: 'acceso/*', element: <ReactScreen><AccessPage /></ReactScreen> },
  { path: 'ayuda/*', element: <ReactScreen><HelpPage /></ReactScreen> },
  { path: 'temario/*', element: <ReactScreen restricted><TopicsPage /></ReactScreen> },
  ...names.map(name => ({ path: `${name}/*`, element: <LegacyRoute /> })),
  { path: '*', element: <ReactScreen home><HomePage /></ReactScreen> },
] }]);
export function initializeApp(): void {
  if (stopLegacy) return;
  configureLegacyRouter((html, refresh) => {
    const target = html.startsWith('#') ? html.slice(1) : html;
    if (refresh) { void router.navigate(target, { state: { legacyRefresh: ++legacyRefreshSeq } }); return; }
    void router.navigate(target);
  });
  stopLegacy = bootLegacy();
}
export function shutdownApp(): void {
  stopLegacy?.();
  stopLegacy = undefined;
}
export function App() {
  return <DialogProvider><RouterProvider router={router} /></DialogProvider>;
}
