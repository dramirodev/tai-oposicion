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
export const showMenu = async (groups: MenuGroup[], current: string, navigate: (h: string) => void): Promise<void> => {
  if (dialogStore.hasMenu()) return;
  await request({ kind: 'menu', groups, current, navigate, msg: '', title: '', label: '', danger: false });
};
function Dialog({ dialog: d, top }: { dialog: DialogRequest; top: boolean }) {
  useLayoutEffect(() => {
    if (!top) return;
    const overlay = document.querySelector<HTMLElement>(`[data-dialog-id="${d.id}"]`)!;
    (overlay.querySelector<HTMLElement>(d.kind === 'menu' ? '#menux' : '[data-v="1"]'))?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || d.kind === 'notice' && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); d.done(false); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const bs = [...overlay.querySelectorAll('button')], i = bs.indexOf(document.activeElement as HTMLButtonElement);
        bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length]?.focus();
      } else if (d.kind !== 'menu') e.stopPropagation();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [d, top]);
  const select = (action: MenuAction) => { d.done(true); if (typeof action === 'function') action(); else d.navigate?.(action); };
  if (d.kind === 'menu') return <div id="menuov" className="overlay" role="dialog" aria-modal="true" aria-labelledby="menut" data-dialog-id={d.id} onClick={e => { if (e.target === e.currentTarget) d.done(false); }}>
    <div className="card menu"><div className="menuhead"><h2 id="menut">Menú</h2><button className="ghost" id="menux" aria-label="Cerrar menú" onClick={() => d.done(false)}>✕</button></div>
      {d.groups?.map(([title, items], group) => <MenuSection key={title} title={title} items={items} offset={d.groups!.slice(0, group).reduce((n, [, rows]) => n + rows.length, 0)} current={d.current} select={select} />)}
    </div></div>;
  const ask = d.kind === 'ask';
  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={ask ? 'askm' : 'noticem'} data-dialog-id={d.id} onClick={e => { if (!ask && e.target === e.currentTarget) d.done(true); }}>
    <div className="card">{!ask && d.title && <h2 className="h3" id="noticet">{d.title}</h2>}<p id={ask ? 'askm' : 'noticem'}>{d.msg}</p><div className="row">
      {ask && <button className="btn sec" data-v="0" onClick={() => d.done(false)}>Cancelar</button>}
      <button className={`btn${ask ? d.danger ? ' danger' : ' ' : ''}`} data-v="1" onClick={() => d.done(true)}>{d.label}</button>
    </div></div></div>;
}
function MenuSection({ title, items, offset, current, select }: { title: string; items: MenuGroup[1]; offset: number; current?: string; select: (a: MenuAction) => void }) {
  return <><div className="gtitle">{title}</div><div className="lgroup">{items.map(([icon, name, sub, action], i) => <button key={i} className={`lrow ${action === current ? 'here' : ''}`} data-a={offset + i} aria-current={action === current ? 'page' : undefined} onClick={() => select(action)}><i aria-hidden="true">{icon}</i><span><b>{name}</b><small>{sub}</small></span></button>)}</div></>;
}
export function DialogProvider({ children }: { children?: ReactNode }) {
  const { dialogs, toast: t } = useSyncExternalStore(dialogStore.subscribe, dialogStore.getSnapshot);
  useLayoutEffect(() => {
    const persistError = () => toast('No se pudo guardar el progreso en este dispositivo (¿poco espacio?). Exporta una copia en Ajustes.');
    addEventListener('tai-persist-error', persistError);
    return () => removeEventListener('tai-persist-error', persistError);
  }, []);
  const act = () => { if (!t.action) return; const action = t.action; dialogStore.setToast({ msg: 'Actualizando…', shown: t.shown }); action.fn(); };
  return <>{children}{createPortal(<><div id="toast" role="status" className={`${t.shown ? 'show' : ''}${t.action ? ' act' : ''}`} onClick={act}>{t.msg}{t.action && <button type="button" onClick={e => { e.stopPropagation(); act(); }}>{t.action.label}</button>}</div>{dialogs.map((d, i) => <Dialog key={d.id} dialog={d} top={i === dialogs.length - 1} />)}</>, document.body)}</>;
}
