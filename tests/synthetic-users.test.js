import { expect, it } from 'vitest';
import { assertEmulators, syntheticRules } from '../scripts/e2e/synthetic-users.mjs';
import { readFile } from 'node:fs/promises';
it('refuses missing, remote, production and credentialed Admin SDK environments', () => {
  const valid = { GCLOUD_PROJECT:'demo-tai-auth', FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080' };
  expect(() => assertEmulators(valid)).not.toThrow();
  for (const override of [{ GCLOUD_PROJECT:'production' }, { FIREBASE_AUTH_EMULATOR_HOST:undefined }, { FIRESTORE_EMULATOR_HOST:'remote:8080' }, { GOOGLE_APPLICATION_CREDENTIALS:'/secret.json' }, { GOOGLE_CLOUD_PROJECT:'production' }, { FIREBASE_CONFIG:'{"projectId":"production"}' }]) {
    expect(() => assertEmulators({ ...valid, ...override })).toThrow();
  }
});
it('substitutes only the owner identity and keeps every production security rule', async () => {
  const original = await readFile('firestore.rules','utf8');
  expect(await syntheticRules()).toBe(original.replace(/request\.auth\.token\.email == '[^']+'/, "request.auth.token.email == 'tai-supertest@example.test'"));
  expect(await syntheticRules()).not.toContain('allow read, write: if true');
});
