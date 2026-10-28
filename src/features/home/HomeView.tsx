import { CalendarClock, Eye, ListChecks, Map, Play, RotateCcw, ScanSearch, Zap, ClipboardCheck, Layers2, Menu } from 'lucide-react';
import { Link } from 'react-router';
import type { TrainingActivity } from '../../core/domain/entities.js';
import type { AccessOverview, ActiveStudy, HomeBlock, HomeOverview } from '../../shared/ui/study-services.js';

const icons = {
  test: ClipboardCheck, sim: CalendarClock, card: Layers2, det: ScanSearch,
  lec: Eye, rel: Zap, map: Map, list: ListChecks, play: Play, redo: RotateCcw,
};

type HomeIcon = keyof typeof icons;
function Icon({ name }: { name: HomeIcon }) { const Glyph = icons[name]; return <Glyph size="1.25rem" strokeWidth={1.7} aria-hidden="true" />; }
function Tile({ id, icon, title, subtitle, badge, onClick }: { id: string; icon: HomeIcon; title: string; subtitle: string; badge?: number; onClick(): void }) {
  return <button className="tile" id={id} onClick={onClick}><i aria-hidden="true"><Icon name={icon} /></i>{!!badge && <em className="bdg" aria-label={`${badge} ${badge === 1 ? 'pendiente' : 'pendientes'}`}>{badge}</em>}<span><b>{title}</b><small>{subtitle}</small></span></button>;
}
function Row({ id, icon, title, subtitle, disabled, onClick }: { id: string; icon: HomeIcon; title: string; subtitle: string; disabled?: boolean; onClick(): void }) {
  return <button className="lrow" id={id} disabled={disabled} onClick={onClick}><i aria-hidden="true"><Icon name={icon} /></i><span><b>{title}</b><small>{subtitle}</small></span></button>;
}

function HomeHeader({ access, overview, onOpenMenu }: { access: AccessOverview; overview: HomeOverview; onOpenMenu(): void }) {
  return <><p className="product-brand" translate="no">TAI <span>Preparación de oposiciones</span></p>
    <div className="hhead"><div><h1 id="hola">{access.greeting}</h1><div className="hsub">{overview.daysToExam !== null ? <><b>{overview.daysToExam} {overview.daysToExam === 1 ? 'día' : 'días'}</b> hasta tu fecha objetivo</> : <Link to="/settings">Configurar fecha objetivo</Link>} · {overview.seen} de {overview.total.toLocaleString('es-ES')} preguntas vistas{overview.streak >= 2 ? ` · racha de ${overview.streak} días` : ''}</div></div>
      <button className="iconbtn" id="menu" aria-label="Menú" aria-haspopup="dialog" onClick={onOpenMenu}><Menu size="1.25rem" strokeWidth={1.7} aria-hidden="true" /></button></div>
  </>;
}

function PrimaryStudy({ overview, access, run, pending, navigate, onQuickSession }: {
  overview: HomeOverview; access: AccessOverview; run: ActiveStudy | null; pending: ReadonlySet<string>;
  navigate(route: string): void; onQuickSession(): void;
}) {
  return <section className="home-primary" aria-labelledby="home-start-title"><h2 className="section-title" id="home-start-title">Tu próxima sesión</h2>
    {run && <button className="cta" id="continue" onClick={() => navigate('quiz')}><span><b>Continuar sesión</b><small>{run.title} · pregunta {run.position + 1} de {run.total}</small></span><Icon name="play" /></button>}
    <div className="session-launch"><p className="session-heading">{run ? 'También puedes practicar' : 'Un paso más, pregunta a pregunta'}</p><button className={`cta ${run ? 'secondary-session' : ''}`} id="quick" disabled={pending.has('quick')} onClick={onQuickSession}>{pending.has('quick') ? 'Cargando…' : <><span><b className="ctt">Sesión rápida</b><small>{!access.full ? '5 min · una pregunta de cada tema, distintas cada vez' : `5 min · ${overview.quickCount} preguntas: ${overview.due ? 'tus repasos pendientes (' + overview.due + ') y ' : ''}nuevas de tus temas más débiles`}</small></span><i className="play" aria-hidden="true"><Icon name="play" /></i></>}</button></div>
    {access.full && <div className="tiles"><Tile id="test" icon="test" title="Test" subtitle="por tema" onClick={() => navigate('test')} /><Tile id="sim" icon="sim" title="Simulacros" subtitle="con tiempo" onClick={() => navigate('sim')} /><Tile id="cards" icon="card" title="Tarjetas" subtitle={overview.cardsDue ? `${overview.cardsDue} ${overview.cardsDue === 1 ? 'pendiente' : 'pendientes'}` : 'repaso'} badge={overview.cardsDue} onClick={() => navigate('cards')} /></div>}
    {!overview.answers && <p className="note">Empieza con una sesión rápida; después marca los temas que hayas estudiado y consulta tu progreso.</p>}
  </section>;
}

function FullAccessReview({ overview, pending, navigate, onStartReview }: {
  overview: HomeOverview; pending: ReadonlySet<string>; navigate(route: string): void; onStartReview(): void;
}) {
  return <section className="home-review" aria-labelledby="home-review-title"><h2 className="section-title" id="home-review-title">Retoma y afianza</h2>
    <div className="study-priorities"><Row id="rev" icon="redo" title="Repasar hoy" subtitle={overview.due ? `${overview.due} ${overview.due === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}` : 'No hay preguntas pendientes hoy'} disabled={!overview.due || pending.has('rev')} onClick={onStartReview} /><Row id="falladas" icon="redo" title="Preguntas falladas" subtitle={overview.failures ? `${overview.failures} ${overview.failures === 1 ? 'pregunta por afianzar' : 'preguntas por afianzar'} · tres aciertos seguidos` : 'No hay preguntas falladas'} disabled={!overview.failures} onClick={() => navigate('falladas')} /></div>
    <details className="training-group"><summary>Entrenamientos</summary><div className="tiles"><Tile id="trampas" icon="det" title="Detective" subtitle="de trampas" onClick={() => navigate('trampas')} /><Tile id="lectura" icon="lec" title="Lectura" subtitle={overview.slowCount ? `${overview.slowCount} por velocidad` : 'atenta'} onClick={() => navigate('lectura')} /><Tile id="relam" icon="rel" title="Relámpago" subtitle="una pregunta" onClick={() => navigate('relampago')} /></div></details>
    <div className="lgroup seg2"><Row id="mapa" icon="map" title="Mapa de dominio" subtitle={overview.assessedTopics ? `${overview.weakTopics} por reforzar · ${overview.masteredTopics} dominados` : 'Aparecerá cuando empieces a contestar'} onClick={() => navigate('stats')} /><Row id="temario" icon="list" title="Temas estudiados" subtitle={overview.studiedTopics ? `${overview.studiedTopics} de ${overview.topicCount}` : 'Marca lo que ya has estudiado'} onClick={() => navigate('temario')} /></div>
  </section>;
}

const activityCopy = {
  activeRecall: { title: 'Active Recall', detail: 'Intenta recordar antes de revelar la respuesta.', route: 'cards', icon: 'card' as const },
  topicTest: { title: 'Preguntas de tema', detail: 'Practica un tema nuevo o refuerza los que muestran más dificultad.', route: 'test', icon: 'test' as const },
  failures: { title: 'Revisión de fallos', detail: 'Vuelve sobre preguntas que todavía necesitan refuerzo.', route: 'falladas', icon: 'redo' as const },
  spacedReviews: { title: 'Repasos vencidos', detail: 'Recupera conocimientos según las fechas de repaso guardadas.', route: 'cards', icon: 'redo' as const },
};

function DailyTraining({ overview, onNavigate, onStartReview, onStartTraining, onCompleteActivity }: {
  overview: HomeOverview;
  onNavigate(route: string): void;
  onStartReview(): void;
  onStartTraining(): void;
  onCompleteActivity(activity: TrainingActivity): void;
}) {
  const plan = overview.trainingPlan;
  const session = overview.trainingSession;
  const sessionFinished = !!session && session.completedAt !== null;
  const currentStep = session && !sessionFinished ? session.activities[session.currentIndex] : undefined;
  const completedSteps = sessionFinished ? session.activities.slice(0, session.currentIndex) : [];
  const completedMinutes = completedSteps.reduce((total, step) => total + step.minutes, 0);
  return <section className="home-training" aria-labelledby="home-training-title">
    <div className="home-domain-heading"><h2 className="section-title" id="home-training-title">Entrenamiento de hoy</h2>
      {!plan.restDay && <span className="sm">{plan.minutes} min orientativos</span>}
    </div>
    {plan.restDay ? <p>Hoy es día de descanso. No se acumula trabajo para mañana.</p>
      : plan.activities.length ? <>
        <div className="training-session-controls">
          {sessionFinished ? <p className="training-session-status" role="status">Entrenamiento completado: {completedSteps.length} {completedSteps.length === 1 ? 'actividad' : 'actividades'} · {completedMinutes} min orientativos ({completedSteps.map(step => activityCopy[step.activity].title).join(', ')}). El descanso no acumula tareas para mañana.</p>
            : session && currentStep ? <>
              <p className="training-session-status" role="status">Actividad {session.currentIndex + 1} de {session.activities.length}: {activityCopy[currentStep.activity].title} · {currentStep.minutes} min orientativos.</p>
              <button className="btn" id="continue-training" onClick={onStartTraining}>{session.currentStartedAt === null ? 'Empezar actividad' : 'Continuar actividad'}</button>
              {session.currentStartedAt !== null && <button className="btn sec" id="complete-training-activity" onClick={() => onCompleteActivity(currentStep.activity)}>He terminado esta actividad</button>}
            </> : <button className="btn" id="start-training" onClick={onStartTraining}>Empezar entrenamiento de hoy</button>}
        </div>
        <div className="training-plan-activities">{plan.activities.map(item => {
        const copy = activityCopy[item.activity];
        const rationale = item.reason === 'new-topic-day' ? 'Día de introducción de temas.'
          : item.reason === 'weak-topics' ? 'Prioridad basada en los temas con menor dominio estimado.'
            : item.reason === 'coverage' ? 'Amplía la cobertura con práctica de temas.'
              : item.reason === 'recurring-failures' ? 'Hay preguntas pendientes de afianzar.'
                : item.reason === 'due-reviews' ? 'Hay tarjetas o preguntas cuya fecha de repaso ya ha llegado.'
                  : 'Recupera la respuesta antes de volver a consultarla.';
        const dueSummary = [overview.cardsDue ? `${overview.cardsDue} ${overview.cardsDue === 1 ? 'tarjeta' : 'tarjetas'}` : '', overview.due ? `${overview.due} ${overview.due === 1 ? 'pregunta' : 'preguntas'}` : ''].filter(Boolean).join(' y ');
        const subtitle = `${item.minutes} min orientativos · ${rationale}${item.activity === 'spacedReviews' && dueSummary ? ` ${dueSummary} pendientes.` : ''}`;
        const route = item.activity !== 'topicTest' ? copy.route
          : item.topicId ? `test?topic=${encodeURIComponent(item.topicId)}`
            : item.reason === 'new-topic-day' ? 'test?recommendation=new-topic' : copy.route;
        return <Row key={item.activity} id={`training-${item.activity}`} icon={copy.icon} title={copy.title} subtitle={subtitle} onClick={() => item.activity === 'spacedReviews' && !overview.cardsDue ? onStartReview() : onNavigate(route)} />;
      })}</div></> : <p>No hay contenido pendiente para las modalidades elegidas hoy. El tiempo no se acumula; puedes cambiarlas en Ajustes.</p>}
    <p className="sm">El tiempo es orientativo. Al volver, puedes continuar o confirmar que has terminado el bloque. El avance se conserva en este dispositivo cuando el navegador permite almacenamiento; no se sincroniza entre dispositivos.</p>
  </section>;
}

function GuestAccess({ access, pending, onLogin, onRequestAccess }: {
  access: AccessOverview; pending: ReadonlySet<string>; onLogin(): void; onRequestAccess(): void;
}) {
  return <div className="card guest" id="guest"><h2 className="h3">{!access.signedIn ? 'Sesión sin iniciar' : access.level === 'pendiente' ? 'Acceso pendiente' : 'Solicita acceso completo'}</h2><p>Sin acceso completo solo puedes hacer la sesión rápida de 5 minutos. El resto (test por tema, simulacros, tarjetas, estadísticas…) lo desbloquea el propietario de la app.</p>
    {!access.signedIn ? (access.configured || access.state === 'iniciando' || access.state === 'comprobando sesión…' ? <button className="btn" id="gin" onClick={onLogin}>Entrar con Google</button> : null) : access.level === 'pendiente' ? <p><b>Solicitud enviada.</b> Cuando se apruebe se desbloqueará todo; esta pantalla se actualiza sola.</p> : <button className="btn" id="greq" disabled={pending.has('request')} onClick={onRequestAccess}>{pending.has('request') ? 'Enviando…' : 'Pedir acceso completo'}</button>}
  </div>;
}

function HomeMetrics({ overview, full }: { overview: HomeOverview; full: boolean }) {
  return <dl className="home-metrics" aria-label="Tu preparación">
    <div><dt>Preguntas vistas</dt><dd>{overview.seen.toLocaleString('es-ES')} <small>/ {overview.total.toLocaleString('es-ES')}</small></dd></div>
    <div><dt>Temas estudiados</dt><dd>{overview.studiedTopics} <small>/ {overview.topicCount}</small></dd></div>
    <div><dt>{full ? 'Tarjetas pendientes' : 'Sesiones completadas'}</dt><dd>{full ? overview.cardsDue : overview.completedSessions}</dd></div>
  </dl>;
}
function HomeDomain({ blocks, full }: { blocks: HomeBlock[]; full: boolean }) {
  if (!full) return null;
  return <section className="home-domain" aria-labelledby="home-domain-title"><div className="home-domain-heading"><h2 className="section-title" id="home-domain-title">Tu mapa de dominio</h2><Link to="/stats">Ver progreso →</Link></div><div className="home-blocks">{blocks.map(block => <Link className="home-block" to="/stats" key={block.name}><span>{block.name}</span><small>{block.assessed ? `${block.mastered} de ${block.total} dominados` : 'Sin datos · practica para empezar'}</small></Link>)}</div></section>;
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
  onStartReview(): void;
  onStartTraining(): void;
  onCompleteTrainingActivity(activity: TrainingActivity): void;
  onOpenMenu(): void;
  onLogin(): void;
  onRequestAccess(): void;
}

export function HomeView({ overview, access, run, pending, onNavigate, onQuickSession, onStartReview, onStartTraining, onCompleteTrainingActivity, onOpenMenu, onLogin, onRequestAccess }: HomeViewProps) {
  return <>
    <HomeHeader access={access} overview={overview} onOpenMenu={onOpenMenu} />
    <p className="home-intro">Tu estudio, con perspectiva. Un paso más en tu preparación.</p>
    {access.full && <DailyTraining overview={overview} onNavigate={onNavigate} onStartReview={onStartReview} onStartTraining={onStartTraining} onCompleteActivity={onCompleteTrainingActivity} />}
    <div className="home-workspace"><PrimaryStudy overview={overview} access={access} run={run} pending={pending} navigate={onNavigate} onQuickSession={onQuickSession} />
      {access.full ? <FullAccessReview overview={overview} pending={pending} navigate={onNavigate} onStartReview={onStartReview} /> : <GuestAccess access={access} pending={pending} onLogin={onLogin} onRequestAccess={onRequestAccess} />}
    </div>
    <HomeMetrics overview={overview} full={access.full} />
    <HomeDomain blocks={overview.blocks} full={access.full} />
    <SyncNote access={access} />
  </>;
}
