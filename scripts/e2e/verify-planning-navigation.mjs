import { chromium, expect as baseExpect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { assertEmulators } from './synthetic-users.mjs';
import { guardSyntheticBrowser } from '../../tests/e2e/synthetic-auth.ts';
const expect = baseExpect.configure({ timeout:15_000 });
assertEmulators();
const root = resolve(process.env.ROOT || '');
const run = resolve(process.env.TAI_EXPLORER_RUN_DIR || '');
if (!run.startsWith(resolve(root, 'test-results-explorer') + sep)) throw new Error('Unexpected synthetic run directory');
const browser = await chromium.launch();
let page;
const diagnostic = { consoleErrors:[], crashes:[], failedRequests:[] };
try {
  const context = await browser.newContext({ baseURL:'http://127.0.0.1:4187', storageState:resolve(run,'auth.json'), serviceWorkers:'block', viewport:{ width:1280, height:900 } });
  await guardSyntheticBrowser(context, 4187);
  page = await context.newPage();
  page.on('pageerror', error => diagnostic.crashes.push(error.message));
  page.on('console', message => { if (message.type() === 'error') diagnostic.consoleErrors.push(message.text().slice(0,800)); });
  page.on('requestfailed', request => diagnostic.failedRequests.push({ path:new URL(request.url()).pathname, error:request.failure()?.errorText }));
  await page.goto('/#/home');
  const actual = page.getByRole('link', { name:'Planificación', exact:true });
  await expect(actual).toBeVisible();
  const href = await actual.getAttribute('href');
  const inventedSelectorCount = await page.locator("a[href='/planning']").count();
  await actual.click();
  await expect(page).toHaveURL(/#\/planificacion$/);
  await expect(page.getByRole('heading', { name:'Planificación de estudio', exact:true })).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/#\/home$/);
  await page.goForward(); await expect(page).toHaveURL(/#\/planificacion$/);
  await page.reload();
  await expect(page.getByRole('heading', { name:'Planificación de estudio', exact:true })).toBeVisible();
  await page.screenshot({ path:resolve(run,'verified-planning-navigation.png') });
  await writeFile(resolve(run,'verified-planning-navigation.json'), JSON.stringify({ project:'demo-tai-auth', actualHref:href, inventedSelectorCount, actualNavigation:'passed', backForwardReload:'passed', candidateVerdict:'false-positive: nonexistent selector used by Explorer' },null,2));
  await page.goto('/#/home');
  const access = page.getByRole('link', { name:'Accesos', exact:true });
  await expect(access).toBeVisible();
  const accessHref = await access.getAttribute('href');
  const missingAria = await page.locator("a[aria-label='Accesos']").count();
  const wrongHashPrefix = await page.locator("a[href='/#/acceso']").count();
  await access.click();
  await expect(page).toHaveURL(/#\/acceso$/);
  await expect(page.getByRole('heading', { name:'Accesos', exact:true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name:'Accesos', exact:true })).toBeVisible();
  await page.screenshot({ path:resolve(run,'verified-access-navigation.png') });
  await writeFile(resolve(run,'verified-access-navigation.json'), JSON.stringify({ project:'demo-tai-auth', actualHref:accessHref, missingAriaSelectorCount:missingAria, wrongHashPrefixSelectorCount:wrongHashPrefix, actualNavigation:'passed', reload:'passed', candidateVerdict:'false-positive: selectors do not match the real access link' },null,2));
  console.log('Verified actual planning/access links and reload; candidate selectors do not exist.');
} catch (error) {
  if (page) {
    await page.screenshot({ path:resolve(run,'navigation-replay-failure.png') });
    await writeFile(resolve(run,'navigation-replay-failure.json'), JSON.stringify({ ...diagnostic, url:page.url(), body:await page.locator('body').innerText(), hiddenAppText:await page.locator('#app').textContent(), bodyClass:await page.locator('body').getAttribute('class'), resources:await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ path:new URL(entry.name).pathname, duration:Math.round(entry.duration) }))) },null,2));
  }
  throw error;
} finally { await browser.close(); }
