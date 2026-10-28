import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'question-render-audit.spec.ts',
  timeout: 20 * 60 * 1000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4188',
    viewport: { width: 393, height: 852 },
    reducedMotion: 'reduce',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: `question-audit-chromium-${process.platform}`, use: { browserName: 'chromium' } },
    { name: `question-audit-webkit-${process.platform}`, use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4188 --strictPort',
    url: 'http://127.0.0.1:4188/tests/e2e/fixtures/question-render-audit.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
