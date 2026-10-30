import { useLayoutEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useStore } from 'zustand';
import { createPortal } from 'react-dom';
import { dialogStore, type DialogRequest, type MenuAction, type MenuGroup } from './dialog-store.js';
import { toast } from './dialog-actions.js';
import { NativeDialog } from './NativeDialog.js';
function Dialog({ dialog: data, top }: { dialog: DialogRequest; top: boolean }) {
  const select = (action: MenuAction) => { data.done(true); if (typeof action === 'function') action(); else data.navigate?.(action); };
  if (data.kind === 'menu') return <NativeDialog id="menuov" dialogId={data.id} open={top} className="overlay menu-dialog" openAnimationClass="mobile-menu-enter" labelledBy={`menu-title-${data.id}`} initialFocusSelector={`#menu-title-${data.id}`} onCancel={() => data.done(false)} onBackdropClick={() => data.done(false)}>
    <div className="card menu"><div className="menuhead"><h2 id={`menu-title-${data.id}`} tabIndex={-1}>Menú</h2><button className="ghost" id="menux" aria-label="Cerrar menú" onClick={() => data.done(false)}><X size="1.25rem" strokeWidth={1.7} aria-hidden="true" /></button></div>
      <div className="menu-content">{data.groups?.map(([title, items], group) => <MenuSection key={title} title={title} items={items} offset={data.groups!.slice(0, group).reduce((itemAccumulator, [, rows]) => itemAccumulator + rows.length, 0)} current={data.current} select={select} />)}</div>
    </div></NativeDialog>;
  const ask = data.kind === 'ask';
  const titleId = ask ? 'askm' : data.title ? `noticet-${data.id}` : `noticem-${data.id}`;
  return <NativeDialog dialogId={data.id} open={top} className="overlay" labelledBy={titleId} initialFocusSelector='[data-v="1"]' onCancel={() => data.done(false)} onBackdropClick={() => !ask && data.done(true)}>
    <div className="card">{!ask && data.title && <h2 className="h3" id={`noticet-${data.id}`}>{data.title}</h2>}<p id={ask ? 'askm' : `noticem-${data.id}`}>{data.msg}</p><div className="row">
      {ask && <button className="btn sec" data-v="0" onClick={() => data.done(false)}>Cancelar</button>}
      <button className={`btn${ask ? data.danger ? ' danger' : ' ' : ''}`} data-v="1" onClick={() => data.done(true)}>{data.label}</button>
    </div></div></NativeDialog>;
}
function MenuSection({ title, items, offset, current, select }: { title: string; items: MenuGroup[1]; offset: number; current?: string; select: (firstValue: MenuAction) => void }) {
  return <><div className="gtitle">{title}</div><div className="lgroup overflow-hidden rounded-[var(--r-xl)] border border-line bg-[var(--card)]">{items.map(([Icon, name, sub, action], index) => <button key={typeof action === 'string' ? action : name} className={`lrow flex w-full min-h-[3.375rem] items-center gap-4 border-0 border-b border-line bg-transparent px-3 py-2 text-left text-ink [font:inherit] [cursor:pointer] active:bg-[var(--sel)] disabled:opacity-100 disabled:bg-[var(--surface-soft)] disabled:text-muted last:border-b-0 ${action === current ? 'here bg-[var(--sel)]' : ''}`} data-a={offset + index} aria-current={action === current ? 'page' : undefined} onClick={() => select(action)}><i className={`flex h-9 w-9 flex-none items-center justify-center rounded-[var(--r-m)] bg-transparent text-[length:var(--fs-xl)] [font-style:normal] ${action === current ? 'text-ink' : 'text-muted'}`} aria-hidden="true"><Icon size="1.125rem" strokeWidth={1.7} /></i><span className="min-w-0 [overflow-wrap:anywhere]"><b className="block text-[length:var(--fs-b)] font-semibold">{name}</b><small className="mt-1 block text-[length:var(--fs-s)] leading-[1.5] text-muted">{sub}</small></span></button>)}</div></>;
}
export function DialogProvider({ children }: { children?: ReactNode }) {
  useLayoutEffect(() => {
    const persistError = () => toast('No se pudo guardar el progreso en este dispositivo (¿poco espacio?). Exporta una copia en Ajustes.');
    addEventListener('tai-persist-error', persistError);
    return () => removeEventListener('tai-persist-error', persistError);
  }, []);
  return <>{children}{createPortal(<><ToastView /><DialogStack /></>, document.body)}</>;
}

function ToastView() {
  const item = useStore(dialogStore, state => state.toast);
  const act = () => { if (!item.action) return; const action = item.action; dialogStore.getState().setToast({ msg: 'Actualizando…', shown: item.shown }); action.fn(); };
  return <div id="toast" role="status" className={`${item.shown ? 'show' : ''}${item.action ? ' act' : ''}`}>{item.msg}{item.action && <button type="button" onClick={act}>{item.action.label}</button>}</div>;
}

function DialogStack() {
  const dialogs = useStore(dialogStore, state => state.dialogs);
  return <>{dialogs.map((data, index) => <Dialog key={data.id} dialog={data} top={index === dialogs.length - 1} />)}</>;
}
