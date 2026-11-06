import { chromium, expect } from '@playwright/test';
import { resolve, sep } from 'node:path';
import { assertEmulators, identities } from './synthetic-users.mjs';
import { guardSyntheticBrowser, signInSynthetic } from '../../tests/e2e/synthetic-auth.ts';
assertEmulators();
if (process.env.APP_URL !== 'http://127.0.0.1:4187') throw new Error('Only the local TAI Explorer app is permitted');
const email = process.env.TAI_EXPLORER_EMAIL || identities.owner.email;
if (!Object.values(identities).some(identity => identity.email === email)) throw new Error('Unknown synthetic profile');
const explorer = resolve(process.env.EXPLORER || '');
const state = resolve(process.env.TAI_EXPLORER_AUTH_STATE || '');
const runDirectory = resolve(process.env.TAI_EXPLORER_RUN_DIR || explorer);
const artifactRoot = resolve(process.env.ROOT || '', 'test-results-explorer');
if (!process.env.ROOT || !runDirectory.startsWith(artifactRoot + sep) || state !== resolve(runDirectory, 'auth.json')) throw new Error('Unexpected Explorer session destination');
const browser = await chromium.launch({ headless:process.env.TAI_EXPLORER_HEADED !== '1' });
try {
  const context = await browser.newContext({ baseURL:process.env.APP_URL, serviceWorkers:'block' });
  context.setDefaultTimeout(15_000);
  await guardSyntheticBrowser(context, 4187);
  const page = await context.newPage();
  await signInSynthetic(page, email);
  if (email === identities.owner.email) {
    await page.goto('/#/acceso');
    await expect(page.getByRole('heading', { name:'Accesos', exact:true })).toBeVisible();
  }
  await context.storageState({ path:state, indexedDB:true });
  console.log('Synthetic Explorer session saved with IndexedDB; local owner access verified.');
} finally { await browser.close(); }
