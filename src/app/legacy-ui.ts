import * as store from '../adapters/local/legacy-store.js';
import { normalizeUiPreferences } from '../shared/presentation/ui-preferences.js';
import { UI_ZOOMS } from '../shared/presentation/study-labels.js';

const systemTheme = matchMedia('(prefers-color-scheme:dark)');

function applyLegacyUi(): void {
  const ui = normalizeUiPreferences(store.getCfg().ui);
  const root = document.documentElement;
  if (ui.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', ui.theme);
  root.style.setProperty('--z', String(UI_ZOOMS[ui.size]));
  root.dataset.textSize = String(ui.size);
  const dark = ui.theme === 'dark' || (ui.theme === 'auto' && systemTheme.matches);
  root.dataset.colorScheme = dark ? 'dark' : 'light';
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name=theme-color]');
  if (themeColor) themeColor.content = dark ? '#111113' : '#f5f6f7';
}

applyLegacyUi();
store.onChange(applyLegacyUi);

// El modo automático y la barra del navegador comparten un único tema resuelto.
systemTheme.addEventListener?.('change', applyLegacyUi);
