import { mkdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

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

    const happenedAt = Date.now() - 60_000;
    const attemptArchive = {
      schemaVersion: 1,
      createdAt: happenedAt + 200,
      sessions: [
        {
          schemaVersion: 1,
          id: 'backup-session-1',
          mode: 'practice',
          status: 'interrupted',
          startedAt: happenedAt,
          endedAt: happenedAt + 200,
          lastSequence: 2,
        },
        {
          schemaVersion: 1,
          id: 'backup-session-completed',
          mode: 'practice',
          status: 'completed',
          startedAt: happenedAt,
          endedAt: happenedAt + 200,
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
          createdAt: happenedAt,
          completedAt: happenedAt + 100,
          lastSequence: 2,
          appliedEventIds: ['backup-open-1', 'backup-answer-1'],
        },
        {
          schemaVersion: 1,
          id: 'backup-attempt-completed',
          sessionId: 'backup-session-completed',
          questionId: 'TAI2024B-P1-05',
          contentRevision: '',
          mode: 'practice',
          position: 0,
          exposure: 1,
          state: 'answered',
          response: 1,
          outcome: 'correct',
          terminalEventId: 'backup-answer-completed',
          confidence: null,
          discardedOptions: [],
          highlights: [],
          createdAt: happenedAt,
          completedAt: happenedAt + 100,
          lastSequence: 2,
          appliedEventIds: ['backup-open-completed', 'backup-answer-completed'],
        },
      ],
      events: [
        {
          schemaVersion: 1,
          id: 'backup-open-1',
          attemptId: 'backup-attempt-1',
          sequence: 1,
          type: 'open',
          at: happenedAt,
          payload: {},
        },
        {
          schemaVersion: 1,
          id: 'backup-answer-1',
          attemptId: 'backup-attempt-1',
          sequence: 2,
          type: 'answer',
          at: happenedAt + 100,
          payload: { optionIndex: 0, outcome: 'wrong' },
        },
        {
          schemaVersion: 1,
          id: 'backup-open-completed',
          attemptId: 'backup-attempt-completed',
          sequence: 1,
          type: 'open',
          at: happenedAt,
          payload: {},
        },
        {
          schemaVersion: 1,
          id: 'backup-answer-completed',
          attemptId: 'backup-attempt-completed',
          sequence: 2,
          type: 'answer',
          at: happenedAt + 100,
          payload: { optionIndex: 1, outcome: 'correct' },
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
    await expect(backups.getByRole('status')).toContainText('2 intentos detallados');
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '2');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null').stats)).toHaveProperty(
      'TAI2024B-P1-05',
    );

    const aiExport = page.locator('#ai-study-export');
    const fromDate = aiExport.getByLabel('Desde');
    const toDate = aiExport.getByLabel('Hasta');
    const originalFrom = await fromDate.inputValue();
    const originalTo = await toDate.inputValue();
    await fromDate.fill('2030-06-02');
    await toDate.fill('2030-06-01');
    await aiExport.getByRole('button', { name: 'Buscar sesiones completadas' }).click();
    await expect(aiExport.getByRole('status')).toHaveText(
      'Elige un periodo válido y asegúrate de que «Hasta» sea posterior o igual a «Desde».',
    );
    await fromDate.fill(originalFrom);
    await toDate.fill(originalTo);
    const practiceMode = aiExport.getByRole('checkbox', { name: 'Práctica' });
    const simulationMode = aiExport.getByRole('checkbox', { name: 'Simulacros' });
    await practiceMode.uncheck();
    await aiExport.getByRole('button', { name: 'Buscar sesiones completadas' }).click();
    await expect(aiExport).toContainText('No hay sesiones completadas con esos filtros.');
    await simulationMode.uncheck();
    await aiExport.getByRole('button', { name: 'Buscar sesiones completadas' }).click();
    await expect(aiExport.getByRole('status')).toHaveText('Selecciona práctica, simulacros o ambos.');
    await practiceMode.check();
    await aiExport.getByRole('button', { name: 'Buscar sesiones completadas' }).click();
    await expect(aiExport.getByRole('status')).toHaveText('1 sesión completada disponible.');
    const sessionChoice = aiExport.getByRole('checkbox', { name: /Práctica ·/ });
    await expect(sessionChoice).toBeChecked();
    await sessionChoice.uncheck();
    const prepareExport = aiExport.getByRole('button', { name: 'Preparar análisis para descargar' });
    await expect(prepareExport).toBeDisabled();
    await sessionChoice.check();
    await prepareExport.click();
    await expect(aiExport).toContainText('Vista previa: 1 parte JSON · 1 sesión · 1 intento · 2 eventos');
    mkdirSync('tests/e2e/evidence/accessibility-2026-11-05', { recursive: true });
    await page.screenshot({
      path: `tests/e2e/evidence/accessibility-2026-11-05/settings-ai-export-preview-${width}px-${browserName}.png`,
      fullPage: true,
    });
    const [aiDownload] = await Promise.all([
      page.waitForEvent('download'),
      aiExport.getByRole('button', { name: 'Descargar análisis completo en ZIP' }).click(),
    ]);
    expect(aiDownload.suggestedFilename()).toBe('tai-estudio-analisis.zip');
    const aiZipPath = await aiDownload.path();
    expect(aiZipPath).not.toBeNull();
    const archiveFiles = unzipSync(readFileSync(aiZipPath!));
    expect(Object.keys(archiveFiles)).toContain('tai-estudio-manifiesto.json');
    expect(Object.keys(archiveFiles)).toContain('tai-estudio-informe.md');
    const exportedManifest = JSON.parse(strFromU8(archiveFiles['tai-estudio-manifiesto.json']));
    expect(exportedManifest.manifest.parts).toHaveLength(1);
    expect(exportedManifest.manifest.parts[0]).toMatchObject({ sessionCount: 1, attemptCount: 1, eventCount: 2 });
    expect(Object.keys(archiveFiles)).toContain(exportedManifest.manifest.parts[0].fileName);

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
      sessions: [
        { id: 'backup-session-1', status: 'interrupted' },
        { id: 'backup-session-completed', status: 'completed' },
      ],
      attempts: [
        { id: 'backup-attempt-1', state: 'answered', outcome: 'wrong' },
        { id: 'backup-attempt-completed', state: 'answered', outcome: 'correct' },
      ],
      events: [
        { id: 'backup-open-1', type: 'open' },
        { id: 'backup-answer-1', type: 'answer' },
        { id: 'backup-open-completed', type: 'open' },
        { id: 'backup-answer-completed', type: 'answer' },
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
    await expect(backups.getByRole('status')).toContainText('2 intentos detallados');
    const [repeatDownload] = await Promise.all([
      page.waitForEvent('download'),
      backups.getByRole('button', { name: 'Exportar progreso' }).click(),
    ]);
    const repeatedPath = await repeatDownload.path();
    expect(repeatedPath).not.toBeNull();
    const repeatedBackup = JSON.parse(readFileSync(repeatedPath!, 'utf8')) as typeof roundTripBackup;
    expect(repeatedBackup.attemptHistory.attempts).toHaveLength(2);
    expect(repeatedBackup.attemptHistory.events).toHaveLength(4);

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
