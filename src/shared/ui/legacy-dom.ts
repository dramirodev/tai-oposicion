/** Atajo de querySelector. Se asume que el elemento existe (como en el JS original); usa `$<HTMLInputElement>(…)` para campos de formulario. */
/** Elemento de interfaz con las propiedades de formulario habituales (value, disabled, checked…). */
export type El = HTMLElement & Pick<HTMLInputElement, 'value' | 'disabled' | 'checked' | 'files' | 'select'>;
export const $ = <T extends HTMLElement = El>(s: string, r: ParentNode = document): T => r.querySelector<T>(s)!;
export interface LegacyScreen { cleanup: (() => void) | null }
const fallbackScreen: LegacyScreen = { cleanup: null };
let activeScope: { app: El; screen: LegacyScreen } | null = null;
const behaviorCleanup = new WeakMap<HTMLElement, () => void>();
function installLegacyBehavior(host: HTMLElement): () => void {
  const previous = behaviorCleanup.get(host);
  if (previous) return previous;
  const observer = new MutationObserver(() => selectionStates(host));
  observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  const onClick = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.seg button');
    const group = b?.parentElement?.id, value = b?.dataset.v;
    if (!b || !group || value === undefined) return;
    queueMicrotask(() => {
      if (b.isConnected || document.activeElement !== document.body) return;
      const replacement = Array.from(host.querySelectorAll<HTMLButtonElement>('.seg button')).find(x => x.parentElement?.id === group && x.dataset.v === value);
      replacement?.focus({ preventScroll: true });
    });
  };
  host.addEventListener('click', onClick, true);
  const cleanup = () => { observer.disconnect(); host.removeEventListener('click', onClick, true); behaviorCleanup.delete(host); };
  behaviorCleanup.set(host, cleanup);
  return cleanup;
}
/** Una visita es dueña de su contenedor y de su limpieza, incluso tras un await. */
export function bindLegacyHost(host: HTMLElement): () => void {
  let disposed = false, cleanup: (() => void) | null = null;
  const scope = { app: host as El, screen: {
    get cleanup() { return cleanup; },
    set cleanup(fn: (() => void) | null) { if (disposed) fn?.(); else cleanup = fn; },
  } };
  activeScope = scope;
  const cleanupBehavior = installLegacyBehavior(host);
  return () => {
    if (disposed) return;
    disposed = true;
    const off = cleanup; cleanup = null; off?.();
    cleanupBehavior();
    if (activeScope === scope) activeScope = null;
  };
}
export function legacyScope(screen: LegacyScreen = fallbackScreen) {
  const host = activeScope?.app || ($('#app') as El);
  installLegacyBehavior(host);
  return { app: host, screen: activeScope?.screen || screen,
    $: <T extends HTMLElement = El>(s: string, r: ParentNode = host): T => r.querySelector<T>(s)!,
  };
}
export const L = 'ABCD';

/** Mantiene un punto de lectura al reemplazar una vista dentro de la misma ruta. */
export function focusHeading(root: ParentNode = legacyScope().app): void {
  const heading = root.querySelector<HTMLElement>('h1');
  if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
}

export { toast, ask, notice, type ToastAction } from './dialogs.js';
// botón ocupado mientras carga: evita dobles pulsaciones y da respuesta inmediata
export const guard = <A extends unknown[], R>(fn: (...a: A) => R | Promise<R>) => async function (this: GlobalEventHandlers, ...a: A): Promise<R | undefined> {
  const button = this as HTMLButtonElement;
  if (button.disabled) return;
  const h = button.innerHTML; button.disabled = true; button.textContent = 'Cargando…';
  try { return await fn(...a); } finally { button.disabled = false; button.innerHTML = h; }
};
// ───────── comodidad: tema y tamaño de letra ─────────
// Los selectores mantienen sus estados también después de repintar una pantalla.
export function selectionStates(root: ParentNode = legacyScope().app): void {
  root.querySelectorAll<HTMLButtonElement>('.seg button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.classList.contains('on')));
  });
}
