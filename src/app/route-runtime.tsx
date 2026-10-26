import { createHashRouter } from 'react-router';
import { Layout } from './Layout.js';
import { LegacyRoute } from './LegacyRoute.js';
import { RouteError } from './RouteError.js';
import { lazy, Suspense } from 'react';
import { ReactScreen } from './ReactScreen.js';
import { legacyPaths, paths, routeSegment } from './paths.js';
const HomePage = lazy(() => import('../features/home/HomePage.js').then(module => ({ default: module.HomePage })));
const AccessPage = lazy(() => import('../features/access/AccessPage.js').then(module => ({ default: module.AccessPage })));
const HelpPage = lazy(() => import('../features/help/HelpPage.js').then(module => ({ default: module.HelpPage })));
const TopicsPage = lazy(() => import('../features/home/TopicsPage.js').then(module => ({ default: module.TopicsPage })));
const CardsPage = lazy(() => import('../features/cards/CardsPage.js').then(module => ({ default: module.CardsPage })));
const ErrorsPage = lazy(() => import('../features/errors/ErrorsPage.js').then(module => ({ default: module.ErrorsPage })));
const FailuresPage = lazy(() => import('../features/failures/FailuresPage.js').then(module => ({ default: module.FailuresPage })));
const LightningPage = lazy(() => import('../features/trainers/LightningPage.js').then(module => ({ default: module.LightningPage })));
interface LegacyRuntime {
  bootLegacy: () => () => void;
  configureLegacyRouter: (navigate: (target: string, refresh?: boolean) => void) => void;
}
let legacyRuntime: LegacyRuntime;
export function configureRuntime(runtime: LegacyRuntime): void { legacyRuntime = runtime; }
let legacyRefreshSeq = 0;
let stopLegacy: (() => void) | undefined;
const loading = <p className="sub loading" role="status">Cargando…</p>;
const screen = (element: React.ReactNode, options?: { home?: boolean; restricted?: boolean }) => (
  <ReactScreen {...options}><Suspense fallback={loading}>{element}</Suspense></ReactScreen>
);
export const router = createHashRouter([{ ErrorBoundary: RouteError, element: <Layout />, children: [
  { index: true, element: screen(<HomePage />, { home: true }) },
  { path: `${routeSegment(paths.home)}/*`, element: screen(<HomePage />, { home: true }) },
  { path: `${routeSegment(paths.access)}/*`, element: screen(<AccessPage />) },
  { path: `${routeSegment(paths.help)}/*`, element: screen(<HelpPage />) },
  { path: `${routeSegment(paths.topics)}/*`, element: screen(<TopicsPage />, { restricted: true }) },
  { path: `${routeSegment(paths.cards)}/*`, element: screen(<CardsPage />, { restricted: true }) },
  { path: `${routeSegment(paths.errors)}/*`, element: screen(<ErrorsPage />, { restricted: true }) },
  { path: `${routeSegment(paths.failures)}/*`, element: screen(<FailuresPage />, { restricted: true }) },
  { path: `${routeSegment(paths.lightning)}/*`, element: screen(<LightningPage />, { restricted: true }) },
  ...legacyPaths.map(path => ({ path: `${routeSegment(path)}/*`, element: <LegacyRoute /> })),
  { path: '*', element: screen(<HomePage />, { home: true }) },
] }]);
export function initializeApp(): void {
  if (stopLegacy) return;
  legacyRuntime.configureLegacyRouter((html, refresh) => {
    const target = html.startsWith('#') ? html.slice(1) : html;
    if (refresh) { void router.navigate(target, { state: { legacyRefresh: ++legacyRefreshSeq } }); return; }
    void router.navigate(target);
  });
  stopLegacy = legacyRuntime.bootLegacy();
}
export function shutdownApp(): void {
  stopLegacy?.();
  stopLegacy = undefined;
}
