import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStudyService, type TestConfiguration, type TestTopic } from '../../shared/ui/study-services.js';
import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { topicsForTest, toggleTestTopics, updateTestConfiguration } from './test-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';

const blocks = [
  ['T1', 'Bloque I · Organización del Estado'], ['T2', 'Bloque II · Informática básica'],
  ['T3', 'Bloque III · Desarrollo'], ['T4', 'Bloque IV · Sistemas y comunicaciones'],
] as const;

export function TestPage() {
  const test = useStudyService('test');
  const [searchParams] = useSearchParams();
  const newTopicRecommendation = searchParams.get('recommendation') === 'new-topic';
  const suggestedTopicId = searchParams.get('topic');
  const trainingTopicsValue = searchParams.get('trainingTopics');
  const dailyTraining = searchParams.get('dailyTraining') === 'topicTest';
  const trainingTopicIds = useMemo(() => trainingTopicsValue === null ? undefined
    : [...new Set(trainingTopicsValue.split(',').filter(topicId => /^T[1-4]\.\d{2}$/.test(topicId)
      && test.seenTopics().includes(topicId)))], [trainingTopicsValue, test]);
  const trainingTopicSet = useMemo(() => trainingTopicIds ? new Set(trainingTopicIds) : null, [trainingTopicIds]);
  const [configuration, setConfiguration] = useState(() => test.getConfiguration());
  const [topics, setTopics] = useState<readonly TestTopic[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const [recommendationMessage, setRecommendationMessage] = useState('');
  const autoStarted = useRef(false);

  useEffect(() => {
    let active = true;
    void test.loadTopics().then(value => {
      if (!active) return;
      const eligibleTopics = trainingTopicIds ? value.filter(topic => trainingTopicSet?.has(topic.id)) : value;
      setTopics(eligibleTopics); setLoading(false);
      if (suggestedTopicId) {
        const suggestedTopic = eligibleTopics.find(topic => topic.id === suggestedTopicId && (trainingTopicIds || topic.answerCount > 0));
        if (!suggestedTopic) {
          setRecommendationMessage(trainingTopicIds
            ? 'El tema recomendado no está entre tus temas vistos. Elige uno de los materiales que ya has marcado.'
            : 'El tema recomendado ya no tiene respuestas registradas. Elige un tema manualmente para continuar.');
          return;
        }
        const next = updateTestConfiguration(test.getConfiguration(), { all: false, selected: [suggestedTopic.id], mode: 'aleatorio', ...(dailyTraining ? { origins: ['O', 'A', 'G'] } : {}) });
        if (!dailyTraining) test.saveConfiguration(next);
        setConfiguration(next);
        setRecommendationMessage(dailyTraining ? '' : `Tema para reforzar: ${suggestedTopic.id} · ${suggestedTopic.name}. Puedes cambiar la selección antes de empezar.`);
        return;
      }
      if (trainingTopicIds) {
        const next = updateTestConfiguration(test.getConfiguration(), { all: false, selected: trainingTopicIds, ...(dailyTraining ? { mode: 'aleatorio', origins: ['O', 'A', 'G'] } : {}) });
        if (!dailyTraining) test.saveConfiguration(next);
        setConfiguration(next);
        setRecommendationMessage(dailyTraining ? '' : 'Entrenamiento de hoy: solo se mostrarán materiales de los temas que has marcado como vistos.');
        return;
      }
      if (!newTopicRecommendation) return;
      const studied = new Set(test.seenTopics());
      const nextTopic = value.find(topic => topic.total > 0 && topic.answerCount === 0 && !studied.has(topic.id));
      if (!nextTopic) {
        setRecommendationMessage('No hay temas nuevos sin respuestas disponibles. Elige un tema manualmente para continuar el entrenamiento.');
        return;
      }
      const next = updateTestConfiguration(test.getConfiguration(), { all: false, selected: [nextTopic.id], mode: 'nuevas' });
      test.saveConfiguration(next); setConfiguration(next);
      setRecommendationMessage(`Tema nuevo recomendado: ${nextTopic.id} · ${nextTopic.name}. Puedes cambiar la selección antes de empezar.`);
    }).catch(() => { if (active) { setMessage('No se pudieron cargar los temas. Comprueba la conexión e inténtalo de nuevo.'); setLoading(false); } });
    return () => { active = false; };
  }, [test, dailyTraining, newTopicRecommendation, suggestedTopicId, trainingTopicIds, trainingTopicSet]);

  const visibleTopics = useMemo(() => topicsForTest(topics, query), [topics, query]);
  const update = (change: Partial<TestConfiguration>) => {
    const next = updateTestConfiguration(configuration, change);
    test.saveConfiguration(next); setConfiguration(next); setMessage('');
  };
  const topicSelection = (ids: readonly string[]) => {
    const next = toggleTestTopics(configuration, ids);
    test.saveConfiguration(next); setConfiguration(next);
  };
  const start = useCallback(async (dailyTrainingActivity?: 'topicTest') => {
    setStarting(true); setMessage('');
    try {
      const currentSeenTopics = new Set(test.seenTopics());
      const allowedTrainingTopics = new Set((trainingTopicIds ?? []).filter(topicId => currentSeenTopics.has(topicId)));
      if (trainingTopicsValue !== null && !allowedTrainingTopics.size) {
        setMessage('No tienes temas marcados como vistos para este entrenamiento. Vuelve al inicio y actualiza la selección.');
        return;
      }
      const startConfiguration = trainingTopicsValue !== null
        ? { ...configuration, all: false, selected: configuration.selected.filter(topicId => allowedTrainingTopics.has(topicId) && trainingTopicSet?.has(topicId)) }
        : configuration;
      if (trainingTopicsValue !== null && !startConfiguration.selected.length) {
        setMessage('Elige un tema que siga marcado como visto para empezar este entrenamiento.');
        return;
      }
      const result = dailyTrainingActivity
        ? await test.start(startConfiguration, { dailyTrainingActivity })
        : await test.start(startConfiguration);
      if (result === 'empty') setMessage(configuration.mode === 'falladas' ? 'No tienes preguntas falladas en esa selección.' : configuration.mode === 'dudosas' ? 'No tienes preguntas dudosas en esa selección.' : configuration.mode === 'trampas' ? 'Aún no hay datos de trampas: contesta al menos 5 preguntas de alguna trampa y falla alguna.' : 'No hay preguntas disponibles con ese filtro.');
      if (result === 'account-changed') setMessage('La cuenta cambió mientras se preparaba el test. Vuelve a intentarlo.');
    } catch { setMessage('No se pudo preparar el test. Comprueba la conexión e inténtalo de nuevo.'); }
    finally { setStarting(false); }
  }, [configuration, test, trainingTopicSet, trainingTopicIds, trainingTopicsValue]);

  useEffect(() => {
    if (!dailyTraining || loading || autoStarted.current) return;
    autoStarted.current = true;
    void start('topicTest');
  }, [dailyTraining, loading, start]);

  if (dailyTraining && (loading || starting || !message)) return <PageLoading variant="legacy" />;
  if (dailyTraining && message) return <><h1>Entrenamiento de hoy</h1><div className="note" role="alert">{message}</div><Link className="btn sec" to="/home">Volver al entrenamiento</Link></>;

  const selected = new Set(configuration.selected);
  return <>
    <h1>Test por tema <HelpIconLink topic="sesiones" label="Ayuda sobre los controles del test" /></h1>
    {recommendationMessage && <p className="note" role="status">{recommendationMessage}</p>}
    <section className="card" aria-label="Configuración del test">
      <h2 className="h3">Terminar por</h2>
      <div className="seg" role="group" aria-label="Límite del test">
        <button className={!configuration.timed ? 'on' : ''} aria-pressed={!configuration.timed} onClick={() => update({ timed: false })}>Nº de preguntas</button>
        <button className={configuration.timed ? 'on' : ''} aria-pressed={configuration.timed} onClick={() => update({ timed: true })}>Tiempo</button>
      </div>
      {configuration.timed ? <><div className="seg" role="group" aria-label="Duración">
        {([10, 20, 30, 45, 60] as const).map(minutes => <button key={minutes} className={configuration.minutes === minutes ? 'on' : ''} aria-pressed={configuration.minutes === minutes} onClick={() => update({ minutes })}>{minutes} min</button>)}
      </div><p className="sub sm">Las preguntas aparecen hasta que se acaba el tiempo. Solo cuentan las que contestes.</p></> : <div className="seg" role="group" aria-label="Número de preguntas">
        {([10, 15, 25, 40] as const).map(count => <button key={count} className={configuration.count === count ? 'on' : ''} aria-pressed={configuration.count === count} onClick={() => update({ count })}>{count}</button>)}
      </div>}
      <h2 className="h3">Qué preguntas</h2>
      <div className="seg" role="group" aria-label="Orden de las preguntas">
        {(['nuevas', 'aleatorio', 'falladas', 'dudosas', 'trampas'] as const).map(mode => <button key={mode} className={configuration.mode === mode ? 'on' : ''} aria-pressed={configuration.mode === mode} onClick={() => update({ mode })}>{({ nuevas: 'Nuevas primero', aleatorio: 'Aleatorio', falladas: 'Falladas', dudosas: 'Dudosas', trampas: 'Mis trampas' })[mode]}</button>)}
      </div>
      {configuration.mode === 'trampas' && <p className="sub sm">Usa tus 3 trampas con más fallos (mínimo 5 respuestas por trampa): primero las que fallaste y luego las que no has visto.</p>}
      <h2 className="h3">Origen</h2>
      <div className="seg multi" role="group" aria-label="Origen de las preguntas">
        {([['G', 'Generadas'], ['O', 'Oficiales'], ['A', 'Academia']] as const).map(([origin, label]) => <button key={origin} className={configuration.origins.includes(origin) ? 'on' : ''} aria-pressed={configuration.origins.includes(origin)} onClick={() => {
          const origins = new Set(configuration.origins); if (origins.has(origin)) origins.delete(origin); else origins.add(origin); if (!origins.size) origins.add(origin); update({ origins: [...origins] });
        }}>{label}</button>)}
      </div>
    </section>
    <section className="card" aria-label="Selección de temas">
      <h2 className="h3">Temas <small>({configuration.all ? 'Todo el temario' : `${selected.size} elegidos`})</small></h2>
      {trainingTopicIds && <p className="note">El entrenamiento diario se limita a los temas que ya has marcado como vistos.</p>}
      <div className="seg" role="group" aria-label="Alcance de temas">
        {!trainingTopicIds && <button className={configuration.all ? 'on' : ''} aria-pressed={configuration.all} onClick={() => update({ all: true, selected: [] })}>Todo el temario</button>}
        <button className={!configuration.all ? 'on' : ''} aria-pressed={!configuration.all} onClick={() => update({ all: false })}>Elegir temas</button>
      </div>
      <label className="field" htmlFor="test-search">Buscar tema</label>
      <input id="test-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o código del tema" />
      <div className="row"><button className="btn sec" onClick={() => {
        const ids = test.seenTopics(); if (!ids.length) { setMessage('Aún no has marcado temas vistos (pantalla «Temas vistos» en Inicio).'); return; }
        update({ all: false, selected: ids });
      }}>Usar mis temas vistos ({test.seenTopics().length})</button></div>
      {loading ? <PageLoading variant="content" /> : blocks.map(([prefix, title]) => {
        const entries = visibleTopics.filter(topic => topic.id.startsWith(prefix));
        if (!entries.length) return null;
        const ids = entries.map(topic => topic.id);
        return <details className="bl topic-block" key={prefix} open={!!query || prefix === 'T1'}>
          <summary>{title}</summary>
          <div className="blh"><span>Seleccionar bloque</span><button className="ghost sm" onClick={event => { event.preventDefault(); topicSelection(ids); }}>todos</button></div>
        {entries.map(topic => <label className={`tm ${selected.has(topic.id) ? 'on' : ''}`} key={topic.id}>
            <input type="checkbox" checked={selected.has(topic.id)} onChange={event => topicSelection(event.target.checked ? [...selected, topic.id] : [...selected].filter(id => id !== topic.id))} />
            <span><b>{topic.id}</b> {topic.name}</span><small>{topic.attempted}/{topic.total}{topic.answerCount ? ` · ${Math.round(topic.correct * 100 / topic.answerCount)}%` : ''}</small>
          </label>)}
        </details>;
      })}
    </section>
    <div className="bar2 action-plan"><p className="sm" role="status">{configuration.timed ? `${configuration.minutes} min` : `${configuration.count} preguntas`} · {configuration.all ? 'Todo el temario' : selected.size ? `${selected.size} temas` : 'Elige al menos un tema'} · {configuration.origins.map(origin => ({ G: 'Generadas', O: 'Oficiales', A: 'Academia' })[origin]).join(', ')}</p>
      <button className="btn" disabled={starting || loading || (!configuration.all && !selected.size)} onClick={() => void start()}>{starting ? 'Preparando…' : 'Empezar'}</button></div>
    {message && <p className="card" role="alert">{message}</p>}
  </>;
}
