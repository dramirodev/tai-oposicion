import { createStore } from 'zustand/vanilla';
import type { EngineSnapshot } from '../core/application/session-model.js';

export const sessionStateStore = createStore<EngineSnapshot>()(() => ({ run: null, last: null }));
export const sessionStatePort = {
  getState: () => sessionStateStore.getState(),
  setState: (state: Partial<EngineSnapshot>) => { sessionStateStore.setState(state); },
  subscribe: (listener: () => void) => sessionStateStore.subscribe(() => listener()),
};
