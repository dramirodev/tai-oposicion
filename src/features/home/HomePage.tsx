import { useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { useStudyServices } from '../../shared/ui/study-services.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { HomeView } from './HomeView.js';
import { createHomeController } from './home-controller.js';

export function HomePage() {
  const { home: services } = useStudyServices();
  const captureLifetime = useActionLifetime(services.accountId);
  const [controller] = useState(() => createHomeController(captureLifetime, services.notify));
  const pending = useSyncExternalStore(controller.subscribe, controller.getPending, controller.getPending);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadOverview() }), [services]);
  const { value: overview, error } = useAccountResource(resource);
  usePageReady(!!overview || !!error);
  const navigate = useNavigate();
  const runAction = (id: string, action: () => Promise<unknown>) => { void controller.runAction(id, action); };
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar</h2><p>{navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button className="btn" id="retryRoute" onClick={() => void navigate('/home')}>Reintentar</button></div>;
  if (!overview) return <p className="sub loading" role="status">Cargando…</p>;

  return <HomeView
    overview={overview}
    access={services.getAccess()}
    run={services.getActiveStudy()}
    pending={pending}
    onNavigate={route => { void navigate('/' + route); }}
    onQuickSession={() => void runAction('quick', services.quickSession)}
    onStartReview={() => void runAction('rev', services.startReview)}
    onOpenMenu={services.openMenu}
    onLogin={() => void runAction('login', services.login)}
    onRequestAccess={() => void runAction('request', async () => {
      if (!await services.requestAccess()) services.notify('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    })}
  />;
}
