/** Atajo de querySelector. Se asume que el elemento existe (como en el JS original); usa `$<HTMLInputElement>(…)` para campos de formulario. */
/** Elemento de interfaz con las propiedades de formulario habituales (value, disabled, checked…). */
export type El = HTMLElement & Pick<HTMLInputElement, 'value' | 'disabled' | 'checked' | 'files' | 'select'>;
export const $ = <T extends HTMLElement = El>(text: string, result: ParentNode = document): T => result.querySelector<T>(text)!;
export interface LegacyScreen { cleanup: (() => void) | null }
const fallbackScreen: LegacyScreen = { cleanup: null };
let activeScope: { app: El; screen: LegacyScreen } | null = null;
const behaviorCleanup = new WeakMap<HTMLElement, () => void>();
function installLegacyBehavior(host: HTMLElement): () => void {
  const previous = behaviorCleanup.get(host);
  if (previous) return previous;
  const observer = new MutationObserver(() => selectionStates(host));
  observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  const onClick = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.seg button');
    const group = button?.parentElement?.id, value = button?.dataset.v;
    if (!button || !group || value === undefined) return;
    queueMicrotask(() => {
      if (button.isConnected || document.activeElement !== document.body) return;
      const replacement = Array.from(host.querySelectorAll<HTMLButtonElement>('.seg button')).find(button => button.parentElement?.id === group && button.dataset.v === value);
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
    $: <T extends HTMLElement = El>(text: string, result: ParentNode = host): T => result.querySelector<T>(text)!,
  };
}
export const L = 'ABCD';

/** Mantiene un punto de lectura al reemplazar una vista dentro de la misma ruta. */
export function focusHeading(root: ParentNode = legacyScope().app): void {
  const heading = root.querySelector<HTMLElement>('h1');
  if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
}

export { toast, ask, notice, type ToastAction } from './dialog-actions.js';
// botón ocupado mientras carga: evita dobles pulsaciones y da respuesta inmediata
export const guard = <A extends unknown[], R>(fn: (...firstValue: A) => R | Promise<R>) => async function (this: GlobalEventHandlers, ...firstValue: A): Promise<R | undefined> {
  const button = this as HTMLButtonElement;
  if (button.disabled) return;
  const html = button.innerHTML; button.disabled = true; button.textContent = 'Cargando…';
  try { return await fn(...firstValue); } finally { button.disabled = false; button.innerHTML = html; }
};
// ───────── comodidad: tema y tamaño de letra ─────────
// Los selectores mantienen sus estados también después de repintar una pantalla.
export function selectionStates(root: ParentNode = legacyScope().app): void {
  root.querySelectorAll<HTMLButtonElement>('.seg button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.classList.contains('on')));
  });
}
