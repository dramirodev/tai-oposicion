import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: ['astra-auth-emulator.spec.ts', 'auth-emulator.spec.ts'],
  projects: [{ name: 'chromium-auth', use: { browserName: 'chromium' } }],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4187' },
  outputDir: 'test-results/astra-auth',
  webServer: { command: 'TAI_FIREBASE_EMULATORS=1 PORT=4187 node scripts/serve.mjs', url: 'http://127.0.0.1:4187', reuseExistingServer: false },
});
