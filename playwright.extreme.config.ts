import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'extreme-profile.spec.ts',
  outputDir: 'test-results-extreme',
  timeout: 10 * 60_000,
  projects: [
    { name: `extreme-chromium-${process.platform}`, use: { browserName: 'chromium' } },
    { name: `extreme-webkit-${process.platform}`, use: { browserName: 'webkit' } },
  ],
});
