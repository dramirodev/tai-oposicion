import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarDays, Check, CircleHelp, Clock3, Pause, Play } from 'lucide-react';
import type { TrainingActivity } from '../../core/domain/entities.js';
import type { DailyTrainingSession, TrainingSessionStep } from '../../core/domain/study-training-session.js';
import { needsPaperRecallFollowUp, type PaperRecallAssessment, type PaperRecallRating } from '../../core/domain/paper-recall-assessment.js';
import type { DailyTrainingPlan } from '../../core/domain/study-training-plan.js';
import type { ScheduledStudyActivity, ScheduledStudyActivityKind } from '../../core/domain/study-training-calendar.js';
import { dailyTrainingPlanFromAgenda, proposeWeeklyAgendaPlan, type WeeklyAgendaItem, type WeeklyAgendaPlanProposal, type WeeklyAgendaRecoveryProposal } from '../../core/domain/study-weekly-agenda.js';
import { useStudyService, type HomeOverview, type HomeServices, type SettingsSnapshot } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { scopeTrainingRouteToSeenTopics } from '../../shared/navigation/training-route.js';
import { createPendingActionController } from '../../shared/ui/pending-action-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { PageMessage } from '../../shared/ui/PageMessage.js';
import { resolvePlannedActivityAction } from './planning-controller.js';
import { StudyCalendar } from './StudyCalendar.js';
import { PlanningHorizon } from './PlanningHorizon.js';
import { buildStudyHorizonSummary } from '../../core/domain/study-planning-horizon.js';

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
  return <p className="planning-reason max-w-[76ch] mt-[.35rem] mb-[.6rem] text-muted">Tu autoevaluación de recuerdo en papel fue «{recallRatingLabels[assessment.rating]}» el {historyDateFormatter.format(new Date(assessment.ratedAt))}. Es una señal personal; por eso hoy se propone comprobar este tema con preguntas.</p>;
}

function PaperRecallAssessmentControl({ topicId, assessment, onRecord }: {
  topicId: string; assessment?: PaperRecallAssessment; onRecord(topicId: string, rating: PaperRecallRating): void;
}) {
  return <fieldset className="planning-recall-assessment my-3 min-w-0 rounded-[var(--r-m)] border border-line p-3">
    <legend className="max-w-full px-1 font-[650]">Después de estudiar en papel y cerrar los apuntes, ¿cuánto recordaste?</legend>
    <div className="flex flex-wrap gap-2">{([
      ['remembered', 'Lo recordé'], ['partial', 'Parcialmente'], ['not-remembered', 'No lo recordé'],
    ] as const).map(([rating, label]) => <button key={rating} className={`btn sec${assessment?.rating === rating ? ' border-brand text-brand [box-shadow:inset_0_0_0_1px_var(--brand)]' : ''}`} aria-pressed={assessment?.rating === rating} onClick={() => onRecord(topicId, rating)}>{label}</button>)}</div>
    <small className="mt-2 block text-muted">{assessment ? `Autoevaluación guardada · ${historyDateFormatter.format(assessment.ratedAt)}` : 'Es una valoración personal; no se mezcla con tus notas de test.'}</small>
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
  return <li className={`${state.className} relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3.5 pb-4 max-[520px]:grid-cols-[1.75rem_minmax(0,1fr)] max-[520px]:gap-2.5`} aria-current={state.current ? 'step' : undefined}>
    <span className={`planning-activity-marker relative z-[1] grid h-8 w-8 place-items-center rounded-full border border-[var(--line-strong,var(--line))] text-muted [background:var(--card)] text-[length:var(--fs-s)] [font-variant-numeric:tabular-nums] max-[600px]:h-7 max-[600px]:w-7${state.completed ? ' border-brand bg-brand text-[var(--on-brand)]' : state.current ? ' border-2 border-brand text-brand' : ''}`} aria-hidden="true">{state.completed ? <Check size="1rem" /> : index + 1}</span>
    <article className="planning-activity-content min-w-0 pt-0.5 pb-4">
      <div className="planning-activity-heading flex items-start justify-between gap-3"><div><p className="planning-activity-type mb-[.15rem] text-muted text-[length:var(--fs-xs)]">{state.label}</p><h3 className="m-0 text-lg leading-[1.35]">{presentation.title}</h3></div><span className="planning-duration flex-none text-muted [font-variant-numeric:tabular-nums]">{step.minutes} min</span></div>
      {topic && <p className="planning-topic my-2 text-muted text-[length:var(--fs-s)]">{topic}</p>}
      <p className="my-2">{presentation.objective}</p>
      <details className="text-[length:var(--fs-s)]"><summary className="min-h-11 inline-flex items-center text-link cursor-pointer underline underline-offset-[.15em]">Instrucciones y motivo</summary><p className="max-w-[76ch] mt-[.35rem] mb-[.6rem]">{presentation.instruction}</p>
        {step.reviewMode && <p className="max-w-[76ch] mt-[.35rem] mb-[.6rem]">Modalidad recomendada: {reviewModeLabels[step.reviewMode]}.</p>}
        <p className="planning-reason max-w-[76ch] mt-[.35rem] mb-[.6rem] text-muted">{step.reviewMode ? 'La intervención se conserva desde la recomendación de hoy. ' : ''}{reasonText[step.reason]}</p>
        <PaperRecallPriorityNote step={step} assessment={recallAssessment} now={now} />
      </details>
      {state.current && <div className="planning-activity-timer my-2 flex items-center gap-[.4rem] text-[length:var(--fs-s)] [font-variant-numeric:tabular-nums]" role="status" aria-live="off"><Clock3 size="1rem" aria-hidden="true" /> Tiempo en esta actividad: {formatMinutes(elapsedSeconds)} {running ? '· contando' : '· en pausa'}</div>}
      {state.completed && step.activity === 'newContent' && step.topicId && onRecallAssessment && <PaperRecallAssessmentControl topicId={step.topicId} assessment={recallAssessment} onRecord={onRecallAssessment} />}
      <p className="planning-resource my-2 text-muted">Recurso de TAI: <Link to={activityResourcePath(step)}>{presentation.resource}</Link></p>
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
  breakRemainingSeconds: number;
  totalElapsed: number;
  progress: number;
  state: 'completed' | 'rest' | 'activities' | 'missing-new-topic' | 'empty';
  emptyMessage: 'no-content' | 'mark-topic' | 'select-introduction-topic' | 'sequence-exhausted';
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
  const breakRemainingSeconds = session?.breakStartedAt != null
    ? Math.max(0, (session.breakDurationMinutes ?? 5) * 60 - Math.floor((clock - session.breakStartedAt) / 1000)) : 0;
  const totalElapsed = (session?.elapsedSecondsByActivity ?? []).reduce((sum, value) => sum + value, 0) + currentElapsed;
  const topicNames = new Map((overview.studiedTopicDetails ?? []).map(topic => [topic.id, topic.name]));
  if (overview.nextNewTopic) topicNames.set(overview.nextNewTopic.id, overview.nextNewTopic.name);
  const weekday = now.getDay();
  const examDays = overview.daysToExam;
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
  const actionLabel = !session ? 'Comenzar sesión' : session.currentStartedAt !== null ? 'Continuar actividad' : session.currentIndex ? 'Continuar sesión' : 'Continuar actividad';
  return {
    plan, session, activities, topicNames, weekday, focus, title, purpose,
    examDistance: examDays === null ? 'Fecha objetivo sin configurar' : `${examDays} días · fecha objetivo`,
    timeLabel: activities.length ? 'Tiempo previsto' : 'Tiempo disponible',
    recordedTime: session ? formatMinutes(totalElapsed) : 'Aún no iniciado',
    topicCount: new Set(activities.flatMap(step => step.topicIds ?? (step.topicId ? [step.topicId] : []))).size,
    completedCount, activeIndex, activeSeconds, breakRemainingSeconds, totalElapsed,
    progress: activities.length ? Math.min(100, Math.round(completedCount * 100 / activities.length)) : 0,
    state,
    emptyMessage: !overview.nextNewTopic && focus === 'new-content' && settings.training.academyTopicOrderIds?.length ? 'sequence-exhausted'
      : !overview.nextNewTopic && focus === 'new-content' ? 'select-introduction-topic'
      : overview.studiedTopics ? 'no-content' : 'mark-topic',
    actionLabel,
  };
}

function usePlanningSessionActions(services: HomeServices, overview: HomeOverview | undefined, navigate: ReturnType<typeof useNavigate>, refresh: () => void) {
  const lifetime = useActionLifetime(services.accountId);
  const [controller] = useState(() => createPendingActionController(lifetime, services.notify));

  const openActivity = (session: DailyTrainingSession, source: HomeOverview) => {
    const currentStep = session.activities[session.currentIndex];
    if (!currentStep) return;
    const sessionId = session.id ?? `training:${session.dateKey}`;
    const reference = { sessionId, activityId: currentStep.id ?? `${sessionId}:activity:${session.currentIndex + 1}` };
    const action = resolvePlannedActivityAction(session, [...new Set(services.seenTopics())], source.trainingDue.cards);
    if (action.type === 'none') return;
    if (action.type === 'notify') { services.notify(action.message); return; }
    if (action.type === 'start-review') {
      void controller.runAction('planning-review', () => services.startReview(action.topicIds, 'spacedReviews', reference));
      return;
    }
    const [path, query = ''] = action.path.split('?');
    const params = new URLSearchParams(query);
    params.set('trainingSessionId', reference.sessionId);
    params.set('trainingActivityId', reference.activityId);
    void navigate(`${path}?${params}`);
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
  const beginBreak = () => { services.beginTrainingBreak(5); refresh(); };
  const endBreak = () => { services.endTrainingBreak(); refresh(); };
  const recordRecallAssessment = (topicId: string, rating: PaperRecallRating) => {
    if (!services.recordPaperRecall) return;
    if (services.recordPaperRecall(topicId, rating)) refresh();
    else services.notify('No se pudo guardar la autoevaluación en este dispositivo. Comprueba el espacio disponible e inténtalo de nuevo.');
  };
  return { startSession, pauseSession, beginBreak, endBreak, recordRecallAssessment };
}

function SessionActionArea({ model, activeStudy, onStart, onPause, onBeginBreak, onEndBreak, focusBlockMinutes }: {
  model: PlanningViewModel; activeStudy: boolean; onStart(): void; onPause(): void; onBeginBreak(): void; onEndBreak(): void; focusBlockMinutes: number;
}) {
  if (model.state === 'completed') return <p className="planning-session-complete my-4" role="status">Sesión finalizada · {model.completedCount} actividades · {formatMinutes(model.totalElapsed)} registrados.</p>;
  if (model.state === 'rest') return <p className="planning-session-complete my-4">Día de descanso · no se trasladan tareas a mañana.</p>;
  if (model.state === 'activities') return <div className="planning-session-actions mt-4 flex flex-wrap items-center gap-2.5">
    {model.session?.breakStartedAt != null ? <><p className="basis-full" role="status">Pausa en curso · {model.breakRemainingSeconds ? `${formatMinutes(model.breakRemainingSeconds)} orientativos` : 'tiempo orientativo cumplido'}. Puedes retomarla cuando quieras; la actividad queda guardada.</p><button className="btn inline-flex items-center justify-center gap-2" onClick={onEndBreak}><Play size="1rem" aria-hidden="true" />Terminar pausa</button></>
      : <><button className="btn inline-flex items-center justify-center gap-2" onClick={onStart} disabled={activeStudy}><Play size="1rem" aria-hidden="true" />{model.actionLabel}</button>
    {model.session?.currentStartedAt !== null && model.session?.currentStartedAt !== undefined && <button className="btn sec inline-flex items-center justify-center gap-2" onClick={onPause}><Pause size="1rem" aria-hidden="true" />Pausar tiempo</button>}
    {model.session?.currentStartedAt !== null && model.session?.currentStartedAt !== undefined && <button className="btn sec inline-flex items-center justify-center gap-2" onClick={onBeginBreak}><Pause size="1rem" aria-hidden="true" />Tomar pausa de 5 min</button>}
    </>}
    {model.activeSeconds >= focusBlockMinutes * 60 && model.session?.breakStartedAt == null && <p className="basis-full text-muted" role="status">Has alcanzado el bloque orientativo de {focusBlockMinutes} min. Puedes pausar y descansar; el bloque se ajusta en Ajustes.</p>}
    <p className="mt-[.15rem] mb-0 flex-[1_1_100%] text-muted text-[length:var(--fs-s)]">Las actividades se abren ya preparadas; al terminar, vuelves aquí para seguir con el paso siguiente.</p>
  </div>;
  if (model.state === 'missing-new-topic') return <p>No se ha podido preparar el siguiente tema. <Link to="/temario">Revisa el temario</Link>.</p>;
  if (model.emptyMessage === 'sequence-exhausted') return <p>Los temas disponibles en tu secuencia ya están marcados como estudiados. Revisa si faltan temas en el <Link to="/settings#training-schedule">orden de academia</Link>; no se elige otro tema por el orden del catálogo.</p>;
  if (model.emptyMessage === 'select-introduction-topic') return <p>Elige el tema que vas a introducir esta semana en <Link to="/settings#training-schedule">Ajustes</Link> para preparar el contenido nuevo.</p>;
  return <p>{model.emptyMessage === 'no-content' ? 'No hay contenido pendiente para las modalidades elegidas.' : <>Primero marca el siguiente tema que vas a estudiar. <Link to="/temario">Abrir temario</Link></>}</p>;
}

function PlanningTodayCard({ model, overview, activeStudy, onStart, onPause, onBeginBreak, onEndBreak, focusBlockMinutes }: {
  model: PlanningViewModel; overview: HomeOverview; activeStudy: boolean; onStart(): void; onPause(): void; onBeginBreak(): void; onEndBreak(): void; focusBlockMinutes: number;
}) {
  const { activities } = model;
  return <section className="planning-today my-5 min-w-0 rounded-[var(--r-xl)] border border-line py-5 px-[clamp(1rem,3vw,1.75rem)] max-[520px]:p-4 [background:var(--card)]" aria-labelledby="planning-today-title">
    <div className="planning-today-main">
      <div className="planning-section-heading flex flex-wrap items-end justify-between gap-x-5 gap-y-3"><div><p className="planning-kicker mb-1 text-muted text-[length:var(--fs-s)]">{focusLabels[model.focus]}</p><h2 className="m-0 text-[clamp(1.25rem,3vw,1.65rem)] tracking-[-.02em]" id="planning-today-title">{model.title}</h2></div><span className="planning-exam-distance text-muted text-[length:var(--fs-s)]">{model.examDistance}</span></div>
      <p className="planning-purpose mt-3.5 mb-4 max-w-[68ch] text-muted">{model.purpose}</p>
      <dl className="planning-facts my-4 grid grid-cols-5 border-y border-line max-[760px]:grid-cols-3 max-[520px]:grid-cols-2">
        <div className="min-w-0 border-e border-line px-3 py-3.5 first:ps-0 last:border-e-0"><dt className="text-muted text-[length:var(--fs-xs)]">{model.timeLabel}</dt><dd className="mt-1 mb-0 text-[clamp(1.1rem,2vw,1.45rem)] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere]">{model.plan.minutes} min</dd></div>
        <div className="min-w-0 border-e border-line px-3 py-3.5 first:ps-0 last:border-e-0"><dt className="text-muted text-[length:var(--fs-xs)]">Tiempo registrado</dt><dd className="mt-1 mb-0 text-[clamp(1.1rem,2vw,1.45rem)] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere]">{model.recordedTime}</dd></div>
        <div className="min-w-0 border-e border-line px-3 py-3.5 first:ps-0 last:border-e-0"><dt className="text-muted text-[length:var(--fs-xs)]">Actividades</dt><dd className="mt-1 mb-0 text-[clamp(1.1rem,2vw,1.45rem)] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere]">{activities.length}</dd></div>
        <div className="min-w-0 border-e border-line px-3 py-3.5 first:ps-0 last:border-e-0"><dt className="text-muted text-[length:var(--fs-xs)]">Temas implicados</dt><dd className="mt-1 mb-0 text-[clamp(1.1rem,2vw,1.45rem)] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere]">{model.topicCount}</dd></div>
        <div className="min-w-0 border-e border-line px-3 py-3.5 first:ps-0 last:border-e-0"><dt className="text-muted text-[length:var(--fs-xs)]">Repasos vencidos</dt><dd className="mt-1 mb-0 text-[clamp(1.1rem,2vw,1.45rem)] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere]">{overview.trainingDue.cards + overview.trainingDue.questions}</dd></div>
      </dl>
      <SessionActionArea model={model} activeStudy={activeStudy} onStart={onStart} onPause={onPause} onBeginBreak={onBeginBreak} onEndBreak={onEndBreak} focusBlockMinutes={focusBlockMinutes} />
      {activities.length > 0 && <div className="planning-progress mt-5 h-[.3rem] overflow-hidden rounded-[99px] bg-[var(--surface-soft)]" aria-label={`Progreso: ${model.completedCount} de ${activities.length} actividades`}><span className="block h-full rounded-[inherit] bg-brand motion-safe:[transition:width_.25s_ease]" style={{ width: `${model.progress}%` }} /></div>}
    </div>
  </section>;
}

function PlanningActivityList({ model, assessments, now, onRecallAssessment }: {
  model: PlanningViewModel; assessments: readonly PaperRecallAssessment[];
  now: number;
  onRecallAssessment(topicId: string, rating: PaperRecallRating): void;
}) {
  if (!model.activities.length) return null;
  return <section className="planning-activities my-5 min-w-0 rounded-[var(--r-xl)] border border-line py-5 px-[clamp(1rem,3vw,1.75rem)] max-[520px]:p-4 [background:var(--card)]" aria-labelledby="planning-activities-title">
    <div className="planning-section-heading flex flex-wrap items-end justify-between gap-x-5 gap-y-3"><div><p className="planning-kicker mb-1 text-muted text-[length:var(--fs-s)]">Orden de trabajo</p><h2 className="m-0 text-[clamp(1.25rem,3vw,1.65rem)] tracking-[-.02em]" id="planning-activities-title">Pasos de la sesión</h2></div><span>{model.completedCount} de {model.activities.length} completadas</span></div>
    <ol className="mt-5 mb-0 grid gap-0 p-0 list-none">{model.activities.map((step, index) => <PlanningActivity key={step.activity} step={step} index={index} session={model.session} topicName={step.topicId ? model.topicNames.get(step.topicId) : undefined} elapsedSeconds={index === model.activeIndex ? model.activeSeconds : model.session?.elapsedSecondsByActivity?.[index] ?? 0} running={index === model.activeIndex && model.session?.currentStartedAt !== null && model.session?.currentStartedAt !== undefined} now={now} recallAssessment={assessments.find(item => item.topicId === step.topicId)} onRecallAssessment={onRecallAssessment} />)}</ol>
  </section>;
}

function PlanningEvidence({ overview }: { overview: HomeOverview }) {
  return <section className="planning-evidence my-5 min-w-0 rounded-[var(--r-xl)] border border-line py-5 px-[clamp(1rem,3vw,1.75rem)] max-[520px]:p-4 [background:var(--card)]" aria-labelledby="planning-evidence-title">
    <div className="planning-section-heading flex flex-wrap items-end justify-between gap-x-5 gap-y-3"><div><p className="planning-kicker mb-1 text-muted text-[length:var(--fs-s)]">Seguimiento sin mezclar medidas</p><h2 className="m-0 text-[clamp(1.25rem,3vw,1.65rem)] tracking-[-.02em]" id="planning-evidence-title">Qué registra TAI</h2></div><Link className="min-h-11 inline-flex items-center gap-1" to="/stats">Ver progreso</Link></div>
    <div className="planning-evidence-grid mt-4 grid grid-cols-4 gap-x-5 gap-y-3 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">{[
      ['Cobertura', `${overview.studiedTopics} de ${overview.topicCount} temas marcados como vistos.`],
      ['Resultados de preguntas', `${overview.assessedTopics} temas tienen actividad evaluada; los aciertos no prueban por sí solos recuerdo libre.`],
      ['Recuerdo en papel', `${overview.paperRecallAssessments?.length ?? 0} autoevaluaciones. Son una señal personal, separada de los resultados objetivos.`],
      ['Comprensión', 'No se mide directamente todavía; TAI no infiere comprensión de una marca de lectura.'],
      ['Examen', 'Los resultados de test y simulacros se muestran por separado en Progreso.'],
    ].map(([label, detail]) => <p className="m-0 grid content-start gap-[.3rem] border-t border-line pt-3" key={label}><b>{label}</b><span className="text-muted text-[length:var(--fs-s)]">{detail}</span></p>)}</div>
    <p className="planning-caveat mt-4 mb-0 flex items-start gap-2 text-muted text-[length:var(--fs-s)]"><CircleHelp className="mt-[.15rem] flex-none" size="1rem" aria-hidden="true" /> La lectura de resúmenes y esquemas ocurre con tus materiales externos. TAI no dispone aquí de esos documentos ni registra su lectura; por eso la actividad pide recuperar primero y usar el material solo para corregir lagunas.</p>
  </section>;
}

function PlanningHistory({ overview }: { overview: HomeOverview }) {
  const [showAll, setShowAll] = useState(false);
  const sessions = (overview.trainingHistory ?? []).slice(0, 5);
  const allSessions = overview.trainingHistory ?? [];
  const visibleSessions = showAll ? allSessions : sessions;
  return <section className="planning-history my-5 min-w-0 rounded-[var(--r-xl)] border border-line py-5 px-[clamp(1rem,3vw,1.75rem)] max-[520px]:p-4 [background:var(--card)]" aria-labelledby="planning-history-title">
    <div className="planning-section-heading flex flex-wrap items-end justify-between gap-x-5 gap-y-3"><div><p className="planning-kicker mb-1 text-muted text-[length:var(--fs-s)]">Seguimiento</p><h2 className="m-0 text-[clamp(1.25rem,3vw,1.65rem)] tracking-[-.02em]" id="planning-history-title">Sesiones recientes</h2></div></div>
    {allSessions.length ? <>
      <ol className="mt-4 mb-0 grid p-0 list-none" id="planning-history-list">{visibleSessions.map(session => {
      const elapsed = session.elapsedSecondsByActivity.reduce((sum, value) => sum + value, 0);
      return <li className="min-w-0 border-t border-line py-3.5" key={session.id}>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><b>{historyDateFormatter.format(new Date(session.startedAt))}</b><span className="text-muted text-[length:var(--fs-s)]">{formatMinutes(elapsed)} · {activityCountText(session.activities.length)}</span></div>
        <p className="mt-[.35rem] mb-0 text-muted text-[length:var(--fs-s)] [overflow-wrap:anywhere]">{session.activities.map(activity => activityPresentation[activity.activity].title).join(' · ')}</p>
      </li>;
      })}</ol>
      {allSessions.length > 5 && <button className="planning-history-toggle min-h-11 mt-2 px-0 py-1.5 border-0 bg-transparent text-link font-semibold cursor-pointer underline underline-offset-[.15em]" type="button" aria-controls="planning-history-list" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>
        {showAll ? 'Mostrar solo las cinco más recientes' : `Mostrar todas las sesiones (${allSessions.length})`}
      </button>}
    </> : <p className="planning-history-empty my-4 text-muted text-[length:var(--fs-s)]">Cuando completes una sesión, su duración y actividades aparecerán aquí.</p>}
  </section>;
}

export function PlanningPage() {
  const services = useStudyService('home');
  const academyProgressService = useStudyService('academyStudyProgress');
  const authResolved = useSyncExternalStore(services.subscribe, services.authResolved, () => false);
  const [reload, setReload] = useState(0);
  const [sectionProgressRetry, setSectionProgressRetry] = useState(0);
  const [, setCalendarRevision] = useState(0);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadOverview() }), [services]);
  const { value: overview, error } = useAccountResource(resource, reload);
  const sectionProgressResource = useMemo(() => ({ accountId:academyProgressService.accountId, subscribe:academyProgressService.subscribe, load:() => academyProgressService.loadProgressOverview() }), [academyProgressService]);
  const { value: sectionProgress, error: sectionProgressError } = useAccountResource(sectionProgressResource, sectionProgressRetry);
  const weeklyAgenda = services.weeklyStudyAgenda?.();
  const seenTopicIds = services.seenTopics();
  const settings = useSettingsSnapshot();
  const [clock, setClock] = useState(() => Date.now()); // con 0, el cronómetro de una actividad en curso mostraba 0 s hasta el primer tick
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  usePageReady(authResolved && (!!overview || !!error));
  const navigate = useNavigate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const planningOverview = overview && weeklyAgenda ? {
    ...overview,
    trainingPlan: dailyTrainingPlanFromAgenda({ plan:overview.trainingPlan, agenda:weeklyAgenda, dateKey:todayKey, studiedTopicIds:seenTopicIds }),
  } : overview;
  const actions = usePlanningSessionActions(services, planningOverview, navigate, () => setReload(value => value + 1));
  const scheduledActivities = services.scheduledStudyActivities?.() ?? [];
  if (!authResolved || (!overview && !error)) return <PageLoading variant="home" />;
  if (error) return <PageMessage role="alert" title="No se pudo cargar la planificación"><p>Inténtalo de nuevo. Si no tienes conexión, los datos de la cuenta todavía pueden no estar disponibles en este dispositivo.</p><button className="btn" onClick={() => setReload(value => value + 1)}>Reintentar</button></PageMessage>;
  if (!planningOverview) return <PageLoading variant="home" />;

  const now = today;
  const model = buildPlanningViewModel(planningOverview, settings, now, clock, seenTopicIds);
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
  const saveWeeklyAgenda = (weekStart: string, items: readonly WeeklyAgendaItem[]) => {
    const saved = services.replaceWeeklyStudyAgendaWeek?.(weekStart, items);
    if (!saved) { services.notify('No se pudo guardar la agenda semanal en este dispositivo.'); return false; }
    setCalendarRevision(value => value + 1);
    setReload(value => value + 1);
    return true;
  };
  const recoverWeeklyAgenda = (proposal: WeeklyAgendaRecoveryProposal) => {
    const saved = services.recoverWeeklyStudyAgenda?.(proposal);
    if (!saved) return false;
    setCalendarRevision(value => value + 1);
    setReload(value => value + 1);
    return true;
  };
  const generateWeeklyAgendaPlan = (weekStart: string) => {
    if (!weeklyAgenda || !planningOverview) return null;
    return proposeWeeklyAgendaPlan({
      agenda:weeklyAgenda, targetWeekStart:weekStart, todayKey, preferences:settings.training,
      catalogTopics:(settings.index?.topics ?? []).map(topic => ({ id:topic.id, name:topic.name })),
      studiedTopicIds:seenTopicIds, dueCount:planningOverview.trainingDue.questions, cardDueCount:planningOverview.trainingDue.cards,
      failureCount:planningOverview.trainingFailures ?? 0, weakTopicCount:planningOverview.weakTopics, weakTopicIds:planningOverview.weakTopicIds ?? [],
      topicReviewEvidence:planningOverview.topicReviewEvidence ?? [], scheduledActivities, contentInventory:planningOverview.studyContentInventory,
      horizonCapacityGap:buildStudyHorizonSummary({
        todayDateKey:todayKey, targetDate:settings.exam, academyTopicOrderIds:settings.training.academyTopicOrderIds,
        catalogTopicIds:(settings.index?.topics ?? []).map(topic => topic.id), studiedTopicIds:seenTopicIds, preferences:settings.training,
        plannedNewContentItems:weeklyAgenda.items.filter(item => item.kind === 'newContent'),
      }).topicSessionGap,
    });
  };
  const addWeeklyAgendaPlan = (proposal: WeeklyAgendaPlanProposal) => {
    const saved = services.addWeeklyStudyAgendaPlan?.(proposal);
    if (!saved) return false;
    setCalendarRevision(value => value + 1);
    setReload(value => value + 1);
    return true;
  };
  const setWeeklyAgendaStatus = (id: string, status: 'completed' | 'skipped') => {
    const saved = services.setWeeklyStudyAgendaItemStatus?.(id, status);
    if (!saved) return false;
    setCalendarRevision(value => value + 1);
    return true;
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
  return <main className="planning-page mx-auto w-full max-w-[68rem] pt-6 pb-12 max-[520px]:pt-4">
    <header className="planning-header mb-6 flex items-start justify-between gap-4 max-[520px]:flex-col">
      <div><p className="planning-kicker mb-1 text-muted text-[length:var(--fs-s)]">TAI · Plan de estudio</p><h1 className="mt-0.5 mb-2 text-[clamp(1.5rem,3vw,2rem)] tracking-[-.035em]">Planificación de estudio</h1><p className="planning-date m-0 flex items-center gap-2 text-muted"><CalendarDays size="1rem" aria-hidden="true" />{localDate(now)}</p></div>
      <Link className="planning-settings-link min-h-11 inline-flex flex-none items-center max-[520px]:self-start" to="/settings">Configurar semana</Link>
    </header>
    <PlanningHorizon targetDate={settings.exam} today={now} preferences={settings.training}
      catalogTopicIds={settings.index?.topics?.map(topic => topic.id) ?? []} studiedTopicIds={seenTopicIds} weeklyItems={weeklyAgenda?.items ?? []}
      sectionProgress={sectionProgress} sectionProgressError={!!sectionProgressError} onRetrySectionProgress={() => setSectionProgressRetry(value => value + 1)} />
    <PlanningTodayCard model={model} overview={planningOverview} activeStudy={!!services.getActiveStudy()} onStart={actions.startSession} onPause={actions.pauseSession}
      onBeginBreak={actions.beginBreak} onEndBreak={actions.endBreak} focusBlockMinutes={settings.training.focusBlockMinutes ?? 35} />
    <PlanningActivityList model={model} assessments={planningOverview.paperRecallAssessments ?? []} now={now.getTime()} onRecallAssessment={actions.recordRecallAssessment} />
    <StudyCalendar preferences={settings.training} now={now} history={planningOverview.trainingHistory ?? []} activeSession={planningOverview.trainingSession}
      topics={planningOverview.studiedTopicDetails ?? []} catalogTopics={settings.index?.topics?.map(topic => ({ id:topic.id, name:topic.name })) ?? []} seenTopicIds={seenTopicIds}
      activities={scheduledActivities} weeklyItems={weeklyAgenda?.items ?? []} weeklyAgenda={weeklyAgenda} onSchedule={scheduleActivity} onReschedule={rescheduleActivity} onOpenActivity={openScheduledActivity}
      onSaveWeeklyAgenda={saveWeeklyAgenda} onRecoverWeeklyAgenda={recoverWeeklyAgenda} onProposeWeeklyAgenda={generateWeeklyAgendaPlan} onAddWeeklyAgendaPlan={addWeeklyAgendaPlan} onSetWeeklyAgendaStatus={setWeeklyAgendaStatus} />
    <PlanningHistory overview={planningOverview} />
    <PlanningEvidence overview={planningOverview} />
  </main>;
}
