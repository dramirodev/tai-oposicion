import { createHashRouter } from 'react-router';
import { Layout } from './Layout.js';
import { LegacyRoute } from './LegacyRoute.js';
import { RouteError } from './RouteError.js';
import { lazy, Suspense, useLayoutEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { ReactScreen } from './ReactScreen.js';
import { ExamsRedirect } from './ExamsRedirect.js';
import { legacyPaths, paths, routeSegment } from './paths.js';
import { useOptionalStudyServices } from '../shared/ui/study-services.js';
const HomePage = lazy(() => import('../features/home/HomePage.js').then(module => ({ default: module.HomePage })));
const AccessPage = lazy(() => import('../features/access/AccessPage.js').then(module => ({ default: module.AccessPage })));
const HelpPage = lazy(() => import('../features/help/HelpPage.js').then(module => ({ default: module.HelpPage })));
const TopicsPage = lazy(() => import('../features/home/TopicsPage.js').then(module => ({ default: module.TopicsPage })));
const CardsPage = lazy(() => import('../features/cards/CardsPage.js').then(module => ({ default: module.CardsPage })));
const ErrorsPage = lazy(() => import('../features/errors/ErrorsPage.js').then(module => ({ default: module.ErrorsPage })));
const FailuresPage = lazy(() => import('../features/failures/FailuresPage.js').then(module => ({ default: module.FailuresPage })));
const LightningPage = lazy(() => import('../features/trainers/LightningPage.js').then(module => ({ default: module.LightningPage })));
const TrapsPage = lazy(() => import('../features/trainers/TrapsPage.js').then(module => ({ default: module.TrapsPage })));
const ReadingPage = lazy(() => import('../features/trainers/ReadingPage.js').then(module => ({ default: module.ReadingPage })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.js').then(module => ({ default: module.SettingsPage })));
const TestPage = lazy(() => import('../features/test/TestPage.js').then(module => ({ default: module.TestPage })));
const SimulationReviewPage = lazy(() => import('../features/simulation/SimulationReviewPage.js').then(module => ({ default: module.SimulationReviewPage })));
const SimulationPage = lazy(() => import('../features/simulation/SimulationPage.js').then(module => ({ default: module.SimulationPage })));
const ResultPage = lazy(() => import('../features/result/ResultPage.js').then(module => ({ default: module.ResultPage })));
const StatsPage = lazy(() => import('../features/stats/StatsPage.js').then(module => ({ default: module.StatsPage })));
const QuizPage = lazy(() => import('../features/quiz/QuizPage.js').then(module => ({ default: module.QuizPage })));
interface LegacyRuntime {
  bootLegacy: () => () => void;
  configureLegacyRouter: (navigate: (target: string, refresh?: boolean) => void) => void;
}
let legacyRuntime: LegacyRuntime;
export function configureRuntime(runtime: LegacyRuntime): void { legacyRuntime = runtime; }
let legacyRefreshSeq = 0;
let stopLegacy: (() => void) | undefined;
const loading = <p className="sub loading" role="status">Cargando…</p>;
function FocusAfterLoad({ children }: { children: ReactNode }) {
  const location = useLocation();
  const services = useOptionalStudyServices();
  useLayoutEffect(() => {
    const heading = document.querySelector<HTMLElement>('.route-transition h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    services?.markReady();
  }, [location.key, services]);
  return <>{children}</>;
}
const screen = (element: React.ReactNode, options?: { home?: boolean; restricted?: boolean }) => (
  <ReactScreen {...options}><Suspense fallback={loading}><FocusAfterLoad>{element}</FocusAfterLoad></Suspense></ReactScreen>
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
  { path: `${routeSegment(paths.traps)}/*`, element: screen(<TrapsPage />, { restricted: true }) },
  { path: `${routeSegment(paths.reading)}/*`, element: screen(<ReadingPage />, { restricted: true }) },
  { path: `${routeSegment(paths.settings)}/*`, element: screen(<SettingsPage />) },
  { path: `${routeSegment(paths.test)}/*`, element: screen(<TestPage />, { restricted: true }) },
  { path: `${routeSegment(paths.simulation)}/*`, element: screen(<SimulationPage />, { restricted: true }) },
  { path: `${routeSegment(paths.simulationReview)}/*`, element: screen(<SimulationReviewPage />, { restricted: true }) },
  { path: `${routeSegment(paths.result)}/*`, element: screen(<ResultPage />) },
  { path: `${routeSegment(paths.stats)}/*`, element: screen(<StatsPage />, { restricted: true }) },
  { path: `${routeSegment(paths.quiz)}/*`, element: screen(<QuizPage />) },
  { path: `${routeSegment(paths.exams)}/*`, element: screen(<ExamsRedirect />) },
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
