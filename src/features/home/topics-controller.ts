import type { TopicOverview } from '../../shared/ui/study-services.js';
import { BLOQUES } from '../../shared/presentation/labels.js';

export interface TopicGroup { id: string; label: string; topics: TopicOverview[] }

const knownBlockLabels = new Map<string, string>(BLOQUES.map(([id, label]) => [id, label] as const));

/** Groups the catalog in its supplied order; unknown IDs remain visible without implying academy order. */
export function groupTopics(topics: readonly TopicOverview[]): TopicGroup[] {
  const groups = new Map<string, TopicOverview[]>();
  for (const topic of topics) {
    const separator = topic.id.indexOf('.');
    const groupId = separator > 0 ? topic.id.slice(0, separator) : 'otros';
    const group = groups.get(groupId) ?? [];
    group.push(topic);
    groups.set(groupId, group);
  }
  return [...groups].map(([id, groupedTopics]) => ({
    id,
    label: knownBlockLabels.get(id) ?? (id === 'otros' ? 'Otros temas' : `Bloque ${id}`),
    topics: groupedTopics,
  }));
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filterTopics(topics: readonly TopicOverview[], query: string): TopicOverview[] {
  const search = normalize(query.trim());
  return topics.filter(topic => normalize(`${topic.id} ${topic.name}`).includes(search));
}

export function toggleTopicSelection(studied: readonly string[], topicIds: readonly string[]): string[] {
  const next = new Set(studied);
  const remove = topicIds.every(id => next.has(id));
  topicIds.forEach(id => remove ? next.delete(id) : next.add(id));
  return [...next];
}
