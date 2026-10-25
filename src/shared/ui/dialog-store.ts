export interface ToastAction { label: string; fn: () => void }
export type MenuAction = string | (() => void);
export type MenuGroup = [string, [string, string, string, MenuAction][]];
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
  navigate?: (h: string) => void;
}
export interface DialogSnapshot {
  dialogs: DialogRequest[];
  toast: { msg: string; action?: ToastAction; shown: boolean };
}

/** Observable UI-only state shared by the dialog API and its single React provider. */
export class DialogStateStore {
  private nextDialogId = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private state: DialogSnapshot = { dialogs: [], toast: { msg: '', shown: false } };
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): DialogSnapshot => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  nextId(): number { return this.nextDialogId++; }

  setToast(toast: DialogSnapshot['toast']): void {
    this.state = { ...this.state, toast };
    this.emit();
  }

  showToast(toast: DialogSnapshot['toast'], duration: number): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.setToast(toast);
    this.toastTimer = setTimeout(() => {
      this.setToast({ ...this.state.toast, shown: false });
      this.toastTimer = undefined;
    }, duration);
  }

  addDialog(dialog: DialogRequest): void {
    this.state = { ...this.state, dialogs: [...this.state.dialogs, dialog] };
    this.emit();
  }

  removeDialog(dialog: DialogRequest): void {
    this.state = { ...this.state, dialogs: this.state.dialogs.filter(item => item !== dialog) };
    this.emit();
  }

  hasMenu(): boolean { return this.state.dialogs.some(dialog => dialog.kind === 'menu'); }

  private emit(): void { this.listeners.forEach(listener => listener()); }
}

export const dialogStore = new DialogStateStore();
