import { createHashRouter, RouterProvider } from 'react-router';
import { configureLegacyRouter } from '../main.js';
import { Layout } from './Layout.js';
import { LegacyRoute } from './LegacyRoute.js';
import { DialogProvider } from './Dialogs.js';
const names = ['home', 'quiz', 'result', 'test', 'sim', 'sim2', 'examenes', 'cards', 'stats', 'settings', 'temario', 'falladas', 'errores', 'lectura', 'relampago', 'trampas', 'acceso'];
export const router = createHashRouter([{ element: <Layout />, children: [
  ...names.map(name => ({ path: `${name}/*`, element: <LegacyRoute /> })),
  { path: '*', element: <LegacyRoute /> },
] }]);
export function App() {
  configureLegacyRouter((h, refresh) => {
    const target = h.startsWith('#') ? h.slice(1) : h;
    if (refresh) { void router.navigate(target, { state: { legacyRefresh: Date.now() } }); return; }
    void router.navigate(target);
  });
  return <DialogProvider><RouterProvider router={router} /></DialogProvider>;
}
