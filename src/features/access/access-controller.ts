type CaptureLifetime = () => () => boolean;
type Confirmation = readonly [message: string, label: string];

export function createAccessController(
  services: {
    confirm(message: string, label: string, danger: boolean): Promise<boolean>;
    notify(message: string): void;
  },
  captureLifetime: CaptureLifetime,
) {
  const listeners = new Set<() => void>();
  let pending = new Set<string>();
  const active = new Set<string>();

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
    async run(id: string, action: () => Promise<boolean>, success: string, confirmation?: Confirmation) {
      if (active.has(id)) return;
      const isAlive = captureLifetime();
      active.add(id);
      try {
        if (confirmation && !await services.confirm(confirmation[0], confirmation[1], true)) return;
        if (!isAlive()) return;
        publish(new Set(pending).add(id));
        const completed = await action();
        if (isAlive()) services.notify(completed ? success : 'No se pudo completar. Revisa la conexión y las reglas de Firestore.');
      } catch {
        if (isAlive()) services.notify('No se pudo completar. Revisa la conexión y las reglas de Firestore.');
      } finally {
        active.delete(id);
        const next = new Set(pending);
        next.delete(id);
        publish(next);
      }
    },
  };
}
