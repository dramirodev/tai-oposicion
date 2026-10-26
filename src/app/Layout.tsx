import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { isFull, isOwner, GUEST_ROUTES } from '../adapters/legacy/access.js';
import { hasActiveRun } from '../core/application/legacy-engine.js';
import { syncGateway } from '../adapters/firebase/legacy-sync-state.js';
import { subscribeAccessChanges } from './access-events.js';
import { observeFixedLayout } from '../shared/ui/layout-metrics.js';
import { WorkspaceNavigation } from './WorkspaceNavigation.js';
import { useActiveSection } from './useActiveSection.js';
const subscribeFull = (fn: () => void) => {
  const offSync = syncGateway.subscribe(() => fn()), offLocal = subscribeAccessChanges(fn);
  return () => { offSync(); offLocal(); };
};
function NetworkBanner() {
  const [status, setStatus] = useState(navigator.onLine === false ? 'off' : '');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let offline = navigator.onLine === false;
    const off = () => { offline = true; clearTimeout(timer); setStatus('off'); };
    const on = () => {
      if (!offline) return;
      offline = false;
      clearTimeout(timer);
      setStatus('on');
      timer = setTimeout(() => setStatus(''), 3000);
    };
    addEventListener('offline', off); addEventListener('online', on);
    return () => { clearTimeout(timer); removeEventListener('offline', off); removeEventListener('online', on); };
  }, []);
  return <div id="net" role="status" aria-live="polite" className={status}>{status === 'off' ? 'Sin conexión · solo lo descargado' : status === 'on' ? 'De nuevo en línea' : ''}</div>;
}
const tabs = [
  ['home', 'Inicio', <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />],
  ['test', 'Test', <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />],
  ['sim', 'Simulacros', <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></>],
  ['stats', 'Progreso', <path d="M5 21V10M12 21V4M19 21v-7" />],
  ['settings', 'Ajustes', <><path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0" /><circle cx="15" cy="6" r="2.5" /><circle cx="9" cy="12" r="2.5" /><circle cx="17" cy="18" r="2.5" /></>],
] as const;
export function Layout() {
  useLayoutEffect(observeFixedLayout, []);
  const location = useLocation(), navigate = useNavigate();
  const full = useSyncExternalStore(subscribeFull, isFull);
  const owner = useSyncExternalStore(subscribeFull, isOwner);
  const lastFull = useRef(full);
  useEffect(() => {
    if (lastFull.current === full) return;
    lastFull.current = full;
    if (!hasActiveRun()) void navigate(location.pathname);
  }, [full, location.pathname, navigate]);
  const section = useActiveSection(location.pathname);
  return <>
    {createPortal(
      <a className="skip-link" href="#app" onClick={e => {
        e.preventDefault();
        document.getElementById('app')?.focus();
        window.scrollTo(0, 0);
      }}>Saltar al contenido</a>,
      document.getElementById('skip-nav') ?? document.body,
    )}
    {createPortal(
      <WorkspaceNavigation full={full} owner={owner} section={section} pathname={location.pathname}
        navigate={path => { void navigate(path); }} />,
      document.getElementById('workspace-shell') ?? document.body,
    )}
    <Outlet key={location.key} />
    {createPortal(<>
      <div id="live" className="sr" role="status" aria-live="polite" />
      <nav aria-label="Principal">
        {tabs.map(([route, label, icon]) => <a key={route} href={`#/${route}`} data-r={route}
          className={section === route ? 'on' : ''} aria-current={section === route ? 'page' : undefined}
          style={{ display: full || GUEST_ROUTES.has(route) ? '' : 'none' }}>
          <i aria-hidden="true"><svg viewBox="0 0 24 24">{icon}</svg></i>{label}
        </a>)}
      </nav>
      <NetworkBanner />
    </>, document.body)}
  </>;
}
