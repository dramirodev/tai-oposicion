import { createStore } from 'zustand/vanilla';
import type { LucideIcon } from 'lucide-react';

export interface ToastAction { label: string; fn: () => void }
export type MenuAction = string | (() => void);
export type MenuGroup = [string, [LucideIcon, string, string, MenuAction][]];
export interface DialogRequest {
  id: number;
  kind: 'ask' | 'notice' | 'menu';
  msg: string;
  title: string;
  label: string;
  danger: boolean;
  prev: Element | null;
  done: (accepted: boolean) => void;
  groups?: MenuGroup[];
  current?: string;
  navigate?: (html: string) => void;
}
export interface DialogSnapshot {
  dialogs: DialogRequest[];
  toast: { msg: string; action?: ToastAction; shown: boolean };
}

interface DialogStoreState extends DialogSnapshot {
  nextDialogId: number;
  nextId: () => number;
  setToast: (toast: DialogSnapshot['toast']) => void;
  showToast: (toast: DialogSnapshot['toast'], duration: number) => void;
  addDialog: (dialog: DialogRequest) => void;
  removeDialog: (dialog: DialogRequest) => void;
  hasMenu: () => boolean;
}

/** Ephemeral UI state; deliberately separate from study progress and persistence. */
export function createDialogStore() {
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  return createStore<DialogStoreState>()((set, get) => ({
    dialogs: [],
    toast: { msg: '', shown: false },
    nextDialogId: 0,
    nextId: () => {
      const id = get().nextDialogId;
      set({ nextDialogId: id + 1 });
      return id;
    },
    setToast: toast => set({ toast }),
    showToast: (toast, duration) => {
      if (toastTimer) clearTimeout(toastTimer);
      get().setToast(toast);
      toastTimer = setTimeout(() => {
        const current = get().toast;
        get().setToast({ ...current, shown: false });
        toastTimer = undefined;
      }, duration);
    },
    addDialog: dialog => set(state => ({ dialogs: [...state.dialogs, dialog] })),
    removeDialog: dialog => set(state => ({ dialogs: state.dialogs.filter(item => item !== dialog) })),
    hasMenu: () => get().dialogs.some(dialog => dialog.kind === 'menu'),
  }));
}

export const dialogStore = createDialogStore();
