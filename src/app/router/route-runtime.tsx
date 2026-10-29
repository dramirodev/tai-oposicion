import { createHashRouter } from 'react-router';
import { Layout } from '../layouts/Layout.js';
import { RouteError } from './RouteError.js';
import { lazy, Suspense, useEffect, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { ReactScreen } from '../layouts/ReactScreen.js';
import { ExamsRedirect } from './ExamsRedirect.js';
import { paths, routeSegment } from './paths.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { useOptionalStudyService } from '../../shared/ui/study-services.js';
import { useInitialAppReadySignal } from '../../shared/ui/InitialAppLoading.js';
const HomePage = lazy(() => import('../../features/home/HomePage.js').then(module => ({ default: module.HomePage })));
const AccessPage = lazy(() => import('../../features/access/AccessPage.js').then(module => ({ default: module.AccessPage })));
const HelpPage = lazy(() => import('../../features/help/HelpPage.js').then(module => ({ default: module.HelpPage })));
const TopicsPage = lazy(() => import('../../features/home/TopicsPage.js').then(module => ({ default: module.TopicsPage })));
const PlanningPage = lazy(() => import('../../features/planning/PlanningPage.js').then(module => ({ default: module.PlanningPage })));
const CardsPage = lazy(() => import('../../features/cards/CardsPage.js').then(module => ({ default: module.CardsPage })));
const ErrorsPage = lazy(() => import('../../features/errors/ErrorsPage.js').then(module => ({ default: module.ErrorsPage })));
const FailuresPage = lazy(() => import('../../features/failures/FailuresPage.js').then(module => ({ default: module.FailuresPage })));
const LightningPage = lazy(() => import('../../features/trainers/LightningPage.js').then(module => ({ default: module.LightningPage })));
const TrapsPage = lazy(() => import('../../features/trainers/TrapsPage.js').then(module => ({ default: module.TrapsPage })));
const ReadingPage = lazy(() => import('../../features/trainers/ReadingPage.js').then(module => ({ default: module.ReadingPage })));
const SettingsPage = lazy(() => import('../../features/settings/SettingsPage.js').then(module => ({ default: module.SettingsPage })));
const TestPage = lazy(() => import('../../features/test/TestPage.js').then(module => ({ default: module.TestPage })));
const SimulationReviewPage = lazy(() => import('../../features/simulation/SimulationReviewPage.js').then(module => ({ default: module.SimulationReviewPage })));
const SimulationPage = lazy(() => import('../../features/simulation/SimulationPage.js').then(module => ({ default: module.SimulationPage })));
const ResultPage = lazy(() => import('../../features/result/ResultPage.js').then(module => ({ default: module.ResultPage })));
const StatsPage = lazy(() => import('../../features/stats/StatsPage.js').then(module => ({ default: module.StatsPage })));
const QuizPage = lazy(() => import('../../features/quiz/QuizPage.js').then(module => ({ default: module.QuizPage })));
interface AppRuntime {
  bootAppServices: () => () => void;
  configureAppNavigation: (navigate: (target: string, refresh?: boolean) => void) => void;
  markReady: () => void;
}
let appRuntime: AppRuntime;
export function configureRuntime(runtime: AppRuntime): void { appRuntime = runtime; }
let legacyRefreshSeq = 0;
let stopAppServices: (() => void) | undefined;
const loading = <PageLoading variant="legacy" />;
const noSubscription = () => () => {};
const readyWithoutServices = () => true;
function FocusAfterLoad({ children }: { children: ReactNode }) {
  const location = useLocation();
  const home = useOptionalStudyService('home');
  const authResolved = useSyncExternalStore(home?.subscribe ?? noSubscription, home?.authResolved ?? readyWithoutServices, readyWithoutServices);
  const markInitialAppReady = useInitialAppReadySignal();
  useLayoutEffect(() => {
    const heading = document.querySelector<HTMLElement>('.route-transition h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    appRuntime?.markReady();
  }, [location.key]);
  useEffect(() => {
    if (!authResolved) return;
    const app = document.getElementById('app');
    if (!app) return;
    const markReadyWhenContentIsLoaded = () => {
      if (app.querySelector('.page-loading')) return false;
      markInitialAppReady();
      return true;
    };
    if (markReadyWhenContentIsLoaded()) return;
    const observer = new MutationObserver(() => {
      if (markReadyWhenContentIsLoaded()) observer.disconnect();
    });
    observer.observe(app, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [authResolved, location.key, markInitialAppReady]);
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
  { path: `${routeSegment(paths.planning)}/*`, element: screen(<PlanningPage />, { restricted: true }) },
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
  { path: '*', element: screen(<HomePage />, { home: true }) },
] }]);
export function initializeApp(): void {
  if (stopAppServices) return;
  appRuntime.configureAppNavigation((html, refresh) => {
    const target = html.startsWith('#') ? html.slice(1) : html;
    if (refresh) { void router.navigate(target, { state: { legacyRefresh: ++legacyRefreshSeq } }); return; }
    void router.navigate(target);
  });
  stopAppServices = appRuntime.bootAppServices();
}
export function shutdownApp(): void {
  stopAppServices?.();
  stopAppServices = undefined;
}
