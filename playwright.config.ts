import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  // These corpus audits have dedicated Vite servers/configurations; the
  // general suite serves the built app from scripts/serve.mjs.
  testIgnore: ['**/question-render-audit.spec.ts', '**/code-render-audit.spec.ts'],
  timeout: 30_000,
  fullyParallel: true,
  // WebKit shares Playwright's temporary trace directory across workers on
  // macOS; one worker avoids ENOENT while parallel traces are packed.
  workers: 1,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.001 } },
  use: { serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4187', viewport: { width: 393, height: 852 }, reducedMotion: 'reduce', locale: 'es-ES', timezoneId: 'Europe/Madrid', trace: 'retain-on-failure' },
  projects: [{ name: `chromium-${process.platform}`, use: { browserName: 'chromium' } }, { name: `webkit-${process.platform}`, use: { browserName: 'webkit' } }],
  webServer: { command: 'PORT=4187 npm start', url: 'http://127.0.0.1:4187', reuseExistingServer: false, timeout: 60_000 },
});
