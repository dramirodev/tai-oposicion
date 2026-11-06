import { test, expect } from '@playwright/test';
import { studyProfiles, studyProfileFixture, STUDY_PROFILE_NOW } from './fixtures/study-profiles';

for (const profile of studyProfiles) {
  test(`Progreso conserva el historial sintético ${profile} tras recargar`, async ({ page }) => {
    const fixture = studyProfileFixture(profile);
    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(error.message));
    await page.setViewportSize({ width: 320, height: 900 });
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.clock.setFixedTime(new Date(STUDY_PROFILE_NOW));
    await page.addInitScript((data) => {
      if (localStorage.getItem('tai.v1:guest')) return;
      localStorage.setItem('tai.dev', '1');
      localStorage.setItem('tai.acc:guest', 'propietario');
      localStorage.setItem('tai.v1:guest', JSON.stringify(data));
    }, fixture);
    await page.goto('/#/stats');
    for (let pass = 0; pass < 2; pass++) {
      await expect(page.getByRole('heading', { name: 'Progreso', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Simulacros', exact: true }).click();
      const history = page.getByRole('region', { name: 'Historial de simulacros' });
      if (!fixture.sessions.length) {
        await expect(history).toContainText('Aún no has hecho ningún simulacro');
        await expect(history.getByLabel('Intento A')).toHaveCount(0);
      } else {
        await expect(history.locator('.sl')).toHaveCount(Math.min(15, fixture.sessions.length));
        const first = history.getByLabel('Intento A');
        const second = history.getByLabel('Intento B');
        await expect(first.locator('option')).toHaveCount(fixture.sessions.length);
        await first.selectOption(fixture.sessions.at(-1)!.id);
        await second.selectOption(fixture.sessions[0].id);
        const expectedDelta = fixture.sessions[0].nota - fixture.sessions.at(-1)!.nota;
        await expect(history.getByText(`Nota: +${expectedDelta}`, { exact: false })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest')!).sessions);
      expect(stored).toEqual(fixture.sessions);
      if (pass === 0) await page.reload();
    }
    expect(crashes).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`stats-${profile}.png`), fullPage: true });
  });
}
