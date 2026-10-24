import * as store from './store.js';
import { esc, normUi, ZOOMS } from './logic.js';
/** Atajo de querySelector. Se asume que el elemento existe (como en el JS original); usa `$<HTMLInputElement>(…)` para campos de formulario. */
/** Elemento de interfaz con las propiedades de formulario habituales (value, disabled, checked…). */
export type El = HTMLElement & Pick<HTMLInputElement, 'value' | 'disabled' | 'checked' | 'files' | 'select'>;
export const $ = <T extends HTMLElement = El>(s: string, r: ParentNode = document): T => r.querySelector<T>(s)!;
export const app = $('#app') as El;
export const L = 'ABCD';

// avisos y confirmaciones propios (sustituyen a alert/confirm nativos)
let toastT: ReturnType<typeof setTimeout> | undefined;
function toastEl() {
  let t = $('#toast');
  if (!t) { t = document.createElement('div') as unknown as El; t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  return t;
}
toastEl(); // la región viva debe existir antes del primer aviso para que se anuncie
// botón ocupado mientras carga: evita dobles pulsaciones y da respuesta inmediata
export const guard = <A extends unknown[], R>(fn: (...a: A) => R | Promise<R>) => async function (this: any, ...a: A): Promise<R | undefined> {
  if (this.disabled) return;
  const h = this.innerHTML; this.disabled = true; this.textContent = 'Cargando…';
  try { return await fn.apply(this, a); } finally { this.disabled = false; this.innerHTML = h; }
};
addEventListener('tai-persist-error', () => toast('No se pudo guardar el progreso en este dispositivo (¿poco espacio?). Exporta una copia en Ajustes.'));
// Indicador de conexión: franja fija arriba. Offline = ámbar y permanente; al volver, verde 3 s.
const netEl = document.createElement('div'); netEl.id = 'net'; netEl.setAttribute('role', 'status'); netEl.setAttribute('aria-live', 'polite');
document.body.appendChild(netEl);
let netT: ReturnType<typeof setTimeout> | undefined;
function netShow() {
  clearTimeout(netT);
  if (navigator.onLine === false) { netEl.className = 'off'; netEl.textContent = 'Sin conexión · solo lo descargado'; }
  else if (netEl.className === 'off') { netEl.className = 'on'; netEl.textContent = 'De nuevo en línea'; netT = setTimeout(() => { netEl.className = ''; netEl.textContent = ''; }, 3000); }
}
addEventListener('offline', netShow); addEventListener('online', netShow); netShow();
export interface ToastAction { label: string; fn: () => void }
export function toast(msg: string, action?: ToastAction): void {
  const t = toastEl();
  t.onclick = null; t.textContent = msg; t.classList.toggle('act', !!action);
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
    const go = () => { t.onclick = null; t.textContent = 'Actualizando…'; t.classList.remove('act'); action.fn(); };
    b.onclick = e => { e.stopPropagation(); go(); };
    t.onclick = go; // pulsar en cualquier parte del aviso también actualiza
    t.append(b);
  }
  t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 20000 : 4500);
}
export function ask(msg: string, okLabel = 'Aceptar', danger = false): Promise<boolean> {
  return new Promise<boolean>(res => {
    const prev = document.activeElement, o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'askm');
    o.innerHTML = `<div class="card"><p id="askm"></p><div class="row"><button class="btn sec" data-v="0">Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-v="1">${esc(okLabel)}</button></div></div>`;
    $('#askm', o).textContent = msg;
    const done = (v: boolean) => { document.removeEventListener('keydown', key, true); o.remove(); prev && (prev as HTMLElement).focus && (prev as HTMLElement).focus(); res(v); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Tab') { const bs = [...o.querySelectorAll('button')], i = bs.indexOf(document.activeElement as HTMLButtonElement); e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); }
      else e.stopPropagation();
    };
    o.onclick = e => { const b = (e.target as HTMLElement).closest('button'); if (b) done(b.dataset.v === '1'); };
    document.addEventListener('keydown', key, true);
    document.body.append(o); (o.querySelector('[data-v="1"]') as HTMLElement).focus();
  });
}

// ───────── comodidad: tema y tamaño de letra ─────────
function applyUi() {
  const u = normUi(store.getCfg().ui);
  const r = document.documentElement;
  if (u.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', u.theme);
  r.style.setProperty('--z', String(ZOOMS[u.size]));
  r.dataset.textSize = String(u.size);
  const dark = u.theme === 'dark' || (u.theme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) (m as HTMLMetaElement).content = dark ? '#0e1424' : '#14213d';
}
applyUi();
store.onChange(applyUi);

// Aviso informativo con un solo botón (sustituye a alert nativo)
export function notice(msg: string, title = '', okLabel = 'Entendido'): Promise<void> {
  return new Promise<void>(res => {
    const prev = document.activeElement, o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'noticem');
    o.innerHTML = `<div class="card">${title ? '<h2 class="h3" id="noticet"></h2>' : ''}<p id="noticem"></p><div class="row"><button class="btn" data-v="1">${esc(okLabel)}</button></div></div>`;
    $('#noticem', o).textContent = msg; if (title) $('#noticet', o).textContent = title;
    const done = () => { document.removeEventListener('keydown', key, true); o.remove(); prev && (prev as HTMLElement).focus && (prev as HTMLElement).focus(); res(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); } else if (e.key === 'Tab') { e.preventDefault(); } else e.stopPropagation(); };
    o.onclick = e => { if ((e.target as HTMLElement).closest('button') || e.target === o) done(); };
    document.addEventListener('keydown', key, true);
    document.body.append(o); o.querySelector('button')!.focus();
  });
}

// Los selectores mantienen sus estados también después de repintar una pantalla.
export function selectionStates(root: ParentNode = app): void {
  root.querySelectorAll<HTMLButtonElement>('.seg button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.classList.contains('on')));
  });
}
if (app) {
  new MutationObserver(() => selectionStates()).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  app.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.seg button');
    const group = b?.parentElement?.id, value = b?.dataset.v;
    if (!b || !group || value === undefined) return;
    queueMicrotask(() => {
      if (b.isConnected || document.activeElement !== document.body) return;
      const replacement = Array.from(document.getElementById(group)?.querySelectorAll<HTMLButtonElement>('button') || []).find(x => x.dataset.v === value);
      replacement?.focus({ preventScroll: true });
    });
  }, true);
}
