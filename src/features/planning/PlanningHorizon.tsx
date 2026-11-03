import { Link } from 'react-router';
import type { TrainingPreferences } from '../../core/domain/entities.js';
import type { WeeklyAgendaItem } from '../../core/domain/study-weekly-agenda.js';
import { buildStudyHorizonSummary, type StudyHorizonSummary } from '../../core/domain/study-planning-horizon.js';
import { summarizeAcademySectionProgress } from '../../core/domain/academy-section-progress-summary.js';
import type { AcademyStudyProgressOverviewSnapshot } from '../../core/domain/academy-study-progress.js';
import { academyCurriculumMaterialIndex } from '../../core/domain/academy-curriculum.generated.js';

const weekDays = [
  { weekday: 1, label: 'Lun' }, { weekday: 2, label: 'Mar' }, { weekday: 3, label: 'Mié' },
  { weekday: 4, label: 'Jue' }, { weekday: 5, label: 'Vie' }, { weekday: 6, label: 'Sáb' }, { weekday: 0, label: 'Dom' },
] as const;
const defaultFocus = ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'] as const;
const focusLabel = { rest: 'Descanso', 'new-content': 'Tema nuevo', consolidation: 'Repaso' } as const;

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function statusMessage(summary: StudyHorizonSummary): string {
  if (summary.status === 'no-academy-order') return 'Configura en Ajustes el orden real de la academia. El catálogo no se usa como orden de clase.';
  if (summary.status === 'objective-unknown') return 'Añade una fecha objetivo válida en Ajustes para calcular el horizonte. No se sustituye por una fecha estimada.';
  if (summary.status === 'objective-reached') return 'La fecha objetivo es hoy o ya pasó. La secuencia y el historial se conservan; actualiza el objetivo si quieres una nueva proyección.';
  const topics = `${summary.pendingOrderedTopicCount} ${summary.pendingOrderedTopicCount === 1 ? 'tema' : 'temas'}`;
  const slots = `${summary.availableNewTopicSessions} ${summary.availableNewTopicSessions === 1 ? 'espacio' : 'espacios'}`;
  if (summary.status === 'sequence-covered') return `No quedan temas pendientes en la secuencia. Los ${summary.markedStudiedTopicCount} temas marcados solo representan cobertura declarada; no demuestran comprensión ni recuerdo.`;
  if (summary.status === 'capacity-gap') return `Quedan ${topics} de la secuencia sin marca y el horario ofrece ${slots} de contenido nuevo antes del objetivo. Faltarían ${summary.topicSessionGap}; haría falta ampliar los días de contenido nuevo o mover la fecha objetivo.`;
  return `Quedan ${topics} de la secuencia sin marca y hay ${slots} de contenido nuevo hasta el objetivo. Es un máximo optimista de un tema por espacio, no una estimación del tiempo para comprenderlos.`;
}

export function PlanningHorizon({ targetDate, today, preferences, catalogTopicIds, studiedTopicIds, weeklyItems = [], sectionProgress, sectionProgressError = false, onRetrySectionProgress }: {
  targetDate: string;
  today: Date;
  preferences: TrainingPreferences;
  catalogTopicIds: readonly string[];
  studiedTopicIds: readonly string[];
  weeklyItems?: readonly WeeklyAgendaItem[];
  sectionProgress?: AcademyStudyProgressOverviewSnapshot;
  sectionProgressError?: boolean;
  onRetrySectionProgress?(): void;
}) {
  const summary = buildStudyHorizonSummary({
    todayDateKey: localDateKey(today), targetDate,
    academyTopicOrderIds: preferences.academyTopicOrderIds,
    catalogTopicIds, studiedTopicIds, preferences,
    plannedNewContentItems:weeklyItems.filter(item => item.kind === 'newContent'),
  });
  const focusByDay = preferences.focusByDay ?? defaultFocus;
  const targetLabel = targetDate && summary.daysUntilObjective !== null
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${targetDate}T12:00:00`))
    : null;
  const upcomingEvents = (summary.calendarEvents ?? []).filter(event => event.endDate >= localDateKey(today)).slice(0, 5);
  const sectionSummary = sectionProgress && summarizeAcademySectionProgress({ ...sectionProgress, materialIndex:academyCurriculumMaterialIndex });

  return <section className="my-5 grid min-w-0 gap-4 rounded-[var(--r-xl)] border border-line p-4 sm:p-5 [background:var(--card)]" aria-labelledby="planning-horizon-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="planning-horizon-title" className="m-0 text-xl">Horizonte y semana</h2>
      <Link className="min-h-11 inline-flex items-center text-link underline underline-offset-2" to="/settings#exam-date">Ajustar fecha y horario</Link>
    </div>
    <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,.8fr)]">
      <section aria-labelledby="planning-global-title" className="min-w-0">
        <h3 id="planning-global-title" className="mb-2 text-base">Hasta tu fecha objetivo</h3>
        <p className="mb-2 text-muted">{targetLabel ? `Objetivo personal: ${targetLabel}. No confirma una convocatoria oficial.` : 'No hay una fecha objetivo válida configurada.'}</p>
        {summary.status !== 'no-academy-order' && <p className="mb-2">Secuencia de academia: {summary.markedStudiedTopicCount} de {summary.orderedTopicCount} temas marcados como estudiados · {summary.pendingOrderedTopicCount} sin marca.</p>}
        <p className="mb-2" role="status">{statusMessage(summary)}</p>
        {summary.unsequencedCatalogTopicCount > 0 && <p className="mb-2 text-muted">{summary.unsequencedCatalogTopicCount} {summary.unsequencedCatalogTopicCount === 1 ? 'tema del catálogo todavía no está' : 'temas del catálogo todavía no están'} en la secuencia de academia; no se les asigna un orden automáticamente.</p>}
        {summary.orderedTopicMissingFromCatalogCount > 0 && <p className="mb-2 text-muted">{summary.orderedTopicMissingFromCatalogCount} {summary.orderedTopicMissingFromCatalogCount === 1 ? 'entrada de la secuencia no aparece' : 'entradas de la secuencia no aparecen'} en el catálogo actual y no {summary.orderedTopicMissingFromCatalogCount === 1 ? 'puede' : 'pueden'} planificarse.</p>}
        <p className="m-0 text-muted text-sm">La marca de «estudiado» registra cobertura declarada, no demuestra comprensión o recuerdo. La proyección estima espacios para introducir temas según el horario habitual y las excepciones guardadas; no estima horas necesarias ni probabilidad de aprobar.</p>
        <section className="mt-3 rounded-md border border-line p-3" aria-labelledby="planning-section-progress-title">
          <h4 id="planning-section-progress-title" className="m-0 text-sm font-semibold">Avance declarado por apartados</h4>
          {sectionProgressError ? <div className="mt-2" role="alert"><p className="my-0 text-sm">No se pudo leer el progreso local por apartados.</p>{onRetrySectionProgress && <button className="btn sec mt-2" type="button" onClick={onRetrySectionProgress}>Reintentar</button>}</div>
            : !sectionSummary ? <p className="mt-2 mb-0 text-sm text-muted" role="status">Cargando progreso guardado…</p>
              : sectionSummary.selectedSyllabusTopicCount === 0 ? <p className="mt-2 mb-0 text-sm text-muted">Aún no hay un temario principal seleccionado para registrar este avance. Puedes elegirlo en Temario → tema → Material de academia.</p>
                : <>
                  <p className="mt-2 mb-1 text-sm">{sectionSummary.selectedSyllabusTopicCount} {sectionSummary.selectedSyllabusTopicCount === 1 ? 'tema tiene' : 'temas tienen'} un temario principal seleccionado · {sectionSummary.trackedSectionCount} {sectionSummary.trackedSectionCount === 1 ? 'apartado tiene' : 'apartados tienen'} un estado de cobertura guardado.</p>
                  <p className="my-1 text-sm text-muted">Declarados cubiertos: {sectionSummary.coveredSectionCount} · parciales: {sectionSummary.partialSectionCount} · reiniciados a «sin iniciar»: {sectionSummary.resetSectionCount} · con autoevaluación diferida: {sectionSummary.delayedSelfCheckSectionCount}.</p>
                  {sectionSummary.staleSyllabusTopicCount > 0 && <p className="my-1 text-sm text-muted" role="status">Se excluye el progreso de {sectionSummary.staleSyllabusTopicCount} tema(s) cuya selección corresponde a otra versión de material. Revísala en Temario.</p>}
                  <p className="m-0 text-xs text-muted">Son registros de apartados con actividad, no el total del programa ni una medida de dominio. Las autoevaluaciones son personales; los índices extraídos requieren revisión.</p>
                </>}
        </section>
        {summary.plannedExtraNewTopicSessions > 0 && <p className="mt-2 mb-0 text-muted text-sm" role="status">La agenda confirmada añade {summary.plannedExtraNewTopicSessions} espacio(s) de contenido nuevo en día(s) que habitualmente son de consolidación. Se cuentan aparte y solo para las fechas/temas aún pendientes.</p>}
      </section>
      <section aria-labelledby="planning-week-title" className="min-w-0">
        <h3 id="planning-week-title" className="mb-2 text-base">Semana habitual</h3>
        <p className="mb-3 text-muted">{formatDuration(summary.weeklyMinutes)} configurados · {summary.weeklyNewContentDays} días con espacio para tema nuevo.</p>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 min-[420px]:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
          {weekDays.map(({ weekday, label }) => {
            const minutes = preferences.minutesByDay[weekday];
            const focus = focusByDay[weekday];
            const isToday = today.getDay() === weekday;
            return <li key={weekday} aria-current={isToday ? 'date' : undefined} className={`min-w-0 rounded-[var(--r-m)] border border-line p-2.5${isToday ? ' [box-shadow:inset_0_0_0_1px_var(--brand)]' : ''}`}>
              <p className="m-0 font-semibold">{label}{isToday ? ' · hoy' : ''}</p>
              <p className="m-0 text-sm">{minutes ? `${minutes} min` : 'Descanso'}</p>
              {minutes > 0 && <p className="m-0 text-muted text-xs">{focusLabel[focus]}</p>}
            </li>;
          })}
        </ul>
        <p className="mt-2 mb-0 text-muted text-xs">Patrón habitual de Ajustes; las excepciones cambian solo sus fechas y no se acumulan después.</p>
        {summary.calendarOverrideDays > 0 && <p className="mt-2 mb-0 text-muted text-sm">{summary.calendarOverrideDays} día(s) del horizonte tienen una excepción de disponibilidad aplicada.</p>}
        {upcomingEvents.length > 0 && <ul aria-label="Próximos eventos" className="mt-3 mb-0 grid gap-1 pl-5 text-sm">{upcomingEvents.map(event => <li key={event.id}><b>{event.title}</b> · {event.startDate === event.endDate ? event.startDate : `${event.startDate}–${event.endDate}`} · {event.kind === 'unavailable' ? 'sin estudio' : event.kind === 'study-window' ? `${event.studyMinutes} min/día${event.startTime ? `, ${event.startTime}–${event.endTime}` : ''}` : event.kind === 'class' ? 'clase informativa' : event.simulation ? `simulacro · ${event.simulation.questionCount} preguntas · penalización ${event.simulation.scoring.wrongPenalty ?? 'desconocida'}` : 'hito informativo'}{event.source ? ` · ${event.source}` : ''}{event.kind === 'milestone' && event.simulation && <> · <Link to={`/sim?milestone=${encodeURIComponent(event.id)}`}>Preparar hito</Link></>}</li>)}</ul>}
      </section>
    </div>
  </section>;
}
