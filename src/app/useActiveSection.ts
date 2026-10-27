import { useStore } from 'zustand';
import { sessionStateStore } from './session-state-store.js';

export function useActiveSection(pathname: string): string {
  const runKind = useStore(sessionStateStore, snapshot => snapshot.run?.kind || null);
  const lastKind = useStore(sessionStateStore, snapshot => snapshot.last?.ses.kind || null);
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
