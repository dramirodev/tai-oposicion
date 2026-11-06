import { normalizeVisualTheme, type VisualTheme } from './visual-themes.js';
import { UI_THEMES, UI_ZOOMS } from './study-labels.js';

export interface UiPreferences { visualTheme: VisualTheme; theme: typeof UI_THEMES[number]; size: number; lectura: 0 | 1 | 2 }

/** Converts the saved UI preference object into safe values the interface can render. */
export function normalizeUiPreferences(value: unknown): UiPreferences {
  const settings = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    visualTheme: normalizeVisualTheme(settings.visualTheme),
    theme: UI_THEMES.includes(settings.theme as typeof UI_THEMES[number]) ? settings.theme as UiPreferences['theme'] : 'auto',
    size: Number.isInteger(settings.size) && (settings.size as number) >= 0 && (settings.size as number) < UI_ZOOMS.length ? settings.size as number : 0,
    lectura: [0, 1, 2].includes(settings.lectura as number) ? settings.lectura as UiPreferences['lectura'] : 0,
  };
}
