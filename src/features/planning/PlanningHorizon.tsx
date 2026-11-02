import { Link } from 'react-router';
import type { TrainingPreferences } from '../../core/domain/entities.js';
import { buildStudyHorizonSummary, type StudyHorizonSummary } from '../../core/domain/study-planning-horizon.js';

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

export function PlanningHorizon({ targetDate, today, preferences, catalogTopicIds, studiedTopicIds }: {
  targetDate: string;
  today: Date;
  preferences: TrainingPreferences;
  catalogTopicIds: readonly string[];
  studiedTopicIds: readonly string[];
}) {
  const summary = buildStudyHorizonSummary({
    todayDateKey: localDateKey(today), targetDate,
    academyTopicOrderIds: preferences.academyTopicOrderIds,
    catalogTopicIds, studiedTopicIds, preferences,
  });
  const focusByDay = preferences.focusByDay ?? defaultFocus;
  const targetLabel = targetDate && summary.daysUntilObjective !== null
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${targetDate}T12:00:00`))
    : null;

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
        <p className="m-0 text-muted text-sm">La marca de «estudiado» registra cobertura declarada, no demuestra comprensión o recuerdo. La proyección solo estima espacios para introducir temas según el horario semanal: no estima horas necesarias ni probabilidad de aprobar, y tampoco resta vacaciones o ausencias aún no registradas.</p>
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
        <p className="mt-2 mb-0 text-muted text-xs">Patrón repetido de Ajustes; al cambiarlo, la vista se actualiza. No es una agenda con clases o vacaciones.</p>
      </section>
    </div>
  </section>;
}
