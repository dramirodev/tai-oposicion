import { localProgressRepository, localStudyProgressGateway } from '../../adapters/local/progress-repository.js';
import { normalizeUiPreferences } from '../../shared/presentation/ui-preferences.js';
import { UI_ZOOMS } from '../../shared/presentation/study-labels.js';

/** Applies the saved theme and text scale before React renders the first screen. */
export function initializeUiPreferences(): () => void {
  const systemTheme = matchMedia('(prefers-color-scheme:dark)');
  const apply = () => {
    const ui = normalizeUiPreferences(localStudyProgressGateway.getPreferences().ui);
    const root = document.documentElement;
    if (ui.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', ui.theme);
    root.style.setProperty('--z', String(UI_ZOOMS[ui.size]));
    root.dataset.textSize = String(ui.size);
    const dark = ui.theme === 'dark' || (ui.theme === 'auto' && systemTheme.matches);
    root.dataset.colorScheme = dark ? 'dark' : 'light';
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name=theme-color]');
    if (themeColor) themeColor.content = dark ? '#111113' : '#f5f6f7';
  };

  apply();
  const unsubscribe = localProgressRepository.subscribe(apply);
  systemTheme.addEventListener?.('change', apply);
  return () => {
    unsubscribe();
    systemTheme.removeEventListener?.('change', apply);
  };
}
