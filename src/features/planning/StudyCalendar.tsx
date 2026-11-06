import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { ScheduledStudyActivity, ScheduledStudyActivityKind } from '../../core/domain/study-training-calendar.js';
import { proposeStudyActivity, proposeStudyActivityReschedule, type ScheduleDecision } from '../../core/domain/study-training-calendar.js';
import type { TrainingPreferences } from '../../core/domain/entities.js';
import { resolveTrainingDay } from '../../core/domain/study-training-events.js';
import type { DailyTrainingSession, TrainingSessionHistoryEntry } from '../../core/domain/study-training-session.js';
import { proposeWeeklyAgendaRecovery, weekStartForStudyDate, type WeeklyAgendaItem, type WeeklyAgendaKind, type WeeklyAgendaPlanProposal, type WeeklyAgendaRecoveryProposal, type WeeklyStudyAgenda } from '../../core/domain/study-weekly-agenda.js';

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const focusLabels = { rest: 'Descanso', 'new-content': 'Contenido nuevo', consolidation: 'Recuperación y consolidación' } as const;
const monthTitleFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const activityNames: Record<ScheduledStudyActivityKind, string> = { activeRecall:'Preguntas de recuperación', topicTest:'Test por tema' };
const weeklyActivityNames: Record<WeeklyAgendaKind, string> = { newContent:'Tema nuevo', activeRecall:'Test de práctica (actividad antigua)', topicTest:'Test por tema', mixedTopicTest:'Test variado', failures:'Errores pendientes', spacedReviews:'Repasos vencidos', sectionRecall:'Seguimiento antiguo → test del tema' };
const weeklyReasonLabels: Record<WeeklyAgendaKind, string> = { newContent:'siguiente tema en el orden de academia', activeRecall:'recuperación mediante preguntas de temas vistos', topicTest:'práctica según las reglas diarias y los datos disponibles', mixedTopicTest:'recuperación acumulativa de temas vistos', failures:'errores guardados de temas vistos', spacedReviews:'repasos de preguntas vencidos de temas vistos', sectionRecall:'fecha de comprobación elegida por ti' };
const reasonLabels: Record<string, string> = {
  'invalid-date':'Elige una fecha válida.', 'past-date':'Solo puedes planificar días futuros.', 'too-far':'La fecha debe estar dentro de los próximos seis meses.',
  'rest-day':'Ese día está configurado como descanso. Cambia primero tu disponibilidad en Ajustes.', 'unseen-topic':'Solo se pueden planificar temas marcados como vistos.',
  'invalid-duration':'Elige entre 5 y 120 minutos.', 'day-capacity':'La duración excede el tiempo disponible de ese día.', 'duplicate':'Ese mismo repaso ya está planificado para ese día.',
  'schedule-limit':'La agenda alcanzó su límite técnico de 90 actividades; no se puede añadir otra ahora.',
  'not-found':'No se encontró el repaso que quieres mover.', 'storage-failed':'No se pudo guardar el cambio en este dispositivo. Libera espacio e inténtalo de nuevo.',
};

type Proposal = { type:'create'; dateKey:string; activity:ScheduledStudyActivityKind; topicId:string; minutes:number }
  | { type:'move'; id:string; dateKey:string };

function decisionText(decision: ScheduleDecision | { ok:false; reason:'storage-failed' }): string | null {
  return decision.ok ? null : reasonLabels[decision.reason] || 'No se pudo validar el cambio.';
}

export function StudyCalendar({ preferences, now, history, activeSession, topics, catalogTopics = topics, seenTopicIds = topics.map(topic => topic.id), activities, weeklyItems = [], weeklyAgenda, onSchedule, onReschedule, onOpenActivity, onSaveWeeklyAgenda, onRecoverWeeklyAgenda, onProposeWeeklyAgenda, onAddWeeklyAgendaPlan, onSetWeeklyAgendaStatus, onOpenSectionRecall }: {
  preferences: TrainingPreferences; now: Date; history: readonly TrainingSessionHistoryEntry[];
  activeSession?: DailyTrainingSession | null;
  topics: readonly { id:string; name:string }[]; activities: readonly ScheduledStudyActivity[];
  catalogTopics?: readonly { id:string; name:string }[]; seenTopicIds?: readonly string[]; weeklyItems?: readonly WeeklyAgendaItem[];
  weeklyAgenda?: WeeklyStudyAgenda;
  onSchedule(input: { dateKey:string; activity:ScheduledStudyActivityKind; topicId:string; minutes:number }): ScheduleDecision | { ok:false; reason:'storage-failed' };
  onReschedule(input: { id:string; dateKey:string }): ScheduleDecision | { ok:false; reason:'storage-failed' };
  onOpenActivity(activity: ScheduledStudyActivity): void;
  onSaveWeeklyAgenda?(weekStart: string, items: readonly WeeklyAgendaItem[]): boolean;
  onRecoverWeeklyAgenda?(proposal: WeeklyAgendaRecoveryProposal): boolean;
  onProposeWeeklyAgenda?(weekStart: string): WeeklyAgendaPlanProposal | null | Promise<WeeklyAgendaPlanProposal | null>;
  onAddWeeklyAgendaPlan?(proposal: WeeklyAgendaPlanProposal): boolean | Promise<boolean>;
  onSetWeeklyAgendaStatus?(id: string, status: 'completed' | 'skipped'): boolean;
  onOpenSectionRecall?(item: WeeklyAgendaItem): void;
}) {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [dateKey, setDateKey] = useState('');
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '');
  const [minutes, setMinutes] = useState(20);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  // La fecha pendiente de cada repaso se guarda por separado: una sola compartida se copiaba a todas las filas.
  const [moveDates, setMoveDates] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [agendaDate, setAgendaDate] = useState(dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)));
  const [agendaKind, setAgendaKind] = useState<WeeklyAgendaKind>('newContent');
  const [agendaTopicId, setAgendaTopicId] = useState(catalogTopics[0]?.id ?? '');
  const [agendaMinutes, setAgendaMinutes] = useState(35);
  const [agendaProposal, setAgendaProposal] = useState<{ weekStart:string; item:WeeklyAgendaItem } | null>(null);
  const [recoveryProposal, setRecoveryProposal] = useState<WeeklyAgendaRecoveryProposal | null>(null);
  const [weeklyPlanProposal, setWeeklyPlanProposal] = useState<WeeklyAgendaPlanProposal | null>(null);
  const monthTitle = monthTitleFormatter.format(month);
  const firstDayOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const completedDays = new Set(history.map(session => session.dateKey));
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 180);
  const dateForInput = dateKey || dayKey(tomorrow);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  const currentWeekKey = dayKey(monday);
  const visibleWeeklyItems = weeklyItems.filter(item => item.weekStart === currentWeekKey);
  const selectedWeekEnd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const agendaMinDate = dayKey(tomorrow), agendaMaxDate = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 180));

  const prepareCreation = () => {
    const decision = proposeStudyActivity({ dateKey:dateForInput, activity:'topicTest', topicId, minutes, now:now.getTime(), preferences, seenTopicIds:topics.map(topic => topic.id), existing:activities });
    const message = decisionText(decision);
    setError(message || '');
    if (!message) setProposal({ type:'create', dateKey:dateForInput, activity:'topicTest', topicId, minutes });
  };

  const prepareMove = (activity: ScheduledStudyActivity) => {
    const targetDate = moveDates[activity.id] || dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const decision = proposeStudyActivityReschedule({ id:activity.id, dateKey:targetDate, now:now.getTime(), preferences, seenTopicIds:topics.map(topic => topic.id), existing:activities });
    const message = decisionText(decision);
    setError(message || '');
    if (!message) setProposal({ type:'move', id:activity.id, dateKey:targetDate });
  };

  const confirmProposal = () => {
    if (!proposal) return;
    const decision = proposal.type === 'create' ? onSchedule(proposal) : onReschedule(proposal);
    const message = decisionText(decision);
    setError(message || '');
    if (!message) {
      setProposal(null);
      if (proposal.type === 'move') setMoveDates(current => Object.fromEntries(Object.entries(current).filter(([id]) => id !== proposal.id)));
    }
  };

  const activitiesByDate = new Map<string, ScheduledStudyActivity[]>();
  for (const activity of activities) activitiesByDate.set(activity.dateKey, [...(activitiesByDate.get(activity.dateKey) ?? []), activity]);
  const topicName = (id: string) => topics.find(topic => topic.id === id)?.name || id;

  return <section className="planning-week my-5 min-w-0 rounded-[var(--r-xl)] border border-line py-5 px-[clamp(1rem,3vw,1.75rem)] max-[520px]:p-4 [background:var(--card)]" aria-labelledby="planning-week-title">
      <div className="planning-section-heading flex flex-wrap items-end justify-between gap-x-5 gap-y-3"><div><p className="planning-kicker mb-1 text-muted text-[length:var(--fs-s)]">Ritmo semanal</p><h2 className="m-0 text-[clamp(1.25rem,3vw,1.65rem)] tracking-[-.02em]" id="planning-week-title">Estudio, repaso y descanso</h2><p className="m-0 mt-1 text-muted">Semana del {fullDateFormatter.format(monday)} al {fullDateFormatter.format(selectedWeekEnd)}</p></div><Link className="min-h-11 inline-flex items-center gap-1" to="/settings">Ajustar disponibilidad</Link></div>
    <div className="planning-schedule-views mt-4 flex gap-2" aria-label="Vista del calendario">
      <button className={`min-w-11 min-h-11 rounded-[var(--r-m)] border border-line bg-[var(--card)] px-3 py-[.45rem] text-ink [font:inherit] [cursor:pointer]${view === 'week' ? ' !border-ink !bg-[var(--surface-soft)] !font-bold' : ''}`} type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Semana</button>
      <button className={`min-w-11 min-h-11 rounded-[var(--r-m)] border border-line bg-[var(--card)] px-3 py-[.45rem] text-ink [font:inherit] [cursor:pointer]${view === 'month' ? ' !border-ink !bg-[var(--surface-soft)] !font-bold' : ''}`} type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>Mes</button>
    </div>
    {view === 'week' ? <>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Navegar semanas">
        <button className="btn sec min-h-11" type="button" aria-label="Semana anterior" onClick={() => { setWeekOffset(value => value - 1); setAgendaProposal(null); setWeeklyPlanProposal(null); setRecoveryProposal(null); }}>Semana anterior</button>
        <button className="btn sec min-h-11" type="button" onClick={() => { setWeekOffset(0); setAgendaDate(agendaMinDate); setAgendaProposal(null); setWeeklyPlanProposal(null); setRecoveryProposal(null); }}>Esta semana</button>
        <button className="btn sec min-h-11" type="button" aria-label="Semana siguiente" onClick={() => { setWeekOffset(value => value + 1); setAgendaDate(dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 8))); setAgendaProposal(null); setWeeklyPlanProposal(null); setRecoveryProposal(null); }}>Semana siguiente</button>
      </div>
      <ol className="mt-4 mb-0 grid grid-cols-7 gap-2 p-0 list-none max-[840px]:grid-cols-4 max-[520px]:grid-cols-2">{[1, 2, 3, 4, 5, 6, 0].map(day => {
        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (day === 0 ? 6 : day - 1));
        const dateValue = dayKey(date), resolved = resolveTrainingDay({ dateKey: dateValue, preferences });
        const scheduled = activitiesByDate.get(dateValue) ?? [];
        const weekly = visibleWeeklyItems.filter(item => item.dateKey === dateValue);
        const completed = completedDays.has(dateValue);
        const inProgress = activeSession?.dateKey === dateValue && activeSession.completedAt === null;
        const isToday = dateValue === dayKey(now);
        return <li key={day} className={`planning-week-day grid min-h-24 min-w-0 content-start gap-[.35rem] rounded-[var(--r-m)] border border-line p-3${isToday ? ' !border-brand ![box-shadow:inset_0_0_0_1px_var(--brand)]' : ''}`} aria-current={isToday ? 'date' : undefined}>
          <b className="text-[length:var(--fs-s)]">{dayNames[day]} · {date.getDate()}</b><span className="text-lg [font-variant-numeric:tabular-nums]">{resolved.minutes ? `${resolved.minutes} min` : '0 min'}</span><small className="leading-[1.35] text-muted [overflow-wrap:anywhere]">{focusLabels[resolved.focus]}{day === preferences.introductionDay && !resolved.override ? ' · academia' : ''}{isToday ? ' · hoy' : ''}</small>
          {resolved.events.map(event => <span key={event.id} className="grid gap-1 text-accent leading-[1.25] [overflow-wrap:anywhere]"><small>{event.title}{event.kind === 'class' ? ' · clase' : event.kind === 'milestone' ? ' · simulacro' : event.kind === 'unavailable' ? ' · sin estudio' : ` · ${event.studyMinutes} min especiales`}</small>{event.kind === 'milestone' && event.simulation && <Link className="min-h-8 inline-flex items-center text-link underline underline-offset-2" to={`/sim?milestone=${encodeURIComponent(event.id)}`}>Preparar hito</Link>}</span>)}
          {scheduled.map(activity => <small key={activity.id} className="leading-[1.25] [overflow-wrap:anywhere]">{activityNames[activity.activity]} · {activity.topicId} · {activity.minutes} min</small>)}
          {weekly.map(item => <small key={item.id} className="leading-[1.25] [overflow-wrap:anywhere]">{weeklyActivityNames[item.kind]} · {item.topicIds.join(', ')} · {item.minutes} min · {item.status === 'planned' ? 'planificada' : item.status === 'completed' ? 'completada' : item.status === 'rescheduled' ? `reprogramada al ${item.rescheduledTo}` : 'omitida'}</small>)}
          {completed && <small className="font-[650] text-accent">Sesión diaria completada</small>}
          {inProgress && <small className="font-[650] text-accent">Sesión diaria en curso · guardada</small>}
        </li>;
      })}</ol>
      <p className="planning-week-note mt-3.5 mb-0 text-muted text-[length:var(--fs-s)]">La semana muestra fechas, disponibilidad, eventos y repasos que has programado. La sesión de hoy se conserva como checkpoint; los cambios de disponibilidad afectan a días futuros, no reescriben una sesión iniciada. El reparto refleja tus preferencias editables, no una distribución demostrada como óptima.</p>
      <section className="planning-calendar-editor mt-4 min-w-0 rounded-[var(--r-m)] border border-line bg-[var(--surface-soft)] p-4" aria-labelledby="weekly-agenda-title">
        <h3 className="m-0 text-[length:var(--fs-m)]" id="weekly-agenda-title">Preparar esta semana</h3>
        <p className="mt-[.4rem] mb-3 text-muted">Añade actividades y confirma cada cambio. Un tema nuevo puede estar pendiente; los repasos requieren un tema visto. La agenda se guarda en este dispositivo y se sincroniza en la cuenta cuando hay conexión y acceso aprobado.</p>
        {!weeklyPlanProposal ? <button className="btn sec min-h-11 mb-3" type="button" disabled={!catalogTopics.length} onClick={async () => {
          const proposal = await onProposeWeeklyAgenda?.(currentWeekKey);
          if (!proposal) { setError('No se pudo preparar la semana. Comprueba la fecha y vuelve a intentarlo.'); return; }
          setWeeklyPlanProposal(proposal); setError('');
        }}>Proponer semana según tu plan</button> : <div className="mb-3 grid gap-2 rounded-[var(--r-s)] border border-line bg-[var(--card)] p-3" role="group" aria-label="Propuesta semanal pendiente de confirmación">
          <b>{weeklyPlanProposal.items.length} actividades · {weeklyPlanProposal.items.reduce((sum, item) => sum + item.minutes, 0)} min propuestos</b>
          {weeklyPlanProposal.contentInventoryStatus !== 'manifest' && <p className="m-0" role="status">Inventario de contenido {weeklyPlanProposal.contentInventoryStatus === 'not-checked' ? 'no consultado' : weeklyPlanProposal.contentInventoryStatus === 'partial' ? 'parcial' : 'no disponible'}. No se puede confirmar la disponibilidad de todas las actividades; revisa el banco antes de iniciarlas.</p>}
          {weeklyPlanProposal.horizonCapacityGapBefore !== null && weeklyPlanProposal.horizonCapacityGapBefore > 0 && <p className="m-0" role="status">El horizonte detecta una brecha optimista de {weeklyPlanProposal.horizonCapacityGapBefore} espacio(s) para introducir los temas pendientes. Esta propuesta añade {weeklyPlanProposal.acceleratedNewTopicIds.length} espacio(s) de contenido nuevo en días de consolidación{weeklyPlanProposal.acceleratedNewTopicIds.length ? ` (${weeklyPlanProposal.acceleratedNewTopicIds.join(', ')})` : ''} y dejaría una brecha de {weeklyPlanProposal.horizonCapacityGapAfter}. La rutina habitual solo cambia para estas fechas si confirmas la propuesta.</p>}
          {weeklyPlanProposal.plannedNewTopicIds.length > 0 && <p className="m-0">Contenido nuevo en el orden configurado: {weeklyPlanProposal.plannedNewTopicIds.join(' → ')}. Programarlo no marca los temas como estudiados.</p>}
          {weeklyPlanProposal.sectionRecallSummary.added > 0 && <p className="m-0" role="status">Se incluyen {weeklyPlanProposal.sectionRecallSummary.added} comprobación(es) cuya fecha elegiste, con la duración de bloque configurada (ajustable entre 25 y 45 minutos). Confirma la semana para guardarlas.</p>}
          {(weeklyPlanProposal.sectionRecallSummary.stale + weeklyPlanProposal.sectionRecallSummary.noCapacity + weeklyPlanProposal.sectionRecallSummary.alreadyIncluded) > 0 && <p className="m-0 text-muted" role="status">Comprobaciones no añadidas: {weeklyPlanProposal.sectionRecallSummary.stale} con material cambiado o referencia incompleta, {weeklyPlanProposal.sectionRecallSummary.noCapacity} sin hueco en la fecha aplicable y {weeklyPlanProposal.sectionRecallSummary.alreadyIncluded} ya incluidas en la agenda.</p>}
          {weeklyPlanProposal.omittedContentActivities.length > 0 && <details><summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Prácticas omitidas por inventario ({weeklyPlanProposal.omittedContentActivities.length})</summary><ul className="my-1 ps-5">{weeklyPlanProposal.omittedContentActivities.map((omitted, index) => <li key={`${omitted.dateKey}:${omitted.kind}:${index}`}>{omitted.dateKey} · {weeklyActivityNames[omitted.kind]} · {omitted.topicIds.join(', ')} · disponibilidad no confirmada</li>)}</ul></details>}
          {!!weeklyPlanProposal.items.length && <ul className="m-0 ps-5">{weeklyPlanProposal.items.map(item => <li key={item.id}>{item.dateKey} · {weeklyActivityNames[item.kind]} · {item.kind === 'sectionRecall' ? `${item.sectionRecall?.sectionTitle ?? item.sectionRecall?.sectionId} (p. ${item.sectionRecall?.printedPage ?? 's/d'})${item.sectionRecall?.dueDateKey !== item.dateKey ? ` · vencía ${item.sectionRecall?.dueDateKey}` : ''}` : item.topicIds.join(', ')} · {item.minutes} min · {weeklyReasonLabels[item.kind]}</li>)}</ul>}
          {!!weeklyPlanProposal.missingTopicIds.length && <p className="m-0" role="status">Hay IDs de la secuencia que no aparecen en el catálogo actual: {weeklyPlanProposal.missingTopicIds.join(', ')}. Se conservan en Ajustes y no se inventa su contenido.</p>}
          {weeklyPlanProposal.skippedDays.length > 0 && <details><summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Días sin propuesta ({weeklyPlanProposal.skippedDays.length})</summary><ul className="my-1 ps-5">{weeklyPlanProposal.skippedDays.map(day => <li key={day.dateKey}>{day.reason === 'no-content' ? `${day.dateKey} · el manifiesto no confirma material para las actividades disponibles` : `${day.dateKey} · ${day.reason === 'past' ? 'ya pasó o es hoy' : day.reason === 'rest' ? 'descanso o ausencia' : day.reason === 'no-capacity' ? 'sin capacidad libre' : 'sin actividad sustentada por los datos'}`}</li>)}</ul></details>}
          <p className="m-0 text-muted text-[length:var(--fs-s)]">La propuesta se suma a las actividades ya planificadas y conserva completadas y omitidas. Los minutos son tiempo de estudio enfocado; planifica las pausas fuera de ese total. No se estima duración ni probabilidad de aprobar.</p>
          <div className="flex flex-wrap gap-2"><button className="btn min-h-11" type="button" disabled={!weeklyPlanProposal.items.length} onClick={async () => {
            if (!await onAddWeeklyAgendaPlan?.(weeklyPlanProposal)) { setError('La agenda o una versión de material cambió, o no se pudo guardar. Vuelve a generar la propuesta antes de confirmar.'); setWeeklyPlanProposal(null); return; }
            setWeeklyPlanProposal(null); setError('');
          }}>Confirmar semana</button><button className="btn sec min-h-11" type="button" onClick={() => setWeeklyPlanProposal(null)}>Cancelar</button></div>
        </div>}
        {!!weeklyAgenda?.items.some(item => item.status === 'planned' && item.dateKey < dayKey(now)) && <div className="mb-3 rounded-[var(--r-s)] border border-line bg-[var(--card)] p-3">
          <p className="mt-0 mb-2">Hay actividades pasadas aún pendientes. Puedes distribuirlas en los días futuros con espacio de esta semana; el plan no las moverá automáticamente.</p>
          {!recoveryProposal ? <button className="btn sec min-h-11" type="button" onClick={() => {
            if (!weeklyAgenda) return;
            const next = proposeWeeklyAgendaRecovery({ agenda:weeklyAgenda, targetWeekStart:currentWeekKey, todayKey:dayKey(now), preferences, seenTopicIds, scheduledActivities:activities });
            if (!next?.moves.length) { setError('No hay pendientes que quepan en los días disponibles de esta semana. Los temas de repaso que ya no constan como vistos se conservan sin reprogramar.'); return; }
            setRecoveryProposal(next); setError('');
          }}>Proponer recuperación gradual</button> : <div className="grid gap-2">
            <p className="m-0">Propuesta: {recoveryProposal.moves.length} {recoveryProposal.moves.length === 1 ? 'actividad' : 'actividades'}; {recoveryProposal.unplacedIds.length} quedarán pendientes para otra revisión. Se conserva cada fecha original en el historial.</p>
            <ul className="m-0 ps-5">{recoveryProposal.moves.map(move => <li key={move.sourceId}>{move.target.topicIds.join(', ')} · {move.target.minutes} min · {move.target.dateKey}</li>)}</ul>
            <div className="flex flex-wrap gap-2"><button className="btn min-h-11" type="button" onClick={() => {
              if (!onRecoverWeeklyAgenda?.(recoveryProposal)) { setError('La agenda cambió o no se pudo guardar. Revisa de nuevo la propuesta antes de confirmar.'); setRecoveryProposal(null); return; }
              setRecoveryProposal(null); setError('');
            }}>Confirmar recuperación</button><button className="btn sec min-h-11" type="button" onClick={() => setRecoveryProposal(null)}>Cancelar</button></div>
          </div>}
        </div>}
        {!catalogTopics.length ? <p role="status" className="text-muted">No se ha cargado el catálogo de temas; puedes consultar la semana, pero no añadir actividades todavía.</p> : <div className="grid grid-cols-4 items-end gap-3 max-[520px]:grid-cols-2">
          <label className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]">Fecha<input aria-label="Fecha de actividad semanal" className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" type="date" value={agendaDate} min={agendaMinDate} max={agendaMaxDate} onChange={event => { setAgendaDate(event.target.value); setAgendaProposal(null); setError(''); }} /></label>
          <label className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]">Actividad<select aria-label="Actividad semanal" className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" value={agendaKind} onChange={event => { setAgendaKind(event.target.value as WeeklyAgendaKind); setAgendaProposal(null); setError(''); }}>
            {Object.entries(weeklyActivityNames).filter(([value]) => value !== 'sectionRecall' && value !== 'activeRecall').map(([value, label]) => <option key={value} value={value}>Añadir: {label}</option>)}
          </select></label>
          <label className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]">Tema<select aria-label="Tema de actividad semanal" className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" value={agendaTopicId} onChange={event => { setAgendaTopicId(event.target.value); setAgendaProposal(null); setError(''); }}>
            {catalogTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.id} · {topic.name}{seenTopicIds.includes(topic.id) ? '' : ' · pendiente'}</option>)}
          </select></label>
          <label className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]">Duración<select aria-label="Duración de actividad semanal" className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" value={agendaMinutes} onChange={event => { setAgendaMinutes(Number(event.target.value)); setAgendaProposal(null); }}>
            {[15, 20, 25, 30, 35, 40, 45, 60].map(value => <option key={value} value={value}>{value} min</option>)}
          </select></label>
          <button className="btn sec min-h-11 max-[520px]:col-span-full" type="button" onClick={() => {
            setError(''); setAgendaProposal(null);
            const weekStart = weekStartForStudyDate(agendaDate);
            if (weekStart !== currentWeekKey) { setError('La fecha debe pertenecer a la semana seleccionada.'); return; }
            const current = weekStart ? weeklyItems.filter(item => item.weekStart === weekStart && item.status === 'planned') : [];
            const resolved = resolveTrainingDay({ dateKey:agendaDate, preferences });
            const allocated = current.filter(item => item.dateKey === agendaDate).reduce((sum, item) => sum + item.minutes, 0)
              + activities.filter(item => item.dateKey === agendaDate).reduce((sum, item) => sum + item.minutes, 0);
            if (!weekStart || agendaDate < agendaMinDate || agendaDate > agendaMaxDate || agendaTopicId === '' || !catalogTopics.some(topic => topic.id === agendaTopicId)) { setError('Elige una fecha futura de la semana seleccionada y un tema del catálogo disponible.'); return; }
            if (agendaKind !== 'newContent' && !seenTopicIds.includes(agendaTopicId)) { setError('El tema está pendiente; puedes programarlo como tema nuevo, no como repaso.'); return; }
            if (!resolved.minutes || allocated + agendaMinutes > resolved.minutes) { setError('La actividad supera el tiempo disponible de esa fecha. Ajusta la duración o la disponibilidad.'); return; }
            const timestamp = now.getTime();
            const id = `agenda:${agendaDate}:${agendaKind}:${agendaTopicId}:${timestamp}`;
            setAgendaProposal({ weekStart, item:{ id, weekStart, dateKey:agendaDate, kind:agendaKind, topicIds:[agendaTopicId], minutes:agendaMinutes, status:'planned', createdAt:timestamp, updatedAt:timestamp } });
          }}>Revisar propuesta</button>
        </div>}
        {agendaProposal && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--r-s)] bg-[var(--card)] p-3" role="group" aria-label="Propuesta de semana pendiente de confirmación">
          <p className="m-0 flex-[1_1_100%]">Añadir {weeklyActivityNames[agendaProposal.item.kind]} · {agendaProposal.item.topicIds[0]} · {agendaProposal.item.minutes} min, el {fullDateFormatter.format(new Date(`${agendaProposal.item.dateKey}T12:00:00`))}. Se conserva el historial ya cerrado.</p>
          <button className="btn" type="button" onClick={() => {
            const weekItems = [...weeklyItems.filter(item => item.weekStart === agendaProposal.weekStart && item.status === 'planned'), agendaProposal.item];
            if (!onSaveWeeklyAgenda?.(agendaProposal.weekStart, weekItems)) { setError('No se pudo guardar la propuesta en este dispositivo.'); return; }
            setAgendaProposal(null); setError('');
          }}>Confirmar actividad semanal</button>
          <button className="btn sec" type="button" onClick={() => setAgendaProposal(null)}>Cancelar</button>
        </div>}
        {!!visibleWeeklyItems.length && <ul className="mt-3 mb-0 grid gap-2 p-0 list-none" aria-label="Actividades de la agenda semanal">{visibleWeeklyItems.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-s)] bg-[var(--card)] p-3">
          <span>{item.dateKey} · {weeklyActivityNames[item.kind]} · {item.kind === 'sectionRecall' ? `${item.sectionRecall?.sectionTitle ?? item.sectionRecall?.sectionId} (p. ${item.sectionRecall?.printedPage ?? 's/d'}) · ${item.topicIds[0]}` : item.topicIds.join(', ')} · {item.minutes} min · {item.status === 'planned' ? 'Planificada' : item.status === 'completed' ? 'Completada' : item.status === 'rescheduled' ? `Reprogramada al ${item.rescheduledTo}` : 'Omitida'}</span>
          {item.status === 'planned' && item.kind === 'sectionRecall' && item.sectionRecall && <button className="btn sec min-h-11" type="button" onClick={() => onOpenSectionRecall?.(item)}>Practicar tema con test</button>}
          {item.status === 'planned' && <button className="btn sec min-h-11" type="button" onClick={() => { if (!onSetWeeklyAgendaStatus?.(item.id, 'skipped')) setError('No se pudo registrar el cambio.'); }}>Marcar como omitida</button>}
        </li>)}</ul>}
      </section>
    </> : <div className="planning-month mt-4">
      <div className="planning-month-heading mb-3 flex items-center justify-between gap-3"><button className="grid min-w-11 min-h-11 place-items-center rounded-[var(--r-m)] border border-line bg-[var(--card)] p-1 text-ink [font:inherit] [cursor:pointer]" type="button" aria-label="Mes anterior" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><ChevronLeft aria-hidden="true" /></button><h3 className="m-0 text-[length:var(--fs-m)] capitalize">{monthTitle}</h3><button className="grid min-w-11 min-h-11 place-items-center rounded-[var(--r-m)] border border-line bg-[var(--card)] p-1 text-ink [font:inherit] [cursor:pointer]" type="button" aria-label="Mes siguiente" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><ChevronRight aria-hidden="true" /></button></div>
      <div className="planning-month-grid grid grid-cols-7 gap-[.35rem] max-[520px]:gap-[.2rem]" role="group" aria-label={`Disponibilidad de estudio en ${monthTitle}`}>
        {[1, 2, 3, 4, 5, 6, 0].map(day => <b className="planning-month-weekday py-[.3rem] text-center text-muted text-[length:var(--fs-xs)]" key={day}>{dayNames[day].slice(0, 2)}</b>)}
        {Array.from({ length:firstDayOffset }, (_, index) => <span className="planning-month-blank min-w-0" aria-hidden="true" key={`blank-${index}`} />)}
        {Array.from({ length:daysInMonth }, (_, index) => {
          const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
          const day = date.getDay(), dateValue = dayKey(date), dayActivities = activitiesByDate.get(dateValue) ?? [];
          const resolved = resolveTrainingDay({ dateKey: dateValue, preferences });
          const isToday = dateValue === dayKey(now), completed = completedDays.has(dateValue), minutesAvailable = resolved.minutes;
          const academy = day === preferences.introductionDay;
          const eventNames = resolved.events.map(event => event.title);
          const description = `${dayNames[day]} ${index + 1}: ${minutesAvailable ? `${minutesAvailable} minutos disponibles, ${focusLabels[resolved.focus]}${academy && !resolved.override ? ', academia' : ''}` : 'descanso'}${eventNames.length ? `, eventos: ${eventNames.join(', ')}` : ''}${completed ? ', sesión completada' : ''}${dayActivities.length ? `, ${dayActivities.length} repasos planificados` : ''}${isToday ? ', hoy' : ''}`;
          return <div role="group" className={`planning-month-day grid min-w-0 min-h-20 content-start gap-[.2rem] rounded-[var(--r-s)] border border-line p-[.35rem] [overflow-wrap:anywhere] max-[520px]:min-h-[4.5rem] max-[520px]:p-1${isToday ? ' !border-brand ![box-shadow:inset_0_0_0_1px_var(--brand)]' : ''}${completed ? ' !bg-[var(--surface-soft)]' : ''}${dayActivities.length ? ' has-planned-activities' : ''}`} aria-label={description} key={dateValue}>
            <b className="text-[length:var(--fs-s)]">{index + 1}</b>
            {minutesAvailable ? <><span className="planning-month-time text-[length:var(--fs-xs)] leading-[1.25]"><span className="planning-month-time-wide max-[520px]:hidden">{minutesAvailable} min</span><span className="planning-month-time-narrow hidden max-[520px]:inline">{minutesAvailable}m</span></span><small className="text-[length:var(--fs-xs)] leading-[1.25] text-muted max-[520px]:hidden">{resolved.override ? (resolved.override.kind === 'study-window' ? 'Disponibilidad especial' : 'Horario ajustado') : academy ? 'Academia' : focusLabels[resolved.focus]}</small></> : <small className="text-[length:var(--fs-xs)] leading-[1.25] text-muted max-[520px]:hidden">Descanso</small>}
            {!!resolved.events.length && <small className="text-[length:var(--fs-xs)] leading-[1.15] text-accent max-[520px]:hidden">{resolved.events.map(event => event.title).join(', ')}</small>}
            {!!dayActivities.length && <strong className="text-[length:var(--fs-xs)] leading-[1.25] text-accent font-bold">{dayActivities.length} {dayActivities.length === 1 ? 'repaso' : 'repasos'}</strong>}
            {completed && <strong className="text-[length:var(--fs-xs)] leading-[1.25] text-accent font-bold">Completada</strong>}{isToday && <strong className="text-[length:var(--fs-xs)] leading-[1.25] text-accent font-bold">Hoy</strong>}
          </div>;
        })}
      </div>
      <p className="planning-week-note mt-3.5 mb-0 text-muted text-[length:var(--fs-s)]">Las actividades futuras son repasos que tú confirmas para temas ya vistos. El temario se consulta en papel; TAI no añade PDFs ni inventa apartados.</p>
      <section className="planning-calendar-editor mt-5 min-w-0 rounded-[var(--r-m)] border border-line bg-[var(--surface-soft)] p-4" aria-labelledby="planned-activity-title">
        <h3 className="m-0 text-[length:var(--fs-m)]" id="planned-activity-title">Programar un repaso</h3>
        <p className="mt-[.4rem] mb-3 text-muted">Elige una actividad de un tema visto. TAI respeta el descanso y el tiempo disponible de cada día.</p>
        {!topics.length ? <p className="mt-[.4rem] mb-3 text-muted">No hay temas vistos para planificar. Márcalos en «Temas vistos» después de estudiarlos en papel.</p> : <div className="planning-calendar-form grid grid-cols-4 items-end gap-3 max-[520px]:grid-cols-2">
          <label className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]">Fecha<input className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" aria-label="Fecha del repaso" type="date" min={dayKey(tomorrow)} max={dayKey(maxDate)} value={dateKey} onChange={event => { setDateKey(event.target.value); setProposal(null); setError(''); }} /></label>
          <label className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]">Tema del repaso<select className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" aria-label="Tema del repaso" value={topicId} onChange={event => { setTopicId(event.target.value); setProposal(null); setError(''); }}>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.id} · {topic.name}</option>)}</select></label>
          <div className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]"><span>Actividad</span><p className="m-0 flex min-h-11 items-center rounded-[var(--r-s)] border border-line bg-[var(--card)] p-2 text-ink">Test por tema</p></div>
          <label className="grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)]">Duración<select className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" aria-label="Duración del repaso" value={minutes} onChange={event => { setMinutes(Number(event.target.value)); setProposal(null); setError(''); }}>{[10, 20, 30, 40, 60].map(value => <option key={value} value={value}>{value} minutos</option>)}</select></label>
          <button className="btn sec min-h-11 max-[520px]:col-span-full" type="button" onClick={prepareCreation}>Revisar propuesta</button>
        </div>}
        {activities.length > 0 && <ul className="planning-calendar-activities mt-4 mb-0 grid gap-2 p-0 list-none" aria-label="Repasos planificados">{activities.map(activity => {
          const scheduledDate = new Date(`${activity.dateKey}T12:00:00`);
          return <li className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(8rem,12rem)_auto] items-center gap-3 rounded-[var(--r-m)] border border-line bg-[var(--card)] p-3 max-[520px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" key={activity.id}>
            <div className="grid min-w-0 gap-1 max-[520px]:col-span-full"><b>{fullDateFormatter.format(scheduledDate)}</b><span className="text-muted text-[length:var(--fs-s)] [overflow-wrap:anywhere]">{activityNames[activity.activity]} · {activity.topicId} {topicName(activity.topicId)} · {activity.minutes} min</span></div>
            <button className="btn sec min-h-11 whitespace-nowrap max-[520px]:w-full" type="button" onClick={() => onOpenActivity(activity)}>Abrir</button>
            <label className="planning-reschedule-date grid min-w-0 gap-[.3rem] text-muted text-[length:var(--fs-s)] max-[520px]:col-span-full">Nueva fecha<input className="box-border w-full min-w-0 min-h-11 rounded-[var(--r-s)] border border-[var(--line-strong,var(--line))] bg-[var(--card)] p-2 text-ink [font:inherit]" aria-label={`Nueva fecha para ${activity.topicId}`} type="date" min={dayKey(tomorrow)} max={dayKey(maxDate)} value={moveDates[activity.id] ?? ''} onChange={event => { setMoveDates(current => ({ ...current, [activity.id]: event.target.value })); setProposal(null); setError(''); }} /></label>
            <button className="btn sec min-h-11 whitespace-nowrap max-[520px]:w-full" type="button" onClick={() => prepareMove(activity)}>Reprogramar</button>
          </li>;
        })}</ul>}
        {proposal && <div className="planning-calendar-proposal mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--r-s)] bg-[var(--card)] p-3 [border-inline-start:.25rem_solid_var(--brand)]" role="group" aria-label="Propuesta pendiente de confirmación">
          {proposal.type === 'create' ? <p className="m-0 flex-[1_1_100%]">Propuesta: {activityNames[proposal.activity]} de {proposal.minutes} min para {proposal.topicId} · {topicName(proposal.topicId)}, el {fullDateFormatter.format(new Date(`${proposal.dateKey}T12:00:00`))}.</p> : <p className="m-0 flex-[1_1_100%]">Propuesta: mover el repaso a {fullDateFormatter.format(new Date(`${proposal.dateKey}T12:00:00`))}. El cambio no se guardará hasta que lo confirmes.</p>}
          <button className="btn" type="button" onClick={confirmProposal}>Confirmar planificación</button><button className="btn sec" type="button" onClick={() => setProposal(null)}>Cancelar</button>
        </div>}
        {error && <p className="planning-calendar-error font-[650] [color:var(--danger,var(--ink))]" role="alert">{error}</p>}
      </section>
    </div>}
  </section>;
}
