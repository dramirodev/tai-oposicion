import { useEffect, useRef } from 'react';
/** Capture the screen generation and account before beginning an async action. */
export function useActionLifetime(accountId: () => string | null) {
  const generation = useRef(0);
  useEffect(() => {
    const mountedGeneration = generation.current + 1;
    generation.current = mountedGeneration;
    return () => { if (generation.current === mountedGeneration) generation.current = mountedGeneration + 1; };
  }, []);
  return () => {
    const current = generation.current, account = accountId();
    return () => current === generation.current && account === accountId();
  };
}
