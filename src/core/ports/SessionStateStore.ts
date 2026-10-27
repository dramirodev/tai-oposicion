/** Small framework-neutral store contract for the active study session snapshot. */
export interface SessionStateStore<State> {
  getState(): State;
  setState(state: Partial<State>): void;
  subscribe(listener: () => void): () => void;
}
