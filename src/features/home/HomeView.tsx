import { CalendarClock, Check, Eye, ListChecks, Map, Play, RotateCcw, ScanSearch, Zap, ClipboardCheck, Layers2, Menu } from 'lucide-react';
import { Link } from 'react-router';
import type { StudyReviewMode } from '../../core/domain/entities.js';
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

function PrimaryStudy({ run, navigate }: {
  run: ActiveStudy;
  navigate(route: string): void;
}) {
  return <section className="home-primary" aria-labelledby="home-start-title">
    <h2 className="section-title" id="home-start-title">Sesión en curso</h2>
    <button className="cta" id="continue" onClick={() => navigate('quiz')}><span><b>Continuar sesión</b><small>{run.title} · pregunta {run.position + 1} de {run.total}</small></span><Icon name="play" /></button>
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
  mixedTopicTest: { title: 'Preguntas variadas de temas vistos', detail: 'Comprueba el temario que has marcado como visto, además del tema prioritario.', route: 'test', icon: 'test' as const },
  failures: { title: 'Revisión de fallos', detail: 'Vuelve sobre preguntas que todavía necesitan refuerzo.', route: 'falladas', icon: 'redo' as const },
  spacedReviews: { title: 'Repasos vencidos', detail: 'Recupera conocimientos según las fechas de repaso guardadas.', route: 'cards', icon: 'redo' as const },
};

const reviewModeLabel = {
  'initial-study': 'Estudio inicial',
  'active-retrieval': 'Comprobación mediante preguntas',
  'selective-reading': 'Relectura selectiva',
  'broad-reading': 'Revisión amplia del temario',
} as const;

function trainingReason(reason: HomeOverview['trainingPlan']['activities'][number]['reason']) {
  const reasons = {
    'new-topic-day': 'Día de introducción de temas.',
    'weak-topics': 'Prioridad basada en los temas con menor dominio estimado.',
    coverage: 'Amplía la cobertura con práctica de temas.',
    'recurring-failures': 'Hay preguntas pendientes de afianzar.',
    'due-reviews': 'Hay tarjetas o preguntas cuya fecha de repaso ya ha llegado.',
    'active-recall': 'Recupera la respuesta antes de volver a consultarla.',
  };
  return reasons[reason] ?? 'Recupera la respuesta antes de volver a consultarla.';
}

function TrainingActivityRows({ overview, activities, onSetReviewMode }: {
  overview: HomeOverview;
  activities: readonly HomeOverview['trainingPlan']['activities'][number][];
  onSetReviewMode?: (topicId: string, mode: StudyReviewMode | null) => void;
}) {
  const trainingDue = overview.trainingDue ?? { questions: overview.due, cards: overview.cardsDue };
  const dueSummary = [
    trainingDue.cards ? `${trainingDue.cards} ${trainingDue.cards === 1 ? 'tarjeta' : 'tarjetas'}` : '',
    trainingDue.questions ? `${trainingDue.questions} ${trainingDue.questions === 1 ? 'pregunta' : 'preguntas'}` : '',
  ].filter(Boolean).join(' y ');
  const session = overview.trainingSession;
  const focusedStep = activities.find(item => item.topicId || item.reviewIntervention);
  const focusTopic = focusedStep?.reviewIntervention?.topicName
    ?? overview.studiedTopicDetails?.find(topic => topic.id === focusedStep?.topicId)?.name;
  const themeLabel = focusedStep?.topicId
    ? `${focusedStep.topicId}${focusTopic ? ` · ${focusTopic}` : ''}`
    : '';
  return <>
    <section className="training-topic-agenda" aria-labelledby="training-topic-agenda-title">
      <h3 id="training-topic-agenda-title">Temas previstos para repasar</h3>
      {focusedStep?.topicId ? <div><b>{themeLabel}</b><p>{focusedStep.reviewIntervention?.explanation ?? 'La práctica de hoy se centra en este tema, dentro de los temas que has marcado como vistos.'}</p></div>
        : <p>La práctica de hoy se limitará a tus {overview.studiedTopics} temas marcados como vistos.</p>}
    </section>
    <ol className="training-progress-rail" aria-label="Progreso del entrenamiento de hoy">{activities.map((item, index) => {
    const copy = activityCopy[item.activity];
    const dueSuffix = item.activity === 'spacedReviews' && dueSummary ? ` ${dueSummary} pendientes.` : '';
    const intervention = item.reviewIntervention;
    const activityTitle = intervention
      ? `${reviewModeLabel[intervention.mode]} · ${intervention.topicName}`
      : copy.title;
    const completed = !!session && index < session.currentIndex;
    const current = !!session && index === session.currentIndex && session.completedAt === null;
    const upcoming = !completed && !current;
    return <li id={`training-${item.activity}`} className={`training-plan-item${completed ? ' is-complete' : ''}${current ? ' is-current' : ''}${upcoming ? ' is-upcoming' : ''}`} key={item.activity} aria-current={current ? 'step' : undefined}>
      <span className="training-step-marker" aria-hidden="true">{completed ? <Check size="1em" strokeWidth={2.2} /> : null}</span>
      <div className="training-plan-step">
      <div className="training-plan-row"><i aria-hidden="true"><Icon name={copy.icon} /></i><span><b>{activityTitle}</b><small><span className="sr">{completed ? 'Completada. ' : current ? 'En curso. ' : 'Pendiente. '}</span>{item.minutes} min · {trainingReason(item.reason)}{dueSuffix}</small></span></div>
      <details className="training-explanation">
        <summary>¿Por qué me toca repasar esto?</summary>
        {item.reviewIntervention ? <div>
          <p><b>{reviewModeLabel[item.reviewIntervention.mode]} · {item.reviewIntervention.topicId} {item.reviewIntervention.topicName}</b></p>
          <p>{item.reviewIntervention.explanation}</p>
          {item.reviewIntervention.evidence.distinctQuestionsAttempted > 0 && <p className="sm">Se han tenido en cuenta {item.reviewIntervention.evidence.distinctQuestionsAttempted} preguntas distintas y sus resultados más recientes. Esto no equivale a medir la retención a largo plazo.</p>}
          {typeof item.reviewIntervention.evidence.questionCoverageOfTarget === 'number' && <p className="sm">La cobertura registrada de preguntas alcanza {item.reviewIntervention.evidence.questionCoverageOfTarget}% del objetivo de cobertura para este tema. Es cobertura del banco, no una fecha de lectura ni una medida de dominio.</p>}
          {item.reviewIntervention.evidence.daysSinceLastQuestionAttempt !== null && <p className="sm">Último intento de una pregunta: hace {item.reviewIntervention.evidence.daysSinceLastQuestionAttempt} días. La app no registra la fecha de lectura del temario.</p>}
          {item.reviewIntervention.mode === 'selective-reading' && !item.reviewIntervention.targets.length && <p className="sm">No hay un apartado enlazado con esos resultados. Tendrás que elegirlo en tu material de estudio; la app no puede identificarlo.</p>}
          {item.reviewIntervention.targets.length > 0 && <ul>{item.reviewIntervention.targets.map(target => <li key={target.id}>{target.title}</li>)}</ul>}
          {item.reviewIntervention.confidence === 'product-rule' && <p className="sm">Criterio de recomendación del producto; no es un umbral pedagógico validado.</p>}
          {onSetReviewMode && <label className="training-review-mode">Cambiar modalidad
            <select aria-label={`Modalidad de repaso para ${item.reviewIntervention.topicName}`} value={item.reviewIntervention.mode} onChange={event => onSetReviewMode(item.reviewIntervention!.topicId, event.target.value === 'automatic' ? null : event.target.value as StudyReviewMode)}>
              <option value="automatic">Usar recomendación automática</option>
              {Object.entries(reviewModeLabel).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
            </select>
          </label>}
          {item.reviewIntervention.mode !== 'active-retrieval' && <p>TAI no incluye el texto del temario. Consulta tus apuntes y <Link to="/temario">abre el tema en la lista del temario</Link> para gestionar tus marcas.</p>}
        </div> : <p>{item.activity === 'mixedTopicTest'
          ? 'Este test mezcla preguntas de todos los temas que has marcado como vistos, además del refuerzo prioritario.'
          : item.activity === 'topicTest' && item.reason === 'new-topic-day'
          ? 'Hoy coincide con el día de introducción configurado en Ajustes. La aplicación no registra qué tema se presenta en la academia, así que no puede asignar uno sin que lo elijas.'
          : trainingReason(item.reason) + (item.activity === 'topicTest' ? ' La comprobación usa preguntas; no hay datos suficientes para recomendar una relectura concreta.' : '')}</p>}
      </details>
      </div>
    </li>;
    })}</ol>
  </>;
}

function TrainingSessionControls({ overview, onStartTraining }: {
  overview: HomeOverview;
  onStartTraining(): void;
}) {
  const session = overview.trainingSession;
  if (!session) return <button className="btn" id="start-training" onClick={onStartTraining}>Empezar entrenamiento de hoy</button>;
  if (session.completedAt !== null) {
    const completedSteps = session.activities.slice(0, session.currentIndex);
    const minutes = completedSteps.reduce((total, step) => total + step.minutes, 0);
    const labels = completedSteps.map(step => activityCopy[step.activity].title).join(', ');
    return <p className="training-session-status" role="status">Entrenamiento completado: {completedSteps.length} {completedSteps.length === 1 ? 'actividad' : 'actividades'} · {minutes} min orientativos ({labels}). El descanso no acumula tareas para mañana.</p>;
  }
  const currentStep = session.activities[session.currentIndex];
  if (!currentStep) return <button className="btn" id="start-training" onClick={onStartTraining}>Empezar entrenamiento de hoy</button>;
  return <>
    <p className="training-session-status" role="status">Actividad {session.currentIndex + 1} de {session.activities.length}: {activityCopy[currentStep.activity].title} · {currentStep.minutes} min orientativos.</p>
    <button className="btn" id="continue-training" onClick={onStartTraining}>{session.currentStartedAt !== null ? 'Continuar actividad' : session.currentIndex > 0 ? 'Continuar con la siguiente actividad' : 'Empezar entrenamiento de hoy'}</button>
  </>;
}

function DailyTraining({ overview, onStartTraining, onSetReviewMode }: {
  overview: HomeOverview;
  onStartTraining(): void;
  onSetReviewMode?: (topicId: string, mode: StudyReviewMode | null) => void;
}) {
  const plan = overview.trainingPlan;
  const activities = overview.trainingSession?.activities ?? plan.activities;
  return <section className="home-training" id="home-training" tabIndex={-1} aria-labelledby="home-training-title">
    <div className="home-domain-heading"><h2 className="section-title" id="home-training-title">Entrenamiento de hoy</h2>
      {!plan.restDay && <span className="sm">{plan.minutes} min orientativos</span>}
    </div>
    {plan.restDay && !overview.trainingSession ? <p>Hoy es día de descanso. No se acumula trabajo para mañana.</p>
      : activities.length ? <>
        <div className="training-session-controls"><TrainingSessionControls overview={overview} onStartTraining={onStartTraining} /></div>
        <TrainingActivityRows overview={overview} activities={activities} onSetReviewMode={onSetReviewMode} />
      </> : overview.studiedTopics === 0
        ? <p>Aún no has marcado temas vistos. <Link to="/temario">Marca los temas que ya has estudiado</Link> para que el entrenamiento use solo esos materiales.</p>
        : <p>No hay contenido pendiente para las modalidades elegidas hoy. El tiempo no se acumula; puedes cambiarlas en Ajustes.</p>}
  </section>;
}

function QuickSessionButton({ overview, access, pending, onQuickSession }: { overview: HomeOverview; access: AccessOverview; pending: ReadonlySet<string>; onQuickSession(): void }) {
  return <button className="cta home-quick-session" id="quick" disabled={pending.has('quick')} onClick={onQuickSession}>{pending.has('quick') ? 'Cargando…' : <><span><b className="ctt">Sesión rápida</b><small>{!access.full ? '5 min · una pregunta de cada tema, distintas cada vez' : `5 min · ${overview.quickCount} preguntas: ${overview.due ? 'tus repasos pendientes (' + overview.due + ') y ' : ''}nuevas de tus temas más débiles`}</small></span><i className="play" aria-hidden="true"><Icon name="play" /></i></>}</button>;
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
  onStartReview(topicIds?: readonly string[]): void;
  onStartTraining(): void;
  onSetTrainingReviewMode?: (topicId: string, mode: StudyReviewMode | null) => void;
  onOpenMenu(): void;
  onLogin(): void;
  onRequestAccess(): void;
}

export function HomeView({ overview, access, run, pending, onNavigate, onQuickSession, onStartReview, onStartTraining, onSetTrainingReviewMode, onOpenMenu, onLogin, onRequestAccess }: HomeViewProps) {
  return <>
    <HomeHeader access={access} overview={overview} onOpenMenu={onOpenMenu} />
    <p className="home-intro">Tu estudio, con perspectiva. Un paso más en tu preparación.</p>
    <QuickSessionButton overview={overview} access={access} pending={pending} onQuickSession={onQuickSession} />
    {access.full && <DailyTraining overview={overview} onStartTraining={onStartTraining} onSetReviewMode={onSetTrainingReviewMode} />}
    <div className={`home-workspace${run ? ' has-active-session' : ''}`}>
      {run && <PrimaryStudy run={run} navigate={onNavigate} />}
      {access.full ? <FullAccessReview overview={overview} pending={pending} navigate={onNavigate} onStartReview={onStartReview} /> : <GuestAccess access={access} pending={pending} onLogin={onLogin} onRequestAccess={onRequestAccess} />}
    </div>
    <HomeMetrics overview={overview} full={access.full} />
    <HomeDomain blocks={overview.blocks} full={access.full} />
    <SyncNote access={access} />
  </>;
}
