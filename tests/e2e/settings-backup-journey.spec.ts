import { mkdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`Ajustes importa una copia sintética con vista previa y confirmación · ${width}px`, async ({
    page,
    browserName,
  }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.addInitScript(() => {
      if (localStorage.getItem('tai.e2e.backup-seeded')) return;
      localStorage.setItem('tai.e2e.backup-seeded', '1');
      localStorage.setItem('tai.dev', '1');
      localStorage.setItem('tai.acc:guest', 'propietario');
      localStorage.setItem(
        'tai.v1:guest',
        JSON.stringify({
          stats: {
            'TAI2024B-P1-05': [1, 0, Date.now(), 0, Date.now() + 2 * 86_400_000, 0, 0, 0, 0, 0, 0, 0],
          },
          sessions: [],
          cfg: { ui: { theme: 'light', size: 1, lectura: 0 } },
          seen: { t: [], ts: 0 },
          cards: {},
          reports: {},
        }),
      );
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/settings');

    const backups = page.getByRole('heading', { name: 'Copias de seguridad' }).locator('..');
    const fileInput = backups.locator('input[type="file"]');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      backups.getByRole('button', { name: 'Exportar progreso' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('tai-progreso.json');
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const exportedBackup = JSON.parse(readFileSync(downloadedPath!, 'utf8')) as {
      stats: Record<string, unknown>;
      attemptHistory: { attempts: unknown[] };
    };
    expect(exportedBackup.stats).toHaveProperty('TAI2024B-P1-05');
    expect(Array.isArray(exportedBackup.attemptHistory.attempts)).toBe(true);

    await fileInput.setInputFiles({
      name: 'copia-ilegible.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ JSON sintético no válido'),
    });
    await expect(backups.getByRole('status')).toHaveText('Archivo no válido: JSON ilegible');
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');

    const attemptArchive = {
      schemaVersion: 1,
      createdAt: 300,
      sessions: [
        {
          schemaVersion: 1,
          id: 'backup-session-1',
          mode: 'practice',
          status: 'interrupted',
          startedAt: 100,
          endedAt: 300,
          lastSequence: 2,
        },
      ],
      attempts: [
        {
          schemaVersion: 1,
          id: 'backup-attempt-1',
          sessionId: 'backup-session-1',
          questionId: 'TAI2024B-P1-05',
          contentRevision: '',
          mode: 'practice',
          position: 0,
          exposure: 1,
          state: 'answered',
          response: 0,
          outcome: 'wrong',
          terminalEventId: 'backup-answer-1',
          confidence: null,
          discardedOptions: [],
          highlights: [],
          createdAt: 100,
          completedAt: 200,
          lastSequence: 2,
          appliedEventIds: ['backup-open-1', 'backup-answer-1'],
        },
      ],
      events: [
        {
          schemaVersion: 1,
          id: 'backup-open-1',
          attemptId: 'backup-attempt-1',
          sequence: 1,
          type: 'open',
          at: 100,
          payload: {},
        },
        {
          schemaVersion: 1,
          id: 'backup-answer-1',
          attemptId: 'backup-attempt-1',
          sequence: 2,
          type: 'answer',
          at: 200,
          payload: { optionIndex: 0, outcome: 'wrong' },
        },
      ],
    };
    const backup = JSON.stringify({
      stats: {},
      sessions: [],
      cards: {},
      reports: {},
      cfg: { ui: { theme: 'dark', size: 2, lectura: 0 } },
      attemptHistory: attemptArchive,
    });
    await fileInput.setInputFiles({
      name: 'copia-sintetica.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup),
    });
    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText('Combinar esta copia con tu progreso');
    await expect(confirmation).toContainText('ajustes válidos');
    await page.keyboard.press('Escape');
    await expect(confirmation).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    await expect(backups.getByRole('status')).toHaveText('Archivo no válido: JSON ilegible');

    await fileInput.setInputFiles({
      name: 'copia-sintetica.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup),
    });
    const confirmAgain = page.getByRole('dialog');
    await confirmAgain.getByRole('button', { name: 'Importar copia' }).click();
    await expect(confirmAgain).toBeHidden();
    await expect(backups.getByRole('status')).toContainText('Copia combinada:');
    await expect(backups.getByRole('status')).toContainText('1 intento detallado');
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '2');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null').stats)).toHaveProperty(
      'TAI2024B-P1-05',
    );
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    const [roundTripDownload] = await Promise.all([
      page.waitForEvent('download'),
      backups.getByRole('button', { name: 'Exportar progreso' }).click(),
    ]);
    const roundTripPath = await roundTripDownload.path();
    expect(roundTripPath).not.toBeNull();
    const roundTripBackup = JSON.parse(readFileSync(roundTripPath!, 'utf8')) as {
      attemptHistory: {
        sessions: { id: string; status: string }[];
        attempts: { id: string; state: string; outcome: string | null }[];
        events: { id: string; type: string }[];
      };
    };
    expect(roundTripBackup.attemptHistory).toMatchObject({
      sessions: [{ id: 'backup-session-1', status: 'interrupted' }],
      attempts: [{ id: 'backup-attempt-1', state: 'answered', outcome: 'wrong' }],
      events: [
        { id: 'backup-open-1', type: 'open' },
        { id: 'backup-answer-1', type: 'answer' },
      ],
    });

    await fileInput.setInputFiles({
      name: 'copia-vuelta.json',
      mimeType: 'application/json',
      buffer: readFileSync(roundTripPath!),
    });
    const repeatedImport = page.getByRole('dialog');
    await repeatedImport.getByRole('button', { name: 'Importar copia' }).click();
    await expect(repeatedImport).toBeHidden();
    await expect(backups.getByRole('status')).toContainText('1 intento detallado');
    const [repeatDownload] = await Promise.all([
      page.waitForEvent('download'),
      backups.getByRole('button', { name: 'Exportar progreso' }).click(),
    ]);
    const repeatedPath = await repeatDownload.path();
    expect(repeatedPath).not.toBeNull();
    const repeatedBackup = JSON.parse(readFileSync(repeatedPath!, 'utf8')) as typeof roundTripBackup;
    expect(repeatedBackup.attemptHistory.attempts).toHaveLength(1);
    expect(repeatedBackup.attemptHistory.events).toHaveLength(2);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '2');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null').stats)).toHaveProperty(
      'TAI2024B-P1-05',
    );
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    mkdirSync('tests/e2e/evidence/accessibility-2026-11-05', { recursive: true });
    await page.screenshot({
      path: `tests/e2e/evidence/accessibility-2026-11-05/settings-backup-${width}px-${browserName}.png`,
      fullPage: true,
    });
  });
}
