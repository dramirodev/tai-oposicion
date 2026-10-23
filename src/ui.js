import * as store from './store.js';
import { esc, normUi, ZOOMS } from './logic.js';
export const $ = (s, r = document) => r.querySelector(s);
export const app = $('#app');
export const L = 'ABCD';

// avisos y confirmaciones propios (sustituyen a alert/confirm nativos)
let toastT = null;
function toastEl() {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  return t;
}
toastEl(); // la región viva debe existir antes del primer aviso para que se anuncie
// botón ocupado mientras carga: evita dobles pulsaciones y da respuesta inmediata
export const guard = fn => async function (...a) {
  if (this.disabled) return;
  const h = this.innerHTML; this.disabled = true; this.textContent = 'Cargando…';
  try { return await fn.apply(this, a); } finally { this.disabled = false; this.innerHTML = h; }
};
addEventListener('tai-persist-error', () => toast('No se pudo guardar el progreso en este dispositivo (¿poco espacio?). Exporta una copia en Ajustes.'));
// Indicador de conexión: franja fija arriba. Offline = ámbar y permanente; al volver, verde 3 s.
const netEl = document.createElement('div'); netEl.id = 'net'; netEl.setAttribute('role', 'status'); netEl.setAttribute('aria-live', 'polite');
document.body.appendChild(netEl);
let netT;
function netShow() {
  clearTimeout(netT);
  if (navigator.onLine === false) { netEl.className = 'off'; netEl.textContent = 'Sin conexión · solo lo descargado'; }
  else if (netEl.className === 'off') { netEl.className = 'on'; netEl.textContent = 'De nuevo en línea'; netT = setTimeout(() => { netEl.className = ''; netEl.textContent = ''; }, 3000); }
}
addEventListener('offline', netShow); addEventListener('online', netShow); netShow();
export function toast(msg, action) {
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
export function ask(msg, okLabel = 'Aceptar', danger = false) {
  return new Promise(res => {
    const prev = document.activeElement, o = document.createElement('div');
    o.className = 'overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'askm');
    o.innerHTML = `<div class="card"><p id="askm"></p><div class="row"><button class="btn sec" data-v="0">Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-v="1">${esc(okLabel)}</button></div></div>`;
    $('#askm', o).textContent = msg;
    const done = v => { document.removeEventListener('keydown', key, true); o.remove(); prev && prev.focus && prev.focus(); res(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Tab') { const bs = [...o.querySelectorAll('button')], i = bs.indexOf(document.activeElement); e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); }
      else e.stopPropagation();
    };
    o.onclick = e => { const b = e.target.closest('button'); if (b) done(b.dataset.v === '1'); };
    document.addEventListener('keydown', key, true);
    document.body.append(o); o.querySelector('[data-v="1"]').focus();
  });
}

// ───────── comodidad: tema y tamaño de letra ─────────
function applyUi() {
  const u = normUi(store.getCfg().ui);
  const r = document.documentElement;
  if (u.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', u.theme);
  r.style.setProperty('--z', String(ZOOMS[u.size]));
  const dark = u.theme === 'dark' || (u.theme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0e1424' : '#14213d';
}
applyUi();
store.onChange(applyUi);
