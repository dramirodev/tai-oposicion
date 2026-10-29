import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { TrainingActivity } from '../../core/domain/entities.js';
import type { DailyTrainingSession } from '../../core/domain/study-training-session.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import type { HomeOverview } from '../../shared/ui/study-services.js';
import { HomeView } from './HomeView.js';
import { createHomeController, scopeTrainingRouteToSeenTopics } from './home-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';

export function HomePage() {
  const services = useStudyService('home');
  const authResolved = useSyncExternalStore(services.subscribe, services.authResolved, () => false);
  const captureLifetime = useActionLifetime(services.accountId);
  const [controller] = useState(() => createHomeController(captureLifetime, services.notify));
  const pending = useSyncExternalStore(controller.subscribe, controller.getPending, controller.getPending);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadOverview() }), [services]);
  const { value: overview, error } = useAccountResource(resource);
  usePageReady(authResolved && (!!overview || !!error));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('focus') !== 'training' || !overview) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById('home-training');
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true, preventScrollReset: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [overview, searchParams, setSearchParams]);
  const runAction = (id: string, action: () => Promise<unknown>) => { void controller.runAction(id, action); };
  const navigateHomeRoute = (route: string) => {
    const scopedRoute = scopeTrainingRouteToSeenTopics(route, services.seenTopics());
    if (!scopedRoute) {
      services.notify('Marca primero los temas que ya has estudiado para preparar un entrenamiento de hoy.');
      return;
    }
    void navigate('/' + scopedRoute);
  };
  const openTrainingActivity = (started: DailyTrainingSession, sourceOverview: HomeOverview) => {
    if (!started || started.completedAt !== null) return;
    const step = started.activities[started.currentIndex];
    if (!step) return;
    const seenTopics = [...new Set(services.seenTopics())];
    if (!seenTopics.length) {
      services.notify('Marca primero los temas que ya has estudiado para preparar un entrenamiento de hoy.');
      return;
    }
    const seenTopicSet = new Set(seenTopics);
    const savedTopicIds = step.topicIds?.filter(topicId => seenTopicSet.has(topicId)) ?? [];
    const topicId = step.topicId && seenTopicSet.has(step.topicId) ? step.topicId : undefined;
    const topicIds = step.activity === 'topicTest' && topicId
      ? [topicId]
      : savedTopicIds.length ? savedTopicIds : seenTopics;
    const route: Record<TrainingActivity, string> = { activeRecall: 'cards', topicTest: 'test', mixedTopicTest: 'test', failures: 'falladas', spacedReviews: 'cards' };
    if (step.activity === 'spacedReviews' && !(sourceOverview.trainingDue?.cards ?? sourceOverview.cardsDue)) {
      runAction('training-review', () => services.startReview(topicIds, 'spacedReviews'));
      return;
    }
    const queryParams = new URLSearchParams();
    queryParams.set('dailyTraining', step.activity);
    queryParams.set('trainingTopics', topicIds.join(','));
    if (step.activity === 'topicTest' && topicId) queryParams.set('topic', topicId);
    navigateHomeRoute(`${route[step.activity]}?${queryParams.toString()}`);
  };

  const startTraining = () => {
    if (!overview) return;
    if (services.getActiveStudy()) {
      services.notify('Termina o continúa primero la sesión que ya tienes abierta para conservar su avance.');
      return;
    }
    const seenTopics = [...new Set(services.seenTopics())];
    if (!seenTopics.length) {
      services.notify('Marca primero los temas que ya has estudiado para preparar un entrenamiento de hoy.');
      return;
    }
    const session = services.startTrainingSession(overview.trainingPlan);
    const started = services.startTrainingActivity() || session;
    if (started) openTrainingActivity(started, overview);
  };

  if (!authResolved || (!overview && !error)) return <PageLoading variant="home" />;
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar</h2><p>{navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button className="btn" id="retryRoute" onClick={() => void navigate('/home')}>Reintentar</button></div>;
  if (!overview) return <PageLoading variant="home" />;

  return <HomeView
    overview={overview}
    access={services.getAccess()}
    run={services.getActiveStudy()}
    pending={pending}
    onNavigate={navigateHomeRoute}
    onQuickSession={() => void runAction('quick', services.quickSession)}
    onStartReview={topicIds => void runAction('rev', () => services.startReview(topicIds))}
    onStartTraining={startTraining}
    onSetTrainingReviewMode={(topicId, mode) => services.setTrainingReviewMode(topicId, mode)}
    onOpenMenu={services.openMenu}
    onLogin={() => void runAction('login', services.login)}
    onRequestAccess={() => void runAction('request', async () => {
      if (!await services.requestAccess()) services.notify('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    })}
  />;
}
