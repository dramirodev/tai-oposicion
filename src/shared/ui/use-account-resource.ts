import { useEffect, useState } from 'react';
interface ResourceServices<Value> {
  accountId(): string | null;
  subscribe(listener: () => void): () => void;
  load(): Promise<Value>;
}
/** Ignore late reads after navigation, a newer read or an account switch. */
export function useAccountResource<Value>(services: ResourceServices<Value>, refreshKey?: string | number) {
  const [state, setState] = useState<{ value?: Value; error?: unknown }>({});
  useEffect(() => {
    let active = true, sequence = 0, previousAccount = services.accountId();
    const refresh = () => {
      const account = services.accountId(), current = ++sequence;
      if (account !== previousAccount) { previousAccount = account; setState({}); }
      void services.load().then(value => {
        if (active && sequence === current && account === services.accountId()) setState({ value });
      }, error => {
        if (active && sequence === current && account === services.accountId()) setState({ error });
      });
    };
    refresh(); const off = services.subscribe(refresh);
    return () => { active = false; sequence++; off(); };
  }, [services, refreshKey]);
  return state;
}
