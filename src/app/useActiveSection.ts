import { useSyncExternalStore } from 'react';
import { getLastRunKind, getRunKind, subscribe } from '../core/application/legacy-engine.js';

export function useActiveSection(pathname: string): string {
  const runKind = useSyncExternalStore(subscribe, getRunKind, getRunKind);
  const lastKind = useSyncExternalStore(subscribe, getLastRunKind, getLastRunKind);
  const name = pathname.split('/')[1] || 'home';
  const kind = name === 'quiz' ? runKind : lastKind;
  const practiceSection = kind === 'rev' ? '' : kind === 'sim' ? 'sim' : kind === 'test' ? 'test' : 'home';
  return ({
    quiz: practiceSection,
    result: practiceSection,
    sim2: 'sim',
    examenes: 'sim',
    errores: 'settings',
    falladas: 'home',
    cards: 'home',
  } as Record<string, string>)[name] || name;
}
