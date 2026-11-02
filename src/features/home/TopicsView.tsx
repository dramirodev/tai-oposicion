import type { TopicOverview } from '../../shared/ui/study-services.js';
import { groupTopics } from './topics-controller.js';

export interface TopicsViewProps {
  topics: readonly TopicOverview[];
  visible: readonly TopicOverview[];
  selected: ReadonlySet<string>;
  query: string;
  open: ReadonlySet<string>;
  onQueryChange(query: string): void;
  onToggle(ids: string[]): void;
  onToggleBlock(block: string, expanded: boolean): void;
  onSelectAll(): void;
  onClearSelection(): void;
  onStartSimulation(): void;
}

export function TopicsView({ topics, visible, selected, query, open, onQueryChange, onToggle, onToggleBlock, onSelectAll, onClearSelection, onStartSimulation }: TopicsViewProps) {
  const visibleGroups = groupTopics(visible);
  return <><h1>Temas vistos</h1><p className="sub">Marca los temas que ya has estudiado. Tus marcas seleccionan el temario disponible en simulacros y en «mis temas vistos». Las preguntas contestadas se cuentan aparte: contestar una pregunta no marca el tema como estudiado.</p>
    <div className="selection-summary" role="status">{selected.size} de {topics.length} temas estudiados · {visible.length} {visible.length === 1 ? 'resultado' : 'resultados'}</div>
    <label className="field" htmlFor="topic-search">Buscar tema por nombre o código</label><input className="search-input" id="topic-search" type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Ej. redes o T1.01" autoComplete="off" />
    <div className="row"><button className="btn sec" id="all" onClick={onSelectAll}>Marcar todos los temas</button><button className="btn sec" id="none" onClick={onClearSelection}>Quitar todas las marcas</button></div>
    <div className="card">{visible.length ? visibleGroups.map(({ id: block, label: name, topics: blockTopics }) => {
      const allSelected = blockTopics.every(topic => selected.has(topic.id));
      return <details className="bl topic-block" data-block={block} key={block} open={open.has(block) || !!query} onToggle={event => onToggleBlock(block, event.currentTarget.open)}><summary>{name} · {blockTopics.filter(topic => selected.has(topic.id)).length}/{blockTopics.length} estudiados</summary><button className="ghost ghost-small" data-b={block} onClick={() => onToggle(blockTopics.map(topic => topic.id))}>{allSelected ? 'Desmarcar' : 'Marcar'} temas {query ? 'filtrados de este bloque' : 'del bloque'}</button>
        {blockTopics.map(topic => <label className={`tm ${selected.has(topic.id) ? 'on' : ''}`} key={topic.id}><input type="checkbox" data-t={topic.id} checked={selected.has(topic.id)} onChange={() => onToggle([topic.id])} /><span><b>{topic.id}</b> {topic.name}</span><small>{topic.answered}/{topic.total} preguntas contestadas{topic.accuracy !== null ? ` · ${topic.accuracy}% de acierto` : ''}</small></label>)}
      </details>;
    }) : <p className="sub">No hay temas que coincidan con la búsqueda.</p>}</div>
    <div className="bar2"><button className="btn" id="sim" onClick={onStartSimulation}>Ir al simulacro</button></div>
  </>;
}
