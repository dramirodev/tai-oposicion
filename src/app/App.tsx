import { createHashRouter, RouterProvider } from 'react-router';
import { bootLegacy, configureLegacyRouter } from './legacy-router.js';
import { Layout } from './Layout.js';
import { LegacyRoute } from './LegacyRoute.js';
import { DialogProvider } from '../shared/ui/dialogs.js';
const names = ['home', 'quiz', 'result', 'test', 'sim', 'sim2', 'examenes', 'cards', 'stats', 'settings', 'temario', 'falladas', 'errores', 'lectura', 'relampago', 'trampas', 'acceso'];
let legacyRefreshSeq = 0;
let stopLegacy: (() => void) | undefined;
export const router = createHashRouter([{ element: <Layout />, children: [
  ...names.map(name => ({ path: `${name}/*`, element: <LegacyRoute /> })),
  { path: '*', element: <LegacyRoute /> },
] }]);
export function initializeApp(): void {
  if (stopLegacy) return;
  configureLegacyRouter((h, refresh) => {
    const target = h.startsWith('#') ? h.slice(1) : h;
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
