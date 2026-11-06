import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch:'supertest-emulator.spec.ts',
  outputDir:'test-results-supertest',
  timeout:60_000,
  projects:[{ name:`chromium-${process.platform}`, use:{ browserName:'chromium' } }],
  use:{ ...base.use, actionTimeout:15_000, baseURL:'http://127.0.0.1:4191' },
  webServer:{ command:'PORT=4191 npm start', url:'http://127.0.0.1:4191', reuseExistingServer:false, timeout:60_000 },
});
