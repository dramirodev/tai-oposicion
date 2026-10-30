import { useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { useStudyService } from '../../shared/ui/study-services.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { HomeView } from './HomeView.js';
import { scopeTrainingRouteToSeenTopics } from '../../shared/navigation/training-route.js';
import { createPendingActionController } from '../../shared/ui/pending-action-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { PageMessage } from '../../shared/ui/PageMessage.js';

export function HomePage() {
  const services = useStudyService('home');
  const authResolved = useSyncExternalStore(services.subscribe, services.authResolved, () => false);
  const captureLifetime = useActionLifetime(services.accountId);
  const [controller] = useState(() => createPendingActionController(captureLifetime, services.notify));
  const pending = useSyncExternalStore(controller.subscribe, controller.getPending, controller.getPending);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadOverview() }), [services]);
  const { value: overview, error } = useAccountResource(resource);
  usePageReady(authResolved && (!!overview || !!error));
  const navigate = useNavigate();
  const runAction = (id: string, action: () => Promise<unknown>) => { void controller.runAction(id, action); };
  const navigateHomeRoute = (route: string) => {
    const scopedRoute = scopeTrainingRouteToSeenTopics(route, services.seenTopics());
    if (!scopedRoute) {
      services.notify('Marca primero los temas que ya has estudiado para preparar un entrenamiento de hoy.');
      return;
    }
    void navigate('/' + scopedRoute);
  };
  if (!authResolved || (!overview && !error)) return <PageLoading variant="home" />;
  if (error) return <PageMessage role="alert" title="No se pudo cargar"><p>{navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button className="btn" id="retryRoute" onClick={() => void navigate('/home')}>Reintentar</button></PageMessage>;
  if (!overview) return <PageLoading variant="home" />;

  return <HomeView
    overview={overview}
    access={services.getAccess()}
    run={services.getActiveStudy()}
    pending={pending}
    onNavigate={navigateHomeRoute}
    onQuickSession={() => void runAction('quick', services.quickSession)}
    onStartReview={topicIds => void runAction('rev', () => services.startReview(topicIds))}
    onOpenMenu={services.openMenu}
    onLogin={() => void runAction('login', services.login)}
    onRequestAccess={() => void runAction('request', async () => {
      if (!await services.requestAccess()) services.notify('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    })}
  />;
}
