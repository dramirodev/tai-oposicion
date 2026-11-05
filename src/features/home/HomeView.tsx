import { CalendarClock, Eye, ListChecks, Map, Play, RotateCcw, ScanSearch, Zap, ClipboardCheck, Layers2, Menu } from 'lucide-react';
import { Link } from 'react-router';
import type { AccessOverview, ActiveStudy, HomeBlock, HomeOverview } from '../../shared/ui/study-services.js';

const icons = {
  test: ClipboardCheck, sim: CalendarClock, card: Layers2, det: ScanSearch,
  lec: Eye, rel: Zap, map: Map, list: ListChecks, play: Play, redo: RotateCcw,
};

type HomeIcon = keyof typeof icons;
function Icon({ name, className }: { name: HomeIcon; className?: string }) { const Glyph = icons[name]; return <Glyph className={className} size="1.25rem" strokeWidth={1.7} aria-hidden="true" />; }
function Tile({ id, icon, title, subtitle, badge, onClick }: { id: string; icon: HomeIcon; title: string; subtitle: string; badge?: number; onClick(): void }) {
  return <button className="tile relative flex min-h-0 flex-col items-start justify-start gap-2 rounded-[var(--r-m)] border border-line bg-surface p-3 text-left text-ink [font:inherit] [cursor:pointer] motion-safe:transition-[background-color,border-color] motion-safe:duration-[var(--duration-fast)] active:bg-[var(--sel)]" id={id} onClick={onClick}><i className="flex h-5 w-5 items-center justify-center bg-transparent text-muted [font-style:normal]" aria-hidden="true"><Icon name={icon} className="h-[1.375rem] w-[1.375rem] fill-none stroke-current [stroke-width:1.9] [stroke-linecap:round] [stroke-linejoin:round]" /></i>{!!badge && <em className="bdg absolute right-2 top-2 min-w-[1.375rem] rounded-full bg-[var(--selb)] px-[.4375rem] py-0.5 text-center text-[length:var(--fs-xs)] font-bold not-italic text-[var(--onselb)]" aria-label={`${badge} ${badge === 1 ? 'pendiente' : 'pendientes'}`}>{badge}</em>}<span className="min-w-0 [overflow-wrap:anywhere]"><b className="block text-[length:var(--fs-l)] font-[650]">{title}</b><small className="mt-0.5 block text-[length:var(--fs-s)] leading-[1.5] text-muted">{subtitle}</small></span></button>;
}
function Row({ id, icon, title, subtitle, disabled, onClick, priority = false }: { id: string; icon: HomeIcon; title: string; subtitle: string; disabled?: boolean; priority?: boolean; onClick(): void }) {
  const priorityClasses = priority ? '!items-start !rounded-none !border-0 !border-b !border-line !bg-transparent !px-0 !py-4 last:!border-b-0' : '';
  return <button className={`lrow flex w-full min-h-[4.5rem] items-center gap-4 border-0 border-b border-line bg-transparent px-4 py-3.5 text-left text-ink [font:inherit] [cursor:pointer] active:bg-[var(--sel)] disabled:opacity-100 disabled:bg-[var(--surface-soft)] disabled:text-muted last:border-b-0 ${priorityClasses}`} id={id} disabled={disabled} onClick={onClick}><i className={`flex ${priority ? 'h-10 w-10' : 'h-7 w-7'} flex-none items-center justify-center rounded-[var(--r-m)] bg-transparent text-[length:var(--fs-xl)] text-muted [font-style:normal]`} aria-hidden="true"><Icon name={icon} /></i><span className="min-w-0 [overflow-wrap:anywhere]"><b className="block text-[length:var(--fs-b)] font-semibold">{title}</b><small className="mt-1 block text-[length:var(--fs-s)] leading-[1.5] text-muted">{subtitle}</small></span></button>;
}

function HomeHeader({ access, overview, onOpenMenu }: { access: AccessOverview; overview: HomeOverview; onOpenMenu(): void }) {
  return <><p className="product-brand mb-2 flex flex-wrap items-baseline gap-2.5 font-[750] text-ink navigation:hidden" translate="no">TAI <span className="text-[length:var(--fs-s)] font-normal text-muted">Preparación de oposiciones</span></p>
    <div className="hhead mt-2 mb-4 flex items-start justify-between gap-4 motion-safe:animate-[hero-arrive_320ms_cubic-bezier(.16,1,.3,1)_both]"><div><h1 className="mt-1.5 mb-3 [font:600_var(--fs-h1)/1.25_var(--font-ui)] tracking-[-.035em]" id="hola">{access.greeting}</h1><div className="hsub mt-1.5 max-w-[58ch] text-[length:var(--fs-m)] leading-[1.6] text-muted">{overview.daysToExam !== null ? <><b className="[color:var(--emphasis-ink)]">{overview.daysToExam} {overview.daysToExam === 1 ? 'día' : 'días'}</b> hasta tu fecha objetivo</> : <Link to="/settings">Configurar fecha objetivo</Link>}{overview.streak >= 2 ? ` · racha de ${overview.streak} días` : ''}</div></div>
      <button className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-[var(--r-m)] border border-line bg-[var(--card)] text-[length:var(--fs-xl)] text-ink motion-safe:transition-[transform,background-color,color,border-color] motion-safe:duration-[var(--duration-fast)] active:translate-y-[.0625rem] active:scale-[.985] motion-reduce:transform-none" id="menu" aria-label="Menú" aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll:true }); onOpenMenu(); }}><Menu className="mx-auto block h-6 w-6 fill-none stroke-current [stroke-width:2] [stroke-linecap:round]" size="1.25rem" strokeWidth={1.7} aria-hidden="true" /></button></div>
  </>;
}

function PrimaryStudy({ run, navigate }: {
  run: ActiveStudy;
  navigate(route: string): void;
}) {
  return <section className="home-primary min-w-0 rounded-[var(--r-xl)] border border-line bg-surface p-6 max-[600px]:p-5" aria-labelledby="home-start-title">
    <h2 className="section-title !mb-3.5 !text-[length:var(--fs-m)] !font-[450] !text-muted" id="home-start-title">Sesión en curso</h2>
    <button className="cta mb-3 flex min-h-0 w-full items-center gap-3 rounded-[var(--r-m)] border border-[var(--brand)] bg-brand p-4 text-left text-[var(--on-brand)] [font:inherit] [cursor:pointer] [transition:background-color_var(--duration-standard)]" id="continue" onClick={() => navigate('quiz')}><span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><b className="block text-[length:var(--fs-l)] font-[550]">Continuar sesión</b><small className="mt-1.5 block text-[length:var(--fs-s)] leading-[1.5] [color:inherit]">{run.title} · pregunta {run.position + 1} de {run.total}</small></span><Icon name="play" className="h-6 w-6 shrink-0 fill-none stroke-current [stroke-width:1.8]" /></button>
  </section>;
}

function FullAccessReview({ overview, pending, navigate, onStartReview }: {
  overview: HomeOverview; pending: ReadonlySet<string>; navigate(route: string): void; onStartReview(): void;
}) {
  return <section className="home-review min-w-0" aria-labelledby="home-review-title"><h2 className="section-title" id="home-review-title">Retoma y afianza</h2>
    <div className="study-priorities mb-4 grid grid-cols-1 gap-0 border-y border-line"><Row priority id="rev" icon="redo" title="Repasar hoy" subtitle={overview.due ? `${overview.due} ${overview.due === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}` : 'No hay preguntas pendientes hoy'} disabled={!overview.due || pending.has('rev')} onClick={onStartReview} /><Row priority id="falladas" icon="redo" title="Preguntas falladas" subtitle={overview.failures ? `${overview.failures} ${overview.failures === 1 ? 'pregunta por afianzar' : 'preguntas por afianzar'} · tres aciertos seguidos` : 'No hay preguntas falladas'} disabled={!overview.failures} onClick={() => navigate('falladas')} /></div>
    <details className="training-group mb-4 border-0 border-b border-line rounded-none bg-transparent p-0"><summary className="min-h-12 cursor-pointer px-0 py-4 text-[length:var(--fs-m)] font-semibold">Entrenamientos</summary><div className="tiles mt-0 mb-4 grid grid-cols-2 min-[600px]:grid-cols-3 gap-3"><Tile id="trampas" icon="det" title="Detective" subtitle="de trampas" onClick={() => navigate('trampas')} /><Tile id="lectura" icon="lec" title="Lectura" subtitle={overview.slowCount ? `${overview.slowCount} por velocidad` : 'atenta'} onClick={() => navigate('lectura')} /><Tile id="relam" icon="rel" title="Relámpago" subtitle="una pregunta" onClick={() => navigate('relampago')} /></div></details>
    <div className="lgroup seg2 overflow-visible rounded-none border-0 bg-transparent"><Row id="mapa" icon="map" title="Mapa de dominio" subtitle={overview.assessedTopics ? `${overview.weakTopics} por reforzar · ${overview.masteredTopics} dominados` : 'Aparecerá cuando empieces a contestar'} onClick={() => navigate('stats')} /><Row id="temario" icon="list" title="Temas estudiados" subtitle={overview.studiedTopics ? `${overview.studiedTopics} de ${overview.topicCount}` : 'Marca lo que ya has estudiado'} onClick={() => navigate('temario')} /></div>
  </section>;
}

function QuickSessionButton({ overview, access, pending, onQuickSession }: { overview: HomeOverview; access: AccessOverview; pending: ReadonlySet<string>; onQuickSession(): void }) {
  return <button className="cta home-quick-session mb-5 flex min-h-0 w-full max-w-[30rem] items-center gap-3 rounded-[var(--r-m)] border-0 bg-[var(--cta)] px-[1.125rem] py-3.5 text-left text-[var(--on-cta)] [font:inherit] [cursor:pointer] [transition:background-color_var(--duration-standard)]" id="quick" disabled={pending.has('quick')} onClick={onQuickSession}>{pending.has('quick') ? 'Cargando…' : <><span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><b className="block text-[length:var(--fs-l)] font-[550]">Sesión rápida</b><small className="mt-1.5 block text-[length:var(--fs-s)] leading-[1.5] [color:inherit]">{!access.full ? '5 min · una pregunta de cada tema, distintas cada vez' : `5 min · ${overview.quickCount} preguntas: ${overview.due ? 'tus repasos pendientes (' + overview.due + ') y ' : ''}nuevas de tus temas más débiles`}</small></span><i className="play flex h-6 w-6 flex-none items-center justify-center bg-transparent text-[0]" aria-hidden="true"><Icon name="play" className="h-5 w-5 fill-none stroke-current [stroke-width:1.8]" /></i></>}</button>;
}

function GuestAccess({ access, pending, onLogin, onRequestAccess }: {
  access: AccessOverview; pending: ReadonlySet<string>; onLogin(): void; onRequestAccess(): void;
}) {
  return <div className="card guest" id="guest"><h2 className="h3">{!access.signedIn ? 'Sesión sin iniciar' : access.level === 'pendiente' ? 'Acceso pendiente' : 'Solicita acceso completo'}</h2><p>Sin acceso completo solo puedes hacer la sesión rápida de 5 minutos. El resto (test por tema, simulacros, progreso y entrenamientos…) lo desbloquea el propietario de la app.</p>
    {!access.signedIn ? (access.configured || access.state === 'iniciando' || access.state === 'comprobando sesión…' ? <button className="btn" id="gin" onClick={onLogin}>Entrar con Google</button> : null) : access.level === 'pendiente' ? <p><b>Solicitud enviada.</b> Cuando se apruebe se desbloqueará todo; esta pantalla se actualiza sola.</p> : <button className="btn" id="greq" disabled={pending.has('request')} onClick={onRequestAccess}>{pending.has('request') ? 'Enviando…' : 'Pedir acceso completo'}</button>}
  </div>;
}

function HomeMetrics({ overview }: { overview: HomeOverview }) {
  return <dl className="home-metrics mt-2 mb-7 grid grid-cols-3 gap-0 border-y border-line py-5" aria-label="Tu preparación">
    <div className="min-w-0 border-e border-line px-6 first:ps-0 last:border-e-0 max-[600px]:px-3"><dt className="mb-2 text-[length:var(--fs-s)] text-muted">Preguntas vistas</dt><dd className="m-0 text-[length:var(--fs-stat)] font-[450] leading-[1.3] [font-variant-numeric:tabular-nums] max-[600px]:whitespace-nowrap max-[600px]:text-[1.375rem]">{overview.seen.toLocaleString('es-ES')} <small className="whitespace-nowrap text-[length:var(--fs-m)] max-[600px]:m-0 max-[600px]:inline max-[600px]:text-sm">/ {overview.total.toLocaleString('es-ES')}</small></dd></div>
    <div className="min-w-0 border-e border-line px-6 first:ps-0 last:border-e-0 max-[600px]:px-3"><dt className="mb-2 text-[length:var(--fs-s)] text-muted">Temas estudiados</dt><dd className="m-0 text-[length:var(--fs-stat)] font-[450] leading-[1.3] [font-variant-numeric:tabular-nums] max-[600px]:whitespace-nowrap max-[600px]:text-[1.375rem]">{overview.studiedTopics} <small className="whitespace-nowrap text-[length:var(--fs-m)] max-[600px]:m-0 max-[600px]:inline max-[600px]:text-sm">/ {overview.topicCount}</small></dd></div>
    <div className="min-w-0 border-e border-line px-6 first:ps-0 last:border-e-0 max-[600px]:px-3"><dt className="mb-2 text-[length:var(--fs-s)] text-muted">Sesiones completadas</dt><dd className="m-0 text-[length:var(--fs-stat)] font-[450] leading-[1.3] [font-variant-numeric:tabular-nums] max-[600px]:whitespace-nowrap max-[600px]:text-[1.375rem]">{overview.completedSessions}</dd></div>
  </dl>;
}
function HomeDomain({ blocks, full }: { blocks: HomeBlock[]; full: boolean }) {
  if (!full) return null;
  return <section className="home-domain mb-7" aria-labelledby="home-domain-title"><div className="home-domain-heading mb-3 flex flex-wrap items-center justify-between gap-4"><h2 className="section-title !m-0" id="home-domain-title">Tu mapa de dominio</h2><Link className="inline-flex min-h-11 items-center text-[length:var(--fs-s)]" to="/stats">Ver progreso →</Link></div><div className="home-blocks grid grid-cols-2 gap-x-7 gap-y-0 max-[600px]:grid-cols-1">{blocks.map(block => <Link className="home-block flex flex-col justify-center gap-2 border-t border-line py-[1.125rem] text-[length:var(--fs-m)] text-ink no-underline transition-colors hover:text-[var(--selb)]" to="/stats" key={block.name}><span>{block.name}</span><small className="text-[length:var(--fs-s)]">{block.assessed ? `${block.mastered} de ${block.total} dominados` : 'Sin datos · practica para empezar'}</small></Link>)}</div></section>;
}
function SyncNote({ access }: { access: AccessOverview }) {
  return <div id="syncnote">{access.pendingRequests ? <div className="note"><Link to="/acceso">{access.pendingRequests} {access.pendingRequests === 1 ? 'persona pide' : 'personas piden'} acceso a la app</Link></div> : !access.full ? null : access.state === 'sin sesión' ? <div className="note">Inicia sesión en <Link to="/settings">Ajustes</Link> para sincronizar iPhone e iPad.</div> : access.state === 'sin configurar' ? <div className="note">Firebase aún no está configurado: el progreso se guarda solo en este dispositivo.</div> : null}</div>;
}

export interface HomeViewProps {
  overview: HomeOverview;
  access: AccessOverview;
  run: ActiveStudy | null;
  pending: ReadonlySet<string>;
  onNavigate(route: string): void;
  onQuickSession(): void;
  onStartReview(topicIds?: readonly string[]): void;
  onOpenMenu(): void;
  onLogin(): void;
  onRequestAccess(): void;
}

export function HomeView({ overview, access, run, pending, onNavigate, onQuickSession, onStartReview, onOpenMenu, onLogin, onRequestAccess }: HomeViewProps) {
  return <>
    <HomeHeader access={access} overview={overview} onOpenMenu={onOpenMenu} />
    <HomeMetrics overview={overview} />
    <QuickSessionButton overview={overview} access={access} pending={pending} onQuickSession={onQuickSession} />
    {access.full && <section className="home-planning-shortcut mt-4 mb-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-4 max-[520px]:items-start" aria-labelledby="home-planning-title"><h2 className="section-title !m-0 !flex-[1_1_100%]" id="home-planning-title">Tu estudio de hoy</h2><p className="m-0 flex-[1_1_22rem] text-muted">La sesión preparada, los temas y el calendario semanal están en Planificación.</p><Link className="btn" to="/planificacion">Abrir Planificación de estudio</Link></section>}
    <div className={`home-workspace grid grid-cols-1 items-start gap-6${run ? ' has-active-session min-[840px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] min-[840px]:gap-8' : ''}`}>
      {run && <PrimaryStudy run={run} navigate={onNavigate} />}
      {access.full ? <FullAccessReview overview={overview} pending={pending} navigate={onNavigate} onStartReview={onStartReview} /> : <GuestAccess access={access} pending={pending} onLogin={onLogin} onRequestAccess={onRequestAccess} />}
    </div>
    <HomeDomain blocks={overview.blocks} full={access.full} />
    <SyncNote access={access} />
  </>;
}
