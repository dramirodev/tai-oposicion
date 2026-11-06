import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Functional layout and planning regressions, without importing another
// browser's visual baselines or changing the standard Chromium/WebKit suite.
export default defineConfig({
  ...base,
  testMatch: 'css-ui.spec.ts',
  outputDir: 'test-results-firefox',
  projects: [{ name: `firefox-${process.platform}`, use: { browserName: 'firefox' } }],
});
