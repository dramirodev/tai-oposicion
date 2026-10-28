import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page, theme = 'dark', size = 3) {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(({ theme, size }) => {
    Math.random = () => 0.5;
    localStorage.setItem('tai.dev', '1');
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats: {}, sessions: [], cfg: { ui: { theme, size } }, seen: { t: [], ts: 0 }, cards: {}, reports: {} }));
  }, { theme, size });
}

for (const theme of ['light', 'dark']) {
  test(`los bloques de código conservan formato y tema mientras cargan · ${theme}`, async ({ page }) => {
    await prepare(page, theme, 0);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/ayuda');
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
      document.querySelector('#app')?.append(explanation);
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
      document.querySelector('#app')?.append(fixture);
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

test('Inicio distribuye práctica y repaso en escritorio sin duplicar acciones', async ({ page }) => {
  await prepare(page, 'light', 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toHaveCount(1);
  const primary = await page.locator('.home-primary').boundingBox();
  const review = await page.locator('.home-review').boundingBox();
  expect(primary).not.toBeNull(); expect(review).not.toBeNull();
  expect(Math.abs(primary!.y - review!.y)).toBeLessThan(2);
  expect(review!.x).toBeGreaterThan(primary!.x + primary!.width);
  await page.locator('#menu').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeFocused();
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
  await expect(page.locator('.chart-scroll')).toBeVisible();
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
