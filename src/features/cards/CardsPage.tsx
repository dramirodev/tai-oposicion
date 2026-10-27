import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleHelp, Trash2, TriangleAlert, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ERROR_REPORT_REASONS } from '../../shared/presentation/study-labels.js';
import { questionNotice, sourceHtml } from '../../shared/presentation/study-content.js';
import { richHtml } from '../../shared/presentation/study-text.js';
import { useStudyServices, type CardsServices, type CardPreferences, type CardsPlan, type StudyCard } from '../../shared/ui/study-services.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { StudyMarkup } from '../../shared/ui/StudyMarkup.js';

const gradeLabels = ['Fallé', 'Dudaba', 'Lo sabía'] as const;
const reasons = ERROR_REPORT_REASONS;
function Notice({ card }: { card: StudyCard }) {
  const html = questionNotice({ n: card.nota, np: card.np, i: card.id.startsWith('FC-Q-') ? card.id.slice(5) : undefined });
  return html ? <StudyMarkup html={html} /> : null;
}

function CardReport({ card, services }: { card: StudyCard; services: CardsServices }) {
  const initial = services.getReport(card.id);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(initial?.motivo || reasons[0]);
  const [note, setNote] = useState(initial?.nota || '');
  const [saved, setSaved] = useState(initial?.st === 'abierto');
  const save = () => { services.saveReport(card, reason, note.trim()); setSaved(true); setEditing(false); };
  if (!editing) return saved
    ? <span className="rep ok"><Check size="1em" aria-hidden="true" /> Error anotado <button className="ghost sm" data-rep onClick={() => setEditing(true)}>editar</button></span>
    : <button className="ghost fl" data-rep onClick={() => setEditing(true)}><TriangleAlert size="1em" aria-hidden="true" /> Avisar de error</button>;
  return <div className="repf">
    <select aria-label="Motivo del error" value={reason} onChange={event => setReason(event.target.value)}>
      {reasons.map(item => <option key={item}>{item}</option>)}
    </select>
    <input aria-label="Qué falla" maxLength={300} placeholder="Qué falla (opcional)" value={note} onChange={event => setNote(event.target.value)} />
    <div className="row"><button className="btn" onClick={save}>Guardar</button><button className="btn sec" onClick={() => setEditing(false)}>Cancelar</button></div>
  </div>;
}

function CompletedSession({ services, onExit, onComplete, headingRef }: {
  services: CardsServices;
  onExit(): void;
  onComplete(): void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const session = services.getSession();
  if (!session) return null;
  const [failed, unsure, known] = session.results, count = failed + unsure + known;
  const nextDue = getNextDueDate(services);
  return <>
    <h1 ref={headingRef} tabIndex={-1}>Sesión terminada</h1>
    <div className="grid"><div className="stat"><b>{known}</b><span>lo sabía</span></div><div className="stat"><b>{unsure}</b><span>dudaba</span></div><div className="stat"><b>{failed}</b><span>fallé</span></div><div className="stat"><b>{count ? Math.round(known * 100 / count) : 0}%</b><span>retención</span></div></div>
    <p className="sub">{failed + unsure ? 'Las que fallaste o dudaste vuelven en 2 días.' : '¡Todas recordadas!'}{nextDue ? ` Próximo repaso: ${nextDue.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}.` : ''}</p>
    <button className="btn" id="otra" onClick={onComplete}>Otra sesión</button> <button className="btn sec" id="ini" onClick={onExit}>Inicio</button>
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
    <div className="qhead"><button className="ghost" id="exit" aria-label="Salir" onClick={onExit}><X size="1.25rem" aria-hidden="true" /></button><div className="prog" role="progressbar" aria-label="Progreso" aria-valuemin={0} aria-valuemax={total} aria-valuenow={session.index}><div style={{ width: `${percent}%` }} /></div><div className="cnt">{session.index + 1}/{total}</div></div>
    <div className="card q fc" id="fc" role="group" aria-label="Pregunta de la tarjeta" tabIndex={0} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      onClick={event => { if (!session.revealed && !(event.target as HTMLElement).closest('button,a,details,input,select,textarea')) show(); }}
      onKeyDown={event => { if (!session.revealed && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); show(); } }}>
      <div className="meta"><span className="tag">{card.t} · {services.topicName(card.t)}</span>{card.tipo && <span className="tag">{card.tipo}</span>}{card.caduca && <span className="tag warn">Puede caducar</span>}</div>
      <Notice card={card} />
      {card.supTexto && <details className="sup"><summary>Enunciado del supuesto</summary><div className="pre">{card.supTexto}</div></details>}
      {card.cp && <div className="ctx pre"><StudyMarkup html={richHtml(card.cp)} /></div>}
      <div className="enun pre"><StudyMarkup html={richHtml(card.q)} /></div>
      {session.revealed ? <div ref={answerRef} className="card-answer" role="region" aria-label="Respuesta de la tarjeta" tabIndex={-1}><small>Respuesta</small><div className="pre"><StudyMarkup html={richHtml(card.a)} /></div>
        {card.nota && <div className="cita"><span>Nota</span>{card.nota}</div>}
        {card.ref && <div className="cita"><span>Temario</span>{card.ref}</div>}
        {source && <StudyMarkup html={source} />}
        <div className="repw" id="crep"><CardReport card={card} services={services} /></div>
        {card.src === 'fallo' && <button className="ghost fl" id="quit" onClick={event => { event.stopPropagation(); services.removeFailureCard(); refresh(value => value + 1); }}><Trash2 size="1em" aria-hidden="true" /> Quitar esta tarjeta</button>}
      </div> : <div className="fh">Toca para ver la respuesta</div>}
    </div>
    <div className="bar2">{session.revealed ? gradeLabels.map((label, gradeValue) => <button key={label} className={`btn ${gradeValue === 0 ? 'bad' : gradeValue === 1 ? 'sec' : ''}`} data-g={gradeValue} onClick={() => grade(gradeValue)}>{label}<small>{services.reviewLabel(card.id, gradeValue)}</small></button>) : <button className="btn" id="show" onClick={show}>Mostrar respuesta</button>}</div>
    {session.revealed && <p className="sub fgl">Teclado 1·2·3 · deslizar ← Fallé · → Lo sabía</p>}
  </>;
}

function CardSession({ services, onExit, onComplete }: { services: CardsServices; onExit(): void; onComplete(): void }) {
  const [, refresh] = useState(0);
  const session = services.getSession();
  const touchStart = useRef<[number, number] | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const card = session?.items[session.index];
  const total = session?.items.length || 0;
  const done = !!session && session.index >= total;

  useLayoutEffect(() => {
    if (!session?.revealed) return;
    answerRef.current?.focus({ preventScroll: true });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = () => answerRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    requestAnimationFrame(reveal);
  }, [session?.revealed, session?.index]);

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
  if (done) return <CompletedSession services={services} onExit={onExit} onComplete={onComplete} headingRef={headingRef} />;
  if (!card) return null;
  return <ActiveCardSession services={services} session={session} card={card} answerRef={answerRef} headingRef={headingRef} onExit={onExit} grade={grade} show={show} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} refresh={refresh} />;
}

function getNextDueDate(services: CardsServices): Date | null {
  const next = services.nextDueDates().filter(value => value > Date.now()).sort((a, b) => a - b)[0];
  return next ? new Date(next) : null;
}

export function CardsPage() {
  const navigate = useNavigate();
  const { home, cards } = useStudyServices();
  const initialPreferences = useMemo(() => cards.getPreferences(), [cards]);
  const [preferences, setPreferences] = useState<CardPreferences>(initialPreferences);
  const [plan, setPlan] = useState<CardsPlan | null>(null);
  const [planKey, setPlanKey] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [planGeneration, setPlanGeneration] = useState(0);
  const [, refreshSession] = useState(0);
  const session = cards.getSession();
  const requestKey = `${preferences.scope}:${preferences.count}:${planGeneration}`;

  useEffect(() => {
    let active = true;
    void cards.loadPlan(preferences).then(value => { if (active) { setPlan(value); setPlanKey(requestKey); setErrorKey(''); } }).catch(() => { if (active) setErrorKey(requestKey); });
    return () => { active = false; };
  }, [cards, preferences, requestKey]);

  if (session) return <CardSession services={cards} onExit={() => { cards.clearSession(); void navigate('/home'); }} onComplete={() => { cards.clearSession(); refreshSession(value => value + 1); setPlanGeneration(value => value + 1); }} />;
  if (errorKey === requestKey) return <div className="card" role="alert"><h1>No se pudo cargar</h1><p>{navigator.onLine === false ? 'Las tarjetas que aún no están guardadas en este dispositivo necesitan conexión.' : 'No se pudieron cargar las tarjetas. Inténtalo de nuevo.'}</p><button className="btn" onClick={() => setPlanGeneration(value => value + 1)}>Reintentar</button></div>;
  if (!plan || planKey !== requestKey) return <PageLoading variant="legacy" />;

  const changePreferences = (next: CardPreferences) => { cards.savePreferences(next); setPreferences(next); };
  const begin = () => {
    if (!plan.ids.length) { home.notify('No hay tarjetas pendientes ahora mismo. Vuelve cuando venza alguna.'); return; }
    cards.startSession(plan.cards, plan.ids); refreshSession(value => value + 1);
  };
  return <>
    <h1>Tarjetas de repaso <Link className="help-icon-link" to="/ayuda?tema=repaso" aria-label="Ayuda sobre el repaso"><CircleHelp size="1em" strokeWidth={1.8} aria-hidden="true" focusable="false" /></Link></h1>
    <div className="sub">Primero intenta recordar la respuesta; después pulsa para verla y valora cómo te fue.</div>
    <div className="grid"><div className="stat"><b>{plan.summary.hoy}</b><span>vencen hoy</span></div><div className="stat"><b>{plan.summary.nuevas}</b><span>nuevas</span></div><div className="stat"><b>{plan.summary.enRepaso}</b><span>en repaso</span></div><div className="stat"><b>{plan.summary.dominadas}</b><span>dominadas</span></div></div>
    {plan.cards.length ? <><div className="card"><h2 className="h3">Tarjetas por sesión</h2><div className="seg" id="cn">{([10, 20, 30] as const).map(value => <button key={value} className={preferences.count === value ? 'on' : ''} aria-pressed={preferences.count === value} data-v={value} onClick={() => changePreferences({ ...preferences, count: value })}>{value}</button>)}</div>
      <h2 className="h3">Tarjetas nuevas de</h2><div className="seg" id="cs">{([['vistos', 'Mis temas vistos'], ['todos', 'Todos los temas']] as const).map(([value, label]) => <button key={value} className={preferences.scope === value ? 'on' : ''} aria-pressed={preferences.scope === value} data-v={value} onClick={() => changePreferences({ ...preferences, scope: value })}>{label}</button>)}</div>
      <p className="sm"><small>Las vencidas salen primero, mezcladas por tema. Como máximo 10 nuevas por sesión.</small></p></div>
      <div className="bar2 action-plan"><p className="sm" id="card-plan" role="status">{plan.ids.length} {plan.ids.length === 1 ? 'tarjeta' : 'tarjetas'}: {plan.reviews} de repaso y {plan.ids.length - plan.reviews} nuevas.</p><button className="btn" id="go" disabled={!plan.ids.length} onClick={begin}>Empezar</button></div></> : <div className="note">Aún no tienes tarjetas. Al fallar una pregunta en un test pulsa <b>«Hacer tarjeta»</b> (si el motivo no es un despiste) y aparecerá aquí.</div>}
  </>;
}
