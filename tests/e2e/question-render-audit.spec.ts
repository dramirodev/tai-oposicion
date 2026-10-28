import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    questionRenderAudit?: { total: number; ids: string[]; renderBatch(offset: number, size: number): Promise<void> };
    questionRenderReady?: Promise<void>;
  }
}

test('renderiza y revisa todo el banco en móvil y escritorio', async ({ page }, testInfo) => {
  test.setTimeout(20 * 60 * 1000);
  await page.goto('/tests/e2e/fixtures/question-render-audit.html');
  await page.waitForFunction(() => window.questionRenderReady && window.questionRenderAudit);
  const total = await page.evaluate(() => window.questionRenderAudit!.total);
  expect(total).toBeGreaterThan(0);
  const reports: { viewport: number; rendered: number; codeBlocks: number; records: number }[] = [];

  for (const viewport of [{ width: 393, height: 852 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    let rendered = 0, codeBlocks = 0;
    for (let offset = 0; offset < total; offset += 40) {
      await page.evaluate(({ start, size }) => window.questionRenderAudit!.renderBatch(start, size), { start: offset, size: 40 });
      const expectedCodeCount = await page.locator('code.cd').count();
      if (expectedCodeCount) {
        await page.waitForFunction(() => [...document.querySelectorAll('code.cd')].every(code => code.classList.contains('shiki')), null, { timeout: 10_000 });
      }
      const result = await page.evaluate(() => {
        const issues: string[] = [];
        const suspicious = /\uFFFD|ï¿½|Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â[\u0080-\u00BF]|ðŸ/u;
        const articles = [...document.querySelectorAll<HTMLElement>('article[data-question-id]')];
        for (const article of articles) {
          const id = article.dataset.questionId || '(sin id)';
          if (article.scrollWidth > article.clientWidth + 1) issues.push(`${id}: overflow horizontal de pregunta`);
          for (const field of article.querySelectorAll<HTMLElement>('[data-audit-field]')) {
            const name = field.dataset.auditField || 'campo';
            if (field.textContent !== field.dataset.expected) issues.push(`${id}: texto alterado en ${name}`);
            if (suspicious.test(field.textContent || '')) issues.push(`${id}: posible OCR/codificación dañada en ${name}`);
            if (field.querySelectorAll('code.cd').length !== Number(field.dataset.expectedCodeCount)) issues.push(`${id}: formato de código perdido en ${name}`);
          }
          for (const option of article.querySelectorAll<HTMLButtonElement>('.opts button.opt')) {
            if (!option.textContent?.trim() || option.getAttribute('aria-pressed') === null) issues.push(`${id}: opción sin nombre o estado accesible`);
          }
          for (const code of article.querySelectorAll<HTMLElement>('code.cd')) {
            if (code.getBoundingClientRect().right > innerWidth + 1) issues.push(`${id}: código fuera del viewport`);
          }
        }
        return { issues, count: articles.length, codeBlocks: document.querySelectorAll('code.cd').length };
      });
      expect(result.issues, `Preguntas ${offset + 1}–${offset + result.count} en ${viewport.width}px`).toEqual([]);
      rendered += result.count;
      codeBlocks += result.codeBlocks;
      if (offset === 0) await testInfo.attach(`question-render-${viewport.width}px`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    expect(rendered).toBe(total);
    reports.push({ viewport: viewport.width, rendered, codeBlocks, records: total });
  }

  await testInfo.attach('question-render-audit.json', { body: Buffer.from(JSON.stringify(reports, null, 2)), contentType: 'application/json' });
});
