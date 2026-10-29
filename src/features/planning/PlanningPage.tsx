import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarDays, Check, CircleHelp, Clock3, Pause, Play } from 'lucide-react';
import type { TrainingActivity } from '../../core/domain/entities.js';
import type { DailyTrainingSession, TrainingSessionStep } from '../../core/domain/study-training-session.js';
import type { DailyTrainingPlan } from '../../core/domain/study-training-plan.js';
import { useStudyService, type HomeOverview, type SettingsSnapshot } from '../../shared/ui/study-services.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { useActionLifetime } from '../../shared/ui/use-action-lifetime.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { createHomeController, scopeTrainingRouteToSeenTopics } from '../home/home-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';

const activityPresentation: Record<TrainingActivity, { title: string; objective: string; instruction: string; resource: string }> = {
  newContent: {
    title: 'Estudio de tema nuevo', objective: 'Avanzar en el temario sin perder el hilo.',
    instruction: 'Estudia el material de este tema fuera de TAI. Después, marca el tema como visto para cerrar este paso.', resource: 'Temario',
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
  'weak-topics': 'Prioridad basada en resultados de temas vistos; es una regla del producto, no una medida científica de dominio.',
  coverage: 'Amplía la práctica de los temas que has marcado como vistos.',
  'recurring-failures': 'Hay preguntas falladas de temas vistos que aún requieren repaso.',
  'due-reviews': 'Hay tarjetas o preguntas de temas vistos con repaso pendiente.',
};

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const focusLabels = { rest: 'Descanso', 'new-content': 'Contenido nuevo', consolidation: 'Recuperación y consolidación' } as const;
const formatMinutes = (seconds: number) => `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ''}`;
const localDate = (date: Date) => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);

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

function PlanningActivity({ step, index, session, topicName, elapsedSeconds, running }: {
  step: TrainingSessionStep; index: number; session: DailyTrainingSession | null; topicName?: string;
  elapsedSeconds: number; running: boolean;
}) {
  const presentation = activityPresentation[step.activity];
  const completed = !!session && index < session.currentIndex;
  const current = !!session && index === session.currentIndex && session.completedAt === null;
  const topic = topicName ? `${step.topicId} · ${topicName}` : step.topicId;
  return <li className={`planning-activity${completed ? ' is-complete' : ''}${current ? ' is-current' : ''}`} aria-current={current ? 'step' : undefined}>
    <span className="planning-activity-marker" aria-hidden="true">{completed ? <Check size="1rem" /> : index + 1}</span>
    <article className="planning-activity-content">
      <div className="planning-activity-heading"><div><p className="planning-activity-type">{completed ? 'Completada' : current ? 'En curso' : 'Pendiente'}</p><h3>{presentation.title}</h3></div><span className="planning-duration">{step.minutes} min</span></div>
      {topic && <p className="planning-topic">{topic}</p>}
      <p>{presentation.objective}</p>
      <details><summary>Instrucciones y motivo</summary><p>{presentation.instruction}</p>
        {step.reviewMode && <p>Modalidad recomendada: {step.reviewMode === 'active-retrieval' ? 'comprobar primero qué recuerdas' : step.reviewMode === 'initial-study' ? 'estudio inicial' : step.reviewMode === 'selective-reading' ? 'revisión selectiva' : 'revisión amplia'}.</p>}
        <p className="planning-reason">{step.reviewMode ? 'La intervención se conserva desde la recomendación de hoy. ' : ''}{reasonText[step.reason]}</p>
      </details>
      {current && <div className="planning-activity-timer" role="status" aria-live="off"><Clock3 size="1rem" aria-hidden="true" /> Tiempo en esta actividad: {formatMinutes(elapsedSeconds)} {running ? '· contando' : '· en pausa'}</div>}
      <p className="planning-resource">Recurso de TAI: {step.activity === 'newContent' ? <Link to={`/temario?topic=${encodeURIComponent(step.topicId ?? '')}&dailyTraining=newContent`}>{presentation.resource}</Link>
        : step.activity === 'activeRecall' || step.activity === 'spacedReviews' ? <Link to="/cards">{presentation.resource}</Link>
          : step.activity === 'topicTest' || step.activity === 'mixedTopicTest' ? <Link to="/test">{presentation.resource}</Link>
            : <Link to="/falladas">{presentation.resource}</Link>}</p>
    </article>
  </li>;
}

function WeekSchedule({ preferences, weekday }: { preferences: SettingsSnapshot['training']; weekday: number }) {
  const focus = preferences.focusByDay ?? ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'];
  return <section className="planning-week" aria-labelledby="planning-week-title">
    <div className="planning-section-heading"><div><p className="planning-kicker">Ritmo semanal</p><h2 id="planning-week-title">Estudio, repaso y descanso</h2></div><Link to="/settings">Ajustar disponibilidad</Link></div>
    <ol>{[1, 2, 3, 4, 5, 6, 0].map(day => <li key={day} className={day === weekday ? 'is-today' : ''} aria-current={day === weekday ? 'date' : undefined}>
      <b>{dayNames[day]}</b><span>{preferences.minutesByDay[day] ? `${preferences.minutesByDay[day]} min` : '0 min'}</span><small>{focusLabels[focus[day]]}{day === preferences.introductionDay ? ' · academia' : ''}</small>
    </li>)}</ol>
    <p className="planning-week-note">El reparto inicial reserva cuatro días para avanzar en contenido, dos para recuperar y consolidar, y el domingo para descansar. Son preferencias editables del producto, no una distribución demostrada como óptima.</p>
  </section>;
}

export function PlanningPage() {
  const services = useStudyService('home');
  const authResolved = useSyncExternalStore(services.subscribe, services.authResolved, () => false);
  const lifetime = useActionLifetime(services.accountId);
  const [reload, setReload] = useState(0);
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
  const [controller] = useState(() => createHomeController(lifetime, services.notify));
  const seenTopics = [...new Set(services.seenTopics())];

  const openActivity = (session: DailyTrainingSession, source: HomeOverview) => {
    if (session.completedAt !== null) return;
    const step = session.activities[session.currentIndex];
    if (!step) return;
    if (step.activity === 'newContent') {
      if (!step.topicId) { services.notify('No se ha encontrado un tema nuevo disponible.'); return; }
      void navigate(`/temario?topic=${encodeURIComponent(step.topicId)}&dailyTraining=newContent`);
      return;
    }
    const available = [...new Set(services.seenTopics())];
    if (!available.length) { services.notify('Marca temas vistos antes de iniciar actividades de recuperación.'); return; }
    const scope = new Set(available);
    const planned = step.topicIds?.filter(id => scope.has(id)) ?? [];
    const oneTopic = step.topicId && scope.has(step.topicId) ? step.topicId : undefined;
    const topics = step.activity === 'topicTest' && oneTopic ? [oneTopic] : planned.length ? planned : available;
    const destinations: Record<Exclude<TrainingActivity, 'newContent'>, string> = {
      activeRecall: 'cards', topicTest: 'test', mixedTopicTest: 'test', failures: 'falladas', spacedReviews: 'cards',
    };
    if (step.activity === 'spacedReviews' && !(source.trainingDue?.cards ?? source.cardsDue)) {
      void controller.runAction('planning-review', () => services.startReview(topics, 'spacedReviews'));
      return;
    }
    const params = new URLSearchParams({ dailyTraining: step.activity, trainingTopics: topics.join(',') });
    if (step.activity === 'topicTest' && oneTopic) params.set('topic', oneTopic);
    const route = scopeTrainingRouteToSeenTopics(`${destinations[step.activity]}?${params.toString()}`, available);
    if (!route) { services.notify('No se encontraron temas vistos válidos para esta actividad.'); return; }
    void navigate(`/${route}`);
  };

  const startSession = () => {
    if (!overview) return;
    if (services.getActiveStudy()) { services.notify('Termina o continúa primero el test que ya tienes abierto para conservar su avance.'); return; }
    const session = services.startTrainingSession(overview.trainingPlan);
    const started = services.startTrainingActivity() ?? session;
    if (started) openActivity(started, overview);
  };
  const pauseSession = () => {
    services.pauseTrainingActivity();
    setReload(value => value + 1);
  };

  if (!authResolved || (!overview && !error)) return <PageLoading variant="home" />;
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar la planificación</h2><p>Inténtalo de nuevo. Si no tienes conexión, los datos de la cuenta todavía pueden no estar disponibles en este dispositivo.</p><button className="btn" onClick={() => setReload(value => value + 1)}>Reintentar</button></div>;
  if (!overview) return <PageLoading variant="home" />;

  const plan = overview.trainingPlan;
  const session = overview.trainingSession;
  const activities = session?.activities ?? plan.activities;
  const focusTopicCount = new Set(activities.flatMap(step => step.topicIds ?? (step.topicId ? [step.topicId] : []))).size;
  const completedCount = session?.currentIndex ?? 0;
  const activeIndex = session?.currentIndex ?? 0;
  const activeSecondsBase = session?.elapsedSecondsByActivity?.[activeIndex] ?? 0;
  const activeSeconds = activeSecondsBase + (session?.currentStartedAt !== null && session?.currentStartedAt !== undefined ? Math.max(0, Math.floor((clock - session.currentStartedAt) / 1000)) : 0);
  const totalElapsed = (session?.elapsedSecondsByActivity ?? []).reduce((sum, value) => sum + value, 0) + (session?.currentStartedAt ? Math.max(0, Math.floor((clock - session.currentStartedAt) / 1000)) : 0);
  const details = new Map((overview.studiedTopicDetails ?? []).map(topic => [topic.id, topic.name]));
  if (overview.nextNewTopic) details.set(overview.nextNewTopic.id, overview.nextNewTopic.name);
  const targetDate = new Date();
  const today = targetDate.getDay();
  const estimatedExamDays = Math.max(0, Math.ceil((Date.UTC(2027, 5, 30) - Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())) / 86_400_000));
  const examDays = overview.daysToExam ?? estimatedExamDays;
  const focus = (settings.training.focusByDay ?? ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'])[today];
  const title = session?.completedAt ? 'Sesión completada' : session && session.currentIndex > 0 ? 'Continúa tu sesión' : 'Mi sesión de hoy';
  const canStartNew = !seenTopics.length && plan.activities.some(activity => activity.activity === 'newContent');
  const progress = activities.length ? Math.min(100, Math.round(completedCount * 100 / activities.length)) : 0;

  return <main className="planning-page">
    <header className="planning-header">
      <div><p className="planning-kicker">TAI · Plan de estudio</p><h1>Planificación de estudio</h1><p className="planning-date"><CalendarDays size="1rem" aria-hidden="true" />{localDate(targetDate)}</p></div>
      <Link className="planning-settings-link" to="/settings">Configurar semana</Link>
    </header>

    <section className="planning-today" aria-labelledby="planning-today-title">
      <div className="planning-today-main">
        <div className="planning-section-heading"><div><p className="planning-kicker">{focusLabels[focus]}</p><h2 id="planning-today-title">{title}</h2></div>
          <span className="planning-exam-distance">{examDays} días · {overview.daysToExam !== null ? 'fecha objetivo' : 'fecha estimada: 30 jun 2027'}</span>
        </div>
        <p className="planning-purpose">{session?.completedAt ? 'Has llegado al final de las actividades preparadas para hoy.' : plan.restDay ? 'Hoy es descanso. El trabajo pendiente no se acumula.' : plan.activities.length ? focus === 'consolidation' ? 'Hoy toca recuperar conocimientos y consolidar lo que ya has estudiado.' : 'Hoy avanzarás en el tema nuevo y practicarás el material de temas vistos que necesite revisión.' : 'No hay actividades justificadas con la información disponible.'}</p>
        <dl className="planning-facts">
          <div><dt>{activities.length ? 'Tiempo previsto' : 'Tiempo disponible'}</dt><dd>{plan.minutes} min</dd></div>
          <div><dt>Tiempo registrado</dt><dd>{session ? formatMinutes(totalElapsed) : 'Aún no iniciado'}</dd></div>
          <div><dt>Actividades</dt><dd>{activities.length}</dd></div>
          <div><dt>Temas implicados</dt><dd>{focusTopicCount}</dd></div>
          <div><dt>Repasos vencidos</dt><dd>{(overview.trainingDue?.cards ?? 0) + (overview.trainingDue?.questions ?? 0)}</dd></div>
        </dl>
        {session?.completedAt ? <p className="planning-session-complete" role="status">Sesión finalizada · {completedCount} actividades · {formatMinutes(totalElapsed)} registrados.</p>
          : !plan.restDay && plan.activities.length ? <div className="planning-session-actions">
            <button className="btn" onClick={startSession} disabled={!!services.getActiveStudy()}><Play size="1rem" aria-hidden="true" />{session?.currentStartedAt ? 'Continuar actividad' : session?.currentIndex ? 'Continuar sesión' : 'Comenzar sesión'}</button>
            {session?.currentStartedAt !== null && session?.currentStartedAt !== undefined && <button className="btn sec" onClick={pauseSession}><Pause size="1rem" aria-hidden="true" />Pausar tiempo</button>}
            <p>Las actividades se abren ya preparadas; al terminar, vuelves aquí para seguir con el paso siguiente.</p>
          </div> : plan.restDay ? <p className="planning-session-complete">Día de descanso · no se trasladan tareas a mañana.</p>
            : canStartNew ? <p>No se ha podido preparar el siguiente tema. <Link to="/temario">Revisa el temario</Link>.</p>
              : <p>{overview.studiedTopics ? 'No hay contenido pendiente para las modalidades elegidas.' : <>Primero marca el siguiente tema que vas a estudiar. <Link to="/temario">Abrir temario</Link></>}</p>}
        {activities.length > 0 && <div className="planning-progress" aria-label={`Progreso: ${completedCount} de ${activities.length} actividades`}><span style={{ width: `${progress}%` }} /></div>}
      </div>
    </section>

    {activities.length > 0 && <section className="planning-activities" aria-labelledby="planning-activities-title">
      <div className="planning-section-heading"><div><p className="planning-kicker">Orden de trabajo</p><h2 id="planning-activities-title">Pasos de la sesión</h2></div><span>{completedCount} de {activities.length} completadas</span></div>
      <ol>{activities.map((step, index) => <PlanningActivity key={`${index}-${step.activity}`} step={step} index={index} session={session} topicName={step.topicId ? details.get(step.topicId) : undefined} elapsedSeconds={index === activeIndex ? activeSeconds : session?.elapsedSecondsByActivity?.[index] ?? 0} running={index === activeIndex && session?.currentStartedAt !== null && session?.currentStartedAt !== undefined} />)}</ol>
    </section>}

    {!session?.completedAt && <WeekSchedule preferences={settings.training} weekday={today} />}

    <section className="planning-evidence" aria-labelledby="planning-evidence-title">
      <div className="planning-section-heading"><div><p className="planning-kicker">Seguimiento sin mezclar medidas</p><h2 id="planning-evidence-title">Qué registra TAI</h2></div><Link to="/stats">Ver progreso</Link></div>
      <div className="planning-evidence-grid"><p><b>Cobertura</b><span>{overview.studiedTopics} de {overview.topicCount} temas marcados como vistos.</span></p><p><b>Resultados de preguntas</b><span>{overview.assessedTopics} temas tienen actividad evaluada; los aciertos no prueban por sí solos recuerdo libre.</span></p><p><b>Comprensión</b><span>No se mide directamente todavía; TAI no infiere comprensión de una marca de lectura.</span></p><p><b>Examen</b><span>Los resultados de test y simulacros se muestran por separado en Progreso.</span></p></div>
      <p className="planning-caveat"><CircleHelp size="1rem" aria-hidden="true" /> La lectura de resúmenes y esquemas ocurre con tus materiales externos. TAI no dispone aquí de esos documentos ni registra su lectura; por eso la actividad pide recuperar primero y usar el material solo para corregir lagunas.</p>
    </section>
  </main>;
}
