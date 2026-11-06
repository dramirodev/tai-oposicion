import { verifySyntheticBrowserIsolation } from './synthetic-auth';
import { expect, test } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';

const projectId = 'demo-tai-auth';
const firebaseConfig = {
  projectId, apiKey: 'fake-api-key', authDomain: 'localhost', appId: '1:123:web:local-test',
  taiEmulators: { authHost: '127.0.0.1', authPort: 9099, firestoreHost: '127.0.0.1', firestorePort: 8080 },
};

test('Auth local aprobado conserva los 100 ítems en recarga protegida y bloquea el simulacro tras cerrar sesión', async ({ page, context, browserName, baseURL }) => {
  test.skip(process.env.TAI_AUTH_EMULATOR !== '1' || browserName !== 'chromium');
  test.setTimeout(90_000);
  expect(baseURL).toBe('http://127.0.0.1:4187');
  expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toMatch(/^(localhost|127\.0\.0\.1):9099$/);
  expect(process.env.FIRESTORE_EMULATOR_HOST).toMatch(/^(localhost|127\.0\.0\.1):8080$/);
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080 } });
  const firestoreResponses: number[] = [];
  const authResponses: number[] = [];
  context.on('response', response => {
    const url = new URL(response.url());
    if (url.port === '8080') firestoreResponses.push(response.status());
    if (url.port === '9099') authResponses.push(response.status());
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !['4187', '9099', '8080'].includes(url.port)) return route.abort('blockedbyclient');
    return route.continue();
  });
  let configGate: Promise<void> | undefined;
  await page.route('**/firebase-config.json', async route => {
    await configGate;
    await route.fulfill({ json: firebaseConfig });
  });

  try {
    await verifySyntheticBrowserIsolation(page);
    await page.goto('about:blank');
    // Sign in using the emulator SDK and hand its real persisted user to the browser SDK.
    // This exercises authenticated app startup without a Google popup or any off-device requests.
    const email = 'astra-ui-student@example.test';
    const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'astra-ui-student', email, email_verified: true })));
    expect((await user.getIdTokenResult()).claims.aud).toBe(projectId);
    await env.withSecurityRulesDisabled(async owner => {
      await setDoc(doc(owner.firestore(), 'access', user.uid), { ok: true, email });
    });
    await page.addInitScript(persisted => {
      if (window.top !== window || sessionStorage.getItem('astra-auth-seeded')) return;
      sessionStorage.setItem('astra-auth-seeded', '1');
      localStorage.setItem('tai.dev', '0');
      localStorage.setItem('firebase:authUser:fake-api-key:[DEFAULT]', persisted);
    }, JSON.stringify(user.toJSON()));
    await page.goto('/#/home');
    await expect.poll(() => page.evaluate(uid => localStorage.getItem('tai.acc:' + uid), user.uid), { timeout: 20_000 }).toBe('aprobado');
    await page.goto('/#/settings');
    await expect(page.getByText('Acceso completo aprobado.')).toBeVisible({ timeout: 20_000 });
    await page.goto('/#/sim');
    await page.reload();
    await page.getByRole('tab', { name: 'Oficial 2025' }).click();
    await page.getByRole('button', { name: 'Abrir cuaderno e iniciar los 120 minutos' }).click();
    await page.getByRole('radio', { name: /Bloque IV/ }).check();
    await page.getByRole('button', { name: 'Responder el examen' }).click();
    await page.locator('.opt').first().click();
    const snapshot = () => page.evaluate(uid => JSON.parse(localStorage.getItem('tai.run:' + uid) || 'null'), user.uid);
    const saved = await snapshot();
    expect(saved.ids).toHaveLength(100);
    expect(saved.ans[0]).toBe(0);
    expect(saved.officialExam.scenarioId).toBe('L2025A-S2');

    // Hold the SDK config and clear the optional UI permission cache to reproduce cold startup.
    let releaseConfig!: () => void;
    configGate = new Promise<void>(resolve => { releaseConfig = resolve; });
    await page.evaluate(uid => {
      localStorage.removeItem('tai.acc:' + uid);
      localStorage.removeItem('tai.account');
    }, user.uid);
    await page.goto('/#/sim');
    const configRequested = page.waitForRequest('**/firebase-config.json');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await configRequested;
    expect(page.url()).toMatch(/#\/sim$/);
    await expect(page.locator('#askm')).toHaveCount(0);
    expect((await snapshot()).ids).toEqual(saved.ids);
    releaseConfig();
    await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?', { timeout: 20_000 });
    await expect(page).toHaveURL(/#\/sim$/);
    await page.locator('.overlay [data-v="1"]').click();
    await expect(page.locator('#app h1')).toContainText('pregunta 1 de 100');
    const resumed = await snapshot();
    expect(resumed.ids).toEqual(saved.ids);
    expect(saved.ids.map((_: string, index: number) => resumed.ans[index] ?? null))
      .toEqual(saved.ids.map((_: string, index: number) => saved.ans[index] ?? null));
    expect(resumed.officialExam).toEqual(saved.officialExam);

    const privateProgress = () => page.evaluate(uid => {
      const data = JSON.parse(localStorage.getItem('tai.v1:' + uid) || '{}');
      return { stats: data.stats || {}, sessions: data.sessions || [] };
    }, user.uid);
    const beforeRevocation = await privateProgress();
    await env.withSecurityRulesDisabled(async owner => { await deleteDoc(doc(owner.firestore(), 'access', user.uid)); });
    await expect(page.getByText('No hay una sesión activa.', { exact: false })).toBeVisible();
    await expect(page.locator('.enun,.opt')).toHaveCount(0);
    await page.keyboard.press('2');
    expect(await privateProgress()).toEqual(beforeRevocation);
    expect(await page.evaluate(() => localStorage.getItem('tai.account'))).toBe(user.uid);
    const suspended = await snapshot();
    expect(suspended.ids).toEqual(saved.ids);
    expect(suspended.ans).toEqual(resumed.ans);
    expect(suspended.attemptIds).toHaveLength(100);
    expect(suspended.attemptIds).toEqual(saved.attemptIds);
    expect(suspended.attemptSessionId).toBe(saved.attemptSessionId);
    expect(suspended.officialExam).toEqual(saved.officialExam);

    // A public sample on the same UID must never overwrite or clear the private exam.
    await page.goto('/#/home');
    await page.locator('#quick').click();
    await expect(page.locator('.opts .opt').first()).toBeVisible();
    await expect.poll(() => page.evaluate(uid => JSON.parse(localStorage.getItem('tai.sample-run:' + uid) || 'null')?.publicSample, user.uid)).toBe(true);
    await page.locator('#exit').click();
    await page.locator('.overlay [data-v="1"]').click();
    await expect(page).toHaveURL(/#\/home$/);
    expect((await snapshot()).ids).toEqual(saved.ids);
    expect(await page.evaluate(uid => localStorage.getItem('tai.sample-run:' + uid), user.uid)).toBeNull();

    await env.withSecurityRulesDisabled(async owner => { await setDoc(doc(owner.firestore(), 'access', user.uid), { ok: true, email }); });
    await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
    await page.locator('.overlay [data-v="1"]').click();
    await expect(page.locator('#app h1')).toContainText('pregunta 1 de 100');
    const restoredGrant = await snapshot();
    expect(restoredGrant.ids).toEqual(suspended.ids);
    expect(restoredGrant.ans).toEqual(suspended.ans);
    expect(restoredGrant.attemptSessionId).toBe(saved.attemptSessionId);
    expect(restoredGrant.attemptIds).toEqual(saved.attemptIds);
    expect(restoredGrant.officialExam).toEqual(saved.officialExam);

    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/#\/home$/);
    await page.goto('/#/sim');
    await expect(page).toHaveURL(/#\/home$/);
    await page.goto('/#/quiz');
    await expect(page.getByText('No hay una sesión activa.', { exact: false })).toBeVisible();
    await expect(page.locator('.enun,.opt,#askm')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('tai.run:guest'))).toBeNull();
    const signedOut = await snapshot();
    expect(signedOut.ids).toEqual(saved.ids);
    expect(signedOut.ans[0]).toBe(0);
    expect(signedOut.officialExam).toEqual(saved.officialExam);
    expect(firestoreResponses).toContain(200);
    expect(authResponses).toContain(200);
  } finally {
    await env.cleanup();
    await deleteApp(app);
  }
});
