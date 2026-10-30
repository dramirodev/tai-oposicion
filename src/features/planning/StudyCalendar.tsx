import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { ScheduledStudyActivity, ScheduledStudyActivityKind } from '../../core/domain/study-training-calendar.js';
import { proposeStudyActivity, proposeStudyActivityReschedule, type ScheduleDecision } from '../../core/domain/study-training-calendar.js';
import type { TrainingPreferences } from '../../core/domain/entities.js';
import type { TrainingSessionHistoryEntry } from '../../core/domain/study-training-session.js';

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const focusLabels = { rest: 'Descanso', 'new-content': 'Contenido nuevo', consolidation: 'Recuperación y consolidación' } as const;
const monthTitleFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const activityNames: Record<ScheduledStudyActivityKind, string> = { activeRecall:'Tarjetas de repaso', topicTest:'Test por tema' };
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

export function StudyCalendar({ preferences, weekday, now, history, topics, activities, onSchedule, onReschedule, onOpenActivity }: {
  preferences: TrainingPreferences; weekday: number; now: Date; history: readonly TrainingSessionHistoryEntry[];
  topics: readonly { id:string; name:string }[]; activities: readonly ScheduledStudyActivity[];
  onSchedule(input: { dateKey:string; activity:ScheduledStudyActivityKind; topicId:string; minutes:number }): ScheduleDecision | { ok:false; reason:'storage-failed' };
  onReschedule(input: { id:string; dateKey:string }): ScheduleDecision | { ok:false; reason:'storage-failed' };
  onOpenActivity(activity: ScheduledStudyActivity): void;
}) {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [dateKey, setDateKey] = useState('');
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '');
  const [kind, setKind] = useState<ScheduledStudyActivityKind>('activeRecall');
  const [minutes, setMinutes] = useState(20);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  // La fecha pendiente de cada repaso se guarda por separado: una sola compartida se copiaba a todas las filas.
  const [moveDates, setMoveDates] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const focus = preferences.focusByDay ?? ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'];
  const monthTitle = monthTitleFormatter.format(month);
  const firstDayOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const completedDays = new Set(history.map(session => session.dateKey));
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 180);
  const dateForInput = dateKey || dayKey(tomorrow);

  const prepareCreation = () => {
    const decision = proposeStudyActivity({ dateKey:dateForInput, activity:kind, topicId, minutes, now:now.getTime(), preferences, seenTopicIds:topics.map(topic => topic.id), existing:activities });
    const message = decisionText(decision);
    setError(message || '');
    if (!message) setProposal({ type:'create', dateKey:dateForInput, activity:kind, topicId, minutes });
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

  return <section className="planning-week" aria-labelledby="planning-week-title">
    <div className="planning-section-heading"><div><p className="planning-kicker">Ritmo semanal</p><h2 id="planning-week-title">Estudio, repaso y descanso</h2></div><Link to="/settings">Ajustar disponibilidad</Link></div>
    <div className="planning-schedule-views" aria-label="Vista del calendario">
      <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Semana</button>
      <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>Mes</button>
    </div>
    {view === 'week' ? <>
      <ol>{[1, 2, 3, 4, 5, 6, 0].map(day => <li key={day} className={day === weekday ? 'is-today' : ''} aria-current={day === weekday ? 'date' : undefined}>
        <b>{dayNames[day]}</b><span>{preferences.minutesByDay[day] ? `${preferences.minutesByDay[day]} min` : '0 min'}</span><small>{focusLabels[focus[day]]}{day === preferences.introductionDay ? ' · academia' : ''}</small>
      </li>)}</ol>
      <p className="planning-week-note">El reparto refleja tus preferencias editables, no una distribución demostrada como óptima.</p>
    </> : <div className="planning-month">
      <div className="planning-month-heading"><button type="button" aria-label="Mes anterior" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><ChevronLeft aria-hidden="true" /></button><h3>{monthTitle}</h3><button type="button" aria-label="Mes siguiente" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><ChevronRight aria-hidden="true" /></button></div>
      <div className="planning-month-grid" role="group" aria-label={`Disponibilidad de estudio en ${monthTitle}`}>
        {[1, 2, 3, 4, 5, 6, 0].map(day => <b className="planning-month-weekday" key={day}>{dayNames[day].slice(0, 2)}</b>)}
        {Array.from({ length:firstDayOffset }, (_, index) => <span className="planning-month-blank" aria-hidden="true" key={`blank-${index}`} />)}
        {Array.from({ length:daysInMonth }, (_, index) => {
          const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
          const day = date.getDay(), dateValue = dayKey(date), dayActivities = activitiesByDate.get(dateValue) ?? [];
          const isToday = dateValue === dayKey(now), completed = completedDays.has(dateValue), minutesAvailable = preferences.minutesByDay[day];
          const academy = day === preferences.introductionDay;
          const description = `${dayNames[day]} ${index + 1}: ${minutesAvailable ? `${minutesAvailable} minutos disponibles, ${focusLabels[focus[day]]}${academy ? ', academia' : ''}` : 'descanso'}${completed ? ', sesión completada' : ''}${dayActivities.length ? `, ${dayActivities.length} repasos planificados` : ''}${isToday ? ', hoy' : ''}`;
          return <div role="group" className={`planning-month-day${isToday ? ' is-today' : ''}${completed ? ' is-complete' : ''}${dayActivities.length ? ' has-planned-activities' : ''}`} aria-label={description} key={dateValue}>
            <b>{index + 1}</b>
            {minutesAvailable ? <><span className="planning-month-time"><span className="planning-month-time-wide">{minutesAvailable} min</span><span className="planning-month-time-narrow">{minutesAvailable}m</span></span><small>{academy ? 'Academia' : focusLabels[focus[day]]}</small></> : <small>Descanso</small>}
            {!!dayActivities.length && <strong>{dayActivities.length} {dayActivities.length === 1 ? 'repaso' : 'repasos'}</strong>}
            {completed && <strong>Completada</strong>}{isToday && <strong>Hoy</strong>}
          </div>;
        })}
      </div>
      <p className="planning-week-note">Las actividades futuras son repasos que tú confirmas para temas ya vistos. El temario se consulta en papel; TAI no añade PDFs ni inventa apartados.</p>
      <section className="planning-calendar-editor" aria-labelledby="planned-activity-title">
        <h4 id="planned-activity-title">Programar un repaso</h4>
        <p>Elige una actividad de un tema visto. TAI respeta el descanso y el tiempo disponible de cada día.</p>
        {!topics.length ? <p>No hay temas vistos para planificar. Márcalos en «Temas vistos» después de estudiarlos en papel.</p> : <div className="planning-calendar-form">
          <label>Fecha<input aria-label="Fecha del repaso" type="date" min={dayKey(tomorrow)} max={dayKey(maxDate)} value={dateKey} onChange={event => { setDateKey(event.target.value); setProposal(null); setError(''); }} /></label>
          <label>Tema visto<select aria-label="Tema del repaso" value={topicId} onChange={event => { setTopicId(event.target.value); setProposal(null); setError(''); }}>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.id} · {topic.name}</option>)}</select></label>
          <label>Actividad<select aria-label="Tipo de repaso" value={kind} onChange={event => { setKind(event.target.value as ScheduledStudyActivityKind); setProposal(null); setError(''); }}><option value="activeRecall">Tarjetas de repaso</option><option value="topicTest">Test por tema</option></select></label>
          <label>Duración<select aria-label="Duración del repaso" value={minutes} onChange={event => { setMinutes(Number(event.target.value)); setProposal(null); setError(''); }}>{[10, 20, 30, 40, 60].map(value => <option key={value} value={value}>{value} minutos</option>)}</select></label>
          <button className="btn sec" type="button" onClick={prepareCreation}>Revisar propuesta</button>
        </div>}
        {activities.length > 0 && <ul className="planning-calendar-activities" aria-label="Repasos planificados">{activities.map(activity => {
          const scheduledDate = new Date(`${activity.dateKey}T12:00:00`);
          return <li key={activity.id}>
            <div><b>{fullDateFormatter.format(scheduledDate)}</b><span>{activityNames[activity.activity]} · {activity.topicId} {topicName(activity.topicId)} · {activity.minutes} min</span></div>
            <button className="btn sec" type="button" onClick={() => onOpenActivity(activity)}>Abrir</button>
            <label className="planning-reschedule-date">Nueva fecha<input aria-label={`Nueva fecha para ${activity.topicId}`} type="date" min={dayKey(tomorrow)} max={dayKey(maxDate)} value={moveDates[activity.id] ?? ''} onChange={event => { setMoveDates(current => ({ ...current, [activity.id]: event.target.value })); setProposal(null); setError(''); }} /></label>
            <button className="btn sec" type="button" onClick={() => prepareMove(activity)}>Reprogramar</button>
          </li>;
        })}</ul>}
        {proposal && <div className="planning-calendar-proposal" role="group" aria-label="Propuesta pendiente de confirmación">
          {proposal.type === 'create' ? <p>Propuesta: {activityNames[proposal.activity]} de {proposal.minutes} min para {proposal.topicId} · {topicName(proposal.topicId)}, el {fullDateFormatter.format(new Date(`${proposal.dateKey}T12:00:00`))}.</p> : <p>Propuesta: mover el repaso a {fullDateFormatter.format(new Date(`${proposal.dateKey}T12:00:00`))}. El cambio no se guardará hasta que lo confirmes.</p>}
          <button className="btn" type="button" onClick={confirmProposal}>Confirmar planificación</button><button className="btn sec" type="button" onClick={() => setProposal(null)}>Cancelar</button>
        </div>}
        {error && <p className="planning-calendar-error" role="alert">{error}</p>}
      </section>
    </div>}
  </section>;
}
