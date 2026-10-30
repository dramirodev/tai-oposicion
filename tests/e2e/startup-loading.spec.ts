import { expect, test } from '@playwright/test';

test('aplica el tema guardado antes de terminar la comprobación de actualización', async ({ page }) => {
  let releaseVersionRequest!: () => void;
  let signalVersionRequestStarted!: () => void;
  const versionRequestReleased = new Promise<void>(resolve => { releaseVersionRequest = resolve; });
  const versionRequestStarted = new Promise<void>(resolve => { signalVersionRequestStarted = resolve; });

  await page.route('**/version.json', async route => {
    signalVersionRequestStarted();
    await versionRequestReleased;
    await route.fulfill({ status: 404, body: '' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('tai.dev', '1');
    localStorage.setItem('tai.acc:guest', 'propietario');
    localStorage.setItem('tai.v1:guest', JSON.stringify({
      stats: {}, sessions: [], cfg: { ui: { theme: 'dark', size: 1 } }, seen: { t: [], ts: 0 }, cards: {}, reports: {},
    }));
  });
  await page.emulateMedia({ colorScheme: 'light' });

  try {
    await page.goto('/');
    await versionRequestStarted;
    const loader = page.locator('#initial-loading');
    await expect(loader).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect.poll(() => loader.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(17, 17, 19)');
    await expect.poll(() => loader.evaluate(element => getComputedStyle(element).color)).toBe('rgb(241, 241, 242)');
  } finally {
    releaseVersionRequest();
  }
});
