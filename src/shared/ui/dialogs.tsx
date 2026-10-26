import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dialogStore, type DialogRequest, type MenuAction, type MenuGroup, type ToastAction } from './dialog-store.js';
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
function Dialog({ dialog: data, top }: { dialog: DialogRequest; top: boolean }) {
  useLayoutEffect(() => {
    if (!top) return;
    const overlay = document.querySelector<HTMLElement>(`[data-dialog-id="${data.id}"]`)!;
    (overlay.querySelector<HTMLElement>(data.kind === 'menu' ? '#menux' : '[data-v="1"]'))?.focus();
    const key = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' || data.kind === 'notice' && keyboardEvent.key === 'Enter') { keyboardEvent.preventDefault(); keyboardEvent.stopPropagation(); data.done(false); }
      else if (keyboardEvent.key === 'Tab') {
        keyboardEvent.preventDefault();
        const bs = [...overlay.querySelectorAll('button')], index = bs.indexOf(document.activeElement as HTMLButtonElement);
        bs[(index + (keyboardEvent.shiftKey ? -1 : 1) + bs.length) % bs.length]?.focus();
      } else if (data.kind !== 'menu') keyboardEvent.stopPropagation();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [data, top]);
  const select = (action: MenuAction) => { data.done(true); if (typeof action === 'function') action(); else data.navigate?.(action); };
  if (data.kind === 'menu') return <div id="menuov" className="overlay" role="dialog" aria-modal="true" aria-labelledby="menut" data-dialog-id={data.id} onClick={event => { if (event.target === event.currentTarget) data.done(false); }}>
    <div className="card menu"><div className="menuhead"><h2 id="menut">Menú</h2><button className="ghost" id="menux" aria-label="Cerrar menú" onClick={() => data.done(false)}>✕</button></div>
      {data.groups?.map(([title, items], group) => <MenuSection key={title} title={title} items={items} offset={data.groups!.slice(0, group).reduce((itemAccumulator, [, rows]) => itemAccumulator + rows.length, 0)} current={data.current} select={select} />)}
    </div></div>;
  const ask = data.kind === 'ask';
  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={ask ? 'askm' : 'noticem'} data-dialog-id={data.id} onClick={event => { if (!ask && event.target === event.currentTarget) data.done(true); }}>
    <div className="card">{!ask && data.title && <h2 className="h3" id="noticet">{data.title}</h2>}<p id={ask ? 'askm' : 'noticem'}>{data.msg}</p><div className="row">
      {ask && <button className="btn sec" data-v="0" onClick={() => data.done(false)}>Cancelar</button>}
      <button className={`btn${ask ? data.danger ? ' danger' : ' ' : ''}`} data-v="1" onClick={() => data.done(true)}>{data.label}</button>
    </div></div></div>;
}
function MenuSection({ title, items, offset, current, select }: { title: string; items: MenuGroup[1]; offset: number; current?: string; select: (firstValue: MenuAction) => void }) {
  return <><div className="gtitle">{title}</div><div className="lgroup">{items.map(([icon, name, sub, action], index) => <button key={index} className={`lrow ${action === current ? 'here' : ''}`} data-a={offset + index} aria-current={action === current ? 'page' : undefined} onClick={() => select(action)}><i aria-hidden="true">{icon}</i><span><b>{name}</b><small>{sub}</small></span></button>)}</div></>;
}
export function DialogProvider({ children }: { children?: ReactNode }) {
  const { dialogs, toast: item } = useSyncExternalStore(dialogStore.subscribe, dialogStore.getSnapshot);
  useLayoutEffect(() => {
    const persistError = () => toast('No se pudo guardar el progreso en este dispositivo (¿poco espacio?). Exporta una copia en Ajustes.');
    addEventListener('tai-persist-error', persistError);
    return () => removeEventListener('tai-persist-error', persistError);
  }, []);
  const act = () => { if (!item.action) return; const action = item.action; dialogStore.setToast({ msg: 'Actualizando…', shown: item.shown }); action.fn(); };
  return <>{children}{createPortal(<><div id="toast" role="status" className={`${item.shown ? 'show' : ''}${item.action ? ' act' : ''}`} onClick={act}>{item.msg}{item.action && <button type="button" onClick={event => { event.stopPropagation(); act(); }}>{item.action.label}</button>}</div>{dialogs.map((data, index) => <Dialog key={data.id} dialog={data} top={index === dialogs.length - 1} />)}</>, document.body)}</>;
}
