import { observeScrollSections } from '../../shared/ui/scroll-sections.js';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, Link, Navigate } from 'react-router';
import { useStudyService } from '../../shared/ui/study-services.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
export function ReactScreen({ children, home = false, restricted = false }: { children: ReactNode; home?: boolean; restricted?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const services = useStudyService('home');
  const markReady = useStudyService('markReady');
  const location = useLocation();
  const full = useSyncExternalStore(services.subscribe, () => services.getAccess().full);
  const accessResolved = useSyncExternalStore(services.subscribe, () => services.getAccess().resolved ?? services.authResolved());
  const blocked = restricted && accessResolved && !full;
  const run = services.getActiveStudy();
  const isQuiz = location.pathname.replace(/\/$/, '') === '/quiz';
  useLayoutEffect(() => {
    // Firebase initialization waits for this route signal; keep protected content gated meanwhile.
    if (blocked || (restricted && !accessResolved)) { markReady(); return; }
    window.scrollTo(0, 0);
    const heading = root.current?.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    if (heading) markReady();
  }, [location.key, markReady, blocked, restricted, accessResolved]);
  useEffect(() => {
    if (blocked || !root.current) return;
    return observeScrollSections(root.current);
  }, [location.key, blocked, accessResolved]);
  if (restricted && !accessResolved) return <PageLoading variant="legacy" />;
  if (blocked) return <Navigate to="/home" replace />;
  return <div ref={root} className="route-transition motion-safe:animate-[screen-arrive_160ms_ease-out]" tabIndex={-1} data-screen={location.pathname.split('/')[1] || 'home'}>
    {!home && !isQuiz && run && <div className="note run"><b>{run.title}</b> en curso · {Math.min(run.position + 1, run.total)}/{run.total} <Link className="btn" id="resume" to="/quiz">Continuar</Link></div>}
    {children}
  </div>;
}
