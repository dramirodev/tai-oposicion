import { useLayoutEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createPortal } from 'react-dom';
import { dialogStore, type DialogRequest, type MenuAction, type MenuGroup } from './dialog-store.js';
import { toast } from './dialog-actions.js';
import { NativeDialog } from './NativeDialog.js';
function Dialog({ dialog: data, top }: { dialog: DialogRequest; top: boolean }) {
  const select = (action: MenuAction) => { data.done(true); if (typeof action === 'function') action(); else data.navigate?.(action); };
  if (data.kind === 'menu') return <NativeDialog id="menuov" dialogId={data.id} open={top} className="overlay menu-dialog" labelledBy={`menu-title-${data.id}`} initialFocusSelector={`#menu-title-${data.id}`} onCancel={() => data.done(false)} onBackdropClick={() => data.done(false)}>
    <div className="card menu"><div className="menuhead"><h2 id={`menu-title-${data.id}`} tabIndex={-1}>Menú</h2><button className="ghost" id="menux" aria-label="Cerrar menú" onClick={() => data.done(false)}>✕</button></div>
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
  return <><div className="gtitle">{title}</div><div className="lgroup">{items.map(([Icon, name, sub, action], index) => <button key={typeof action === 'string' ? action : name} className={`lrow ${action === current ? 'here' : ''}`} data-a={offset + index} aria-current={action === current ? 'page' : undefined} onClick={() => select(action)}><i aria-hidden="true"><Icon size="1.125rem" strokeWidth={1.7} /></i><span><b>{name}</b><small>{sub}</small></span></button>)}</div></>;
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
