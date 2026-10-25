import * as store from '../adapters/local/legacy-store.js';
import { normUi, ZOOMS } from '../legacy/logic.js';

function applyLegacyUi(): void {
  const ui = normUi(store.getCfg().ui);
  const root = document.documentElement;
  if (ui.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', ui.theme);
  root.style.setProperty('--z', String(ZOOMS[ui.size]));
  root.dataset.textSize = String(ui.size);
  const dark = ui.theme === 'dark' || (ui.theme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name=theme-color]');
  if (themeColor) themeColor.content = dark ? '#0e1424' : '#14213d';
}

applyLegacyUi();
store.onChange(applyLegacyUi);
