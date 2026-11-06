import { officialSessionQuota } from '../../core/domain/simulation-scenarios.js';
import { lazy, Suspense } from 'react';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import type { StatsComparison, StatsSnapshot } from '../../core/application/stats/statistics-model.js';
import { statsTableClasses, statsTableScrollClasses } from './stats-classes.js';

const StatsTrendChart = lazy(() => import('./StatsCharts.js').then(module => ({ default: module.StatsTrendChart })));

const date = (time: number) => new Date(time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const delta = (value: number | null, suffix = '') => value === null ? '—' : `${value > 0 ? '+' : ''}${value}${suffix}`;

export function StatsSimulationSection({ snapshot, visibleSimulations, firstSimulation, secondSimulation, setFirstSimulation, setSecondSimulation, trend }: {
  snapshot: StatsSnapshot; visibleSimulations: StatsSnapshot['simulations']; firstSimulation: string; secondSimulation: string;
  setFirstSimulation: (value: string) => void; setSecondSimulation: (value: string) => void; trend: StatsComparison | null;
}) {
  const points = visibleSimulations.filter(item => item.part === 'p1').map(item => ({ timestamp: item.ts, value: item.nota }));
  const rules = new Set(visibleSimulations.filter(sim => sim.part !== 'both').map(sim => JSON.stringify([sim.scoringPolicy?.version ?? 1, sim.scoringPolicy?.correctPoints ?? 1, sim.scoringPolicy ? sim.scoringPolicy.wrongPenalty : 1 / 3, sim.scoringPolicy?.blankPoints ?? 0])));
  const oneRule = rules.size <= 1;
  const scoringRuleLabel = (policy?: typeof visibleSimulations[number]['scoringPolicy']) => policy
    ? `Regla v${policy.version}: +${policy.correctPoints} / −${policy.wrongPenalty ?? '?'} / blanco ${policy.blankPoints}`
    : 'Regla histórica: +1 / −1/3 / blanco 0';
  return <section aria-label="Historial de simulacros"><h2>Simulacros</h2>{visibleSimulations.length ? <div className="card">{oneRule ? <><Suspense fallback={<PageLoading variant="chart" />}><StatsTrendChart points={points} label="Nota por simulacro" metric="Nota" suffix="/100" emptyMessage="Aún no hay notas de simulacros de la parte 1 para mostrar." /></Suspense><p className="legend">Nota de la parte 1 por intento (sobre 100).</p></> : <p className="legend" role="status">No se dibuja una tendencia única porque los intentos usan reglas de puntuación distintas. Cada nota conserva su regla.</p>}
    <h3 className="h3">Últimos intentos</h3>{visibleSimulations.slice(0, 15).map(sim => <div className="sl border-b border-line py-2.5" key={sim.id}><div className="slh flex items-baseline gap-3"><b className="text-xl">{sim.nota}</b><small>{date(sim.ts)} · {sim.part === 'both' ? 'Ejercicio completo TAI 2025' : sim.part === 'p2' ? 'Parte 2 (supuesto)' : 'Parte 1'}{sim.dNota === null ? '' : ` · ${delta(sim.dNota)}`}</small></div><div className="sm">{sim.part === 'both' ? `Calificación por partes · ${officialSessionQuota(sim.id) === 'norma13' ? 'norma común 13' : 'sistema general'}` : scoringRuleLabel(sim.scoringPolicy)} · {sim.a} aciertos · {sim.f} fallos · {sim.b} en blanco · {Math.floor(sim.secs / 60)}:{String(sim.secs % 60).padStart(2, '0')}</div></div>)}
    <h3 className="h3">Comparar dos intentos</h3>{visibleSimulations.filter(item => item.part === 'p1').length < 2 ? <p className="sub sm">Haz al menos 2 simulacros de la parte 1 para compararlos.</p> : <><div className="row"><label>Intento A<select aria-label="Intento A" value={firstSimulation} onChange={event => setFirstSimulation(event.target.value)}>{snapshot.simulations.filter(item => item.part === 'p1').map(item => <option key={item.id} value={item.id}>{date(item.ts)} · {item.nota}</option>)}</select></label><label>Intento B<select aria-label="Intento B" value={secondSimulation} onChange={event => setSecondSimulation(event.target.value)}>{snapshot.simulations.filter(item => item.part === 'p1').map(item => <option key={item.id} value={item.id}>{date(item.ts)} · {item.nota}</option>)}</select></label></div>{trend && <><p className="sm">Nota: <b>{delta(trend.scoreDelta)}</b>{trend.scoreDelta === null && ' · no comparable entre reglas distintas'} · acierto {delta(trend.accuracyDelta, ' pts')} · ritmo {delta(trend.secondsDelta, ' s/preg.')}</p><div className={statsTableScrollClasses} role="region" aria-label="Tabla de progreso" tabIndex={0}><table className={statsTableClasses}><caption>Comparación de los intentos A y B por tema</caption><thead><tr><th>Tema</th><th>A</th><th>B</th><th>Δ</th></tr></thead><tbody>{trend.topics.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.first ?? '—'}</td><td>{row.second ?? '—'}</td><td>{delta(row.delta)}</td></tr>)}</tbody></table></div></>}</>}</div> : <div className="card"><p className="sub">Aún no has hecho ningún simulacro. Cuando lo hagas verás aquí tu nota por intento y podrás comparar dos.</p></div>}</section>;
}
