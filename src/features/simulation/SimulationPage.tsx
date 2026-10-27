import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStudyService, type SimulationConfiguration, type SimulationExam, type SimulationTab } from '../../shared/ui/study-services.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';

const tabs: readonly [SimulationTab, string][] = [['completo', 'Completo'], ['examen', 'Por examen'], ['tema', 'Por tema']];
const origins = [['G', 'Generadas'], ['O', 'Oficiales'], ['A', 'Academia']] as const;
type SimulationGroups = { official: readonly SimulationExam[]; academy: readonly SimulationExam[]; topicTests: readonly SimulationExam[] };

function CompleteSimulationForm({ configuration, seen, starting, update, onBegin }: { configuration: SimulationConfiguration; seen: readonly string[]; starting: boolean; update: (change: Partial<SimulationConfiguration>) => void; onBegin: () => void }) {
  return <>
    <section className="card">
      <h2 className="h3">Parte 1 · conocimientos</h2>
      <div className="seg" role="group" aria-label="Número de preguntas">{([40, 80] as const).map(count => <button key={count} className={configuration.count === count ? 'on' : ''} aria-pressed={configuration.count === count} onClick={() => {
        const minutes = count === 40 && configuration.minutes > 60 ? 45 : count === 80 && configuration.minutes < 90 ? 90 : configuration.minutes;
        update({ count, minutes });
      }}>{count} preguntas</button>)}</div>
      <h2 className="h3">Tiempo (minutos)</h2>
      <div className="seg" role="group" aria-label="Duración">{([45, 60, 90, 120] as const).map(minutes => <button key={minutes} className={configuration.minutes === minutes ? 'on' : ''} aria-pressed={configuration.minutes === minutes} onClick={() => update({ minutes })}>{minutes}</button>)}</div>
      <h2 className="h3">Temas</h2>
      <div className="seg" role="group" aria-label="Alcance de temas">
        <button className={configuration.scope !== 'todos' ? 'on' : ''} aria-pressed={configuration.scope !== 'todos'} onClick={() => update({ scope: 'vistos' })}>Mis temas vistos ({seen.length})</button>
        <button className={configuration.scope === 'todos' ? 'on' : ''} aria-pressed={configuration.scope === 'todos'} onClick={() => update({ scope: 'todos' })}>Todo el temario</button>
      </div>
      {configuration.scope !== 'todos' && !seen.length && <p className="sub sm">No has marcado ningún tema: se usará todo el temario.</p>}
      <p className="sub sm"><Link to="/temario">Editar temas vistos</Link></p>
      <h2 className="h3">Origen de las preguntas</h2>
      <div className="seg multi" role="group" aria-label="Origen de las preguntas">{origins.map(([origin, label]) => <button key={origin} className={configuration.origins.includes(origin) ? 'on' : ''} aria-pressed={configuration.origins.includes(origin)} onClick={() => {
        const selected = new Set(configuration.origins); if (selected.has(origin)) selected.delete(origin); else selected.add(origin); if (!selected.size) selected.add(origin); update({ origins: [...selected] });
      }}>{label}</button>)}</div>
      <label className="chk"><input type="checkbox" checked={configuration.includeSecondPart} onChange={event => update({ includeSecondPart: event.target.checked })} /> Después, parte 2: elegir 1 de 2 supuestos prácticos (20 preguntas)</label>
    </section>
    <div className="note">Reparto por temas calcado a los exámenes oficiales. Cada fallo resta 1/3 de acierto; en blanco no resta. No hay corrección hasta el final.</div>
    <div className="bar2"><button className="btn" disabled={starting} onClick={onBegin}>{starting ? 'Preparando…' : 'Empezar simulacro'}</button></div>
  </>;
}

function ExamBrowser({ tab, loading, starting, filteredGroups, visibleSelection, years, originFilter, turnFilter, yearFilter, setOriginFilter, setTurnFilter, setYearFilter, onSelect, onStudy, onExam }: {
  tab: SimulationTab; loading: boolean; starting: boolean;
  filteredGroups: readonly { title: string; exams: readonly SimulationExam[] }[]; visibleSelection?: string | null; years: readonly string[];
  originFilter: string; turnFilter: string; yearFilter: string;
  setOriginFilter: (value: string) => void; setTurnFilter: (value: string) => void; setYearFilter: (value: string) => void;
  onSelect: (id: string) => void; onStudy: () => void; onExam: () => void;
}) {
  const exams = filteredGroups.flatMap(group => group.exams);
  return <>
    {tab === 'examen' && <section className="card exam-filters">
      <label>Origen<select aria-label="Origen" value={originFilter} onChange={event => setOriginFilter(event.target.value)}><option value="all">Todos</option><option value="official">Oficiales</option><option value="academy">Academia</option></select></label>
      <label>Turno<select aria-label="Turno" value={turnFilter} onChange={event => setTurnFilter(event.target.value)}><option value="all">Todos</option><option value="libre">Ingreso libre</option><option value="promotion">Promoción interna</option></select></label>
      <label>Año en la referencia<select aria-label="Año en la referencia" value={yearFilter} onChange={event => setYearFilter(event.target.value)}><option value="">Todos</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
    </section>}
    <p className="sub sm">Elige uno y contesta solo sus preguntas. Notas sobre 100; cada fallo resta 1/3.</p>
    {loading && <p className="sub loading" role="status">Cargando exámenes…</p>}
    {!loading && filteredGroups.map(group => <section key={group.title}><h2 className="h3">{group.title}</h2><div className="exlist">{group.exams.map(exam => <button key={exam.id} data-exam-id={exam.id} className={`exrow ${exam.id === visibleSelection ? 'on' : ''}`} aria-pressed={exam.id === visibleSelection} onClick={() => onSelect(exam.id)}>
      <span><b>{exam.name}</b><small>{exam.questionCount} preguntas{exam.attempts > 1 ? ` · ${exam.attempts} intentos · mejor ${exam.best?.toFixed(1).replace('.', ',')}` : ''}</small></span>
      <em className={`nt ${exam.latest === null ? '' : exam.latest >= 50 ? 'ok' : 'mid'}`}>{exam.latest === null ? 'Sin hacer' : exam.latest.toFixed(1).replace('.', ',')}</em>
    </button>)}</div></section>)}
    {!loading && !exams.length && <p className="note">No hay exámenes con estos filtros. Prueba con otro año o turno.</p>}
    <div className="bar2"><button className="btn sec" disabled={starting || !visibleSelection} onClick={onStudy}>Estudiar</button><button className="btn" disabled={starting || !visibleSelection} onClick={onExam}>{starting ? 'Preparando…' : 'Examen · 90 min'}</button></div>
  </>;
}

export function SimulationPage() {
  const simulation = useStudyService('simulation');
  const [tab, setTab] = useState(() => simulation.getTab());
  const [configuration, setConfiguration] = useState(() => simulation.getConfiguration());
  const [groups, setGroups] = useState<SimulationGroups | null>(null);
  const [selection, setSelection] = useState(() => simulation.getSelectedExam());
  const [originFilter, setOriginFilter] = useState('all');
  const [turnFilter, setTurnFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('');
  const [loading, setLoading] = useState(() => simulation.getTab() !== 'completo');
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const seen = simulation.seenTopics();

  useEffect(() => {
    if (tab === 'completo' || groups) return;
    let active = true;
    void simulation.loadExamGroups().then(value => { if (active) setGroups(value); }).catch(() => { if (active) setMessage('No se pudieron cargar los exámenes. Comprueba la conexión e inténtalo de nuevo.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [groups, simulation, tab]);

  const filteredGroups = useMemo((): { title: string; exams: readonly SimulationExam[] }[] => {
    if (!groups) return [];
    if (tab === 'tema') return [{ title: 'Tests de la academia', exams: groups.topicTests }];
    const official = groups.official.filter(exam => (turnFilter === 'all' || (turnFilter === 'libre' ? exam.name.startsWith('Ingreso libre') : exam.name.startsWith('Promoción interna'))) && (!yearFilter || exam.name.includes(yearFilter)));
    const academy = groups.academy.filter(exam => turnFilter === 'all' && (!yearFilter || exam.name.includes(yearFilter)));
    const list: { title: string; exams: readonly SimulationExam[] }[] = [];
    if (originFilter !== 'academy' && official.length) list.push({ title: 'Exámenes oficiales', exams: official });
    if (originFilter !== 'official' && academy.length) list.push({ title: 'Simulacros de la academia', exams: academy });
    return list;
  }, [groups, originFilter, tab, turnFilter, yearFilter]);
  const allVisibleExams = filteredGroups.flatMap(group => group.exams);
  const visibleSelection = allVisibleExams.some(exam => exam.id === selection) ? selection : allVisibleExams[0]?.id;
  const years = [...new Set((groups?.official || []).flatMap(exam => exam.name.match(/20\d{2}/g) || []))].sort().reverse();

  const update = (change: Partial<SimulationConfiguration>) => {
    const next = { ...configuration, ...change, origins: [...(change.origins ?? configuration.origins)] };
    simulation.saveConfiguration(next); setConfiguration(next); setMessage('');
  };
  const openTab = (next: SimulationTab) => { setTab(next); simulation.setTab(next); setMessage(''); if (next !== 'completo' && !groups) setLoading(true); };
  const begin = async (run: () => Promise<'started' | 'empty' | 'account-changed'>) => {
    setStarting(true); setMessage('');
    try { const result = await run();
      if (result === 'empty') setMessage('No hay preguntas disponibles con estos filtros.');
      if (result === 'account-changed') setMessage('La cuenta cambió mientras se preparaba el simulacro. Vuelve a intentarlo.');
    } catch { setMessage('No se pudo preparar el simulacro. Comprueba la conexión e inténtalo de nuevo.'); }
    finally { setStarting(false); }
  };

  return <>
    <h1>Simulacros <HelpIconLink topic="simulacros" label="Ayuda sobre navegación y corrección de simulacros" /></h1>
    <div className="seg tabs" role="tablist" aria-label="Tipo de simulacro">
      {tabs.map(([id, label]) => <button key={id} role="tab" className={tab === id ? 'on' : ''} aria-selected={tab === id} onClick={() => openTab(id)}>{label}</button>)}
    </div>
    {tab === 'completo' ? <CompleteSimulationForm configuration={configuration} seen={seen} starting={starting} update={update} onBegin={() => { void begin(() => simulation.startConfigured(configuration)); }} /> : <ExamBrowser tab={tab} loading={loading} starting={starting} filteredGroups={filteredGroups} visibleSelection={visibleSelection} years={years} originFilter={originFilter} turnFilter={turnFilter} yearFilter={yearFilter} setOriginFilter={setOriginFilter} setTurnFilter={setTurnFilter} setYearFilter={setYearFilter} onSelect={id => { simulation.selectExam(id); setSelection(id); }} onStudy={() => { if (visibleSelection) void begin(() => simulation.startExam(visibleSelection, 'study')); }} onExam={() => { if (visibleSelection) void begin(() => simulation.startExam(visibleSelection, 'exam')); }} />}
    {message && <p className="card" role="alert">{message}</p>}
  </>;
}
