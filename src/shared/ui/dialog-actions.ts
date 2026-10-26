import { dialogStore, type DialogRequest, type MenuGroup, type ToastAction } from './dialog-store.js';
export type { ToastAction, MenuGroup } from './dialog-store.js';
export function toast(msg: string, action?: ToastAction): void {
  dialogStore.showToast({ msg, action, shown: true }, action ? 20000 : 4500);
}
function request(input: Omit<DialogRequest, 'id' | 'done' | 'prev'>, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const prev = document.activeElement; let settled = false;
    const abort = () => done(false);
    const done = (ok: boolean) => {
      if (settled) return; settled = true; signal?.removeEventListener('abort', abort);
      dialogStore.removeDialog(dialog);
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus();
      resolve(ok);
    };
    const dialog: DialogRequest = { ...input, id: dialogStore.nextId(), done, prev };
    signal?.addEventListener('abort', abort, { once: true });
    dialogStore.addDialog(dialog);
  });
}
export const ask = (msg: string, okLabel = 'Aceptar', danger = false, signal?: AbortSignal): Promise<boolean> => request({ kind: 'ask', msg, title: '', label: okLabel, danger }, signal);
export const notice = async (msg: string, title = '', okLabel = 'Entendido'): Promise<void> => { await request({ kind: 'notice', msg, title, label: okLabel, danger: false }); };
export const showMenu = async (groups: MenuGroup[], current: string, navigate: (html: string) => void): Promise<void> => {
  if (dialogStore.hasMenu()) return;
  await request({ kind: 'menu', groups, current, navigate, msg: '', title: '', label: '', danger: false });
};
