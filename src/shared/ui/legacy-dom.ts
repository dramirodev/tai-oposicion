import * as store from '../../adapters/local/legacy-store.js';
import { esc, normUi, ZOOMS } from '../../legacy/logic.js';
/** Atajo de querySelector. Se asume que el elemento existe (como en el JS original); usa `$<HTMLInputElement>(…)` para campos de formulario. */
/** Elemento de interfaz con las propiedades de formulario habituales (value, disabled, checked…). */
export type El = HTMLElement & Pick<HTMLInputElement, 'value' | 'disabled' | 'checked' | 'files' | 'select'>;
export const $ = <T extends HTMLElement = El>(s: string, r: ParentNode = document): T => r.querySelector<T>(s)!;
export let app = $('#app') as El;
export interface LegacyScreen { cleanup: (() => void) | null }
const fallbackScreen: LegacyScreen = { cleanup: null };
let activeScope: { app: El; screen: LegacyScreen } | null = null;
/** Una visita es dueña de su contenedor y de su limpieza, incluso tras un await. */
export function bindLegacyHost(host: HTMLElement): () => void {
  let disposed = false, cleanup: (() => void) | null = null;
  const scope = { app: host as El, screen: {
    get cleanup() { return cleanup; },
    set cleanup(fn: (() => void) | null) { if (disposed) fn?.(); else cleanup = fn; },
  } };
  activeScope = scope; app = scope.app;
  return () => {
    if (disposed) return;
    disposed = true;
    const off = cleanup; cleanup = null; off?.();
    if (activeScope === scope) activeScope = null;
  };
}
export function legacyScope(screen: LegacyScreen = fallbackScreen) {
  const host = activeScope?.app || app;
  return { app: host, screen: activeScope?.screen || screen,
    $: <T extends HTMLElement = El>(s: string, r: ParentNode = host): T => r.querySelector<T>(s)!,
  };
}
export const L = 'ABCD';

/** Mantiene un punto de lectura al reemplazar una vista dentro de la misma ruta. */
export function focusHeading(): void {
  const heading = app.querySelector<HTMLElement>('h1');
  if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
}

export { toast, ask, notice, type ToastAction } from './dialogs.js';
// botón ocupado mientras carga: evita dobles pulsaciones y da respuesta inmediata
export const guard = <A extends unknown[], R>(fn: (...a: A) => R | Promise<R>) => async function (this: any, ...a: A): Promise<R | undefined> {
  if (this.disabled) return;
  const h = this.innerHTML; this.disabled = true; this.textContent = 'Cargando…';
  try { return await fn.apply(this, a); } finally { this.disabled = false; this.innerHTML = h; }
};
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
