import type { TestConfiguration, TestMode, TestTopic } from '../../shared/ui/study-services.js';

export function updateTestConfiguration(configuration: TestConfiguration, change: Partial<TestConfiguration>): TestConfiguration {
  return { ...configuration, ...change, selected: [...(change.selected ?? configuration.selected)], origins: [...(change.origins ?? configuration.origins)] };
}

export function toggleTestTopics(configuration: TestConfiguration, topicIds: readonly string[]): TestConfiguration {
  const selected = new Set(configuration.selected);
  const remove = topicIds.every(id => selected.has(id));
  topicIds.forEach(id => remove ? selected.delete(id) : selected.add(id));
  return updateTestConfiguration(configuration, { all: false, selected: [...selected] });
}

export function topicsForTest(topics: readonly TestTopic[], query: string): TestTopic[] {
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return topics.filter(topic => `${topic.id} ${topic.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized));
}

export function testModeLabel(mode: TestMode): string {
  return ({ nuevas: 'Nuevas primero', aleatorio: 'Aleatorio', falladas: 'Falladas', dudosas: 'Dudosas', trampas: 'Mis trampas' })[mode];
}
