import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface AuditApi {
  total: number;
  records: Record<string, number>;
  originCounts: Record<string, number>;
  scannedFiles: number;
  fieldsScanned: number;
  fieldsWithCode: number;
  fragmentCount: number;
  recordsWithCode: number;
  byField: Record<string, number>;
  bySource: Record<string, number>;
  byLanguage: Record<string, number>;
  codeCases: { path: string; id: string; field: string; fragmentIndex: number; text: string; language: string }[];
  renderBatch(offset: number, size: number): Promise<void>;
  renderIndexes(indexes: number[]): Promise<void>;
}

declare global { interface Window { codeRenderAudit?: AuditApi; codeRenderReady?: Promise<void>; codeRenderError?: string; } }

test('Shiki presenta todos los fragmentos reales del banco, supuestos, tarjetas y explicaciones', async ({ page }, testInfo) => {
  test.setTimeout(60 * 60 * 1000);
  await page.goto('/tests/e2e/fixtures/code-render-audit.html');
  await page.waitForFunction(() => window.codeRenderReady && (window.codeRenderAudit || window.codeRenderError));
  const loadError = await page.evaluate(() => window.codeRenderError);
  if (loadError) throw new Error(`No se pudo construir el inventario del banco: ${loadError}`);
  const summary = await page.evaluate(() => {
    const { total: _total, renderBatch: _renderBatch, renderIndexes: _renderIndexes, ...value } = window.codeRenderAudit!;
    return { ...value, total: window.codeRenderAudit!.total };
  });
  expect(summary.records.question).toBe(15_662 + 417);
  expect(summary.records.scenario).toBe(32);
  expect(summary.records.card).toBe(1_410);
  expect(summary.records.explanation).toBeGreaterThan(0);
  expect(summary.fieldsScanned).toBeGreaterThan(90_000);
  expect(summary.fragmentCount).toBeGreaterThan(0);
  expect(summary.total).toBe(summary.recordsWithCode);

  const expectedCases = summary.codeCases;
  const languageCaseIndex = new Map<string, number>();
  expectedCases.forEach((codeCase, caseIndex) => { if (!languageCaseIndex.has(codeCase.language)) languageCaseIndex.set(codeCase.language, caseIndex); });
  const report: Record<string, unknown>[] = [];
  // Keep evidence outside Playwright's outputDir, which is cleared per run.
  const artifactDirectory = join(process.cwd(), 'test-results', 'code-render-audit-evidence');
  await mkdir(artifactDirectory, { recursive: true });
  const combinations = [
    { width: 320, height: 780, theme: 'light', textSize: 0, zoom: 1 },
    { width: 320, height: 780, theme: 'light', textSize: 3, zoom: 1.5 },
    { width: 320, height: 780, theme: 'dark', textSize: 0, zoom: 1 },
    { width: 320, height: 780, theme: 'dark', textSize: 3, zoom: 1.5 },
    { width: 1440, height: 1000, theme: 'light', textSize: 0, zoom: 1 },
    { width: 1440, height: 1000, theme: 'light', textSize: 3, zoom: 1.5 },
    { width: 1440, height: 1000, theme: 'dark', textSize: 0, zoom: 1 },
    { width: 1440, height: 1000, theme: 'dark', textSize: 3, zoom: 1.5 },
  ];

  for (const combination of combinations) {
    await page.setViewportSize({ width: combination.width, height: combination.height });
    await page.evaluate(({ theme, textSize, zoom }) => {
      document.documentElement.dataset.colorScheme = theme;
      document.documentElement.dataset.textSize = String(textSize);
      document.documentElement.style.setProperty('--z', String(zoom));
    }, combination);
    let rendered = 0, visibleCode = 0, batchNumber = 0;
    for (let offset = 0; offset < summary.total; offset += 40) {
      await page.evaluate(({ offset, size }) => window.codeRenderAudit!.renderBatch(offset, size), { offset, size: 40 });
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('[data-audit-field] code')].every(code => code.classList.contains('shiki')));
      const result = await page.evaluate(() => {
        const issues: string[] = [];
        const articles = [...document.querySelectorAll<HTMLElement>('article[data-audit-record]')];
        for (const article of articles) {
          const id = article.dataset.auditRecord || '(sin ID)';
          if (article.scrollWidth > article.clientWidth + 1) {
            const overflowing = [...article.querySelectorAll<HTMLElement>('div,pre,code')].filter(node => node.scrollWidth > node.clientWidth + 2).map(node => `${node.tagName.toLowerCase()}.${String(node.className).replace(/\s+/g, '.')}:${(node.textContent || '').slice(0, 80)}`);
            issues.push(`${id}: la tarjeta se desborda horizontalmente (${overflowing.slice(0, 3).join(' | ')})`);
          }
          for (const field of article.querySelectorAll<HTMLElement>('[data-audit-field]')) {
            const name = field.dataset.auditField || 'campo';
            const expected = Number(field.dataset.expectedCodeCount || 0);
            const actualText = field.textContent || '';
            if (actualText !== field.dataset.expected) issues.push(`${id}/${name}: el texto renderizado difiere`);
            const sourceExpected = field.dataset.expectedSource;
            if (sourceExpected !== undefined && !actualText.includes(sourceExpected)) issues.push(`${id}/${name}: falta texto original del banco`);
            const codeElements = [...field.querySelectorAll<HTMLElement>('code')];
            const actualCodeCount = article.dataset.recordKind === 'explanation'
              ? codeElements.length : field.querySelectorAll('code.cd').length;
            if (actualCodeCount !== expected) issues.push(`${id}/${name}: código marcado ${actualCodeCount}, esperado ${expected}`);
            if (codeElements.some(code => !code.classList.contains('shiki'))) issues.push(`${id}/${name}: bloque sin Shiki ni fallback marcado`);
            if (field.querySelector('script,iframe,object,embed,[onerror],[onclick]')) issues.push(`${id}/${name}: contenido interpretado como HTML ejecutable`);
            for (const code of codeElements) {
              const fieldBounds = field.getBoundingClientRect();
              const codeBounds = code.getBoundingClientRect();
              if (codeBounds.left < fieldBounds.left - 1 || codeBounds.right > fieldBounds.right + 2) issues.push(`${id}/${name}: código se sale de su contenedor`);
              const language = code.dataset.shikiLanguage;
              if (!language) issues.push(`${id}/${name}: falta la decisión de lenguaje/fallback`);
              if (!['text', 'bash', 'sql', 'java', 'python', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'xml', 'html', 'css'].includes(language || '')) issues.push(`${id}/${name}: lenguaje Shiki desconocido ${language}`);
              const tokens = [...code.querySelectorAll<HTMLElement>('.shiki-token')];
              if (language !== 'text' && tokens.length === 0) issues.push(`${id}/${name}: Shiki no generó tokens para ${language}`);
              if (tokens.some(token => getComputedStyle(token).color === 'rgba(0, 0, 0, 0)')) issues.push(`${id}/${name}: token invisible con tema ${document.documentElement.dataset.colorScheme}`);
              if (language !== 'text' && tokens.length > 0 && tokens.every(token => getComputedStyle(token).color === getComputedStyle(code).color)) {
                issues.push(`${id}/${name}: el tema no aplica los colores de Shiki para ${language}`);
              }
            }
          }
        }
        if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(`página: desbordamiento horizontal de ${document.documentElement.scrollWidth - innerWidth}px`);
        return { issues, rows: articles.length, code: document.querySelectorAll('[data-audit-field] code').length, ids: articles.map(article => article.dataset.auditRecord) };
      });
      expect(result.issues, `${combination.theme}, ${combination.width}px, texto ${combination.textSize}, lote ${offset}–${offset + result.rows}`).toEqual([]);
      rendered += result.rows;
      visibleCode += result.code;

      if (batchNumber === 0) {
        const screenshotName = `${testInfo.project.name}-${combination.theme}-${combination.width}-text${combination.textSize}.png`;
        const screenshotPath = join(artifactDirectory, screenshotName);
        const screenshot = await page.screenshot({ path: screenshotPath, fullPage: true });
        await testInfo.attach(screenshotName, { body: screenshot, contentType: 'image/png' });
      }
      batchNumber++;
    }
    expect(rendered).toBe(summary.total);
    report.push({ ...combination, renderedRecords: rendered, renderedCodeElements: visibleCode });
  }

  const inventory = { ...summary, combinations: report };
  await writeFile(join(artifactDirectory, `${testInfo.project.name}-inventory.json`), JSON.stringify(inventory, null, 2));
  await writeFile(join(artifactDirectory, `${testInfo.project.name}-inventory.txt`), [
    `Archivos de contenido: ${summary.scannedFiles}`,
    `Preguntas de temas: ${summary.records.question - 417}; preguntas de supuestos: 417; escenarios: ${summary.records.scenario}; tarjetas: ${summary.records.card}; explicaciones: ${summary.records.explanation}`,
    `Campos textuales escaneados: ${summary.fieldsScanned}; campos con código: ${summary.fieldsWithCode}; fragmentos: ${summary.fragmentCount}; registros de pantalla con código: ${summary.recordsWithCode}`,
    `Por campo: ${JSON.stringify(summary.byField)}`,
    `Por origen: ${JSON.stringify(summary.originCounts)}`,
    `Por lenguaje/fallback: ${JSON.stringify(summary.byLanguage)}`,
    `Variantes visuales: ${JSON.stringify(report)}`,
  ].join('\n'));
  await testInfo.attach('code-render-inventory.json', { body: Buffer.from(JSON.stringify(inventory, null, 2)), contentType: 'application/json' });
  await testInfo.attach('code-render-inventory.txt', { body: Buffer.from([
    `Archivos de contenido: ${summary.scannedFiles}`,
    `Preguntas de temas: ${summary.records.question - 417}; preguntas de supuestos: 417; escenarios: ${summary.records.scenario}; tarjetas: ${summary.records.card}; explicaciones: ${summary.records.explanation}`,
    `Campos textuales escaneados: ${summary.fieldsScanned}; campos con código: ${summary.fieldsWithCode}; fragmentos: ${summary.fragmentCount}; registros de pantalla con código: ${summary.recordsWithCode}`,
    `Por campo: ${JSON.stringify(summary.byField)}`,
    `Por origen: ${JSON.stringify(summary.originCounts)}`,
    `Por lenguaje/fallback: ${JSON.stringify(summary.byLanguage)}`,
    `Variantes visuales: ${JSON.stringify(report)}`,
  ].join('\n')), contentType: 'text/plain' });
});
