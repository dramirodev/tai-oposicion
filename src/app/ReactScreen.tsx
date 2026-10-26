import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, Link, Navigate } from 'react-router';
import { useStudyServices } from '../shared/ui/study-services.js';
export function ReactScreen({ children, home = false, restricted = false }: { children: ReactNode; home?: boolean; restricted?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const { home: services, markReady } = useStudyServices();
  const location = useLocation();
  const full = useSyncExternalStore(services.subscribe, () => services.getAccess().full);
  const blocked = restricted && !full;
  const run = services.getActiveStudy();
  useLayoutEffect(() => {
    if (blocked) return;
    window.scrollTo(0, 0);
    const heading = root.current?.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    if (heading) markReady();
  }, [location.key, markReady, blocked]);
  if (blocked) return <Navigate to="/home" replace />;
  return <div ref={root} tabIndex={-1} data-screen={location.pathname.split('/')[1] || 'home'}>
    {!home && run && <div className="note run"><b>{run.title}</b> en curso · {Math.min(run.position + 1, run.total)}/{run.total} <Link className="btn" id="resume" to="/quiz">Continuar</Link></div>}
    {children}
  </div>;
}
