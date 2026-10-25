import { describe, expect, it, vi } from 'vitest';
import { DialogStateStore } from '../src/shared/ui/dialog-store.js';

describe('DialogStateStore', () => {
  it('publishes immutable snapshots after toast state changes', () => {
    const store = new DialogStateStore();
    const listener = vi.fn();
    const before = store.getSnapshot();
    const unsubscribe = store.subscribe(listener);

    store.setToast({ msg: 'Guardado', shown: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().toast).toEqual({ msg: 'Guardado', shown: true });
    unsubscribe();
  });

  it('adds and removes dialog requests through published snapshots', () => {
    const store = new DialogStateStore();
    const done = vi.fn();
    const dialog = { id: store.nextId(), kind: 'ask', msg: '¿Continuar?', title: '', label: 'Sí', danger: false, prev: null, done };

    store.addDialog(dialog);
    expect(store.getSnapshot().dialogs).toEqual([dialog]);
    store.removeDialog(dialog);
    expect(store.getSnapshot().dialogs).toEqual([]);
  });
});
