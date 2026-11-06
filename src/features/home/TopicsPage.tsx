import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { BLOQUES } from '../../shared/presentation/labels.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { TopicsView } from './TopicsView.js';
import { filterTopics, toggleTopicSelection } from './topics-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
const AcademyCurriculumPanel = lazy(() => import('./AcademyCurriculumPanel.js').then(module => ({ default: module.AcademyCurriculumPanel })));
export function TopicsPage() {
  const services = useStudyService('topics'), navigate = useNavigate();
  const home = useStudyService('home');
  const [searchParams] = useSearchParams();
  const requestedTopic = searchParams.get('topic') ?? '';
  const dailyNewContent = searchParams.get('dailyTraining') === 'newContent';
  const followUpId = searchParams.get('followUpId') ?? undefined;
  const sessionId = searchParams.get('trainingSessionId'), activityId = searchParams.get('trainingActivityId');
  const trainingActivityReference = sessionId && activityId ? { sessionId, activityId } : undefined;
  const completedPlannedStudy = useRef(false);
  const resource = useMemo(() => ({ accountId: services.accountId, subscribe: services.subscribe, load: () => services.loadTopics() }), [services]);
  const { value: topics, error } = useAccountResource(resource);
  usePageReady(!!topics || !!error);
  const [queryOverride, setQueryOverride] = useState<{ routeTopic: string; value: string } | null>(null);
  const query = queryOverride?.routeTopic === requestedTopic ? queryOverride.value : requestedTopic;
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(BLOQUES.map(([block]) => block)));
  if (error) return <div className="card" role="alert"><h2>No se pudo cargar</h2><p>No se pudo cargar el temario. Inténtalo de nuevo.</p><button className="btn" id="retryRoute" onClick={() => void navigate('/temario')}>Reintentar</button></div>;
  if (!topics) return <PageLoading variant="topics" />;
  const selected = new Set(services.getStudied());
  const visible = filterTopics(topics, query);
  const toggle = (ids: string[]) => {
    const next = toggleTopicSelection(services.getStudied(), ids);
    services.setStudied(next);
    if (dailyNewContent && requestedTopic && next.includes(requestedTopic) && !completedPlannedStudy.current) {
      completedPlannedStudy.current = true;
      home.completeTrainingActivity('newContent', trainingActivityReference);
      void navigate('/planificacion');
    }
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
  if (searchParams.get('dailyTraining') === 'sectionRecall' || followUpId) {
    const params = new URLSearchParams({ topic: requestedTopic, dailyTraining: 'activeRecall', trainingTopics: requestedTopic });
    if (sessionId) params.set('trainingSessionId', sessionId);
    if (activityId) params.set('trainingActivityId', activityId);
    return <Navigate to={`/test?${params}`} replace />;
  }

  return <>
    {dailyNewContent && <section className="planned-topic-study my-4 px-5 py-4 [border-inline-start:.2rem_solid_var(--brand)] bg-[var(--surface-soft)]" aria-labelledby="planned-topic-title">
      <h2 className="m-0 mb-[.35rem] text-[length:var(--fs-l)]" id="planned-topic-title">Estudio inicial · {topics.find(topic => topic.id === requestedTopic)?.name ?? requestedTopic}</h2>
      <p className="m-0 text-muted">Empieza por comprender un apartado del temario. En «Material de academia», elige el PDF de temario que estés usando, abre el epígrafe y, después de trabajarlo, registra si la cobertura fue parcial o completa. Esa marca se guarda ligada a esta sesión, pero no acredita comprensión. Marca el tema como visto cuando hayas decidido que ya lo has estudiado; después puedes practicarlo con preguntas. Ese estado del tema y la cobertura de sus apartados se registran por separado.</p>
    </section>}
    {requestedTopic && <Suspense fallback={<p className="mt-2 text-sm text-muted" role="status">Cargando índice de materiales…</p>}><AcademyCurriculumPanel topicId={requestedTopic} hasStudyMarker={selected.has(requestedTopic)} sessionId={sessionId ?? undefined} activityId={activityId ?? undefined} followUpId={followUpId} /></Suspense>}
    <TopicsView topics={topics} visible={visible} selected={selected} query={query} open={open}
    onQueryChange={value => setQueryOverride({ routeTopic: requestedTopic, value })} onToggle={toggle} onToggleBlock={toggleBlock}
    onSelectAll={() => services.setStudied(topics.map(topic => topic.id))}
    onClearSelection={() => services.setStudied([])}
    onStartSimulation={() => void navigate('/sim')}
    />
  </>;
}
