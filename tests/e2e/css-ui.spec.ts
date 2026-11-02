import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page, theme = 'dark', size = 3, fullAccess = false) {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(({ theme, size, fullAccess }) => {
    if (localStorage.getItem('tai.e2e.fixture-ready')) return;
    Math.random = () => 0.5;
    localStorage.setItem('tai.dev', '1');
    if (fullAccess) localStorage.setItem('tai.acc:guest', 'propietario');
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats: {}, sessions: [], cfg: { ui: { theme, size } }, seen: { t: fullAccess ? ['T1.01'] : [], ts: 0 }, cards: {}, reports: {} }));
    localStorage.setItem('tai.e2e.fixture-ready', '1');
  }, { theme, size, fullAccess });
}

async function selectIntroductionTopic(page: Page, topicId: string) {
  await page.goto('/#/settings');
  await page.getByLabel('Tema que estás introduciendo esta semana').selectOption(topicId);
}

test('Ajustes mantiene completas las etiquetas del horario semanal en escritorio y móvil', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Entrenamiento semanal' })).toBeVisible();
  await expect(page.locator('.training-day')).toHaveCount(7);

  for (const width of [1100, 320]) {
    await page.setViewportSize({ width, height: 850 });
    const fits = await page.locator('.training-day').evaluateAll(days => days.every(day => {
      const weekday = day.querySelector<HTMLLabelElement>(':scope > label:first-child');
      const focus = day.querySelector<HTMLLabelElement>('.training-focus-label');
      const minutes = day.querySelector<HTMLElement>('.training-minute-input');
      const select = day.querySelector<HTMLSelectElement>('select');
      if (!weekday || !focus || !minutes || !select) return false;
      const bounds = day.getBoundingClientRect();
      return weekday.scrollWidth <= weekday.clientWidth
        && focus.scrollWidth <= focus.clientWidth
        && minutes.getBoundingClientRect().right <= bounds.right
        && select.scrollWidth <= select.clientWidth
        && select.getBoundingClientRect().right <= bounds.right;
    }));
    expect(fits, `etiquetas y controles dentro de las tarjetas a ${width}px`).toBe(true);
  }
});

test('las excepciones de calendario se guardan, afectan solo las fechas indicadas y sobreviven a recarga', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'));
  await selectIntroductionTopic(page, 'T1.02');
  await page.getByLabel('Tipo de evento').selectOption('unavailable');
  await page.getByLabel('Nombre del evento').fill('Vacaciones');
  await page.getByLabel('Inicio del evento').fill('2026-11-02');
  await page.getByLabel('Fin del evento').fill('2026-11-05');
  await page.getByRole('button', { name:'Guardar evento' }).click();
  await expect(page.getByText('Vacaciones', { exact:true })).toBeVisible();
  await expect(page.getByLabel('Lunes: minutos de entrenamiento')).toHaveValue('120');

  await page.goto('/#/planificacion');
  await expect(page.getByRole('list', { name:'Próximos eventos' })).toContainText('Vacaciones');
  await expect(page.locator('.planning-week ol li').filter({ hasText:'Lunes · 2' })).toContainText('Vacaciones');
  await expect(page.locator('.planning-activity')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('list', { name:'Próximos eventos' })).toContainText('Vacaciones');

  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+01:00'));
  await page.reload();
  await page.goto('/#/settings');
  await expect(page.getByText('Vacaciones', { exact:true }).locator('..')).toContainText('Pasado');
  await page.goto('/#/planificacion');
  await expect(page.locator('.planning-activity')).toHaveCount(2);
  await expect(page.getByRole('list', { name:'Próximos eventos' })).toHaveCount(0);
});

test('un hito versionado crea un simulacro con su política explícita y queda enlazado desde Planificación', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await page.setViewportSize({ width:390, height:844 });
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'));
  await page.goto('/#/settings');
  await page.getByLabel('Tipo de evento').selectOption('milestone');
  await page.getByLabel('Nombre del evento').fill('Simulacro de referencia');
  await page.getByLabel('Inicio del evento').fill('2026-11-02');
  await page.getByLabel('Fin del evento').fill('2026-11-02');
  await page.getByLabel('Preguntas del hito').fill('3');
  await page.getByLabel('Duración del hito').fill('10');
  await page.getByRole('button', { name:'Guardar evento' }).click();
  await expect(page.getByRole('list', { name:'Eventos guardados' })).toContainText('Simulacro · 3 preguntas/10 min · penalización desconocida');

  await page.goto('/#/planificacion');
  const event = page.getByRole('list', { name:'Próximos eventos' });
  await expect(event).toContainText('Simulacro de referencia');
  await event.getByRole('link', { name:'Preparar hito' }).click();
  await expect(page).toHaveURL(/#\/sim\?milestone=/);
  await expect(page.getByRole('heading', { name:'Simulacro de referencia' })).toBeVisible();
  await expect(page.getByText(/sin nota neta/)).toBeVisible();
  await expect(page.getByRole('tablist', { name:'Tipo de simulacro' })).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Empezar este hito' })).toBeEnabled();
  await page.getByRole('button', { name:'Empezar este hito' }).click();
  await expect.poll(async () => page.evaluate(() => location.hash)).toMatch(/#\/quiz/);
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await page.locator('.opt').first().click();
  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  for (let index = 0; index < 3; index++) {
    if (index > 0) await page.locator('.opt').first().click();
    await page.locator('#next').click();
  }
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  await expect(page.getByText('Puntuación neta pendiente')).toBeVisible();
  const savedSession = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null')?.sessions?.at(-1));
  expect(savedSession).toMatchObject({ scorePending:true, scoringPolicy:{ version:1, correctPoints:1, wrongPenalty:null, blankPoints:0 }, milestoneEventId:expect.any(String) });
  expect(savedSession.nota).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width:1440, height:960 });
  await page.goto('/#/planificacion');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

for (const theme of ['light', 'dark']) {
  test(`los bloques de código conservan formato y tema mientras cargan · ${theme}`, async ({ page }) => {
    await prepare(page, theme, 0);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/ayuda');
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', theme);
    await expect(page.locator('#app h1')).toHaveText('Ayuda');
    await page.evaluate(() => {
      const sample = document.createElement('pre');
      sample.className = 'code-sample';
      const code = document.createElement('code');
      code.className = 'cd blk shiki';
      const token = document.createElement('span');
      token.className = 'shiki-token';
      token.style.setProperty('--shiki-token-light', 'rgb(20, 30, 40)');
      token.style.setProperty('--shiki-token-dark', 'rgb(240, 220, 200)');
      token.textContent = 'SELECT nombre FROM usuarios;';
      code.append(token);
      sample.append(code);
      const explanation = document.createElement('section');
      explanation.className = 'card code-explanation';
      explanation.append(sample);
      // Keep the CSS probe outside React's owned root: navigation/startup may
      // replace #app while the lazy screen finishes mounting.
      document.body.append(explanation);
    });

    const styles = await page.locator('.code-explanation .code-sample > code').evaluate(code => {
      const style = getComputedStyle(code);
      const token = getComputedStyle(code.querySelector('.shiki-token')!);
      return { display: style.display, family: style.fontFamily, whiteSpace: style.whiteSpace, background: style.backgroundColor, token: token.color };
    });
    expect(styles.display).toBe('block');
    expect(styles.family).toMatch(/monospace/i);
    expect(styles.whiteSpace).toBe('pre-wrap');
    expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.token).toBe(theme === 'dark' ? 'rgb(240, 220, 200)' : 'rgb(20, 30, 40)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test(`los fragmentos inline de enunciados y respuestas aplican los colores Shiki · ${theme}`, async ({ page }) => {
    await prepare(page, theme, 0);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/ayuda');
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', theme);
    await expect(page.locator('#app h1')).toHaveText('Ayuda');
    await page.evaluate(() => {
      const token = document.createElement('span');
      token.className = 'shiki-token';
      token.style.setProperty('--shiki-token-light', 'rgb(20, 30, 40)');
      token.style.setProperty('--shiki-token-dark', 'rgb(240, 220, 200)');
      token.textContent = 'chmod';

      const code = document.createElement('code');
      code.className = 'cd shiki';
      code.append(token);

      const statement = document.createElement('div');
      statement.className = 'enun';
      statement.append('Enunciado: ', code.cloneNode(true));

      const answer = document.createElement('button');
      answer.className = 'opt';
      const answerText = document.createElement('span');
      answerText.className = 'pre';
      answerText.append(code);
      answer.append(answerText);

      const fixture = document.createElement('section');
      fixture.setAttribute('aria-label', 'Fragmentos de código de pregunta y respuesta');
      fixture.append(statement, answer);
      document.body.append(fixture);
    });

    const colors = await page.locator('[aria-label="Fragmentos de código de pregunta y respuesta"] .shiki-token').evaluateAll(tokens =>
      tokens.map(token => getComputedStyle(token).color));
    const expected = theme === 'dark' ? 'rgb(240, 220, 200)' : 'rgb(20, 30, 40)';
    expect(colors).toEqual([expected, expected]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test(`Progreso conserva el reflujo con texto máximo · ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/stats');
    const sections = page.getByRole('group', { name: 'Sección de progreso' });
    const sectionStyle = await sections.evaluate(element => {
      const style = getComputedStyle(element);
      return { position: style.position, zIndex: style.zIndex, background: style.backgroundColor, bodyBackground: getComputedStyle(document.body).backgroundColor, borderBottomStyle: style.borderBottomStyle };
    });
    expect(sectionStyle).toMatchObject({ position: 'sticky', zIndex: '3', borderBottomStyle: 'solid' });
    expect(sectionStyle.background).toBe(sectionStyle.bodyBackground);
    await expect(page.locator('.dmt')).toHaveCount(36);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
    for (const card of await page.locator('.dmt').all()) {
      expect(await card.evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
    }
  });

  test(`los filtros de Progreso no salen del viewport en Evolución · ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/stats');
    await page.getByRole('button', { name: 'Evolución' }).click();
    await expect(page.getByRole('combobox', { name: 'Qué medir en la evolución' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
      selects: [...document.querySelectorAll('.row>label>select')].map(select => {
        const rect = select.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.selects.every(select => select.left >= 0 && select.right <= dimensions.viewport)).toBe(true);
  });

  test(`los controles de Detective caben con texto máximo · ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/trampas');
    await expect(page.locator('.mot button').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test(`las opciones y su descarte siguen siendo legibles · ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/home');
    await page.locator('#quick').click();
    const option = page.locator('.option-control').first();
    expect(await option.locator('.pre').evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(90);
    await option.locator('[data-discard-option]').click();
    await expect(option.locator('[data-discard-option]')).toHaveAttribute('aria-pressed', 'true');
    await option.locator('[data-discard-option]').click();
    await option.locator('.opt').click();
    await expect(page.locator('.opt.ok')).toHaveCount(1);
    const contrasts = await page.locator('.opt.ok,.opt.bad').evaluateAll(elements => {
      const luminance = (color: string) => (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      return elements.map(e => {
        const foreground = luminance(getComputedStyle(e, '::after').color), background = luminance(getComputedStyle(e).backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
    });
    expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(3);
  });
}

test('las falsas alarmas conservan su estado de error sin animación de tarjeta', async ({ page }) => {
  await prepare(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/trampas');
  await expect(page.locator('.mot button').first()).toBeVisible();
  for (const chip of await page.locator('.mot button').all()) await chip.click();
  await page.getByRole('button', { name: 'Comprobar' }).click();
  const falseAlarm = page.locator('.trapx').filter({ hasText: 'Falsa alarma:' }).first();
  await expect(falseAlarm).toBeVisible();
  const styles = await falseAlarm.evaluate(e => ({ animation: getComputedStyle(e).animationName, background: getComputedStyle(e).backgroundColor }));
  expect(styles.animation).toBe('none');
  expect(styles.background).not.toBe('rgb(18, 52, 31)');
});

test('el espacio para acciones se adapta a etiquetas largas sin ocultar el final', async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/home');
  await page.locator('#quick').click();
  await expect(page.locator('.opt').first()).toBeVisible();
  await page.locator('#next').evaluate(e => { e.textContent = 'Continuar a la siguiente pregunta del ejercicio '.repeat(8); });
  await expect.poll(async () => page.evaluate(() => {
    const bar = document.querySelector('.bar2')!.getBoundingClientRect();
    const root = document.querySelector('#app')!;
    const zoom = parseFloat(getComputedStyle(root).zoom) || 1;
    return parseFloat(getComputedStyle(root).paddingBottom) * zoom - (innerHeight - bar.top);
  })).toBeGreaterThanOrEqual(16);
});

test('el tema automático sigue los cambios del sistema sin recargar', async ({ page }) => {
  await prepare(page, 'auto', 0);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 246, 247)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 17, 19)');
  await expect.poll(() => page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#111113');
});

test('saltar al contenido conserva la ruta y ofrece un destino de teclado', async ({ page }) => {
  await prepare(page, 'light', 0);
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  const before = page.url();
  await page.locator('.skip-link').focus();
  await expect(page.locator('.skip-link')).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toBeFocused();
  expect(page.url()).toBe(before);
});

test('Planificación prepara la sesión fuera de Inicio y permite comenzar el paso configurado', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await selectIntroductionTopic(page, 'T1.02');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  await expect(page.locator('.home-training')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir Planificación de estudio' })).toHaveAttribute('href', '#/planificacion');
  await page.locator('#menu').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeFocused();

  await page.goto('/#/planificacion');
  await expect(page.locator('#app h1')).toHaveText('Planificación de estudio');
  await expect(page.locator('.planning-activity')).toHaveCount(2);
  await page.getByRole('button', { name: 'Comenzar sesión' }).click();
  await expect(page).toHaveURL(/#\/temario\?topic=T1\.02&dailyTraining=newContent/);
});

test('la agenda semanal confirma, persiste y alimenta el checkpoint de la fecha al llegar', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'));
  await page.goto('/#/home');
  await expect(page.locator('#app h1')).toContainText('Hola');
  await page.goto('/#/planificacion');
  await expect(page.locator('#app h1')).toHaveText('Planificación de estudio');
  await expect(page.locator('main.planning-page')).toBeVisible();
  await page.getByLabel('Fecha de actividad semanal').fill('2026-11-03');
  await page.getByLabel('Actividad semanal', { exact:true }).selectOption('newContent');
  await page.getByLabel('Tema de actividad semanal', { exact:true }).selectOption('T1.02');
  await page.getByLabel('Duración de actividad semanal', { exact:true }).selectOption('35');
  await page.getByRole('button', { name:'Revisar propuesta' }).click();
  await expect(page.getByRole('group', { name:'Propuesta de semana pendiente de confirmación' })).toContainText('Añadir Tema nuevo · T1.02 · 35 min');
  await expect(page.getByRole('list', { name:'Actividades de la agenda semanal' })).toHaveCount(0);
  await page.getByRole('button', { name:'Confirmar actividad semanal' }).click();
  await expect(page.getByRole('list', { name:'Actividades de la agenda semanal' })).toContainText('Tema nuevo · T1.02 · 35 min · Planificada');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.weekly-study-agenda.v1.guest') || 'null'))).toMatchObject({
    schemaVersion:1, items:[{ dateKey:'2026-11-03', kind:'newContent', topicIds:['T1.02'], minutes:35, status:'planned' }],
  });

  await page.reload();
  await expect(page.getByRole('list', { name:'Actividades de la agenda semanal' })).toContainText('Tema nuevo · T1.02 · 35 min · Planificada');
  await page.clock.setFixedTime(new Date('2026-11-03T12:00:00+01:00'));
  await page.reload();
  await expect(page.locator('.planning-activity')).toContainText('T1.02');
  await page.getByRole('button', { name:'Comenzar sesión' }).click();
  await expect(page).toHaveURL(/#\/temario\?topic=T1\.02&dailyTraining=newContent/);
});

test('la pausa de foco se guarda, sobrevive a recarga y continúa el mismo paso', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'));
  await page.goto('/#/home');
  const session = await page.evaluate(() => {
    const now = Date.now();
    const dateKey = `${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, '0')}-${String(new Date(now).getDate()).padStart(2, '0')}`;
    const id = `training:${dateKey}`;
    const value = { schemaVersion:2, id, dateKey, activities:[{ id:`${id}:activity:1`, activity:'activeRecall', minutes:30, reason:'active-recall' }], currentIndex:0, currentStartedAt:now - 36 * 60_000, elapsedSecondsByActivity:[0], updatedAt:now, startedAt:now - 40 * 60_000, completedAt:null };
    localStorage.setItem(`tai.training-session.v1.${encodeURIComponent('guest')}`, JSON.stringify(value));
    return value;
  });
  await page.goto('/#/planificacion');
  await expect(page.getByText(/Has alcanzado el bloque orientativo de 35 min/)).toBeVisible();
  await page.getByRole('button', { name:'Tomar pausa de 5 min' }).click();
  await expect(page.getByRole('status').filter({ hasText:'Pausa en curso' })).toBeVisible();
  const paused = await page.evaluate(() => JSON.parse(localStorage.getItem(`tai.training-session.v1.${encodeURIComponent('guest')}`) || 'null'));
  expect(paused).toMatchObject({ currentIndex:0, currentStartedAt:null, breakStartedAt:expect.any(Number), breakDurationMinutes:5 });
  expect(paused.elapsedSecondsByActivity[0]).toBeGreaterThanOrEqual(2159);

  await page.reload();
  await expect(page.getByRole('status').filter({ hasText:'Pausa en curso' })).toBeVisible();
  await page.getByRole('button', { name:'Terminar pausa' }).click();
  const resumed = await page.evaluate(() => JSON.parse(localStorage.getItem(`tai.training-session.v1.${encodeURIComponent('guest')}`) || 'null'));
  expect(resumed).toMatchObject({ currentIndex:0, currentStartedAt:null, breakStartedAt:null, activities:[{ id:session.activities[0].id }] });
  await page.getByRole('button', { name:'Continuar actividad' }).click();
  await expect(page).toHaveURL(/#\/cards/);
});

test('registra el recuerdo del tema en papel y prioriza su comprobación el día siguiente', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await selectIntroductionTopic(page, 'T1.02');
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00+02:00'));
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Comenzar sesión' }).click();
  await expect(page).toHaveURL(/#\/temario\?topic=T1\.02&dailyTraining=newContent/);
  await page.locator('[data-t="T1.02"]').click({ noWaitAfter:true });
  await expect(page).toHaveURL(/#\/planificacion$/);

  const assessment = page.getByRole('group', { name:'Después de estudiar en papel y cerrar los apuntes, ¿cuánto recordaste?' });
  await expect(assessment).toBeVisible();
  await assessment.getByRole('button', { name:'Parcialmente' }).click();
  await expect(assessment.getByRole('button', { name:'Parcialmente' })).toHaveAttribute('aria-pressed', 'true');
  await expect(assessment.getByText(/Autoevaluación guardada/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.paper-recall.v1.guest') || '[]'))).toMatchObject([
    { topicId:'T1.02', rating:'partial', dateKey:'2026-10-29' },
  ]);

  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+02:00'));
  await page.reload();
  await expect(page.locator('#app h1')).toHaveText('Planificación de estudio');
  await expect(page.getByText(/2 de \d+ temas marcados como vistos/)).toBeVisible();
  const nextDayActivities = page.locator('.planning-activity');
  await expect(nextDayActivities).toHaveCount(3);
  await expect(nextDayActivities.nth(1)).toContainText('Preguntas del tema prioritario');
  await expect(nextDayActivities.nth(1)).toContainText('T1.02');
  await nextDayActivities.nth(1).getByText('Instrucciones y motivo').click();
  await expect(nextDayActivities.nth(1)).toContainText('Tu autoevaluación de recuerdo en papel fue «Parcialmente» el 29 de octubre de 2026');
});

test('un día de consolidación sin temas vistos muestra tiempo disponible, no una duración de sesión inventada', async ({ page }) => {
  await prepare(page, 'light', 0);
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+02:00'));
  await page.goto('/#/planificacion');
  await expect(page.locator('#app h1')).toHaveText('Planificación de estudio');
  await expect(page.getByText('No hay actividades justificadas con la información disponible.')).toBeVisible();
  await expect(page.getByText('Tiempo disponible')).toBeVisible();
  await expect(page.getByText('Tiempo previsto')).toHaveCount(0);
  await expect(page.getByRole('definition').filter({ hasText: '120 min' })).toBeVisible();
});

test('el historial de Planificación muestra todas las sesiones en móvil sin desbordarse', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  const history = Array.from({ length:7 }, (_, index) => {
    const startedAt = new Date(2026, 9, 28 - index, 12).getTime();
    const dateKey = new Date(startedAt).toLocaleDateString('en-CA');
    return { id:dateKey, dateKey, startedAt, completedAt:startedAt + 60_000, plannedMinutes:10,
      activities:[{ activity:'activeRecall', minutes:10, reason:'active-recall' }], elapsedSecondsByActivity:[60] };
  });
  await page.addInitScript(value => localStorage.setItem('tai.training-history.v1.guest', JSON.stringify(value)), history);
  await page.setViewportSize({ width:320, height:900 });
  await page.goto('/#/planificacion');

  await expect(page.locator('.planning-history li')).toHaveCount(5);
  const showAll = page.locator('.planning-history-toggle');
  await expect(showAll).toHaveAccessibleName('Mostrar todas las sesiones (7)');
  await expect(showAll).toHaveAttribute('aria-expanded', 'false');
  expect((await showAll.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await showAll.click();
  await expect(page.locator('.planning-history li')).toHaveCount(7);
  await expect(showAll).toHaveAttribute('aria-expanded', 'true');
  await expect(showAll).toHaveAccessibleName('Mostrar solo las cinco más recientes');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('el calendario mensual distingue disponibilidad de sesiones completadas en móvil', async ({ page }) => {
  await prepare(page, 'light', 0, true);
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00+02:00'));
  await page.setViewportSize({ width:320, height:900 });
  await page.goto('/#/planificacion');

  await page.getByRole('button', { name:'Mes', exact:true }).click();
  await expect(page.locator('.planning-month-day')).toHaveCount(31);
  await expect(page.getByRole('group', { name:/jueves 29: 120 minutos disponibles.*academia.*hoy/i })).toBeVisible();
  await expect(page.getByRole('group', { name:/domingo 25: descanso/i })).toBeVisible();
  await expect(page.locator('.planning-month-day>small').first()).toBeHidden();
  await expect(page.getByText(/Las actividades futuras son repasos que tú confirmas/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name:'Mes siguiente' }).click();
  await expect(page.getByRole('heading', { name:'noviembre de 2026' })).toBeVisible();
});

for (const theme of ['light', 'dark']) {
test(`programa y reprograma un repaso de papel solo tras confirmar y conserva el cambio al recargar · ${theme}`, async ({ page }) => {
  await prepare(page, theme, 0, true);
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00+02:00'));
  await page.setViewportSize({ width:375, height:812 });
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Mes', exact:true }).click();
  await page.getByLabel('Fecha del repaso').fill('2026-11-02');
  await page.getByLabel('Tema del repaso').selectOption('T1.01');
  await page.getByLabel('Tipo de repaso').selectOption('topicTest');
  await page.getByLabel('Duración del repaso').selectOption('20');
  await page.getByRole('button', { name:'Revisar propuesta' }).click();
  await expect(page.getByRole('group', { name:'Propuesta pendiente de confirmación' })).toContainText('lunes, 2 de noviembre de 2026');
  await expect(page.getByRole('list', { name:'Repasos planificados' })).toHaveCount(0);
  await page.getByRole('button', { name:'Confirmar planificación' }).click();

  const activity = page.getByRole('list', { name:'Repasos planificados' }).getByRole('listitem');
  await expect(activity).toContainText('Test por tema');
  await expect(activity).toContainText('T1.01');
  await expect(activity).toContainText('20 min');
  await expect(activity.getByRole('button', { name:'Abrir' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.training-calendar.v1.guest') || '[]'))).toMatchObject([
    { dateKey:'2026-11-02', activity:'topicTest', topicId:'T1.01', minutes:20 },
  ]);

  await page.reload();
  await page.getByRole('button', { name:'Mes', exact:true }).click();
  const reloadedActivity = page.getByRole('list', { name:'Repasos planificados' }).getByRole('listitem');
  await expect(reloadedActivity).toContainText('lunes, 2 de noviembre de 2026');
  await reloadedActivity.getByLabel('Nueva fecha para T1.01').fill('2026-11-03');
  await reloadedActivity.getByRole('button', { name:'Reprogramar' }).click();
  await expect(page.getByRole('group', { name:'Propuesta pendiente de confirmación' })).toContainText('martes, 3 de noviembre de 2026');
  await expect(reloadedActivity).toContainText('lunes, 2 de noviembre de 2026');
  await page.getByRole('button', { name:'Confirmar planificación' }).click();
  await expect(page.getByRole('list', { name:'Repasos planificados' }).getByRole('listitem')).toContainText('martes, 3 de noviembre de 2026');
  await page.reload();
  await page.getByRole('button', { name:'Mes', exact:true }).click();
  const persistedActivity = page.getByRole('list', { name:'Repasos planificados' }).getByRole('listitem');
  await expect(persistedActivity).toContainText('martes, 3 de noviembre de 2026');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path:`test-results/planning-calendar-mobile-${theme}.png`, fullPage:true });
  await persistedActivity.getByRole('button', { name:'Abrir' }).click();
  await expect(page).toHaveURL(/#\/test\?dailyTraining=topicTest&trainingTopics=T1\.01&topic=T1\.01/);
  await expect(page.locator('#app h1')).toContainText('pregunta 1 de');
});
}

test('Planificación conserva el contenido dentro del viewport desde móvil estrecho hasta escritorio grande', async ({ page }) => {
  await prepare(page, 'light', 0);
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+02:00'));
  await page.goto('/#/planificacion');
  await expect(page.locator('#app h1')).toHaveText('Planificación de estudio');
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const pageBounds = await page.locator('.planning-page').boundingBox();
    expect(pageBounds).not.toBeNull();
    expect(pageBounds!.x + pageBounds!.width).toBeLessThanOrEqual(width + 1);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const bottomVisibility = await page.evaluate(() => ({
    contentBottom: document.querySelector('.planning-evidence')!.getBoundingClientRect().bottom,
    navigationTop: document.querySelector('nav[aria-label="Principal"]')!.getBoundingClientRect().top,
  }));
  expect(bottomVisibility.contentBottom).toBeLessThanOrEqual(bottomVisibility.navigationTop + 1);
});

test('el espaciado de texto conserva el reflujo con una sesión en curso', async ({ page }) => {
  await prepare(page, 'light', 3);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/#/home');
  await page.locator('#quick').click();
  for (const route of ['test', 'settings', 'stats']) {
    await page.goto('/#/' + route);
    await expect(page.locator('#app h1')).toBeVisible();
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.locator('summary').filter({ hasText: 'Lectura y carga de repasos' }).click();
  const chart = page.locator('.chart-scroll');
  await expect(chart).toBeVisible();
  const dimensions = await chart.evaluate(element => ({
    overflow: getComputedStyle(element).overflowX,
    client: element.clientWidth,
    content: element.scrollWidth,
    gridDisplay: getComputedStyle(element.firstElementChild!).display,
    gridMinimum: element.firstElementChild!.scrollWidth,
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  const barStyle = await chart.locator('[aria-hidden="true"]').first().evaluate(element => {
    const style = getComputedStyle(element);
    return { display: style.display, minHeight: style.minHeight, opacity: style.opacity, background: style.backgroundColor };
  });
  expect(dimensions.overflow).toBe('auto');
  expect(dimensions.gridDisplay).toBe('flex');
  expect(dimensions.content).toBeGreaterThan(dimensions.client);
  expect(dimensions.gridMinimum).toBeGreaterThan(dimensions.client);
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  expect(barStyle).toMatchObject({ display: 'block', minHeight: '2px', opacity: '0.85' });
  expect(barStyle.background).not.toBe('rgba(0, 0, 0, 0)');
});

test('la sidebar conserva los destinos y el área de estudio al ampliar texto', async ({ page }) => {
  await prepare(page, 'dark', 3);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/home');
  const sidebar = page.locator('.workspace-sidebar');
  await expect(sidebar).toBeVisible();
  await expect(page.locator('nav[aria-label="Principal"]')).toBeHidden();
  await sidebar.getByRole('link', { name: 'Test por tema', exact: true }).click();
  await expect(page.locator('#app h1')).toHaveText('Test por tema');
  await expect(sidebar.getByRole('link', { name: 'Test por tema', exact: true })).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Inicio', exact: true }).click();
  await page.locator('#quick').click();
  await expect(page.locator('.opt').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const sidebar = document.querySelector('.workspace-sidebar')!.getBoundingClientRect();
    const bar = document.querySelector('.bar2')!.getBoundingClientRect();
    return bar.left - sidebar.right;
  })).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

test('el menú móvil conserva la iconografía de navegación y funciona con teclado', async ({ page }) => {
  await prepare(page, 'light', 0);
  await page.goto('/#/test');
  await expect(page.locator('.workspace-sidebar')).toBeHidden();
  // La pantalla legacy enfoca el título al terminar su carga asíncrona.
  await expect(page.locator('#app h1')).toBeFocused();
  const menu = page.locator('.workspace-menu');
  await expect(menu).toBeVisible();
  await menu.focus();
  await expect(menu).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  const menuTestIcon = page.locator('#menuov .lrow').filter({ hasText: 'Test por tema' }).locator('svg');
  const navigationTestIcon = page.locator('.workspace-sidebar a[href="#/test"] svg');
  await expect(menuTestIcon).toBeVisible();
  expect(await menuTestIcon.evaluate(icon => icon.innerHTML)).toBe(await navigationTestIcon.evaluate(icon => icon.innerHTML));
  await expect(menuTestIcon).toHaveAttribute('stroke-width', '1.7');
  await page.locator('#menuov').getByRole('button', { name: 'Ayuda', exact: true }).click();
  await expect(page.locator('#app h1')).toHaveText('Ayuda');
});

for (const theme of ['light', 'dark']) {
  test(`los iconos del menú usan los colores de navegación · ${theme}`, async ({ page }) => {
    await prepare(page, theme, 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/home');
    await page.locator('#menu').click();
    const menu = page.locator('#menuov');
    await expect(menu).toBeVisible();

    const menuIconColors = await menu.evaluate(dialog => {
      const iconColor = (label: string) => {
        const row = [...dialog.querySelectorAll<HTMLButtonElement>('.lrow')]
          .find(candidate => candidate.querySelector('b')?.textContent === label);
        return row ? getComputedStyle(row.querySelector('svg')!).color : null;
      };
      return { active: iconColor('Inicio'), inactive: iconColor('Test por tema') };
    });
    const navigationIconColors = await page.locator('.workspace-sidebar').evaluate(sidebar => {
      const active = sidebar.querySelector<HTMLAnchorElement>('a[aria-current="page"] svg');
      const inactive = [...sidebar.querySelectorAll<HTMLAnchorElement>('a')]
        .find(link => link.textContent?.includes('Test por tema'))?.querySelector('svg');
      return {
        active: active ? getComputedStyle(active).color : null,
        inactive: inactive ? getComputedStyle(inactive).color : null,
      };
    });

    expect(menuIconColors).toEqual(navigationIconColors);
  });
}

test('la práctica táctil no aplica estilos hover persistentes a opciones', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await prepare(page, 'light', 0);
    await page.goto('/#/home');
    await page.locator('#quick').tap();
    const options = page.locator('.opt');
    await expect(options.first()).toBeVisible();
    expect(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)).toBe(false);
    const untouched = options.nth(3);
    const initialBackground = await untouched.evaluate(option => getComputedStyle(option).backgroundColor);
    await options.first().tap();
    await expect(options.first()).toHaveAttribute('aria-pressed', 'true');
    expect(await untouched.evaluate(option => getComputedStyle(option).backgroundColor)).toBe(initialBackground);
  } finally {
    await context.close();
  }
});
