type CaptureLifetime = () => () => boolean;

export function scopeTrainingRouteToSeenTopics(route: string, seenTopics: readonly string[]): string | null {
  const separator = route.indexOf('?');
  if (separator < 0) return route;
  let path = route.slice(0, separator);
  const params = new URLSearchParams(route.slice(separator + 1));
  if (!params.has('trainingTopics')) return route;

  const seen = new Set(seenTopics);
  const allowedTopics = [...new Set((params.get('trainingTopics') || '').split(',')
    .filter(topicId => /^T[1-4]\.\d{2}$/.test(topicId) && seen.has(topicId)))];
  if (!allowedTopics.length) return null;

  params.set('trainingTopics', allowedTopics.join(','));
  const requestedTopic = params.get('topic');
  if (requestedTopic && !seen.has(requestedTopic)) {
    params.delete('topic');
    if (path === 'temario') path = 'test';
  }
  if (params.get('recommendation') === 'new-topic') params.delete('recommendation');

  return `${path}?${params.toString()}`;
}

export function createHomeController(captureLifetime: CaptureLifetime, notify: (message: string) => void) {
  const listeners = new Set<() => void>();
  let pending = new Set<string>();

  const publish = (next: Set<string>) => {
    pending = next;
    listeners.forEach(listener => listener());
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPending: () => pending,
    async runAction(id: string, action: () => Promise<unknown>) {
      if (pending.has(id)) return;
      const isAlive = captureLifetime();
      publish(new Set(pending).add(id));
      try {
        await action();
      } catch {
        if (isAlive()) notify('No se pudo completar la acción. Inténtalo de nuevo.');
      } finally {
        const next = new Set(pending);
        next.delete(id);
        publish(next);
      }
    },
  };
}
