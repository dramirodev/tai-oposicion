import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { GUEST_ROUTES, isFull } from '../adapters/legacy/access.js';
import { renderLegacy } from './legacy-router.js';
import { PageLoading } from '../shared/ui/PageLoading.js';
interface LegacyVisit {
  key: string;
  container: HTMLDivElement;
  dispose: () => void;
  ready: Promise<void>;
  users: number;
  teardown?: ReturnType<typeof setTimeout>;
}
const visits = new WeakMap<HTMLElement, LegacyVisit>();
function releaseVisit(host: HTMLElement, visit: LegacyVisit): void {
  visit.users--;
  if (visit.users > 0) return;
  visit.teardown = setTimeout(() => {
    if (visit.users > 0 || visits.get(host) !== visit) return;
    visit.dispose();
    visit.container.remove();
    visits.delete(host);
  }, 0);
}
function acquireVisit(host: HTMLElement, key: string, pathname: string): { release: () => void; ready: Promise<void> } {
  const existing = visits.get(host);
  if (existing?.key === key) {
    clearTimeout(existing.teardown);
    existing.teardown = undefined;
    existing.users++;
    return { release: () => releaseVisit(host, existing), ready: existing.ready };
  }
  if (existing) {
    clearTimeout(existing.teardown);
    existing.dispose();
    existing.container.remove();
    visits.delete(host);
  }
  const container = document.createElement('div');
  container.tabIndex = -1;
  host.append(container);
  const view = renderLegacy(container, pathname);
  const visit = { key, container, dispose: view.dispose, ready: view.ready, users: 1 };
  visits.set(host, visit);
  return { release: () => releaseVisit(host, visit), ready: visit.ready };
}
/** Cada visita tiene un nodo independiente: React nunca reconcilia su HTML. */
export function LegacyRoute() {
  const host = useRef<HTMLDivElement>(null);
  const location = useLocation(), navigate = useNavigate();
  const routeKey = `${location.pathname}:${location.key}`;
  const [readyKey, setReadyKey] = useState('');
  useLayoutEffect(() => {
    const name = location.pathname.split('/')[1] || 'home';
    if (!isFull() && !GUEST_ROUTES.has(name)) { void navigate('/home', { replace: true }); return; }
    let active = true;
    const visit = acquireVisit(host.current!, routeKey, location.pathname);
    void visit.ready.then(() => { if (active) setReadyKey(routeKey); });
    return () => { active = false; visit.release(); };
  }, [routeKey, location.key, location.pathname, navigate]);
  return <>
    {readyKey !== routeKey && <PageLoading variant="legacy" />}
    <div ref={host} className="route-transition" tabIndex={-1} data-screen={location.pathname.split('/')[1] || 'home'} />
  </>;
}
