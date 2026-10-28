import { useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import type { TrainingActivity } from '../../core/domain/entities.js';
import type { DailyTrainingSession } from '../../core/domain/study-training-session.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { HomeView } from './HomeView.js';
import { createHomeController } from './home-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';

export function HomePage() {
  const services = useStudyService('home');
  const authResolved = useSyncExternalStore(services.subscribe, services.authResolved, () => false);
  const captureLifetime = useActionLifetime(services.accountId);
  const [controller] = useState(() => createHomeController(captureLifetime, services.notify));
  const pending = useSyncExternalStore(controller.subscribe, controller.getPending, controller.getPending);
  const [sessionOverride, setSessionOverride] = useState<{ accountId: string | null; session: DailyTrainingSession } | null>(null);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadOverview() }), [services]);
  const { value: overview, error } = useAccountResource(resource);
  usePageReady(authResolved && (!!overview || !!error));
  const navigate = useNavigate();
  const runAction = (id: string, action: () => Promise<unknown>) => { void controller.runAction(id, action); };
  if (!authResolved || (!overview && !error)) return <PageLoading variant="home" />;
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar</h2><p>{navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button className="btn" id="retryRoute" onClick={() => void navigate('/home')}>Reintentar</button></div>;
  if (!overview) return <PageLoading variant="home" />;

  const startTraining = () => {
    const session = services.startTrainingSession(overview.trainingPlan);
    const started = services.startTrainingActivity() || session;
    if (!started || started.completedAt !== null) return;
    const step = started.activities[started.currentIndex];
    if (!step) return;
    const route: Record<TrainingActivity, string> = { activeRecall: 'cards', topicTest: 'test', failures: 'falladas', spacedReviews: 'cards' };
    if (step.activity === 'spacedReviews' && !overview.cardsDue) runAction('training-review', services.startReview);
    else {
      const query = step.activity !== 'topicTest' ? ''
        : step.topicId ? `?topic=${encodeURIComponent(step.topicId)}`
          : step.reason === 'new-topic-day' ? '?recommendation=new-topic' : '';
      void navigate('/' + route[step.activity] + query);
    }
  };
  const completeTrainingActivity = (activity: TrainingActivity) => {
    const session = services.completeTrainingActivity(activity);
    if (session) setSessionOverride({ accountId: services.accountId(), session });
  };
  const homeOverview = sessionOverride?.accountId === services.accountId()
    ? { ...overview, trainingSession: sessionOverride.session }
    : overview;

  return <HomeView
    overview={homeOverview}
    access={services.getAccess()}
    run={services.getActiveStudy()}
    pending={pending}
    onNavigate={route => { void navigate('/' + route); }}
    onQuickSession={() => void runAction('quick', services.quickSession)}
    onStartReview={() => void runAction('rev', services.startReview)}
    onStartTraining={startTraining}
    onCompleteTrainingActivity={completeTrainingActivity}
    onSetTrainingReviewMode={(topicId, mode) => services.setTrainingReviewMode(topicId, mode)}
    onOpenMenu={services.openMenu}
    onLogin={() => void runAction('login', services.login)}
    onRequestAccess={() => void runAction('request', async () => {
      if (!await services.requestAccess()) services.notify('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    })}
  />;
}
