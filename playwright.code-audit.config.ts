import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'code-render-audit.spec.ts',
  timeout: 60 * 60 * 1000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/code-render-audit',
  use: {
    baseURL: 'http://127.0.0.1:4189',
    viewport: { width: 320, height: 780 },
    reducedMotion: 'reduce',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: `code-audit-chrome-${process.platform}`, use: { browserName: 'chromium', channel: 'chrome' } },
    { name: `code-audit-webkit-${process.platform}`, use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4189 --strictPort',
    url: 'http://127.0.0.1:4189/tests/e2e/fixtures/code-render-audit.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
