import { observeScrollSections } from '../shared/ui/scroll-sections.js';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, Link, Navigate } from 'react-router';
import { useStudyService } from '../shared/ui/study-services.js';
export function ReactScreen({ children, home = false, restricted = false }: { children: ReactNode; home?: boolean; restricted?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const services = useStudyService('home');
  const markReady = useStudyService('markReady');
  const location = useLocation();
  const full = useSyncExternalStore(services.subscribe, () => services.getAccess().full);
  const blocked = restricted && !full;
  const run = services.getActiveStudy();
  const isQuiz = location.pathname.replace(/\/$/, '') === '/quiz';
  useLayoutEffect(() => {
    if (blocked) { markReady(); return; }
    window.scrollTo(0, 0);
    const heading = root.current?.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    if (heading) markReady();
  }, [location.key, markReady, blocked]);
  useEffect(() => {
    if (blocked || !root.current) return;
    return observeScrollSections(root.current);
  }, [location.key, blocked]);
  if (blocked) return <Navigate to="/home" replace />;
  return <div ref={root} className="route-transition" tabIndex={-1} data-screen={location.pathname.split('/')[1] || 'home'}>
    {!home && !isQuiz && run && <div className="note run"><b>{run.title}</b> en curso · {Math.min(run.position + 1, run.total)}/{run.total} <Link className="btn" id="resume" to="/quiz">Continuar</Link></div>}
    {children}
  </div>;
}
