import { expect, test, type Page } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('Firebase Auth Emulator aísla el estudio al cambiar de cuenta y de día en la aplicación', async ({ page, browserName }) => {
  test.skip(process.env.TAI_AUTH_EMULATOR !== '1' || browserName !== 'chromium');
  const emulator = await initializeTestEnvironment({
    projectId:'demo-tai-auth',
    firestore:{ host:'127.0.0.1', port:8080, rules:await readFile(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
  });
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00+02:00'));
  const firebaseRequests: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const isAppOrEmulatorPort = ['4187', '4195', '9099', '8080'].includes(url.port);
    const isStaticGoogleAuthAsset = url.origin === 'https://apis.google.com' && route.request().method() === 'GET'
      && (url.pathname === '/js/api.js' || url.pathname.startsWith('/_/scs/'));
    if ((!isLoopback || !isAppOrEmulatorPort) && !isStaticGoogleAuthAsset) return route.abort('blockedbyclient');
    if (url.port === '9099' || url.port === '8080') firebaseRequests.push(`${url.hostname}:${url.port}`);
    return route.fallback();
  });
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {
    apiKey:'fake-api-key', authDomain:'localhost', projectId:'demo-tai-auth', appId:'1:123:web:local-test',
    taiEmulators:{ authHost:'127.0.0.1', authPort:9099, firestoreHost:'127.0.0.1', firestorePort:8080 },
  } }));

  const signIn = async (email: string) => {
    await expect(page.getByRole('button', { name:'Entrar con Google' })).toBeVisible({ timeout:15_000 });
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name:'Entrar con Google' }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    const closed = popup.waitForEvent('close');
    const existing = popup.getByText(email, { exact:true });
    if (await existing.count()) await existing.click();
    else {
      await popup.getByRole('button', { name:'Add new account' }).click();
      await popup.getByLabel('Email').fill(email);
      await popup.getByRole('button', { name:'Sign in with Google.com' }).click();
    }
    await closed;
    let uid = '';
    await expect.poll(async () => {
      uid = await page.evaluate(async expectedEmail => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('firebaseLocalStorageDb');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const storeName = Array.from(database.objectStoreNames).find(name => name === 'firebaseLocalStorage');
          if (!storeName) throw new Error('Firebase Auth IndexedDB store not found');
          const entries = await new Promise<Array<{ value?: { uid?: string; email?: string; user?: { uid?: string; email?: string } } }>>((resolve, reject) => {
            const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const user = entries.map(entry => entry.value?.user ?? entry.value).find(value => typeof value?.uid === 'string' && value.email === expectedEmail);
          return user?.uid || '';
        } finally { database.close(); }
      }, email);
      return uid;
    }, { timeout:15_000 }).not.toBe('');
    await emulator.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'access', uid), { ok:true, email, name:'TAI E2E ficticio' });
    });
    await page.goto('/#/settings');
    await expect(page.getByRole('button', { name:'Cerrar sesión' })).toBeVisible({ timeout:15_000 });
    await expect(page.getByText('Acceso completo aprobado.')).toBeVisible({ timeout:15_000 });
    return uid;
  };
  const readRemote = async (path: string) => {
    let result: { exists:boolean; data:() => Record<string, unknown> | undefined } | undefined;
    await emulator.withSecurityRulesDisabled(async context => {
      const snapshot = await getDoc(doc(context.firestore(), path));
      result = { exists:snapshot.exists(), data:() => snapshot.data() };
    });
    if (!result) throw new Error(`Firestore Emulator read returned no snapshot for ${path}`);
    return result;
  };

  await emulator.clearFirestore();
  let firstUid = '';
  let secondUid = '';
  let peerPage: Page | undefined;
  try {
  await page.goto('/#/settings');
  firstUid = await signIn('study-owner@example.test');
  // Sin tema semanal elegido el plan no ofrece contenido nuevo (como hacen los e2e de Planificación en css-ui.spec.ts).
  await page.getByLabel('Tema que estás introduciendo esta semana').selectOption('T1.02');
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Comenzar sesión' }).click();
  await expect(page).toHaveURL(/#\/temario\?topic=T\d+\.\d{2}&dailyTraining=newContent/);
  const firstTopic = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('topic');
  expect(firstTopic).toBeTruthy();
  await page.locator(`[data-t="${firstTopic}"]`).click({ noWaitAfter:true });
  await expect(page).toHaveURL(/#\/planificacion$/);
  const rating = page.getByRole('group', { name:'Después de estudiar en papel y cerrar los apuntes, ¿cuánto recordaste?' });
  await rating.getByRole('button', { name:'Parcialmente' }).click();
  await expect(rating.getByText(/Autoevaluación guardada/)).toBeVisible();
  const ownerKey = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('tai.paper-recall.v1.') && key !== 'tai.paper-recall.v1.guest'));
  expect(ownerKey).toBeTruthy();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key!) || '[]'), ownerKey)).toHaveLength(1);
  await expect.poll(async () => (await readRemote(`users/${firstUid}/cfg/trainingRecall`)).exists).toBe(true);
  await expect.poll(async () => (await readRemote(`users/${firstUid}/cfg/training`)).exists).toBe(true);
  await expect.poll(async () => (await readRemote(`users/${firstUid}/cfg/seen`)).exists).toBe(true);
  const savedRecall = (await readRemote(`users/${firstUid}/cfg/trainingRecall`)).data();
  expect(savedRecall?.assessments).toHaveLength(1);

  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+02:00'));
  await page.reload();
  const continueWithCurrentVersion = page.locator('#initial-update-continue');
  if (await continueWithCurrentVersion.isVisible().catch(() => false)) await continueWithCurrentVersion.click();
  const activities = page.locator('.planning-activity');
  const priority = activities.filter({ hasText:'Preguntas del tema prioritario' });
  await expect(priority).toHaveCount(1);
  await expect(priority).toContainText(firstTopic!);
  await priority.getByText('Instrucciones y motivo').click();
  await expect(priority).toContainText('Tu autoevaluación de recuerdo en papel fue «Parcialmente» el 29 de octubre de 2026');

  await page.goto('/#/settings');
  await page.getByRole('button', { name:'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await page.goto('/#/settings');
  await expect(page.getByRole('button', { name:'Entrar con Google' })).toBeVisible();
  secondUid = await signIn('student@example.test');
  await page.goto('/#/home');
  await expect(page.locator('dl').getByText('0 / 36')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key!), ownerKey)).not.toBeNull();
  expect(secondUid).not.toBe(firstUid);
  expect((await readRemote(`users/${secondUid}/cfg/trainingRecall`)).exists).toBe(false);
  await page.goto('/#/settings');
  await page.getByRole('button', { name:'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await page.goto('/#/settings');
  await expect(page.getByRole('button', { name:'Entrar con Google' })).toBeVisible({ timeout:15_000 });
  const ownerAgainUid = await signIn('study-owner@example.test');
  expect(ownerAgainUid).toBe(firstUid);
  await page.goto('/#/planificacion');
  const restoredPriority = page.locator('.planning-activity').filter({ hasText:'Preguntas del tema prioritario' });
  await expect(restoredPriority).toHaveCount(1);
  await expect(restoredPriority).toContainText(firstTopic!);
  peerPage = await page.context().newPage();
  await peerPage.route('**/*', route => {
    const url = new URL(route.request().url());
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const isAppOrEmulatorPort = ['4187', '4195', '9099', '8080'].includes(url.port);
    const isStaticGoogleAuthAsset = url.origin === 'https://apis.google.com' && route.request().method() === 'GET'
      && (url.pathname === '/js/api.js' || url.pathname.startsWith('/_/scs/'));
    if ((!isLoopback || !isAppOrEmulatorPort) && !isStaticGoogleAuthAsset) return route.abort('blockedbyclient');
    if (url.port === '9099' || url.port === '8080') firebaseRequests.push(`${url.hostname}:${url.port}`);
    return route.fallback();
  });
  await peerPage.route('**/firebase-config.json', route => route.fulfill({ json: {
    apiKey:'fake-api-key', authDomain:'localhost', projectId:'demo-tai-auth', appId:'1:123:web:local-test',
    taiEmulators:{ authHost:'127.0.0.1', authPort:9099, firestoreHost:'127.0.0.1', firestorePort:8080 },
  } }));
  await peerPage.clock.setFixedTime(new Date('2026-10-30T12:00:00+02:00'));
  await peerPage.goto('/#/planificacion');
  const peerPriority = peerPage.locator('.planning-activity').filter({ hasText:'Preguntas del tema prioritario' });
  await expect(peerPriority).toHaveCount(1);
  await expect(peerPriority).toContainText(firstTopic!);
  await peerPage.screenshot({ path:'tests/e2e/evidence/progress-metrics-2026-11-06/authenticated-peer-tab-planning.png', fullPage:true });
  await peerPage.close();
  peerPage = undefined;
  const reloadedRecall = (await readRemote(`users/${firstUid}/cfg/trainingRecall`)).data();
  expect(reloadedRecall?.assessments).toHaveLength(1);
  expect(firebaseRequests.some(endpoint => endpoint.endsWith(':9099'))).toBe(true);
  expect(firebaseRequests.some(endpoint => endpoint.endsWith(':8080'))).toBe(true);
  } finally {
    await peerPage?.close();
    await emulator.cleanup();
  }
});
