import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useStudyServices } from '../../shared/ui/study-services.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';

const icons: Record<string, ReactNode> = {
  test: <><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></>,
  sim: <><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 2M9.5 3h5" /></>,
  card: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M7 3h10" /></>,
  det: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.5-4.5" /></>,
  lec: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  rel: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  map: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  play: <path d="M8 5v14l11-7z" />, redo: <path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" />,
};
function Icon({ name }: { name: string }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>; }
function Tile({ id, icon, title, subtitle, badge, onClick }: { id: string; icon: string; title: string; subtitle: string; badge?: number; onClick(): void }) {
  return <button className="tile" id={id} onClick={onClick}><i aria-hidden="true"><Icon name={icon} /></i>{!!badge && <em className="bdg" aria-label={`${badge} ${badge === 1 ? 'pendiente' : 'pendientes'}`}>{badge}</em>}<span><b>{title}</b><small>{subtitle}</small></span></button>;
}
function Row({ id, icon, title, subtitle, disabled, onClick }: { id: string; icon: string; title: string; subtitle: string; disabled?: boolean; onClick(): void }) {
  return <button className="lrow" id={id} disabled={disabled} onClick={onClick}><i aria-hidden="true"><Icon name={icon} /></i><span><b>{title}</b><small>{subtitle}</small></span></button>;
}
export function HomePage() {
  const { home: services } = useStudyServices();
  const captureLifetime = useActionLifetime(services.accountId);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadOverview() }), [services]);
  const { value: overview, error } = useAccountResource(resource);
  usePageReady(!!overview || !!error);
  const navigate = useNavigate();
  const busy = useRef(new Set<string>()), [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const runAction = async (id: string, action: () => Promise<unknown>) => {
    if (busy.current.has(id)) return;
    const alive = captureLifetime();
    busy.current.add(id); setPending(new Set(busy.current));
    try { await action(); } catch { if (alive()) services.notify('No se pudo completar la acción. Inténtalo de nuevo.'); }
    finally { busy.current.delete(id); if (alive()) setPending(new Set(busy.current)); }
  };
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar</h2><p>{navigator.onLine === false ? 'Estás sin conexión y esta pantalla necesita datos que aún no están descargados (Ajustes → Uso sin conexión).' : 'Algo ha fallado al cargar los datos. Inténtalo de nuevo; si sigue igual, recarga la app.'}</p><button className="btn" id="retryRoute" onClick={() => void navigate('/home')}>Reintentar</button></div>;
  if (!overview) return <p className="sub loading" role="status">Cargando…</p>;
  const access = services.getAccess(), run = services.getActiveStudy();
  const percent = overview.total ? Math.round(100 * overview.seen / overview.total) : 0;
  const go = (route: string) => () => void navigate('/' + route);
  return <>
    <p className="product-brand" translate="no">TAI <span>Preparación de oposiciones</span></p>
    <div className="hhead"><div><h1 id="hola">{access.greeting}</h1><div className="hsub">{overview.daysToExam !== null ? <><b>{overview.daysToExam} {overview.daysToExam === 1 ? 'día' : 'días'}</b> hasta tu fecha objetivo · <Link to="/settings">Cambiar fecha</Link></> : <Link to="/settings">Configurar fecha objetivo</Link>} · {overview.seen} de {overview.total.toLocaleString('es-ES')} preguntas vistas{overview.streak >= 2 ? ` · racha de ${overview.streak} días` : ''}</div></div>
      <button className="iconbtn" id="menu" aria-label="Menú" aria-haspopup="dialog" onClick={services.openMenu}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button></div>
    <div className="hbar" role="img" aria-label={`${percent} % de las preguntas vistas`}><i style={{ '--progress-from': 0, width: `${Math.max(2, Math.min(100, percent))}%` } as React.CSSProperties} /></div>
    <div className="home-workspace"><section className="home-primary" aria-labelledby="home-start-title"><h2 className="section-title" id="home-start-title">Tu próxima sesión</h2>
      {run && <button className="cta" id="continue" onClick={go('quiz')}><span><b>Continuar sesión</b><small>{run.title} · pregunta {run.position + 1} de {run.total}</small></span><Icon name="play" /></button>}
      <button className="cta" id="quick" disabled={pending.has('quick')} onClick={() => void runAction('quick', services.quickSession)}>{pending.has('quick') ? 'Cargando…' : <><span><b className="ctt">Sesión rápida</b><small>{!access.full ? '5 min · una pregunta de cada tema, distintas cada vez' : `5 min · ${overview.quickCount} preguntas: ${overview.due ? 'tus repasos pendientes (' + overview.due + ') y ' : ''}nuevas de tus temas más débiles`}</small></span><i className="play" aria-hidden="true"><Icon name="play" /></i></>}</button>
      {access.full && <div className="tiles"><Tile id="test" icon="test" title="Test" subtitle="por tema" onClick={go('test')} /><Tile id="sim" icon="sim" title="Simulacros" subtitle="con tiempo" onClick={go('sim')} /><Tile id="cards" icon="card" title="Tarjetas" subtitle={overview.cardsDue ? `${overview.cardsDue} ${overview.cardsDue === 1 ? 'pendiente' : 'pendientes'}` : 'repaso'} badge={overview.cardsDue} onClick={go('cards')} /></div>}
      {!overview.answers && <p className="note">Empieza con una sesión rápida; después marca los temas que hayas estudiado y consulta tu progreso.</p>}
    </section>
    {access.full ? <section className="home-review" aria-labelledby="home-review-title"><h2 className="section-title" id="home-review-title">Retoma y afianza</h2><div className="study-priorities"><Row id="rev" icon="redo" title="Repasar hoy" subtitle={overview.due ? `${overview.due} ${overview.due === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}` : 'No hay preguntas pendientes hoy'} disabled={!overview.due || pending.has('rev')} onClick={() => void runAction('rev', services.startReview)} /><Row id="falladas" icon="redo" title="Preguntas falladas" subtitle={overview.failures ? `${overview.failures} ${overview.failures === 1 ? 'pregunta por afianzar' : 'preguntas por afianzar'} · tres aciertos seguidos` : 'No hay preguntas falladas'} disabled={!overview.failures} onClick={go('falladas')} /></div>
      <details className="training-group"><summary>Entrenamientos</summary><div className="tiles"><Tile id="trampas" icon="det" title="Detective" subtitle="de trampas" onClick={go('trampas')} /><Tile id="lectura" icon="lec" title="Lectura" subtitle={overview.slowCount ? `${overview.slowCount} por velocidad` : 'atenta'} onClick={go('lectura')} /><Tile id="relam" icon="rel" title="Relámpago" subtitle="una pregunta" onClick={go('relampago')} /></div></details>
      <div className="lgroup seg2"><Row id="mapa" icon="map" title="Mapa de dominio" subtitle={overview.assessedTopics ? `${overview.weakTopics} por reforzar · ${overview.masteredTopics} dominados` : 'Aparecerá cuando empieces a contestar'} onClick={go('stats')} /><Row id="temario" icon="list" title="Temas estudiados" subtitle={overview.studiedTopics ? `${overview.studiedTopics} de ${overview.topicCount}` : 'Marca lo que ya has estudiado'} onClick={go('temario')} /></div>
    </section> : <div className="card guest" id="guest"><h2 className="h3">{!access.signedIn ? 'Sesión sin iniciar' : access.level === 'pendiente' ? 'Acceso pendiente' : 'Solicita acceso completo'}</h2><p>Sin acceso completo solo puedes hacer la sesión rápida de 5 minutos. El resto (test por tema, simulacros, tarjetas, estadísticas…) lo desbloquea el propietario de la app.</p>
      {!access.signedIn ? (access.configured || access.state === 'iniciando' || access.state === 'comprobando sesión…' ? <button className="btn" id="gin" onClick={() => void runAction('login', services.login)}>Entrar con Google</button> : null) : access.level === 'pendiente' ? <p><b>Solicitud enviada.</b> Cuando se apruebe se desbloqueará todo; esta pantalla se actualiza sola.</p> : <button className="btn" id="greq" disabled={pending.has('request')} onClick={() => void runAction('request', async () => { if (!await services.requestAccess()) services.notify('No se pudo enviar la solicitud. Inténtalo de nuevo.'); })}>{pending.has('request') ? 'Enviando…' : 'Pedir acceso completo'}</button>}
    </div>}</div>
    <div id="syncnote">{access.pendingRequests ? <div className="note"><Link to="/acceso">{access.pendingRequests} {access.pendingRequests === 1 ? 'persona pide' : 'personas piden'} acceso a la app</Link></div> : !access.full ? null : access.state === 'sin sesión' ? <div className="note">Inicia sesión en <Link to="/settings">Ajustes</Link> para sincronizar iPhone e iPad.</div> : access.state === 'sin configurar' ? <div className="note">Firebase aún no está configurado: el progreso se guarda solo en este dispositivo.</div> : null}</div>
  </>;
}
