import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  deleteDoc,
  terminate,
} from 'firebase/firestore';
import { identities, assertEmulators } from '../../scripts/e2e/synthetic-users.mjs';
import { guardSyntheticBrowser, signInSynthetic, readSyntheticRemote, verifySyntheticBrowserIsolation } from './synthetic-auth';

import { studyProfileFixture } from './fixtures/study-profiles';

const restrictedRoutes = [
  'temario',
  'planificacion',
  'errores',
  'falladas',
  'relampago',
  'trampas',
  'lectura',
  'curar-contenido',
  'test',
  'sim',
  'sim2',
  'stats',
];
test.describe('Firebase Auth Emulator supertest', () => {
  test.describe.configure({ mode: 'default' });
  test.skip(process.env.TAI_AUTH_EMULATOR !== '1');
  test.beforeEach(async ({ context }, testInfo) => {
    assertEmulators();
    await guardSyntheticBrowser(context, 4187);
    // Read-only preflight precedes every fixture write. Inspect the effective
    // browser config and observe GET traffic to both fixed emulators.
    const probe = await context.newPage();
    try {
      const isolation = await verifySyntheticBrowserIsolation(probe);
      mkdirSync(testInfo.outputDir, { recursive:true });
      writeFileSync(testInfo.outputPath('isolation-before-writes.json'), JSON.stringify(isolation,null,2));
    } finally { await probe.close(); }
    execFileSync(process.execPath, ['scripts/e2e/prepare-synthetic-users.mjs'], {
      env: process.env,
      timeout: 30_000,
      stdio: 'inherit',
    });
  });
  for (const writeLatencyMs of [0,500])
   for (const offline of [false, true])
    test(`historial extenso importado se recupera en un navegador nuevo sin duplicados · ${offline ? 'offline' : 'online'}${writeLatencyMs ? ' · latencia500ms' : ''}`, async ({
      page,
      browser,
      context,
    }) => {
      test.setTimeout(120_000);
      if (writeLatencyMs) await context.route('**/google.firestore.v1.Firestore/Write/channel**', async route => {
        if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve,writeLatencyMs));
        await route.fallback();
      });
      const fixture = studyProfileFixture('extensive');
      await signInSynthetic(page, identities.owner.email);
      await expect(page.getByText('Propietario · acceso completo.', { exact: false })).toBeVisible();
      if (offline) await context.setOffline(true);
      const backups = page.getByRole('heading', { name: 'Copias de seguridad' }).locator('..');
      for (let repetition = 0; repetition < 2; repetition++) {
        await backups.locator('input[type="file"]').setInputFiles({
          name: 'historial-sintetico.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(fixture)),
        });
        const confirmation = page.getByRole('dialog');
        await expect(confirmation).toContainText('300 sesiones válidas');
        await confirmation.getByRole('button', { name: 'Importar copia' }).click();
        await expect(confirmation).toBeHidden();
        await expect(backups.getByRole('status')).toContainText('Copia combinada:');
      }
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:tai-supertest')!).sessions)).toEqual(
        fixture.sessions,
      );
      if (offline) await context.setOffline(false);
      await expect
        .poll(
          async () => {
            const remote = await readSyntheticRemote(page, 'users/tai-supertest/sessions');
            expect(remote.status).toBe(200);
            return remote.data.documents?.length ?? 0;
          },
          { timeout: 30_000 },
        )
        .toBe(300);
      const fresh = await browser.newContext({
        baseURL: 'http://127.0.0.1:4187',
        viewport: { width: 320, height: 900 },
      });
      try {
        await guardSyntheticBrowser(fresh, 4187);
        const recovered = await fresh.newPage();
        await recovered.goto('/#/settings');
        expect(await recovered.evaluate(() => localStorage.getItem('tai.v1:tai-supertest'))).toBeNull();
        await signInSynthetic(recovered, identities.owner.email);
        await expect
          .poll(
            () =>
              recovered.evaluate(
                () => JSON.parse(localStorage.getItem('tai.v1:tai-supertest') || '{}').sessions?.length ?? 0,
              ),
            { timeout: 30_000 },
          )
          .toBe(300);
        const restored = await recovered.evaluate(
          () => JSON.parse(localStorage.getItem('tai.v1:tai-supertest')!).sessions,
        );
        expect(restored).toEqual(fixture.sessions);
        await recovered.goto('/#/stats');
        await recovered.getByRole('button', { name: 'Simulacros', exact: true }).click();
        const history = recovered.getByRole('region', { name: 'Historial de simulacros' });
        await expect(history.getByLabel('Intento A').locator('option')).toHaveCount(300);
        await history.getByLabel('Intento A').selectOption(fixture.sessions.at(-1)!.id);
        await history.getByLabel('Intento B').selectOption(fixture.sessions[0].id);
        await expect(history.getByText('Nota: +20', { exact: false })).toBeVisible();
        await recovered.screenshot({
          path: test.info().outputPath(`authenticated-history-restored-${offline ? 'offline' : 'online'}.png`),
          fullPage: true,
        });
      } finally {
        await fresh.close();
      }
    });
  test('propietario sintético completa planificación, estudio, evaluación, preguntas y estadísticas', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const capture = (name: string) =>
      page.screenshot({ path: `tests/e2e/evidence/ux-audit-2026-11-04/${name}.png`, fullPage: true });
    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-29T12:00:00+01:00'));
    await signInSynthetic(page, identities.owner.email);
    await expect(page.getByText(/propietario/i).first()).toBeVisible();
    await page.getByLabel('Tema que estás introduciendo esta semana').selectOption('T1.02');
    await page.goto('/#/planificacion');
    await expect(page.locator('#app h1')).toHaveText('Planificación de estudio');
    await capture('owner-planificacion');
    const startStudy = page.getByRole('button', { name: 'Comenzar sesión' });
    await startStudy.evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect(page).toHaveURL(/#\/temario\?topic=/);
    await expect(page.locator('#app h1')).toContainText('Temas vistos');
    const checkpoints = await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith('tai.training-session.v1.'))
        .map(([, value]) => JSON.parse(value)),
    );
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]).toMatchObject({ currentIndex: 0, completedAt: null });
    expect(checkpoints[0].currentStartedAt).not.toBeNull();
    const plannedActivityUrl = page.url();
    const plannedActivityParams = new URL(plannedActivityUrl).hash.split('?')[1];
    const plannedActivityQuery = new URLSearchParams(plannedActivityParams);
    expect(plannedActivityQuery.get('trainingSessionId')).toBe(checkpoints[0].id);
    expect(plannedActivityQuery.get('trainingActivityId')).toBe(checkpoints[0].activities[0].id);
    await page.reload();
    await expect(page.locator('#app h1')).toContainText('Temas vistos');
    expect(page.url()).toBe(plannedActivityUrl);
    await expect(page.locator(`[data-t="${plannedActivityQuery.get('topic')}"]`)).toBeVisible();
    const recoveredCheckpoints = await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith('tai.training-session.v1.'))
        .map(([, value]) => JSON.parse(value)),
    );
    expect(recoveredCheckpoints).toHaveLength(1);
    expect(recoveredCheckpoints[0]).toMatchObject({ id: checkpoints[0].id, currentIndex: 0, completedAt: null });
    await capture('owner-temario-recuperado');
    await capture('owner-temario-estudio');
    const topic = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('topic');
    await page.locator(`[data-t="${topic}"]`).click({ noWaitAfter: true });
    await expect(page).toHaveURL(/#\/planificacion$/);
    await expect(page.getByRole('button', { name:'Lo recordé', exact:true })).toHaveCount(0);
    await capture('owner-planificacion-solo-tests');
    // A short real simulation creates answers and a scored result through the UI.
    await page.goto('/#/settings');
    await page.getByLabel('Tipo de evento').selectOption('milestone');
    await page.getByLabel('Nombre del evento').fill('Supertest sintético');
    const today = '2026-10-29';
    await page.getByLabel('Inicio del evento').fill(today);
    await page.getByLabel('Fin del evento').fill(today);
    await page.getByLabel('Preguntas del hito').fill('3');
    await page.getByLabel('Duración del hito').fill('10');
    await page.getByRole('button', { name: 'Guardar evento' }).click();
    await page.goto('/#/planificacion');
    await page.getByRole('list', { name: 'Próximos eventos' }).getByRole('link', { name: 'Preparar hito' }).click();
    await page.getByRole('button', { name: 'Empezar este hito' }).click();
    for (let index = 0; index < 3; index++) {
      await page.locator('.opt').first().click();
      await page.locator('#next').click();
    }
    await expect(page.locator('#app h1')).toHaveText('Resultado');
    await capture('owner-resultado');
    expect((await readSyntheticRemote(page, 'users/tai-supertest/cfg/trainingRecall')).status).toBe(404);
    await expect
      .poll(
        async () =>
          (await readSyntheticRemote(page, 'users/tai-supertest/attemptSessions')).data.documents?.length ?? 0,
      )
      .toBeGreaterThan(0);
    for (const route of [...restrictedRoutes, 'home', 'ayuda', 'settings', 'acceso']) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('#app h1').first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`#/${route}(?:$|[?])`));
      await expect(page.locator('#app')).not.toContainText('No se pudo cargar');
      if (route === 'stats' || route === 'curar-contenido' || route === 'acceso') await capture(`owner-${route}`);
    }
    await page.goto('/#/cards');
    await expect(page).toHaveURL(/#\/home$/);
    await page.goto('/#/examenes');
    await expect(page).toHaveURL(/#\/sim/);
    await page.goto('/#/acceso');
    // Grant and revoke are user actions, never Admin SDK substitutes.
    await expect(page.getByText('tai-pending@example.test').first()).toBeVisible();
    await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await expect(page.getByText('tai-pending@example.test').first()).toBeVisible();
    const pendingRow = page.locator('.arow').filter({ hasText: 'tai-pending@example.test' });
    await pendingRow.getByRole('button', { name: 'Revocar' }).click();
    await page.getByRole('button', { name: 'Revocar', exact: true }).last().click();
    await expect(pendingRow).toHaveCount(0);
    expect(crashes).toEqual([]);
  });
  test('los enlaces observados de Planificación y Accesos permiten navegar y recargar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInSynthetic(page, identities.owner.email);
    for (const [label, route, heading] of [
      ['Planificación', 'planificacion', 'Planificación de estudio'],
      ['Accesos', 'acceso', 'Accesos'],
    ]) {
      await page.goto('/#/home');
      const link = page.getByRole('link', { name: label, exact: true });
      await expect(link).toHaveAttribute('href', `#/${route}`);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#/${route}$`));
      const routeHeading = page.getByRole('heading', { name: heading, exact: true });
      await expect(routeHeading).toBeVisible({ timeout: 15_000 });
      await expect(routeHeading).toBeFocused();
      await page.goBack();
      await expect(page).toHaveURL(/#\/home$/);
      await page.goForward();
      await expect(page).toHaveURL(new RegExp(`#/${route}$`));
      await page.reload();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 15_000 });
    }
  });
  for (const firestoreUnavailable of [false, true])
  test(`una sesión autenticada se recupera tras pagehide y recarga sin perder respuestas · ${firestoreUnavailable ? 'Firestore inaccesible' : 'con conexión'}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.install({ time: new Date('2026-10-29T12:00:00+01:00') });
    await signInSynthetic(page, identities.owner.email);

    await page.goto('/#/settings');
    await page.getByLabel('Tema que estás introduciendo esta semana').selectOption('T1.02');
    await page.goto('/#/planificacion');
    await page.getByRole('button', { name: 'Comenzar sesión' }).click();
    await expect(page).toHaveURL(/#\/temario\?topic=/);
    const topic = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('topic');
    await page.locator(`[data-t="${topic}"]`).click({ noWaitAfter: true });

    await page.goto('/#/settings');
    await page.getByLabel('Tipo de evento').selectOption('milestone');
    await page.getByLabel('Nombre del evento').fill('Recuperación sintética');
    await page.getByLabel('Inicio del evento').fill('2026-10-29');
    await page.getByLabel('Fin del evento').fill('2026-10-29');
    await page.getByLabel('Preguntas del hito').fill('3');
    await page.getByLabel('Duración del hito').fill('10');
    await page.getByRole('button', { name: 'Guardar evento' }).click();

    await page.goto('/#/planificacion');
    await page.getByRole('list', { name: 'Próximos eventos' }).getByRole('link', { name: 'Preparar hito' }).click();
    await page.getByRole('button', { name: 'Empezar este hito' }).click();
    await expect(page.getByRole('heading', { name: /pregunta 1/i })).toBeVisible();
    const firstAnswer = page.locator('.opt').first();
    await firstAnswer.click();
    await page.locator('#next').click();
    await expect(page.getByRole('heading', { name: /pregunta 2/i })).toBeVisible();

    const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:tai-supertest') || 'null'));
    expect(checkpoint).not.toBeNull();
    expect(checkpoint.idx).toBe(1);
    expect(checkpoint.ans[0]).toEqual(expect.any(Number));
    const evidenceDir = 'tests/e2e/evidence/accessibility-2026-11-05';
    mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: `${evidenceDir}/authenticated-run-before-reload.png`, fullPage: true });
    if (firestoreUnavailable) await page.route('http://127.0.0.1:8080/**', route => route.abort('failed'));
    await page.reload();
    const resumeDialog = page.getByRole('dialog');
    await expect(resumeDialog).toContainText('Tienes sin terminar');
    await expect(resumeDialog).toContainText('2/3');
    await page.screenshot({ path: `${evidenceDir}/authenticated-run-resume-prompt.png`, fullPage: true });
    await resumeDialog.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/#\/quiz$/);
    await expect(page.getByRole('heading', { name: /pregunta 2/i })).toBeVisible();
    await page.screenshot({ path: `${evidenceDir}/authenticated-run-resumed.png`, fullPage: true });

    const resumed = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:tai-supertest') || 'null'));
    expect(resumed.ids).toEqual(checkpoint.ids);
    expect(resumed.idx).toBe(checkpoint.idx);
    expect(resumed.ans[0]).toBe(checkpoint.ans[0]);
    if (firestoreUnavailable) await page.unroute('http://127.0.0.1:8080/**');
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText('Lo respondido se guardará como sesión interrumpida');
    await confirmation.getByRole('button', { name: 'Salir', exact: true }).click();
    await expect(page).toHaveURL(/#\/result$/);
    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
    await expect(page.getByText('Sesión interrumpida')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tai.run:tai-supertest'))).toBeNull();
  });
  test('Lectura atenta recorre sus tres pasos, avanza y permite salir', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.install({ time: new Date('2026-10-29T12:00:00+01:00') });
    await signInSynthetic(page, identities.owner.email);
    await page.goto('/#/lectura');

    await expect(page.getByRole('heading', { name: 'Lectura atenta · paso 1 de 3' })).toBeVisible();
    await page.getByRole('button', { name: 'La opción CORRECTA / VERDADERA' }).click();
    await expect(page.getByText(/¡Bien leído!|Ojo: lo habías leído al revés\./)).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente →' }).click();

    await expect(page.getByRole('heading', { name: 'Lectura atenta · paso 2 de 3' })).toBeVisible();
    const words = page.getByRole('group', { name: 'Palabras del enunciado' });
    const firstWord = words.getByRole('button').first();
    await firstWord.click();
    await expect(firstWord).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ver opciones →' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver opciones →' }).click();

    await expect(page.getByRole('heading', { name: 'Lectura atenta · paso 3 de 3' })).toBeVisible();
    mkdirSync('tests/e2e/evidence/accessibility-2026-11-05', { recursive: true });
    await page.screenshot({
      path: 'tests/e2e/evidence/accessibility-2026-11-05/reading-options-timed-gate.png',
      fullPage: true,
    });
    const firstOption = page.locator('.opts .opt').first();
    await expect(firstOption).toBeDisabled();
    await page.clock.runFor('10:00');
    await expect(firstOption).toBeEnabled();
    await firstOption.click();
    await expect(page.getByText(/¡Correcto!|Incorrecto/)).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente →' }).click();
    await expect(page.getByRole('heading', { name: 'Lectura atenta · paso 1 de 3' })).toBeVisible();
    await expect(page.locator('.cnt')).toHaveText(/^2\/\d+$/);

    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText('¿Salir del ejercicio?');
    await confirmation.getByRole('button', { name: 'Salir', exact: true }).click();
    await expect(page).toHaveURL(/#\/home$/);
  });
  test('Curación owner descubre preguntas, filtra candidatos y exige evidencia antes de guardar', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInSynthetic(page, identities.owner.email);
    await page.goto('/#/curar-contenido');
    await expect(page.getByRole('heading', { name: 'Curar vínculos a epígrafes' })).toBeVisible();

    await page.getByLabel('Tema de la pregunta').selectOption('T1.01');
    await expect(page.getByText(/Cola de candidatos sin vínculo/)).toBeVisible();
    const question = page.getByRole('combobox', { name: 'Pregunta', exact: true });
    await expect.poll(async () => question.locator('option').count()).toBeGreaterThan(1);
    await question.selectOption({ index: 1 });
    const selectedQuestionId = await question.inputValue();
    const search = page.getByLabel('Buscar candidato');
    await search.fill('__sin_coincidencias__');
    await expect(page.getByText('No hay candidatos pendientes para este tema o filtro.')).toBeVisible();
    await page.screenshot({
      path: 'tests/e2e/evidence/accessibility-2026-11-05/content-curation-filter-empty.png',
      fullPage: true,
    });
    await search.clear();
    await expect(question).toHaveValue(selectedQuestionId);

    await expect(page.getByRole('button', { name: 'Añadir al borrador local' })).toBeDisabled();
    await expect(page.locator('#app')).not.toContainText('No se pudo cargar el catálogo');
  });
  test('Curación guarda un vínculo de prueba en el borrador local y lo recupera tras recargar', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInSynthetic(page, identities.owner.email);
    await page.goto('/#/curar-contenido');
    await expect(page.getByRole('heading', { name: 'Curar vínculos a epígrafes' })).toBeVisible();

    await page.getByLabel('Tema de la pregunta').selectOption('T1.01');
    const question = page.getByRole('combobox', { name: 'Pregunta', exact: true });
    await expect.poll(async () => question.locator('option').count()).toBeGreaterThan(1);
    await question.selectOption({ index: 1 });
    const questionId = await question.inputValue();
    await page.getByLabel('Tema del PDF de origen').selectOption('T1.01');
    const testFile = page.getByLabel('PDF de test de Drive');
    await expect.poll(async () => testFile.locator('option').count()).toBeGreaterThan(1);
    await testFile.selectOption({ index: 1 });
    await page.getByLabel('Tema del epígrafe de destino').selectOption('T1.01');
    const section = page.getByLabel('Epígrafe del temario');
    await expect.poll(async () => section.locator('option').count()).toBeGreaterThan(1);
    await section.selectOption({ index: 1 });
    await page.getByLabel('Página física del PDF de test').fill('1');
    await page
      .getByLabel('Por qué corresponde esta pregunta al epígrafe')
      .fill('Fixture sintético para verificar persistencia local; no constituye una revisión documental real.');
    await page.getByLabel('Identificador del revisor').fill('TAI QA sintético');

    const addToDraft = page.getByRole('button', { name: 'Añadir al borrador local' });
    await expect(addToDraft).toBeDisabled();
    await page
      .getByLabel(
        'He cotejado la pregunta y las páginas en los documentos de Drive; la asociación está revisada por una persona.',
      )
      .check();
    await expect(addToDraft).toBeEnabled();
    await addToDraft.click();
    await expect(
      page.getByText('Vínculo añadido al borrador local. Exporta el JSON para revisarlo en el repositorio.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Borrador local · 1 vínculo' })).toBeVisible();
    await page.screenshot({
      path: 'tests/e2e/evidence/accessibility-2026-11-05/content-curation-synthetic-draft.png',
      fullPage: true,
    });

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tai.academy-question-section-map:v2:tai-supertest') || 'null'),
    );
    expect(stored.schemaVersion).toBe(2);
    expect(stored.links).toHaveLength(1);
    expect(stored.links[0].questionId).toBe(questionId);
    expect(stored.links[0].reviewer).toBe('TAI QA sintético');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Borrador local · 1 vínculo' })).toBeVisible();
    const restored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('tai.academy-question-section-map:v2:tai-supertest') || 'null'),
    );
    expect(restored.links).toHaveLength(1);
    expect(restored.links[0].questionId).toBe(questionId);
  });
  test('inventario accesible de rutas y controles con perfil propietario sintético', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInSynthetic(page, identities.owner.email);
    await page.goto('/#/settings');
    await expect(page.locator('#app h1').first()).toHaveText(/Ajustes/i);
    const routes = ['home', ...restrictedRoutes, 'ayuda', 'settings', 'acceso'];
    const controlRoles = new Set([
      'button',
      'link',
      'textbox',
      'searchbox',
      'combobox',
      'checkbox',
      'radio',
      'switch',
      'slider',
      'spinbutton',
      'tab',
      'menuitem',
    ]);
    type AriaNode = {
      role?: string;
      name?: string;
      children?: readonly AriaNode[];
      box?: { x: number; y: number; width: number; height: number };
    };
    const evidenceDir = 'tests/e2e/evidence/accessibility-2026-11-05';
    mkdirSync(evidenceDir, { recursive: true });
    const inventory: { route: string; viewport: string; heading: string; snapshot: unknown; controls: AriaNode[] }[] =
      [];
    for (const route of routes) {
      await page.goto(`/#/${route}`);
      const heading = page.locator('#app h1').first();
      await expect(heading).toBeVisible();
      const snapshot = await page.locator('#app').ariaSnapshotJSON({ boxes: true });
      const controls: AriaNode[] = [];
      const visit = (node: AriaNode | AriaNode[]) => {
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        if (node.role && controlRoles.has(node.role)) controls.push(node);
        for (const child of node.children ?? []) visit(child);
      };
      visit(snapshot as AriaNode[]);
      inventory.push({ route, viewport: '1280x900', heading: (await heading.innerText()).trim(), snapshot, controls });
      expect(controls.length, `${route}: no se descubrieron controles accesibles`).toBeGreaterThan(0);
      expect(controls.filter((control) => !control.name?.trim()).map((control) => control.role)).toEqual([]);
      if (route === 'planificacion')
        await page.screenshot({ path: `${evidenceDir}/planning-desktop.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 375, height: 812 });
    for (const route of ['home', 'planificacion']) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('#app h1').first()).toBeVisible();
      const snapshot = await page.locator('#app').ariaSnapshotJSON({ boxes: true });
      const controls: AriaNode[] = [];
      const visit = (node: AriaNode | AriaNode[]) => {
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        if (node.role && controlRoles.has(node.role)) controls.push(node);
        for (const child of node.children ?? []) visit(child);
      };
      visit(snapshot as AriaNode[]);
      inventory.push({
        route,
        viewport: '375x812',
        heading: (await page.locator('#app h1').first().innerText()).trim(),
        snapshot,
        controls,
      });
      expect(controls.length, `${route} móvil: no se descubrieron controles accesibles`).toBeGreaterThan(0);
      expect(controls.filter((control) => !control.name?.trim()).map((control) => control.role)).toEqual([]);
      if (route === 'planificacion')
        await page.screenshot({ path: `${evidenceDir}/planning-mobile.png`, fullPage: true });
    }
    await page.goto('/#/home');
    await page.getByRole('button', { name: 'Menú' }).click();
    const menu = page.getByRole('dialog', { name: /menú/i });
    await expect(menu).toBeVisible();
    const menuSnapshot = await menu.ariaSnapshotJSON({ boxes: true });
    await page.screenshot({ path: `${evidenceDir}/mobile-menu.png` });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: 'Menú' })).toBeFocused();
    // Discover controls that only exist after an explicit transition, not just route entry.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/sim');
    const dynamicStates: {
      route: string;
      state: string;
      action: string;
      oracle: string;
      snapshot: unknown;
      controls: AriaNode[];
    }[] = [];
    for (const name of ['Oficial 2025', 'Por examen', 'Por tema']) {
      const tab = page.getByRole('tab', { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      if (name === 'Oficial 2025') {
        await expect(page.getByLabel('Baremo de calificación')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Abrir cuaderno e iniciar los 120 minutos' })).toBeVisible();
      } else {
        await expect(page.locator('[data-exam-id]').first()).toBeVisible();
        await expect(page.locator('.page-loading')).toHaveCount(0);
        await page.locator('[data-exam-id]').last().click();
        await expect(page.locator('[data-exam-id]').last()).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('button', { name: 'Estudiar', exact: true })).toBeEnabled();
      }
      const snapshot = await page.locator('#app').ariaSnapshotJSON({ boxes: true });
      const controls: AriaNode[] = [];
      const visit = (node: AriaNode | AriaNode[]) => {
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        if (node.role && controlRoles.has(node.role)) controls.push(node);
        for (const child of node.children ?? []) visit(child);
      };
      visit(snapshot as AriaNode[]);
      expect(controls.filter((control) => !control.name?.trim())).toEqual([]);
      dynamicStates.push({
        route: 'sim',
        state: name,
        action: 'abrir pestaña y seleccionar último examen cuando procede',
        oracle: 'pestaña seleccionada; baremo/cuaderno disponible o examen seleccionado y Estudiar habilitado',
        snapshot,
        controls,
      });
      await page.screenshot({ path: testInfo.outputPath(`dynamic-sim-${dynamicStates.length}.png`), fullPage: true });
    }
    const artifact = testInfo.outputPath('tai-owner-accessible-control-inventory.json');
    const result = JSON.stringify(
      { profile: 'owner', routes: inventory, mobileMenu: menuSnapshot, dynamicStates },
      null,
      2,
    );
    writeFileSync(artifact, result);
    writeFileSync(`${evidenceDir}/owner-route-control-inventory.json`, result);
    await testInfo.attach('tai-owner-accessible-control-inventory', {
      path: artifact,
      contentType: 'application/json',
    });
  });
  test('gestión de accesos aprueba, cancela, revoca y rechaza con efecto en otro usuario', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await signInSynthetic(page, identities.owner.email);
    await page.goto('/#/acceso');
    const member = page.locator('.arow').filter({ hasText: identities.pending.email });
    await expect(member.getByRole('button', { name: 'Aprobar', exact: true })).toBeVisible();
    const studentContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4187' });
    try {
      await guardSyntheticBrowser(studentContext, 4187);
      const student = await studentContext.newPage();
      await signInSynthetic(student, identities.pending.email);
      await expect(student.getByText('Acceso completo aprobado.')).toHaveCount(0);
      await member.getByRole('button', { name: 'Aprobar', exact: true }).click();
      await expect(member.getByRole('button', { name: 'Revocar', exact: true })).toBeVisible();
      await expect(student.getByText('Acceso completo aprobado.')).toBeVisible();
      await student.goto('/#/planificacion');
      await expect(student.getByRole('heading', { name: 'Planificación de estudio', exact: true })).toBeVisible();
      const revoke = member.getByRole('button', { name: 'Revocar', exact: true });
      await revoke.click();
      await expect(page.getByRole('dialog')).toContainText('Volverá a poder hacer solo la sesión rápida');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(revoke).toBeFocused();
      await student.reload();
      await expect(student.getByRole('heading', { name: 'Planificación de estudio', exact: true })).toBeVisible();
      await revoke.click();
      await page.getByRole('dialog').getByRole('button', { name: 'Revocar', exact: true }).click();
      await expect(member).toHaveCount(0);
      await student.goto('/#/settings');
      await expect(student.getByRole('button', { name: 'Pedir acceso completo' })).toBeVisible();
      await student.goto('/#/planificacion');
      await expect(student).toHaveURL(/#\/home$/);
      await student.goto('/#/settings');
      await student.getByRole('button', { name: 'Pedir acceso completo' }).click();
      await expect(member.getByRole('button', { name: 'Rechazar', exact: true })).toBeVisible();
      await member.getByRole('button', { name: 'Rechazar', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Rechazar', exact: true }).click();
      await expect(member).toHaveCount(0);
      await expect(student.getByRole('button', { name: 'Pedir acceso completo' })).toBeVisible();
      await student.reload();
      await expect(student.getByText('Acceso completo aprobado.')).toHaveCount(0);
      await expect(student.getByRole('button', { name: 'Pedir acceso completo' })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('access-owner-after-rejection.png'), fullPage: true });
      await student.screenshot({ path: test.info().outputPath('access-student-restricted.png'), fullPage: true });
    } finally {
      await studentContext.close();
    }
  });
  for (const role of ['normal', 'restricted', 'pending', 'anonymous'] as const) {
    test(`${role}: navegación directa respeta permisos`, async ({ page }) => {
      test.setTimeout(90_000);
      if (role !== 'anonymous') await signInSynthetic(page, identities[role].email);
      else await page.goto('/#/settings');
      for (const route of restrictedRoutes) {
        await page.goto(`/#/${route}`);
        if (role === 'normal') await expect(page).toHaveURL(new RegExp(`#/${route}$`));
        else await expect(page).toHaveURL(/#\/home$/);
        await expect(page.locator('#app h1').first()).toBeVisible();
      }
      await page.goto('/#/acceso');
      await expect(page).toHaveURL(/#\/home$/);
      await expect(page.getByRole('button', { name: 'Aprobar', exact: true })).toHaveCount(0);
    });
  }
  test('peticiones Firebase reales: permisos, aislamiento, escalada y validación', async () => {
    for (const role of ['owner', 'normal', 'restricted', 'pending', 'anonymous'] as const) {
      const app = initializeApp({ projectId: 'demo-tai-auth', apiKey: 'fake-api-key' }, `probe-${role}`);
      const auth = getAuth(app);
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      const db = getFirestore(app);
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      try {
        const identity = role === 'anonymous' ? null : identities[role];
        if (identity) {
          const payload = {
            sub: identity.email,
            email: identity.email,
            email_verified: true,
            aud: 'demo-tai-auth',
            iss: 'https://accounts.google.com',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
          };
          const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.`;
          const result = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
          expect(result.user.uid).toBe(identity.uid);
        }
        const uid = identity?.uid ?? 'anonymous';
        const own = doc(db, 'users', uid, 'cfg', 'seen');
        const write = () => setDoc(own, { t: ['T1.02'], ts: Date.now() });
        if (role === 'owner' || role === 'normal') {
          await write();
          expect((await getDoc(own)).exists()).toBe(true);
        } else await expect(write()).rejects.toMatchObject({ code: 'permission-denied' });
        for (const suffix of [
          'cfg/seen',
          'cfg/training',
          'cfg/trainingRecall',
          'cfg/paperTestLog',
          'cfg/trainingCalendar',
          'cfg/weeklyStudyAgenda',
          'cfg/cards',
          'cfg/reports',
          'cfg/attempts',
          'stats/T1.02',
          'sessions/example',
          'attempts/example',
          'attemptSessions/example',
          'academyStudyMaterials/T1.02',
          'academySectionEvents/example',
          'academyMaterialOpenEvents/example',
        ]) {
          await expect(getDoc(doc(db, `users/unrelated-account/${suffix}`))).rejects.toMatchObject({
            code: 'permission-denied',
          });
          if (role === 'owner' || role === 'normal') await getDoc(doc(db, `users/${uid}/${suffix}`));
          else
            await expect(getDoc(doc(db, `users/${uid}/${suffix}`))).rejects.toMatchObject({
              code: 'permission-denied',
            });
        }
        if (role === 'owner') await getDocs(collection(db, 'access'));
        else await expect(getDocs(collection(db, 'access'))).rejects.toMatchObject({ code: 'permission-denied' });
        if (role === 'owner' || role === 'normal') await getDoc(doc(db, 'bank', 'example'));
        else await expect(getDoc(doc(db, 'bank', 'example'))).rejects.toMatchObject({ code: 'permission-denied' });
        await expect(setDoc(doc(db, 'bank', 'forbidden'), { content: 'synthetic' })).rejects.toMatchObject({
          code: 'permission-denied',
        });
        await expect(setDoc(own, { unexpected: true })).rejects.toMatchObject({ code: 'permission-denied' });
        const grant = () => setDoc(doc(db, 'access', identities.restricted.uid), { ok: true });
        if (role === 'owner') {
          await grant();
          await deleteDoc(doc(db, 'access', identities.restricted.uid));
        } else await expect(grant()).rejects.toMatchObject({ code: 'permission-denied' });
      } finally {
        await terminate(db);
        await deleteApp(app);
      }
    }
  });
});
