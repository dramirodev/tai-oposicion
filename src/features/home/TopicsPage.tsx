import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BLOQUES } from '../../shared/presentation/labels.js';
import { useStudyServices } from '../../shared/ui/study-services.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { TopicsView } from './TopicsView.js';
import { filterTopics, toggleTopicSelection } from './topics-controller.js';
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
  const visible = filterTopics(topics, query);
  const toggle = (ids: string[]) => {
    services.setStudied(toggleTopicSelection(services.getStudied(), ids));
  };
  const toggleBlock = (block: string, expanded: boolean) => {
    if (query) return;
    setOpen(previous => {
      if (previous.has(block) === expanded) return previous;
      const next = new Set(previous);
      if (expanded) next.add(block); else next.delete(block);
      return next;
    });
  };
  return <TopicsView topics={topics} visible={visible} selected={selected} query={query} open={open}
    onQueryChange={setQuery} onToggle={toggle} onToggleBlock={toggleBlock}
    onSelectAll={() => services.setStudied(topics.map(topic => topic.id))}
    onClearSelection={() => services.setStudied([])}
    onStartSimulation={() => void navigate('/sim')}
  />;
}
