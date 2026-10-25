import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { GUEST_ROUTES, isFull } from '../../infra/access.js';
import { renderLegacy } from '../main.js';
/** Cada visita tiene un nodo independiente: React nunca reconcilia su HTML. */
export function LegacyRoute() {
  const host = useRef<HTMLDivElement>(null);
  const location = useLocation(), navigate = useNavigate();
  useLayoutEffect(() => {
    const name = location.pathname.split('/')[1] || 'home';
    if (!isFull() && !GUEST_ROUTES.has(name)) { void navigate('/home', { replace: true }); return; }
    const container = document.createElement('div'); container.tabIndex = -1;
    container.innerHTML = '<p class="sub loading" role="status">Cargando…</p>';
    host.current!.append(container);
    const view = renderLegacy(container, location.pathname);
    return () => { view.dispose(); container.remove(); };
  }, [location, navigate]);
  return <div ref={host} tabIndex={-1} />;
}
