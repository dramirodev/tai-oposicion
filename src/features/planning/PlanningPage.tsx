import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarDays, Check, CircleHelp, Clock3, Pause, Play } from 'lucide-react';
import type { TrainingActivity } from '../../core/domain/entities.js';
import type { DailyTrainingSession, TrainingSessionStep } from '../../core/domain/study-training-session.js';
import { needsPaperRecallFollowUp, type PaperRecallAssessment, type PaperRecallRating } from '../../core/domain/paper-recall-assessment.js';
import type { DailyTrainingPlan } from '../../core/domain/study-training-plan.js';
import type { ScheduledStudyActivity, ScheduledStudyActivityKind } from '../../core/domain/study-training-calendar.js';
import { useStudyService, type HomeOverview, type HomeServices, type SettingsSnapshot } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { createHomeController, scopeTrainingRouteToSeenTopics } from '../home/home-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { resolvePlannedActivityAction } from './planning-controller.js';
import { StudyCalendar } from './StudyCalendar.js';

const activityPresentation: Record<TrainingActivity, { title: string; objective: string; instruction: string; resource: string }> = {
  newContent: {
    title: 'Estudio de tema nuevo', objective: 'Avanzar en el temario sin perder el hilo.',
    instruction: 'Estudia el tema en papel. Antes de mirar los apuntes, intenta reconstruir lo que recuerdes; después marca el tema como visto y registra cómo te fue.', resource: 'Temario',
  },
  activeRecall: {
    title: 'Recuperación activa', objective: 'Recordar antes de volver a mirar la respuesta.',
    instruction: 'Intenta responder cada tarjeta sin consultar la solución; después compárala y valora cómo te fue.', resource: 'Tarjetas de repaso',
  },
  topicTest: {
    title: 'Preguntas del tema prioritario', objective: 'Comprobar un tema visto que necesita práctica.',
    instruction: 'Responde el test ya preparado con preguntas del tema señalado. Al terminar, volverás a esta sesión.', resource: 'Test por tema',
  },
  mixedTopicTest: {
    title: 'Preguntas variadas de temas vistos', objective: 'Intercalar la recuperación de varios temas ya estudiados.',
    instruction: 'Responde preguntas variadas, limitadas a los temas que has marcado como vistos.', resource: 'Test variado',
  },
  failures: {
    title: 'Revisión de errores', objective: 'Corregir errores que todavía necesitan práctica.',
    instruction: 'Vuelve a responder preguntas falladas de temas vistos y lee el feedback antes de continuar.', resource: 'Preguntas falladas',
  },
  spacedReviews: {
    title: 'Repasos programados', objective: 'Recuperar tarjetas o preguntas que ya vencieron.',
    instruction: 'Completa el material cuyo repaso está pendiente. Las tarjetas conservan el calendario FSRS existente.', resource: 'Tarjetas o preguntas pendientes',
  },
};

const reasonText: Record<DailyTrainingPlan['activities'][number]['reason'], string> = {
  'active-recall': 'Practica recordar el contenido antes de consultar la respuesta.',
  'new-content-day': 'El enfoque de hoy reserva tiempo para el siguiente tema sin marcar como visto.',
  'new-topic-day': 'Hoy coincide con el día semanal configurado para introducir temas.',
  'weak-topics': 'Prioridad basada en resultados de preguntas o autoevaluaciones de temas vistos; es una regla del producto, no una medida científica de dominio.',
  coverage: 'Amplía la práctica de los temas que has marcado como vistos.',
  'recurring-failures': 'Hay preguntas falladas de temas vistos que aún requieren repaso.',
  'due-reviews': 'Hay tarjetas o preguntas de temas vistos con repaso pendiente.',
};

const focusLabels = { rest: 'Descanso', 'new-content': 'Contenido nuevo', consolidation: 'Recuperación y consolidación' } as const;
const formatMinutes = (seconds: number) => `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ''}`;
const activityCountText = (count: number) => `${count} ${count === 1 ? 'actividad' : 'actividades'}`;
const localDateFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const localDate = (date: Date) => localDateFormatter.format(date);
const historyDateFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

const reviewModeLabels: Record<NonNullable<TrainingSessionStep['reviewMode']>, string> = {
  'active-retrieval': 'comprobar primero qué recuerdas',
  'initial-study': 'estudio inicial',
  'selective-reading': 'revisión selectiva',
  'broad-reading': 'revisión amplia',
};
const recallRatingLabels: Record<PaperRecallRating, string> = {
  remembered: 'Lo recordé', partial: 'Parcialmente', 'not-remembered': 'No lo recordé',
};

function activityState(session: DailyTrainingSession | null, index: number) {
  const completed = !!session && index < session.currentIndex;
  const current = !!session && index === session.currentIndex && session.completedAt === null;
  return {
    completed,
    current,
    label: completed ? 'Completada' : current ? 'En curso' : 'Pendiente',
    className: `planning-activity${completed ? ' is-complete' : ''}${current ? ' is-current' : ''}`,
  };
}

function activityResourcePath(step: TrainingSessionStep): string {
  if (step.activity === 'newContent') return `/temario?topic=${encodeURIComponent(step.topicId ?? '')}&dailyTraining=newContent`;
  if (step.activity === 'activeRecall' || step.activity === 'spacedReviews') return '/cards';
  if (step.activity === 'topicTest' || step.activity === 'mixedTopicTest') return '/test';
  return '/falladas';
}

function useSettingsSnapshot() {
  const settings = useStudyService('settings');
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(() => settings.getSnapshot());
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active) setSnapshot(settings.getSnapshot()); };
    const unsubscribe = settings.subscribe(refresh);
    void settings.load().then(refresh).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, [settings]);
  return snapshot;
}

function PaperRecallPriorityNote({ step, assessment, now }: { step: TrainingSessionStep; assessment?: PaperRecallAssessment; now: number }) {
  if (step.reason !== 'weak-topics' || !assessment || assessment.rating === 'remembered' || !needsPaperRecallFollowUp(assessment, now)) return null;
  return <p className="planning-reason">Tu autoevaluación de recuerdo en papel fue «{recallRatingLabels[assessment.rating]}» el {historyDateFormatter.format(new Date(assessment.ratedAt))}. Es una señal personal; por eso hoy se propone comprobar este tema con preguntas.</p>;
}

function PaperRecallAssessmentControl({ topicId, assessment, onRecord }: {
  topicId: string; assessment?: PaperRecallAssessment; onRecord(topicId: string, rating: PaperRecallRating): void;
}) {
  return <fieldset className="planning-recall-assessment">
    <legend>Después de estudiar en papel y cerrar los apuntes, ¿cuánto recordaste?</legend>
    <div>{([
      ['remembered', 'Lo recordé'], ['partial', 'Parcialmente'], ['not-remembered', 'No lo recordé'],
    ] as const).map(([rating, label]) => <button key={rating} className={`btn sec${assessment?.rating === rating ? ' is-selected' : ''}`} aria-pressed={assessment?.rating === rating} onClick={() => onRecord(topicId, rating)}>{label}</button>)}</div>
    <small>{assessment ? `Autoevaluación guardada · ${historyDateFormatter.format(assessment.ratedAt)}` : 'Es una valoración personal; no se mezcla con tus notas de test.'}</small>
  </fieldset>;
}

function PlanningActivity({ step, index, session, topicName, elapsedSeconds, running, now, recallAssessment, onRecallAssessment }: {
  step: TrainingSessionStep; index: number; session: DailyTrainingSession | null; topicName?: string;
  elapsedSeconds: number; running: boolean; now: number; recallAssessment?: PaperRecallAssessment;
  onRecallAssessment?(topicId: string, rating: PaperRecallRating): void;
}) {
  const presentation = activityPresentation[step.activity];
  const state = activityState(session, index);
  const topic = topicName ? `${step.topicId} · ${topicName}` : step.topicId;
  return <li className={state.className} aria-current={state.current ? 'step' : undefined}>
    <span className="planning-activity-marker" aria-hidden="true">{state.completed ? <Check size="1rem" /> : index + 1}</span>
    <article className="planning-activity-content">
      <div className="planning-activity-heading"><div><p className="planning-activity-type">{state.label}</p><h3>{presentation.title}</h3></div><span className="planning-duration">{step.minutes} min</span></div>
      {topic && <p className="planning-topic">{topic}</p>}
      <p>{presentation.objective}</p>
      <details><summary>Instrucciones y motivo</summary><p>{presentation.instruction}</p>
        {step.reviewMode && <p>Modalidad recomendada: {reviewModeLabels[step.reviewMode]}.</p>}
        <p className="planning-reason">{step.reviewMode ? 'La intervención se conserva desde la recomendación de hoy. ' : ''}{reasonText[step.reason]}</p>
        <PaperRecallPriorityNote step={step} assessment={recallAssessment} now={now} />
      </details>
      {state.current && <div className="planning-activity-timer" role="status" aria-live="off"><Clock3 size="1rem" aria-hidden="true" /> Tiempo en esta actividad: {formatMinutes(elapsedSeconds)} {running ? '· contando' : '· en pausa'}</div>}
      {state.completed && step.activity === 'newContent' && step.topicId && onRecallAssessment && <PaperRecallAssessmentControl topicId={step.topicId} assessment={recallAssessment} onRecord={onRecallAssessment} />}
      <p className="planning-resource">Recurso de TAI: <Link to={activityResourcePath(step)}>{presentation.resource}</Link></p>
    </article>
  </li>;
}

interface PlanningViewModel {
  plan: DailyTrainingPlan;
  session: DailyTrainingSession | null;
  activities: readonly TrainingSessionStep[];
  topicNames: Map<string, string>;
  weekday: number;
  focus: keyof typeof focusLabels;
  title: string;
  purpose: string;
  examDistance: string;
  timeLabel: string;
  recordedTime: string;
  topicCount: number;
  completedCount: number;
  activeIndex: number;
  activeSeconds: number;
  totalElapsed: number;
  progress: number;
  state: 'completed' | 'rest' | 'activities' | 'missing-new-topic' | 'empty';
  emptyMessage: 'no-content' | 'mark-topic' | 'select-introduction-topic';
  actionLabel: string;
}

function buildPlanningViewModel(overview: HomeOverview, settings: SettingsSnapshot, now: Date, clock: number, seenTopics: readonly string[]): PlanningViewModel {
  const plan = overview.trainingPlan;
  const session = overview.trainingSession;
  const activities = session?.activities ?? plan.activities;
  const completedCount = session?.currentIndex ?? 0;
  const activeIndex = session?.currentIndex ?? 0;
  const activeSecondsBase = session?.elapsedSecondsByActivity?.[activeIndex] ?? 0;
  const currentElapsed = session?.currentStartedAt !== null && session?.currentStartedAt !== undefined ? Math.max(0, Math.floor((clock - session.currentStartedAt) / 1000)) : 0;
  const activeSeconds = activeSecondsBase + currentElapsed;
  const totalElapsed = (session?.elapsedSecondsByActivity ?? []).reduce((sum, value) => sum + value, 0) + currentElapsed;
  const topicNames = new Map((overview.studiedTopicDetails ?? []).map(topic => [topic.id, topic.name]));
  if (overview.nextNewTopic) topicNames.set(overview.nextNewTopic.id, overview.nextNewTopic.name);
  const weekday = now.getDay();
  const estimatedExamDays = Math.max(0, Math.ceil((Date.UTC(2027, 5, 30) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000));
  const examDays = overview.daysToExam ?? estimatedExamDays;
  const focus = (settings.training.focusByDay ?? ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'])[weekday];
  const completed = session?.completedAt !== null && session?.completedAt !== undefined;
  const hasPlannedActivities = activities.length > 0;
  const missingNewTopic = !activities.length && !seenTopics.length && plan.activities.some(activity => activity.activity === 'newContent');
  const state: PlanningViewModel['state'] = completed ? 'completed'
    : plan.restDay ? 'rest'
      : hasPlannedActivities ? 'activities'
        : missingNewTopic ? 'missing-new-topic'
          : 'empty';
  const title = completed ? 'Sesión completada' : session && session.currentIndex > 0 ? 'Continúa tu sesión' : 'Mi sesión de hoy';
  const purpose = completed ? 'Has llegado al final de las actividades preparadas para hoy.'
    : plan.restDay ? 'Hoy es descanso. El trabajo pendiente no se acumula.'
      : hasPlannedActivities ? focus === 'consolidation' ? 'Hoy toca recuperar conocimientos y consolidar lo que ya has estudiado.' : 'Hoy avanzarás en el tema nuevo y practicarás el material de temas vistos que necesite revisión.'
        : 'No hay actividades justificadas con la información disponible.';
  const actionLabel = session?.currentStartedAt ? 'Continuar actividad' : session?.currentIndex ? 'Continuar sesión' : 'Comenzar sesión';
  return {
    plan, session, activities, topicNames, weekday, focus, title, purpose,
    examDistance: `${examDays} días · ${overview.daysToExam !== null ? 'fecha objetivo' : 'fecha estimada: 30 jun 2027'}`,
    timeLabel: activities.length ? 'Tiempo previsto' : 'Tiempo disponible',
    recordedTime: session ? formatMinutes(totalElapsed) : 'Aún no iniciado',
    topicCount: new Set(activities.flatMap(step => step.topicIds ?? (step.topicId ? [step.topicId] : []))).size,
    completedCount, activeIndex, activeSeconds, totalElapsed,
    progress: activities.length ? Math.min(100, Math.round(completedCount * 100 / activities.length)) : 0,
    state,
    emptyMessage: !overview.nextNewTopic && focus === 'new-content' ? 'select-introduction-topic'
      : overview.studiedTopics ? 'no-content' : 'mark-topic',
    actionLabel,
  };
}

function usePlanningSessionActions(services: HomeServices, overview: HomeOverview | undefined, navigate: ReturnType<typeof useNavigate>, refresh: () => void) {
  const lifetime = useActionLifetime(services.accountId);
  const [controller] = useState(() => createHomeController(lifetime, services.notify));

  const openActivity = (session: DailyTrainingSession, source: HomeOverview) => {
    const action = resolvePlannedActivityAction(session, [...new Set(services.seenTopics())], source.trainingDue.cards);
    if (action.type === 'none') return;
    if (action.type === 'notify') { services.notify(action.message); return; }
    if (action.type === 'start-review') {
      void controller.runAction('planning-review', () => services.startReview(action.topicIds, 'spacedReviews'));
      return;
    }
    void navigate(action.path);
  };

  const startSession = () => {
    if (!overview) return;
    if (services.getActiveStudy()) {
      services.notify('Termina o continúa primero el test que ya tienes abierto para conservar su avance.');
      return;
    }
    const session = services.startTrainingSession(overview.trainingPlan);
    const started = services.startTrainingActivity() ?? session;
    if (started) openActivity(started, overview);
  };

  const pauseSession = () => { services.pauseTrainingActivity(); refresh(); };
  const recordRecallAssessment = (topicId: string, rating: PaperRecallRating) => {
    if (!services.recordPaperRecall) return;
    if (services.recordPaperRecall(topicId, rating)) refresh();
    else services.notify('No se pudo guardar la autoevaluación en este dispositivo. Comprueba el espacio disponible e inténtalo de nuevo.');
  };
  return { startSession, pauseSession, recordRecallAssessment };
}

function SessionActionArea({ model, activeStudy, onStart, onPause }: {
  model: PlanningViewModel; activeStudy: boolean; onStart(): void; onPause(): void;
}) {
  if (model.state === 'completed') return <p className="planning-session-complete" role="status">Sesión finalizada · {model.completedCount} actividades · {formatMinutes(model.totalElapsed)} registrados.</p>;
  if (model.state === 'rest') return <p className="planning-session-complete">Día de descanso · no se trasladan tareas a mañana.</p>;
  if (model.state === 'activities') return <div className="planning-session-actions">
    <button className="btn" onClick={onStart} disabled={activeStudy}><Play size="1rem" aria-hidden="true" />{model.actionLabel}</button>
    {model.session?.currentStartedAt !== null && model.session?.currentStartedAt !== undefined && <button className="btn sec" onClick={onPause}><Pause size="1rem" aria-hidden="true" />Pausar tiempo</button>}
    <p>Las actividades se abren ya preparadas; al terminar, vuelves aquí para seguir con el paso siguiente.</p>
  </div>;
  if (model.state === 'missing-new-topic') return <p>No se ha podido preparar el siguiente tema. <Link to="/temario">Revisa el temario</Link>.</p>;
  if (model.emptyMessage === 'select-introduction-topic') return <p>Elige el tema que vas a introducir esta semana en <Link to="/settings#training-schedule">Ajustes</Link> para preparar el contenido nuevo.</p>;
  return <p>{model.emptyMessage === 'no-content' ? 'No hay contenido pendiente para las modalidades elegidas.' : <>Primero marca el siguiente tema que vas a estudiar. <Link to="/temario">Abrir temario</Link></>}</p>;
}

function PlanningTodayCard({ model, overview, activeStudy, onStart, onPause }: {
  model: PlanningViewModel; overview: HomeOverview; activeStudy: boolean; onStart(): void; onPause(): void;
}) {
  const { activities } = model;
  return <section className="planning-today" aria-labelledby="planning-today-title">
    <div className="planning-today-main">
      <div className="planning-section-heading"><div><p className="planning-kicker">{focusLabels[model.focus]}</p><h2 id="planning-today-title">{model.title}</h2></div><span className="planning-exam-distance">{model.examDistance}</span></div>
      <p className="planning-purpose">{model.purpose}</p>
      <dl className="planning-facts">
        <div><dt>{model.timeLabel}</dt><dd>{model.plan.minutes} min</dd></div>
        <div><dt>Tiempo registrado</dt><dd>{model.recordedTime}</dd></div>
        <div><dt>Actividades</dt><dd>{activities.length}</dd></div>
        <div><dt>Temas implicados</dt><dd>{model.topicCount}</dd></div>
        <div><dt>Repasos vencidos</dt><dd>{overview.trainingDue.cards + overview.trainingDue.questions}</dd></div>
      </dl>
      <SessionActionArea model={model} activeStudy={activeStudy} onStart={onStart} onPause={onPause} />
      {activities.length > 0 && <div className="planning-progress" aria-label={`Progreso: ${model.completedCount} de ${activities.length} actividades`}><span style={{ width: `${model.progress}%` }} /></div>}
    </div>
  </section>;
}

function PlanningActivityList({ model, assessments, now, onRecallAssessment }: {
  model: PlanningViewModel; assessments: readonly PaperRecallAssessment[];
  now: number;
  onRecallAssessment(topicId: string, rating: PaperRecallRating): void;
}) {
  if (!model.activities.length) return null;
  return <section className="planning-activities" aria-labelledby="planning-activities-title">
    <div className="planning-section-heading"><div><p className="planning-kicker">Orden de trabajo</p><h2 id="planning-activities-title">Pasos de la sesión</h2></div><span>{model.completedCount} de {model.activities.length} completadas</span></div>
    <ol>{model.activities.map((step, index) => <PlanningActivity key={step.activity} step={step} index={index} session={model.session} topicName={step.topicId ? model.topicNames.get(step.topicId) : undefined} elapsedSeconds={index === model.activeIndex ? model.activeSeconds : model.session?.elapsedSecondsByActivity?.[index] ?? 0} running={index === model.activeIndex && model.session?.currentStartedAt !== null && model.session?.currentStartedAt !== undefined} now={now} recallAssessment={assessments.find(item => item.topicId === step.topicId)} onRecallAssessment={onRecallAssessment} />)}</ol>
  </section>;
}

function PlanningEvidence({ overview }: { overview: HomeOverview }) {
  return <section className="planning-evidence" aria-labelledby="planning-evidence-title">
    <div className="planning-section-heading"><div><p className="planning-kicker">Seguimiento sin mezclar medidas</p><h2 id="planning-evidence-title">Qué registra TAI</h2></div><Link to="/stats">Ver progreso</Link></div>
    <div className="planning-evidence-grid"><p><b>Cobertura</b><span>{overview.studiedTopics} de {overview.topicCount} temas marcados como vistos.</span></p><p><b>Resultados de preguntas</b><span>{overview.assessedTopics} temas tienen actividad evaluada; los aciertos no prueban por sí solos recuerdo libre.</span></p><p><b>Recuerdo en papel</b><span>{overview.paperRecallAssessments?.length ?? 0} autoevaluaciones. Son una señal personal, separada de los resultados objetivos.</span></p><p><b>Comprensión</b><span>No se mide directamente todavía; TAI no infiere comprensión de una marca de lectura.</span></p><p><b>Examen</b><span>Los resultados de test y simulacros se muestran por separado en Progreso.</span></p></div>
    <p className="planning-caveat"><CircleHelp size="1rem" aria-hidden="true" /> La lectura de resúmenes y esquemas ocurre con tus materiales externos. TAI no dispone aquí de esos documentos ni registra su lectura; por eso la actividad pide recuperar primero y usar el material solo para corregir lagunas.</p>
  </section>;
}

function PlanningHistory({ overview }: { overview: HomeOverview }) {
  const [showAll, setShowAll] = useState(false);
  const sessions = (overview.trainingHistory ?? []).slice(0, 5);
  const allSessions = overview.trainingHistory ?? [];
  const visibleSessions = showAll ? allSessions : sessions;
  return <section className="planning-history" aria-labelledby="planning-history-title">
    <div className="planning-section-heading"><div><p className="planning-kicker">Seguimiento</p><h2 id="planning-history-title">Sesiones recientes</h2></div></div>
    {allSessions.length ? <>
      <ol id="planning-history-list">{visibleSessions.map(session => {
      const elapsed = session.elapsedSecondsByActivity.reduce((sum, value) => sum + value, 0);
      return <li key={session.id}>
        <div><b>{historyDateFormatter.format(new Date(session.startedAt))}</b><span>{formatMinutes(elapsed)} · {activityCountText(session.activities.length)}</span></div>
        <p>{session.activities.map(activity => activityPresentation[activity.activity].title).join(' · ')}</p>
      </li>;
      })}</ol>
      {allSessions.length > 5 && <button className="planning-history-toggle" type="button" aria-controls="planning-history-list" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>
        {showAll ? 'Mostrar solo las cinco más recientes' : `Mostrar todas las sesiones (${allSessions.length})`}
      </button>}
    </> : <p className="planning-history-empty">Cuando completes una sesión, su duración y actividades aparecerán aquí.</p>}
  </section>;
}

export function PlanningPage() {
  const services = useStudyService('home');
  const authResolved = useSyncExternalStore(services.subscribe, services.authResolved, () => false);
  const [reload, setReload] = useState(0);
  const [, setCalendarRevision] = useState(0);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadOverview() }), [services]);
  const { value: overview, error } = useAccountResource(resource, reload);
  const settings = useSettingsSnapshot();
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  usePageReady(authResolved && (!!overview || !!error));
  const navigate = useNavigate();
  const actions = usePlanningSessionActions(services, overview, navigate, () => setReload(value => value + 1));
  const scheduledActivities = services.scheduledStudyActivities?.() ?? [];

  if (!authResolved || (!overview && !error)) return <PageLoading variant="home" />;
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar la planificación</h2><p>Inténtalo de nuevo. Si no tienes conexión, los datos de la cuenta todavía pueden no estar disponibles en este dispositivo.</p><button className="btn" onClick={() => setReload(value => value + 1)}>Reintentar</button></div>;
  if (!overview) return <PageLoading variant="home" />;

  const now = new Date();
  const model = buildPlanningViewModel(overview, settings, now, clock, services.seenTopics());
  const scheduleActivity = (input: { dateKey:string; activity:ScheduledStudyActivityKind; topicId:string; minutes:number }) => {
    const result = services.scheduleStudyActivity?.(input) ?? { ok:false as const, reason:'storage-failed' as const };
    if (result.ok) setCalendarRevision(value => value + 1);
    return result;
  };
  const rescheduleActivity = (input: { id:string; dateKey:string }) => {
    const result = services.rescheduleStudyActivity?.(input) ?? { ok:false as const, reason:'storage-failed' as const };
    if (result.ok) setCalendarRevision(value => value + 1);
    return result;
  };
  const openScheduledActivity = (activity: ScheduledStudyActivity) => {
    const topic = encodeURIComponent(activity.topicId);
    const route = activity.activity === 'topicTest'
      ? `test?dailyTraining=topicTest&trainingTopics=${topic}&topic=${topic}`
      : `cards?dailyTraining=activeRecall&trainingTopics=${topic}`;
    const scoped = scopeTrainingRouteToSeenTopics(route, services.seenTopics());
    if (!scoped) { services.notify('Ese tema ya no está marcado como visto. Actualiza la agenda antes de iniciar el repaso.'); return; }
    void navigate(`/${scoped}`);
  };
  return <main className="planning-page">
    <header className="planning-header">
      <div><p className="planning-kicker">TAI · Plan de estudio</p><h1>Planificación de estudio</h1><p className="planning-date"><CalendarDays size="1rem" aria-hidden="true" />{localDate(now)}</p></div>
      <Link className="planning-settings-link" to="/settings">Configurar semana</Link>
    </header>
    <PlanningTodayCard model={model} overview={overview} activeStudy={!!services.getActiveStudy()} onStart={actions.startSession} onPause={actions.pauseSession} />
    <PlanningActivityList model={model} assessments={overview.paperRecallAssessments ?? []} now={now.getTime()} onRecallAssessment={actions.recordRecallAssessment} />
    <StudyCalendar preferences={settings.training} weekday={model.weekday} now={now} history={overview.trainingHistory ?? []}
      topics={overview.studiedTopicDetails ?? []} activities={scheduledActivities} onSchedule={scheduleActivity} onReschedule={rescheduleActivity} onOpenActivity={openScheduledActivity} />
    <PlanningHistory overview={overview} />
    <PlanningEvidence overview={overview} />
  </main>;
}
