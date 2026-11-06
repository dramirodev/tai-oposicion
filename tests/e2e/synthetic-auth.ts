import { expect, type BrowserContext, type Page } from '@playwright/test';
export async function guardSyntheticBrowser(context: BrowserContext, appPort = 4191) {
  if (![4187, 4191].includes(appPort)) throw new Error('Unexpected synthetic app port');
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && [String(appPort),'9099','8080'].includes(url.port);
    const asset = url.origin === 'https://apis.google.com' && request.method() === 'GET' && (url.pathname === '/js/api.js' || url.pathname.startsWith('/_/scs/'));
    return local || asset ? route.fallback() : route.abort('blockedbyclient');
  });
  await context.route('**/firebase-config.json', route => route.fulfill({ json:{ apiKey:'fake-api-key', authDomain:'localhost', projectId:'demo-tai-auth', appId:'1:123:web:local-test', taiEmulators:{ authHost:'127.0.0.1', authPort:9099, firestoreHost:'127.0.0.1', firestorePort:8080 } } }));
}
export async function signInSynthetic(page: Page, email: string) {
  if (!email.endsWith('@example.test')) throw new Error('Only synthetic identities permitted');
  await page.goto('/#/settings');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name:'Entrar con Google' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  const existingAccount = popup.getByText(email, { exact:true });
  const closed = popup.waitForEvent('close');
  if (await existingAccount.count()) {
    await existingAccount.click();
  } else {
    await popup.getByRole('button', { name:'Add new account' }).click();
    await popup.getByLabel('Email').fill(email);
    await popup.getByRole('button', { name:'Sign in with Google.com' }).click();
  }
  await closed;
  await page.goto('/#/settings');
  await expect(page.getByRole('button', { name:'Cerrar sesión' })).toBeVisible({ timeout:15_000 });
  if (email === 'tai-normal@example.test') await expect(page.getByText('Acceso completo aprobado.')).toBeVisible({ timeout:15_000 });
}


/** Observe writes made by the UI with the user's own token, subject to Firestore rules. */
export async function readSyntheticRemote(page: Page, path: string) {
  if (!/^users\/tai-supertest\/[a-zA-Z0-9/_-]+$/.test(path)) throw new Error('Only reserved synthetic owner data may be observed');
  return page.evaluate(async documentPath => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('firebaseLocalStorageDb');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    let token: string | undefined;
    try {
      const records = await new Promise<Array<{ value?: { stsTokenManager?: { accessToken?: string }; user?: { stsTokenManager?: { accessToken?: string } } } }>>((resolve, reject) => {
        const request = database.transaction('firebaseLocalStorage','readonly').objectStore('firebaseLocalStorage').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      token = records.map(record => (record.value?.user ?? record.value)?.stsTokenManager?.accessToken).find(Boolean);
    } finally { database.close(); }
    if (!token) throw new Error('No synthetic browser session token');
    const base = `http://127.0.0.1:8080/v1/projects/demo-tai-auth/databases/(default)/documents/${documentPath}`;
    const response = await fetch(base, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await response.json();
    let nextPageToken = data.nextPageToken;
    const visited = new Set<string>();
    while (response.ok && nextPageToken) {
      if (visited.has(nextPageToken) || visited.size >= 100) throw new Error('Synthetic read pagination limit');
      visited.add(nextPageToken);
      const next = await fetch(`${base}?pageToken=${encodeURIComponent(nextPageToken)}`, { headers:{ Authorization:`Bearer ${token}` } });
      const page = await next.json();
      if (!next.ok) return { status:next.status, data:page };
      data.documents = [...(data.documents || []), ...(page.documents || [])];
      nextPageToken = page.nextPageToken;
    }
    delete data.nextPageToken;
    return { status:response.status, data };
  }, path);
}
