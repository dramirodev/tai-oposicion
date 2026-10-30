import { Link } from 'react-router';
import { Clover } from 'lucide-react';
import { FAILURE_REASONS } from '../../shared/presentation/study-labels.js';
import type { StatsServices } from '../../shared/ui/study-services.js';
import type { StatsDomainTopic, StatsSnapshot } from '../../core/application/stats/statistics-model.js';
import { MobileDisclosure } from './MobileDisclosure.js';

const date = (time: number) => new Date(time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const domainTone: Record<string, { dot: string; border: string }> = {
  r: { dot: 'bg-[var(--bad)]', border: 'border-l-[var(--bad)]' },
  y: { dot: 'bg-[var(--amber)]', border: 'border-l-[var(--amber)]' },
  g: { dot: 'bg-[var(--ok)]', border: 'border-l-[var(--ok)]' },
  n: { dot: 'bg-muted opacity-50', border: 'border-l-muted' },
};

function ReviewLoad({ values, generatedAt }: { values: readonly number[]; generatedAt: number }) {
  const max = Math.max(1, ...values);
  return <div className="chart-scroll max-w-full overflow-x-auto overscroll-x-contain" role="region" aria-label="Repasos previstos en los próximos 14 días" tabIndex={0}>
    <div className="flex h-24 min-w-[22rem] items-end gap-0.5">{values.map((value, index) => <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5" title={`${value} repasos`} key={index}>
      <small className="text-[length:var(--fs-xs)] tracking-[-.03em] whitespace-nowrap text-muted leading-[1.1]">{value || ''}</small>
      <div aria-hidden="true" className={`block min-h-0.5 w-full rounded-t-[.1875rem] ${index === 0 && value ? 'bg-[var(--accent)] opacity-100' : 'bg-[var(--selb)] opacity-[.85]'}`} style={{ height: `${Math.round(60 * value / max)}px` }} />
      <small className="text-[length:var(--fs-xs)] tracking-[-.03em] whitespace-nowrap text-muted leading-[1.1]">{index === 0 ? 'hoy' : date(generatedAt + index * 86400000)}</small>
    </div>)}</div>
  </div>;
}

function DomainMap({ snapshot, stats, topics, domainOrder, setDomainOrder, formattedDays }: {
  snapshot: StatsSnapshot; stats: StatsServices; topics: readonly StatsDomainTopic[]; domainOrder: string;
  setDomainOrder: (value: string) => void; formattedDays: (days: number | null) => string;
}) {
  return <>
    <h2 className="mt-1.5">Mapa de dominio</h2>
    <div className="mt-3 mb-5 flex flex-wrap items-center gap-3 text-[length:var(--fs-s)] font-normal leading-[1.8]">{[['r', 'Reforzar'], ['y', 'A vigilar'], ['g', 'Dominado'], ['n', 'Sin datos']].map(([code, label]) => <span className="inline-flex items-center gap-1.5" key={code}><span className={`inline-block size-[.6875rem] shrink-0 rounded-full ${domainTone[code]?.dot ?? domainTone.n.dot}`} aria-hidden="true" />{snapshot.domains.filter(topic => topic.status === code).length} {label}</span>)}</div>
    <div className="seg"><button className={domainOrder !== 'frios' ? 'on' : ''} aria-pressed={domainOrder !== 'frios'} onClick={() => { setDomainOrder('tema'); stats.savePreference('domainOrder', { order: 'tema' }); }}>Por tema</button><button className={domainOrder === 'frios' ? 'on' : ''} aria-pressed={domainOrder === 'frios'} onClick={() => { setDomainOrder('frios'); stats.savePreference('domainOrder', { order: 'frios' }); }}>Más urgentes primero</button></div>
    <div className="dm my-3 grid min-w-0 grid-cols-2 gap-3 min-[600px]:grid-cols-3">{topics.map(topic => <button className={`dmt flex min-w-0 cursor-pointer flex-col gap-2 [overflow-wrap:anywhere] rounded-[var(--r-m)] border border-line border-l-[3px] bg-surface p-4 text-left font-[inherit] text-ink transition-[background-color,border-color] duration-[var(--duration-fast)] active:scale-[.985] ${domainTone[topic.status]?.border ?? domainTone.n.border}`} key={topic.id} onClick={() => stats.practiceTopics([topic.id])}><div className="dmh flex min-w-0 flex-wrap items-center gap-1.5"><span className={`inline-block size-[.6875rem] shrink-0 rounded-full ${domainTone[topic.status]?.dot ?? domainTone.n.dot}`} aria-hidden="true" /><b>{topic.id}</b><small className="ml-auto">{formattedDays(topic.days)}</small></div><div className="dmn min-h-0 text-[length:var(--fs-b)] leading-[1.5]">{topic.name}</div><div className="dmb h-[.3125rem] overflow-hidden rounded-[.1875rem] bg-line"><span aria-hidden="true" className="block h-full bg-[var(--selb)]" style={{ width: `${topic.score}%` }} /></div><small className="text-[length:var(--fs-s)] leading-[1.5]">{{ r: 'Reforzar', y: 'A vigilar', g: 'Dominado', n: 'Sin datos' }[topic.status]} · {topic.reason}{topic.due ? ` · ${topic.due} repasos` : ''}</small></button>)}</div>
    <p className="legend">Rojo: precisión o cobertura bajas, o más de 30 días sin tocar. Ámbar: va bien pero falta práctica o lleva más de 2 semanas parado. Verde: precisión alta y reciente. La puntuación mezcla tu acierto actual (65 %) y las preguntas vistas respecto al 60 % del banco (35 %).</p>
  </>;
}

function ReadingAndReviewInsights({ snapshot }: { snapshot: StatsSnapshot }) {
  return <>
    <h2>Velocidad de lectura</h2><div className="card">{snapshot.speed.total ? <div className="line"><span>Fallos por velocidad</span><span><b>{snapshot.speed.count}</b> de {snapshot.speed.total} <small>({snapshot.speed.percent}%)</small></span></div> : <p className="sub">Aún no has etiquetado fallos. Al fallar, pulsa «Velocidad» si leíste deprisa.</p>}{snapshot.speed.percent >= 15 && <p className="r"><b>Es un patrón relevante</b>: más de 1 de cada 7 fallos se debe a leer rápido. Prueba el ejercicio de lectura atenta.</p>}<ul className="tips">{['Antes de mirar las opciones, di con tus palabras qué te piden.', 'Marca negaciones y excepciones: NO, SALVO, EXCEPTO.', 'Subraya cifras, plazos y unidades.', 'Lee las cuatro opciones enteras antes de responder.', 'No cambies de respuesta sin un motivo concreto.'].map(tip => <li key={tip}>{tip}</li>)}</ul><Link className="btn" to="/lectura">Entrenar lectura atenta</Link></div>
    <h2>Carga de repasos</h2><div className="card"><ReviewLoad values={snapshot.reviewLoad} generatedAt={snapshot.generatedAt} /><p className="legend">Preguntas que vencen cada día (hoy incluye las atrasadas). Total en 14 días: {snapshot.reviewLoad.reduce((sum, value) => sum + value, 0)}.</p>{snapshot.failureReasons.some(Boolean) && <><h3 className="h3">Por qué fallas</h3>{[5, 7, 1, 2, 3, 4].map(reason => <div className="line" key={reason}><span>{FAILURE_REASONS[reason]}</span><span>{snapshot.failureReasons[reason]} <small>({Math.round(100 * snapshot.failureReasons[reason] / snapshot.failureReasons.reduce((a, b) => a + b, 0))}%)</small></span></div>)}</>}{snapshot.lucky > 0 && <div className="line"><span><Clover size="1em" aria-hidden="true" /> Aciertos por suerte (pendientes de repasar)</span><span>{snapshot.lucky}</span></div>}</div>
    <div className="stats-grid"><div className="stat"><b>{snapshot.answers}</b><span>respuestas</span></div><div className="stat"><b>{snapshot.accuracy}%</b><span>acierto</span></div></div>
    {snapshot.weakTopics.length > 0 && <><h2>Para reforzar</h2><div className="card">{snapshot.weakTopics.map(topic => <div className="line" key={topic.id}><span><b>{topic.id}</b> {topic.name}</span><span className="r">{topic.accuracy}%</span></div>)}</div></>}
  </>;
}

function TopicPerformance({ snapshot, stats, setMessage }: { snapshot: StatsSnapshot; stats: StatsServices; setMessage: (message: string) => void }) {
  return <>
    <h2>Por tema</h2><div className="card">{snapshot.topics.map(topic => <div className="mb-5" key={topic.id}><div className="line !border-0 !py-1"><span><b>{topic.id}</b> {topic.name}</span><span>{topic.interactions ? `${topic.accuracy}%` : '—'}</span></div><div className="bar my-2 h-[.3125rem] overflow-hidden rounded bg-line"><i aria-hidden="true" style={{ width: `${topic.interactions ? topic.accuracy : 0}%` }} className={`block h-full rounded ${topic.accuracy >= 75 ? 'bg-[var(--ok)]' : topic.accuracy >= 50 ? 'bg-[var(--amber)]' : 'bg-[var(--bad)]'}`} /></div><small className="text-[length:var(--fs-xs)]">{topic.seen}/{topic.total} vistas · {topic.interactions} respuestas</small></div>)}</div>
    <h2>Errores por tipo de trampa</h2><div className="card">{snapshot.trapRates.length ? snapshot.trapRates.map(trap => <div className="mb-5" key={trap.id}><div className="line !border-0 !py-1"><span>{trap.label}</span><span>{trap.rate}% fallos <small>({trap.attempts})</small> <button className="ghost ghost-small" onClick={async () => { try { const value = await stats.practiceTrap(trap.id); if (value === 'empty') setMessage('No hay preguntas con esa trampa.'); } catch { setMessage('No se pudieron preparar las preguntas de esta trampa.'); } }}>practicar</button></span></div><div className="bar my-2 h-[.3125rem] overflow-hidden rounded bg-line"><i aria-hidden="true" style={{ width: `${100 - trap.rate}%` }} className={`block h-full rounded ${trap.rate >= 50 ? 'bg-[var(--bad)]' : 'bg-[var(--ok)]'}`} /></div></div>) : <p className="sub">Aún no hay datos suficientes (se necesitan ≥5 respuestas por trampa).</p>}</div>
    <h2>Por origen y tipo</h2><div className="card">{snapshot.origins.map(row => <div className="line" key={row.label}><span>{row.label}</span><span>{row.accuracy}% <small>({row.answers})</small></span></div>)}{snapshot.types.map(row => <div className="line" key={row.id}><span>{row.label}</span><span>{row.accuracy}% <small>({row.answers})</small></span></div>)}</div>
  </>;
}

export function StatsTopicsSection({ snapshot, stats, topics, domainOrder, setDomainOrder, formattedDays, setMessage }: {
  snapshot: StatsSnapshot; stats: StatsServices; topics: readonly StatsDomainTopic[]; domainOrder: string;
  setDomainOrder: (value: string) => void; formattedDays: (days: number | null) => string; setMessage: (message: string) => void;
}) {
  return <section aria-label="Progreso por temas">
    <MobileDisclosure title="Mapa de dominio"><DomainMap snapshot={snapshot} stats={stats} topics={topics} domainOrder={domainOrder} setDomainOrder={setDomainOrder} formattedDays={formattedDays} /></MobileDisclosure>
    <MobileDisclosure title="Lectura y carga de repasos"><ReadingAndReviewInsights snapshot={snapshot} /></MobileDisclosure>
    <MobileDisclosure title="Rendimiento por tema"><TopicPerformance snapshot={snapshot} stats={stats} setMessage={setMessage} /></MobileDisclosure>
  </section>;
}
