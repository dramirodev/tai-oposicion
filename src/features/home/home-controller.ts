type CaptureLifetime = () => () => boolean;

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
