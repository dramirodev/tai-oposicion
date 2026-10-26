import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Activity, CalendarClock, ClipboardCheck, House, Settings2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { isFull, isOwner, GUEST_ROUTES } from '../adapters/legacy/access.js';
import { hasActiveRun } from '../core/application/legacy-engine.js';
import { syncGateway } from '../adapters/firebase/legacy-sync-state.js';
import { subscribeAccessChanges } from './access-events.js';
import { observeFixedLayout } from '../shared/ui/layout-metrics.js';
import { WorkspaceNavigation } from './WorkspaceNavigation.js';
import { useActiveSection } from './useActiveSection.js';
import { hashSegment } from './paths.js';
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
  ['home', 'Inicio', House],
  ['test', 'Test', ClipboardCheck],
  ['sim', 'Simulacros', CalendarClock],
  ['stats', 'Progreso', Activity],
  ['settings', 'Ajustes', Settings2],
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
        {tabs.map(([route, label, Icon]) => <a key={route} href={hashSegment(route)} data-r={route}
          className={section === route ? 'on' : ''} aria-current={section === route ? 'page' : undefined}
          style={{ display: full || GUEST_ROUTES.has(route) ? '' : 'none' }}>
          <i aria-hidden="true"><Icon size="1.125rem" strokeWidth={1.7} /></i>{label}
        </a>)}
      </nav>
      <NetworkBanner />
    </>, document.body)}
  </>;
}
