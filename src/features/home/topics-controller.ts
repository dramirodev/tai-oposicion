import type { TopicOverview } from '../../shared/ui/study-services.js';

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
