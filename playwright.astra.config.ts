import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  outputDir: 'test-results/astra',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4193' },
  webServer: {
    command: 'PORT=4193 node scripts/serve.mjs',
    url: 'http://127.0.0.1:4193',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
