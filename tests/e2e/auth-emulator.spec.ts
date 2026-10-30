import { expect, test } from '@playwright/test';

test('Firebase Auth Emulator aísla el estudio al cambiar de cuenta y de día en la aplicación', async ({ page, browserName }) => {
  test.skip(process.env.TAI_AUTH_EMULATOR !== '1' || browserName !== 'chromium');
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00+02:00'));
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {
    apiKey:'fake-api-key', authDomain:'localhost', projectId:'demo-tai-auth', appId:'1:123:web:local-test',
    taiEmulators:{ authHost:'127.0.0.1', authPort:9099, firestoreHost:'127.0.0.1', firestorePort:8080 },
  } }));

  const signIn = async (email: string) => {
    await expect(page.getByRole('button', { name:'Entrar con Google' })).toBeVisible();
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name:'Entrar con Google' }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await popup.getByRole('button', { name:'Add new account' }).click();
    await popup.getByLabel('Email').fill(email);
    const closed = popup.waitForEvent('close');
    await popup.getByRole('button', { name:'Sign in with Google.com' }).click();
    await closed;
    await page.goto('/#/settings');
    await expect(page.getByRole('button', { name:'Cerrar sesión' })).toBeVisible({ timeout:15_000 });
  };

  await page.goto('/#/settings');
  await signIn('dramiro@gmail.com');
  // Sin tema semanal elegido el plan no ofrece contenido nuevo (como hacen los e2e de Planificación en css-ui.spec.ts).
  await page.getByLabel('Tema que estás introduciendo esta semana').selectOption('T1.02');
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Comenzar sesión' }).click();
  await expect(page).toHaveURL(/#\/temario\?topic=T[1-4]\.\d{2}&dailyTraining=newContent/);
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

  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+02:00'));
  await page.reload();
  const activities = page.locator('.planning-activity');
  await expect(activities.nth(1)).toContainText('Preguntas del tema prioritario');
  await expect(activities.nth(1)).toContainText(firstTopic!);

  await page.goto('/#/settings');
  await page.getByRole('button', { name:'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await page.goto('/#/settings');
  await expect(page.getByRole('button', { name:'Entrar con Google' })).toBeVisible();
  await signIn('student@example.test');
  await page.goto('/#/home');
  await expect(page.locator('dl').getByText('0 / 36')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key!), ownerKey)).not.toBeNull();
});
