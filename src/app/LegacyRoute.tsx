import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { GUEST_ROUTES, isFull } from '../adapters/legacy/access.js';
import { renderLegacy } from './legacy-router.js';
interface LegacyVisit {
  key: string;
  container: HTMLDivElement;
  dispose: () => void;
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
function acquireVisit(host: HTMLElement, key: string, pathname: string): () => void {
  const existing = visits.get(host);
  if (existing?.key === key) {
    clearTimeout(existing.teardown);
    existing.teardown = undefined;
    existing.users++;
    return () => releaseVisit(host, existing);
  }
  if (existing) {
    clearTimeout(existing.teardown);
    existing.dispose();
    existing.container.remove();
    visits.delete(host);
  }
  const container = document.createElement('div');
  container.tabIndex = -1;
  container.innerHTML = '<p class="sub loading" role="status">Cargando…</p>';
  host.append(container);
  const view = renderLegacy(container, pathname);
  const visit = { key, container, dispose: view.dispose, users: 1 };
  visits.set(host, visit);
  return () => releaseVisit(host, visit);
}
/** Cada visita tiene un nodo independiente: React nunca reconcilia su HTML. */
export function LegacyRoute() {
  const host = useRef<HTMLDivElement>(null);
  const location = useLocation(), navigate = useNavigate();
  useLayoutEffect(() => {
    const name = location.pathname.split('/')[1] || 'home';
    if (!isFull() && !GUEST_ROUTES.has(name)) { void navigate('/home', { replace: true }); return; }
    return acquireVisit(host.current!, `${location.pathname}:${location.key}`, location.pathname);
  }, [location.key, location.pathname, navigate]);
  return <div ref={host} className="route-transition" tabIndex={-1} data-screen={location.pathname.split('/')[1] || 'home'} />;
}
