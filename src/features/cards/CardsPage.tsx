import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleHelp, Trash2, TriangleAlert } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ERROR_REPORT_REASONS } from '../../shared/presentation/study-labels.js';
import { isStudyTopicId } from '../../core/domain/topic-id.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { richHtml } from '../../shared/presentation/study-text.js';
import { useStudyService, type CardsServices, type CardPreferences, type CardsPlan, type StudyCard } from '../../shared/ui/study-services.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { PageMessage } from '../../shared/ui/PageMessage.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';
import { StudyQuestionSources } from '../../shared/ui/StudyQuestionSources.js';
import { StudyProgressBar } from '../../shared/ui/StudyProgressBar.js';
import { StudyExitButton } from '../../shared/ui/StudyExitButton.js';
import { resolveCardsPageState } from './cards-page-state.js';

const gradeLabels = ['Fallé', 'Dudaba', 'Lo sabía'] as const;
const reasons = ERROR_REPORT_REASONS;
function Notice({ card }: { card: StudyCard }) {
  const fallback = questionNotice({ n: card.nota, np: card.np, i: card.id.startsWith('FC-Q-') ? card.id.slice(5) : undefined });
  const html = card.np === 1 ? fallback : card.editorialNotice ?? fallback;
  return <StudyQuestionSources noticeHtml={html} languageContext={card.q} />;
}

function CardReport({ card, services }: { card: StudyCard; services: CardsServices }) {
  const initial = services.getReport(card.id);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(initial?.motivo || reasons[0]);
  const [note, setNote] = useState(initial?.nota || '');
  const [saved, setSaved] = useState(initial?.st === 'abierto');
  const save = () => { services.saveReport(card, reason, note.trim()); setSaved(true); setEditing(false); };
  if (!editing) return saved
    ? <span className="rep ok text-[length:var(--fs-m)] text-[var(--good-ink)]"><Check size="1em" aria-hidden="true" /> Error anotado <button className="ghost ghost-small" data-rep onClick={() => setEditing(true)}>editar</button></span>
    : <button className="ghost ghost-compact" data-rep onClick={() => setEditing(true)}><TriangleAlert size="1em" aria-hidden="true" /> Avisar de error</button>;
  return <div className="repf mt-2 flex flex-col gap-2">
    <select className="font-[inherit] rounded-[var(--r-m)] border-[1.5px] border-line bg-surface p-2.5 text-[length:var(--fs-b)] text-ink" aria-label="Motivo del error" value={reason} onChange={event => setReason(event.target.value)}>
      {reasons.map(item => <option key={item}>{item}</option>)}
    </select>
    <input className="font-[inherit] rounded-[var(--r-m)] border-[1.5px] border-line bg-surface p-2.5 text-[length:var(--fs-b)] text-ink" aria-label="Qué falla" maxLength={300} placeholder="Qué falla (opcional)" value={note} onChange={event => setNote(event.target.value)} />
    <div className="row"><button className="btn !min-h-[2.625rem] !px-4 !py-2.5 !text-[length:var(--fs-b)]" onClick={save}>Guardar</button><button className="btn sec !min-h-[2.625rem] !px-4 !py-2.5 !text-[length:var(--fs-b)]" onClick={() => setEditing(false)}>Cancelar</button></div>
  </div>;
}

function CompletedSession({ services, onExit, onComplete, headingRef, dailyTraining = false }: {
  services: CardsServices;
  onExit(): void;
  onComplete(): void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  dailyTraining?: boolean;
}) {
  const session = services.getSession();
  if (!session) return null;
  const [failed, unsure, known] = session.results, count = failed + unsure + known;
  const nextDue = getNextDueDate(services);
  return <>
    <h1 ref={headingRef} tabIndex={-1}>Sesión terminada</h1>
    <div className="stats-grid"><div className="stat"><b>{known}</b><span>lo sabía</span></div><div className="stat"><b>{unsure}</b><span>dudaba</span></div><div className="stat"><b>{failed}</b><span>fallé</span></div><div className="stat"><b>{count ? Math.round(known * 100 / count) : 0}%</b><span>de tarjetas valoradas como «lo sabía»</span></div></div>
    <p className="sub">{failed + unsure ? 'Las valoraciones se han usado para calcular el siguiente repaso.' : '¡Todas recordadas!'}{nextDue ? ` Próximo repaso: ${nextDue.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}.` : ''}</p>
    {dailyTraining ? <button className="btn" id="otra" onClick={onComplete}>Continuar con el entrenamiento</button> : <button className="btn" id="otra" onClick={onComplete}>Otra sesión</button>} <button className="btn sec" id="ini" onClick={onExit}>Inicio</button>
  </>;
}

function cardKeyboardAction(event: KeyboardEvent, session: ReturnType<CardsServices['getSession']>): 'reveal' | number | null {
  const target = event.target as HTMLElement;
  if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return null;
  if (target.closest('button,a,[role="button"]') || !session) return null;
  if (!session.revealed && (event.key === ' ' || event.key === 'Enter')) return 'reveal';
  if (session.revealed && (event.key === '1' || event.key === 'ArrowLeft')) return 0;
  if (session.revealed && event.key === '2') return 1;
  if (session.revealed && (event.key === '3' || event.key === 'ArrowRight')) return 2;
  return null;
}

function swipeStart(event: React.TouchEvent<HTMLElement>): [number, number] | null {
  const touch = event.touches[0];
  const target = event.target as HTMLElement;
  const insideCard = touch.clientX > 24 && touch.clientX < innerWidth - 24;
  const notControl = !target.closest('button,details,input,textarea');
  return event.touches.length === 1 && insideCard && notControl ? [touch.clientX, touch.clientY] : null;
}

function swipeGrade(start: [number, number] | null, event: React.TouchEvent<HTMLElement>): number | null {
  if (!start) return null;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - start[0], dy = touch.clientY - start[1];
  return Math.abs(dx) >= 70 && Math.abs(dx) >= Math.abs(dy) * 1.6 && Math.abs(dy) <= 90 ? dx < 0 ? 0 : 2 : null;
}

function ActiveCardSession({ services, session, card, answerRef, headingRef, onExit, grade, show, onTouchStart, onTouchEnd, refresh }: {
  services: CardsServices;
  session: NonNullable<ReturnType<CardsServices['getSession']>>;
  card: StudyCard;
  answerRef: React.RefObject<HTMLDivElement | null>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onExit(): void;
  grade(value: number): void;
  show(): void;
  onTouchStart(event: React.TouchEvent<HTMLElement>): void;
  onTouchEnd(event: React.TouchEvent<HTMLElement>): void;
  refresh(update: (value: number) => number): void;
}) {
  const total = session.items.length;
  const question: Record<string, unknown> = { source: card.source, u: card.ref, i: card.id };
  const source = sourceHtml(question as never);
  const percent = Math.round(100 * session.index / total);
  return <>
    <h1 className="sr" ref={headingRef} tabIndex={-1}>Tarjetas · tarjeta {session.index + 1} de {total}</h1>
    <div className="qhead sticky top-[calc(var(--sat)/var(--z,1))] z-[3] mb-4 flex items-center gap-4 border-b-0 bg-canvas py-3"><StudyExitButton className="ghost h-12 w-12 flex-none rounded-[var(--r-m)] border border-line bg-[var(--card)] p-0 text-[length:var(--fs-xl)] text-ink" id="exit" onExit={onExit} /><StudyProgressBar trackClassName="prog min-w-0 h-[.375rem] flex-1 overflow-hidden rounded-full bg-line" percent={percent} valueNow={session.index} valueMax={total} /><div className="cnt min-w-11 text-right text-[length:var(--fs-m)] font-semibold text-muted">{session.index + 1}/{total}</div></div>
    <div className="card q fc min-h-80 flex flex-col cursor-pointer leading-[1.65]" id="fc" role="group" aria-label="Pregunta de la tarjeta" tabIndex={0} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      onClick={event => { if (!session.revealed && !(event.target as HTMLElement).closest('button,a,details,input,select,textarea')) show(); }}
      onKeyDown={event => { if (!session.revealed && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); show(); } }}>
      <div className="meta"><span className="tag">{card.t} · {services.topicName(card.t)}</span>{card.tipo && <span className="tag">{card.tipo}</span>}{card.caduca && <span className="tag warn">Puede caducar</span>}</div>
      <Notice card={card} />
      {card.supTexto && <details className="sup"><summary>Enunciado del supuesto</summary><div className="pre"><StudyMarkup html={richHtml(card.supTexto)} languageContext={card.q} /></div></details>}
      {card.cp && <div className="ctx pre"><StudyMarkup html={richHtml(card.cp)} languageContext={card.q} /></div>}
      <div className="enun pre mt-4 mb-6 text-[length:var(--fs-xl)] leading-[1.65]"><StudyMarkup html={richHtml(card.q)} languageContext={card.q} /></div>
      {session.revealed ? <div ref={answerRef} className="card-answer mt-1.5 p-5 rounded-md bg-[color:var(--okbg)] border border-[color:var(--good-line)]" role="region" aria-label="Respuesta de la tarjeta" tabIndex={-1}><small className="block normal-case tracking-normal text-[length:var(--fs-xs)] !text-[color:var(--good-ink)] mb-1 !font-semibold">Respuesta</small><div className="pre text-[length:var(--fs-xl)] font-medium leading-[1.6]"><StudyMarkup html={richHtml(card.a)} languageContext={card.q} /></div>
        {card.nota && <div className="cita"><span>Nota</span><StudyMarkup html={richHtml(card.nota)} languageContext={card.q} /></div>}
        {card.ref && <div className="cita"><span>Temario</span><StudyMarkup html={richHtml(card.ref)} languageContext={card.q} /></div>}
        <StudyQuestionSources sourceHtml={source} languageContext={card.q} />
        <div className="repw" id="crep"><CardReport card={card} services={services} /></div>
        {card.src === 'fallo' && <button className="ghost ghost-compact" id="quit" onClick={event => { event.stopPropagation(); services.removeFailureCard(); refresh(value => value + 1); }}><Trash2 size="1em" aria-hidden="true" /> Quitar esta tarjeta</button>}
      </div> : <div className="fh mt-auto text-center text-[color:var(--mute)] text-[length:var(--fs-m)] py-3">Toca para ver la respuesta</div>}
    </div>
    <div className="bar2">{session.revealed ? gradeLabels.map((label, gradeValue) => <button key={label} className={`btn ${gradeValue === 0 ? 'bad' : gradeValue === 1 ? 'sec' : ''}`} data-g={gradeValue} onClick={() => grade(gradeValue)}>{label}<small>{services.reviewLabel(card.id, gradeValue)}</small></button>) : <button className="btn" id="show" onClick={show}>Mostrar respuesta</button>}</div>
    {session.revealed && <p className="sub fgl text-center !mt-4 !mb-0">Teclado 1·2·3 · deslizar ← Fallé · → Lo sabía</p>}
  </>;
}

function CardSession({ services, onExit, onComplete, onActivityFinished, dailyTraining = false }: { services: CardsServices; onExit(): void; onComplete(): void; onActivityFinished?(): void; dailyTraining?: boolean }) {
  const [, refresh] = useState(0);
  const session = services.getSession();
  const touchStart = useRef<[number, number] | null>(null);
  const activityFinished = useRef(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const card = session?.items[session.index];
  const total = session?.items.length || 0;
  const done = !!session && session.index >= total;

  useLayoutEffect(() => {
    if (!session?.revealed) return;
    answerRef.current?.focus({ preventScroll: true });
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const reveal = () => answerRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    requestAnimationFrame(reveal);
  }, [session?.revealed, session?.index]);

  useEffect(() => {
    if (!dailyTraining || !done || activityFinished.current) return;
    activityFinished.current = true;
    onActivityFinished?.();
  }, [dailyTraining, done, onActivityFinished]);

  function grade(value: number) {
    const next = services.grade(value);
    if (next) { refresh(current => current + 1); window.scrollTo(0, 0); }
  }

  useLayoutEffect(() => {
    if (!session?.revealed) headingRef.current?.focus({ preventScroll: true });
  }, [session?.revealed, session?.index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = services.getSession();
      const action = cardKeyboardAction(event, current);
      if (action === 'reveal') { event.preventDefault(); services.reveal(); refresh(value => value + 1); }
      else if (typeof action === 'number') { event.preventDefault(); grade(action); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const show = () => { if (services.reveal()) refresh(value => value + 1); };
  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStart.current = swipeStart(event);
  };
  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (!session?.revealed) return;
    const gradeValue = swipeGrade(touchStart.current, event);
    touchStart.current = null;
    if (gradeValue !== null) grade(gradeValue);
  };

  if (!session) return null;
  if (done) return <CompletedSession services={services} onExit={onExit} onComplete={onComplete} headingRef={headingRef} dailyTraining={dailyTraining} />;
  if (!card) return null;
  return <ActiveCardSession services={services} session={session} card={card} answerRef={answerRef} headingRef={headingRef} onExit={onExit} grade={grade} show={show} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} refresh={refresh} />;
}

function getNextDueDate(services: CardsServices): Date | null {
  const next = services.nextDueDates().filter(value => value > Date.now()).sort((a, b) => a - b)[0];
  return next ? new Date(next) : null;
}

export function CardsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trainingTopicsValue = searchParams.get('trainingTopics');
  const dailyTrainingActivity = (['activeRecall', 'spacedReviews'] as const).find(value => value === searchParams.get('dailyTraining'));
  const sessionId = searchParams.get('trainingSessionId'), activityId = searchParams.get('trainingActivityId');
  const trainingActivityReference = sessionId && activityId ? { sessionId, activityId } : undefined;
  const home = useStudyService('home');
  const cards = useStudyService('cards');
  const seenTopicIds = useMemo(() => new Set(cards.seenTopics()), [cards]);
  const trainingTopicIds = useMemo(() => trainingTopicsValue === null ? undefined
    : [...new Set(trainingTopicsValue.split(',').filter(topicId => isStudyTopicId(topicId)
      && seenTopicIds.has(topicId)))], [seenTopicIds, trainingTopicsValue]);
  const activeRecallFallback = useMemo(() => {
    const params = new URLSearchParams({ dailyTraining: 'activeRecall', trainingTopics: (trainingTopicIds ?? []).join(',') });
    if (sessionId && activityId) { params.set('trainingSessionId', sessionId); params.set('trainingActivityId', activityId); }
    return `/test?${params.toString()}`;
  }, [activityId, sessionId, trainingTopicIds]);
  const trainingTopicSet = useMemo(() => trainingTopicIds ? new Set(trainingTopicIds) : null, [trainingTopicIds]);
  const initialPreferences = useMemo(() => cards.getPreferences(), [cards]);
  const [preferences, setPreferences] = useState<CardPreferences>(initialPreferences);
  const [plan, setPlan] = useState<CardsPlan | null>(null);
  const [planKey, setPlanKey] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [planGeneration, setPlanGeneration] = useState(0);
  const [, refreshSession] = useState(0);
  const autoStartedPlan = useRef<string | null>(null);
  const session = cards.getSession();
  const preparedIds = useMemo(() => dailyTrainingActivity === 'spacedReviews' && plan
    ? plan.ids.slice(0, plan.reviews)
    : plan?.ids ?? [], [dailyTrainingActivity, plan]);
  const requestKey = `${preferences.scope}:${preferences.count}:${trainingTopicIds?.join(',') ?? '*'}:${planGeneration}`;
  const pageState = resolveCardsPageState({
    session,
    trainingTopicIds: trainingTopicSet,
    dailyTrainingActivity: !!dailyTrainingActivity,
    preparedIds,
    errorKey,
    requestKey,
    planKey,
    hasPlan: !!plan,
  });

  useEffect(() => {
    let active = true;
    void cards.loadPlan(preferences, trainingTopicIds).then(value => { if (active) { setPlan(value); setPlanKey(requestKey); setErrorKey(''); } }).catch(() => { if (active) setErrorKey(requestKey); });
    return () => { active = false; };
  }, [cards, preferences, requestKey, trainingTopicIds]);

  useEffect(() => {
    if (!dailyTrainingActivity || session || !plan || planKey !== requestKey || autoStartedPlan.current === requestKey) return;
    autoStartedPlan.current = requestKey;
    if (preparedIds.length) {
      cards.startSession(plan.cards, preparedIds);
      queueMicrotask(() => refreshSession(value => value + 1));
    }
  }, [cards, dailyTrainingActivity, plan, planKey, preparedIds, requestKey, session]);

  const onSessionComplete = () => { cards.clearSession(); refreshSession(value => value + 1); if (dailyTrainingActivity) void navigate('/planificacion'); else setPlanGeneration(value => value + 1); };
  const onSessionExit = () => { cards.clearSession(); void navigate('/home'); };
  const onActivityFinished = () => { if (dailyTrainingActivity) home.completeTrainingActivity(dailyTrainingActivity, trainingActivityReference); };
  if (pageState !== 'plan') return <CardsPageStatus state={pageState} cards={cards} dailyTraining={!!dailyTrainingActivity} activeRecallFallback={activeRecallFallback} onSessionExit={onSessionExit} onSessionComplete={onSessionComplete} onActivityFinished={onActivityFinished} onRetry={() => setPlanGeneration(value => value + 1)} onHome={() => void navigate('/home')} />;
  if (!plan) return <PageLoading variant="legacy" />;

  const changePreferences = (next: CardPreferences) => { cards.savePreferences(next); setPreferences(next); };
  const begin = () => {
    if (!plan.ids.length) { home.notify('No hay tarjetas pendientes ahora mismo. Vuelve cuando venza alguna.'); return; }
    cards.startSession(plan.cards, plan.ids); refreshSession(value => value + 1);
  };
  return <CardsPlanView plan={plan} preferences={preferences} trainingTopicIds={trainingTopicIds} changePreferences={changePreferences} begin={begin} />;
}

function CardsPageStatus({ state, cards, dailyTraining, activeRecallFallback, onSessionExit, onSessionComplete, onActivityFinished, onRetry, onHome }: {
  state: Exclude<ReturnType<typeof resolveCardsPageState>, 'plan'>;
  cards: CardsServices;
  dailyTraining: boolean;
  activeRecallFallback: string;
  onSessionExit(): void;
  onSessionComplete(): void;
  onActivityFinished(): void;
  onRetry(): void;
  onHome(): void;
}) {
  switch (state) {
    case 'topic-scope-mismatch': return <PageMessage role="status" titleLevel={1} title="La sesión de tarjetas anterior no coincide con tus temas vistos"><p>La sesión se conserva para no perder el progreso, pero este entrenamiento solo muestra tarjetas de los temas que has marcado. Puedes volver a Inicio para continuar con el plan de hoy.</p><div className="bar2"><button className="btn" onClick={onHome}>Volver al inicio</button></div></PageMessage>;
    case 'another-session-pending': return <PageMessage role="status" titleLevel={1} title="Hay otra sesión de tarjetas pendiente"><p>Se conserva para no perder tu avance. Termínala desde Tarjetas y después vuelve al plan de hoy.</p><div className="bar2"><button className="btn" onClick={onHome}>Volver al entrenamiento</button></div></PageMessage>;
    case 'load-error': return <PageMessage role="alert" titleLevel={1} title="No se pudo cargar"><p>{navigator.onLine === false ? 'Las tarjetas que aún no están guardadas en este dispositivo necesitan conexión.' : 'No se pudieron cargar las tarjetas. Inténtalo de nuevo.'}</p><button className="btn" onClick={onRetry}>Reintentar</button></PageMessage>;
    case 'no-daily-cards': return <><h1>Entrenamiento de hoy</h1><PageMessage className="note" role="status">No hay tarjetas disponibles para esta actividad dentro de los temas vistos. Puedes recuperar preguntas de esos temas o volver al plan de hoy.</PageMessage><div className="bar2"><Link className="btn" to={activeRecallFallback}>Practicar preguntas</Link><Link className="btn sec" to="/planificacion">Volver al plan de hoy</Link></div></>;
    case 'daily-loading':
    case 'loading': return <PageLoading variant="legacy" />;
    case 'session': return <CardSession services={cards} onExit={onSessionExit} onComplete={onSessionComplete} onActivityFinished={onActivityFinished} dailyTraining={dailyTraining} />;
  }
}

function CardsPlanView({ plan, preferences, trainingTopicIds, changePreferences, begin }: {
  plan: CardsPlan;
  preferences: CardPreferences;
  trainingTopicIds: string[] | undefined;
  changePreferences(next: CardPreferences): void;
  begin(): void;
}) {
  return <>
    <h1>Tarjetas de repaso <Link className="help-icon-link" to="/ayuda?tema=repaso" aria-label="Ayuda sobre el repaso"><CircleHelp size="1em" strokeWidth={1.8} aria-hidden="true" focusable="false" /></Link></h1>
    <div className="sub">Primero intenta recordar la respuesta; después pulsa para verla y valora cómo te fue.</div>
    <div className="stats-grid"><div className="stat"><b>{plan.summary.hoy}</b><span>vencen hoy</span></div><div className="stat"><b>{plan.summary.nuevas}</b><span>nuevas</span></div><div className="stat"><b>{plan.summary.enRepaso}</b><span>en repaso</span></div><div className="stat"><b>{plan.summary.dominadas}</b><span>dominadas</span></div></div>
    {trainingTopicIds && <p className="note">Entrenamiento de hoy: tarjetas limitadas a los temas que has marcado como vistos.</p>}
    {plan.cards.length ? <><div className="card"><h2 className="h3">Tarjetas por sesión</h2><div className="seg" id="cn">{([10, 20, 30] as const).map(value => <button key={value} className={preferences.count === value ? 'on' : ''} aria-pressed={preferences.count === value} data-v={value} onClick={() => changePreferences({ ...preferences, count: value })}>{value}</button>)}</div>
      {!trainingTopicIds && <><h2 className="h3">Tarjetas nuevas de</h2><div className="seg" id="cs">{([['vistos', 'Mis temas vistos'], ['todos', 'Todos los temas']] as const).map(([value, label]) => <button key={value} className={preferences.scope === value ? 'on' : ''} aria-pressed={preferences.scope === value} data-v={value} onClick={() => changePreferences({ ...preferences, scope: value })}>{label}</button>)}</div></>}
      <p className="sm"><small>Las vencidas salen primero, mezcladas por tema. Como máximo 10 nuevas por sesión.</small></p></div>
      <div className="bar2 action-plan"><p className="sm" id="card-plan" role="status">{plan.ids.length} {plan.ids.length === 1 ? 'tarjeta' : 'tarjetas'}: {plan.reviews} de repaso y {plan.ids.length - plan.reviews} nuevas.</p><button className="btn" id="go" disabled={!plan.ids.length} onClick={begin}>Empezar</button></div></> : <div className="note">Aún no tienes tarjetas. Al fallar una pregunta en un test pulsa <b>«Hacer tarjeta»</b> (si el motivo no es un despiste) y aparecerá aquí.</div>}
  </>;
}
