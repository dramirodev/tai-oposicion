import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDialogStore } from '../src/shared/ui/dialog-store.js';

describe('dialog Zustand store', () => {
  afterEach(() => vi.useRealTimers());

  it('updates toast state without replacing the dialogs slice', () => {
    const store = createDialogStore();
    const dialogsBefore = store.getState().dialogs;

    store.getState().setToast({ msg: 'Guardado', shown: true });

    expect(store.getState().toast).toEqual({ msg: 'Guardado', shown: true });
    expect(store.getState().dialogs).toBe(dialogsBefore);
  });

  it('adds and removes dialog requests while preserving toast state', () => {
    const store = createDialogStore();
    const done = vi.fn();
    const dialog = { id: store.getState().nextId(), kind: 'ask', msg: '¿Continuar?', title: '', label: 'Sí', danger: false, prev: null, done };
    store.getState().setToast({ msg: 'Guardado', shown: true });

    store.getState().addDialog(dialog);
    expect(store.getState().dialogs).toEqual([dialog]);
    expect(store.getState().hasMenu()).toBe(false);
    store.getState().removeDialog(dialog);

    expect(store.getState().dialogs).toEqual([]);
    expect(store.getState().toast).toEqual({ msg: 'Guardado', shown: true });
  });

  it('only permits one open menu and hides a toast after its duration', () => {
    vi.useFakeTimers();
    const store = createDialogStore();
    const dialog = { id: 0, kind: 'menu', msg: '', title: '', label: '', danger: false, prev: null, done: vi.fn() };

    store.getState().addDialog(dialog);
    expect(store.getState().hasMenu()).toBe(true);
    store.getState().showToast({ msg: 'Listo', shown: true }, 1000);
    vi.advanceTimersByTime(1000);

    expect(store.getState().toast.shown).toBe(false);
    expect(store.getState().hasMenu()).toBe(true);
  });
});
