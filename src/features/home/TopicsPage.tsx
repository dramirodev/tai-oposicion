import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BLOQUES } from '../../shared/presentation/labels.js';
import { useStudyServices } from '../../shared/ui/study-services.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function TopicsPage() {
  const { topics: services } = useStudyServices(), navigate = useNavigate();
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadTopics() }), [services]);
  const { value: topics, error } = useAccountResource(resource);
  usePageReady(!!topics || !!error);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(BLOQUES.map(([block]) => block)));
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar</h2><p>No se pudo cargar el temario. Inténtalo de nuevo.</p><button className="btn" id="retryRoute" onClick={() => void navigate('/temario')}>Reintentar</button></div>;
  if (!topics) return <p className="sub loading" role="status">Cargando…</p>;
  const selected = new Set(services.getStudied());
  const visible = topics.filter(topic => normalize(topic.id + ' ' + topic.name).includes(normalize(query.trim())));
  const toggle = (ids: string[]) => {
    const current = new Set(services.getStudied()), remove = ids.every(id => current.has(id));
    ids.forEach(id => remove ? current.delete(id) : current.add(id)); services.setStudied([...current]);
  };
  return <><h1>Temas vistos</h1><p className="sub">Marca los temas que ya has estudiado. Tus marcas seleccionan el temario disponible en simulacros y en «mis temas vistos». Las preguntas contestadas se cuentan aparte: contestar una pregunta no marca el tema como estudiado.</p>
    <div className="selection-summary" role="status">{selected.size} de {topics.length} temas estudiados · {visible.length} {visible.length === 1 ? 'resultado' : 'resultados'}</div>
    <label className="field" htmlFor="topic-search">Buscar tema por nombre o código</label><input id="topic-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ej. redes o T1.01" autoComplete="off" />
    <div className="row"><button className="btn sec" id="all" onClick={() => services.setStudied(topics.map(topic => topic.id))}>Marcar todos los temas</button><button className="btn sec" id="none" onClick={() => services.setStudied([])}>Quitar todas las marcas</button></div>
    <div className="card">{visible.length ? BLOQUES.map(([block, name]) => {
      const blockTopics = visible.filter(topic => topic.id.startsWith(block));
      if (!blockTopics.length) return null;
      return <details className="bl topic-block" data-block={block} key={block} open={open.has(block) || !!query} onToggle={event => {
        const expanded = event.currentTarget.open;
        if (query) return;
        setOpen(previous => { if (previous.has(block) === expanded) return previous; const next = new Set(previous); if (expanded) next.add(block); else next.delete(block); return next; });
      }}><summary>{name} · {blockTopics.filter(topic => selected.has(topic.id)).length}/{blockTopics.length} estudiados</summary><button className="ghost sm" data-b={block} onClick={() => toggle(blockTopics.map(topic => topic.id))}>{blockTopics.every(topic => selected.has(topic.id)) ? 'Desmarcar' : 'Marcar'} temas {query ? 'filtrados de este bloque' : 'del bloque'}</button>
        {blockTopics.map(topic => <label className={`tm ${selected.has(topic.id) ? 'on' : ''}`} key={topic.id}><input type="checkbox" data-t={topic.id} checked={selected.has(topic.id)} onChange={() => toggle([topic.id])} /><span><b>{topic.id}</b> {topic.name}</span><small>{topic.answered}/{topic.total} preguntas contestadas{topic.accuracy !== null ? ` · ${topic.accuracy}% de acierto` : ''}</small></label>)}
      </details>;
    }) : <p className="sub">No hay temas que coincidan con la búsqueda.</p>}</div>
    <div className="bar2"><button className="btn" id="sim" onClick={() => void navigate('/sim')}>Ir al simulacro</button></div>
  </>;
}
