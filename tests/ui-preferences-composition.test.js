import { afterEach, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({ listener: undefined, unsubscribe: vi.fn() }));
vi.mock('../src/adapters/local/progress-repository.js', () => ({
  localProgressRepository: {
    subscribe: listener => {
      progress.listener = listener;
      return progress.unsubscribe;
    },
  },
  localStudyProgressGateway: {
    getPreferences: () => ({ ui: { theme: 'auto', size: 2, lectura: 0 } }),
  },
}));

import { initializeUiPreferences } from '../src/app/composition/ui-preferences-composition.js';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-color-scheme');
  document.documentElement.removeAttribute('data-text-size');
  document.documentElement.style.removeProperty('--z');
  document.documentElement.style.removeProperty('--bg');
  document.documentElement.removeAttribute('data-visual-theme');
  document.querySelector('meta[name="theme-color"]')?.remove();
  progress.listener = undefined;
  progress.unsubscribe.mockClear();
  vi.unstubAllGlobals();
});

it('applies saved preferences before render and tracks system theme changes', () => {
  const media = new EventTarget();
  media.matches = true;
  const addEventListener = vi.spyOn(media, 'addEventListener');
  const removeEventListener = vi.spyOn(media, 'removeEventListener');
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const themeColor = document.createElement('meta');
  themeColor.name = 'theme-color';
  document.head.append(themeColor);

  document.documentElement.style.setProperty('--bg', '#123456');
  const stop = initializeUiPreferences();

  expect(document.documentElement.dataset.colorScheme).toBe('dark');
  expect(document.documentElement.dataset.textSize).toBe('2');
  expect(document.documentElement.style.getPropertyValue('--z')).not.toBe('');
  expect(document.documentElement.dataset.visualTheme).toBe('soft-brutalism');
  expect(themeColor.content).toBe('#123456');
  expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

  document.documentElement.style.setProperty('--bg', '#fff9ed');
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  expect(document.documentElement.dataset.colorScheme).toBe('light');
  expect(themeColor.content).toBe('#fff9ed');

  stop();
  expect(progress.unsubscribe).toHaveBeenCalledOnce();
  expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});
