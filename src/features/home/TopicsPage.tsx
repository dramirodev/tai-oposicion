import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BLOQUES } from '../../shared/presentation/labels.js';
import { useStudyService } from '../../shared/ui/study-services.js';
import { usePageReady } from '../../shared/ui/use-page-ready.js';
import { useAccountResource } from '../../shared/ui/use-account-resource.js';
import { TopicsView } from './TopicsView.js';
import { filterTopics, toggleTopicSelection } from './topics-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';
import { isCurrentAcademyMaterialSelection, sectionFollowUps, sectionFollowUpCompletionEventId, type AcademySectionStudyEvent } from '../../core/domain/academy-study-progress.js';
import { academyCurriculumMaterialIndex } from '../../core/domain/academy-curriculum.generated.js';
const AcademyCurriculumPanel = lazy(() => import('./AcademyCurriculumPanel.js').then(module => ({ default: module.AcademyCurriculumPanel })));
export function TopicsPage() {
  const services = useStudyService('topics'), navigate = useNavigate();
  const home = useStudyService('home');
  const academyProgress = useStudyService('academyStudyProgress');
  const [searchParams] = useSearchParams();
  const requestedTopic = searchParams.get('topic') ?? '';
  const dailyNewContent = searchParams.get('dailyTraining') === 'newContent';
  const sessionId = searchParams.get('trainingSessionId'), activityId = searchParams.get('trainingActivityId');
  const trainingActivityReference = sessionId && activityId ? { sessionId, activityId } : undefined;
  const completedPlannedStudy = useRef(false);
  const completingSectionRecall = useRef(false);
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
  const completeSectionRecall = async () => {
    if (completingSectionRecall.current || !trainingActivityReference || !requestedTopic) return;
    completingSectionRecall.current = true;
    try {
      const overview = await home.loadOverview();
      const session = overview.trainingSession;
      const step = session?.activities[session.currentIndex];
      const agendaId = searchParams.get('agendaItemId');
      const sectionId = searchParams.get('sectionId');
      if (!session || session.id !== trainingActivityReference.sessionId || step?.id !== trainingActivityReference.activityId
        || step.activity !== 'activeRecall' || !step.sectionRecall || step.sectionRecall.agendaItemId !== agendaId
        || step.sectionRecall.sectionId !== sectionId || step.topicId !== requestedTopic) {
        home.notify('La sesión ya no está en esta comprobación. Vuelve a Planificación para continuar el paso vigente.'); return;
      }
      const agenda = home.weeklyStudyAgenda?.();
      const item = agenda?.items.find(candidate => candidate.id === agendaId && (candidate.status === 'planned' || candidate.status === 'completed') && candidate.kind === 'sectionRecall');
      if (!item?.sectionRecall || item.sectionRecall.followUpId !== step.sectionRecall.followUpId
        || item.sectionRecall.sectionId !== step.sectionRecall.sectionId || item.sectionRecall.materialPath !== step.sectionRecall.materialPath
        || item.topicIds[0] !== requestedTopic || item.sectionRecall.sourceHash !== step.sectionRecall.sourceHash
        || item.sectionRecall.outlineFingerprint !== step.sectionRecall.outlineFingerprint) {
        home.notify('La comprobación semanal cambió o se cerró. Actualiza Planificación antes de terminar este paso.'); return;
      }
      const snapshot = await academyProgress.loadProgressOverview();
      const selfCheckRecorded = snapshot.events.some(event => event.kind === 'self-check' && event.topicId === requestedTopic
        && event.sectionId === step.sectionRecall!.sectionId && event.materialPath === step.sectionRecall!.materialPath
        && event.sourceHash === step.sectionRecall!.sourceHash && event.trainingSessionId === session.id
        && event.trainingActivityId === step.id && event.occurredAt >= session.startedAt);
      if (!selfCheckRecorded) { home.notify('Registra primero una autoevaluación de este apartado en la sesión; después podrás cerrar la actividad.'); return; }
      const followUp = sectionFollowUps(snapshot.events).find(candidate => candidate.followUpId === step.sectionRecall!.followUpId);
      if (!followUp || followUp.status === 'cancelled') { home.notify('Este seguimiento ya no está pendiente. Actualiza la planificación antes de cerrar la actividad.'); return; }
      if (followUp.topicId !== requestedTopic || followUp.sectionId !== step.sectionRecall.sectionId
        || followUp.materialPath !== step.sectionRecall.materialPath || followUp.sourceHash !== step.sectionRecall.sourceHash
        || followUp.outlineFingerprint !== step.sectionRecall.outlineFingerprint
        || followUp.sourceSelfCheckEventId !== item.sectionRecall.sourceSelfCheckEventId) {
        home.notify('La referencia del seguimiento cambió. Actualiza Planificación para revisar el material asociado.'); return;
      }
      const selection = snapshot.selections.find(candidate => candidate.topicId === requestedTopic);
      const selected = isCurrentAcademyMaterialSelection({ files:academyCurriculumMaterialIndex[requestedTopic] ?? [] }, selection ?? null)
        ? selection?.materials.find(material => material.role === 'syllabus' && material.path === step.sectionRecall!.materialPath
          && material.sourceHash === step.sectionRecall!.sourceHash && material.outlineFingerprint === step.sectionRecall!.outlineFingerprint)
        : undefined;
      const current = (academyCurriculumMaterialIndex[requestedTopic] ?? []).find(material => material.path === step.sectionRecall!.materialPath && material.kind === 'syllabus');
      if (!selected || !current || current.sha256 !== selected.sourceHash || current.outlineFingerprint !== selected.outlineFingerprint
        || current.sha256 !== step.sectionRecall.sourceHash || current.outlineFingerprint !== step.sectionRecall.outlineFingerprint
        || current.outlineStructureFingerprint !== selection?.materials.find(material => material.path === current.path)?.outlineStructureFingerprint) {
        home.notify('Cambió la selección o versión del temario. Se conserva el seguimiento, pero esta actividad no se puede cerrar con material obsoleto.'); return;
      }
      if (followUp.status === 'scheduled') {
        const event: AcademySectionStudyEvent = {
          id:sectionFollowUpCompletionEventId(followUp.followUpId), topicId:followUp.topicId, sectionId:followUp.sectionId,
          materialPath:followUp.materialPath, sourceHash:followUp.sourceHash, outlineFingerprint:followUp.outlineFingerprint,
          occurredAt:Math.max(Date.now(), ...snapshot.events.filter(candidate => candidate.kind === 'follow-up' && candidate.followUpId === followUp.followUpId).map(candidate => candidate.occurredAt + 1)),
          kind:'follow-up', followUpId:followUp.followUpId, sourceSelfCheckEventId:followUp.sourceSelfCheckEventId,
          dueDateKey:followUp.dueDateKey, status:'completed', ...(followUp.sectionTitle ? { sectionTitle:followUp.sectionTitle } : {}),
          ...(followUp.printedPage !== undefined ? { printedPage:followUp.printedPage } : {}),
        };
        if (!academyProgress.record(event)) {
          const latest = await academyProgress.loadProgressOverview();
          if (sectionFollowUps(latest.events).find(candidate => candidate.followUpId === followUp.followUpId)?.status !== 'completed') {
            home.notify('No se pudo guardar la comprobación. La actividad sigue abierta; puedes reintentar.'); return;
          }
        }
      }
      const savedAgenda = item.status === 'completed' ? agenda : home.setWeeklyStudyAgendaItemStatus?.(item.id, 'completed');
      if (!savedAgenda) {
        const latest = home.weeklyStudyAgenda?.().items.find(candidate => candidate.id === item.id);
        if (latest?.status !== 'completed') { home.notify('La comprobación quedó guardada, pero no se pudo cerrar su actividad semanal. Reintenta desde Planificación.'); return; }
      }
      const advanced = home.completeTrainingActivity('activeRecall', trainingActivityReference);
      if (!advanced || advanced.currentIndex <= session.currentIndex) {
        home.notify('La comprobación está guardada; la sesión cambió mientras se cerraba. Actualiza Planificación para continuar.'); return;
      }
      void navigate('/planificacion');
    } catch {
      home.notify('No se pudo completar la comprobación por un error de almacenamiento. La actividad sigue disponible para reintentar.');
    } finally { completingSectionRecall.current = false; }
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
  return <>
    {dailyNewContent && <section className="planned-topic-study my-4 px-5 py-4 [border-inline-start:.2rem_solid_var(--brand)] bg-[var(--surface-soft)]" aria-labelledby="planned-topic-title">
      <h2 className="m-0 mb-[.35rem] text-[length:var(--fs-l)]" id="planned-topic-title">Estudio inicial · {topics.find(topic => topic.id === requestedTopic)?.name ?? requestedTopic}</h2>
      <p className="m-0 text-muted">Empieza por comprender un apartado del temario. En «Material de academia», elige el PDF de temario que estés usando, abre el epígrafe y, después de trabajarlo, registra si la cobertura fue parcial o completa. Esa marca se guarda ligada a esta sesión, pero no acredita comprensión. Cierra el material y explica la idea con tus palabras; marca el tema como visto solo cuando hayas decidido que ya lo has estudiado. Ese estado del tema y la cobertura de sus apartados se registran por separado.</p>
    </section>}
    {requestedTopic && <Suspense fallback={<p className="mt-2 text-sm text-muted" role="status">Cargando índice de materiales…</p>}><AcademyCurriculumPanel topicId={requestedTopic} hasStudyMarker={selected.has(requestedTopic)} sessionId={sessionId ?? undefined} activityId={activityId ?? undefined} onCompleteSectionRecall={searchParams.get('dailyTraining') === 'sectionRecall' ? completeSectionRecall : undefined} /></Suspense>}
    <TopicsView topics={topics} visible={visible} selected={selected} query={query} open={open}
    onQueryChange={value => setQueryOverride({ routeTopic: requestedTopic, value })} onToggle={toggle} onToggleBlock={toggleBlock}
    onSelectAll={() => services.setStudied(topics.map(topic => topic.id))}
    onClearSelection={() => services.setStudied([])}
    onStartSimulation={() => void navigate('/sim')}
    />
  </>;
}
