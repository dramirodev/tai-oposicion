import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { syntheticRules, PROJECT } from './synthetic-users.mjs';
const directory = await mkdtemp(join(tmpdir(), 'tai-supertest-'));
try {
  const rules = join(directory, 'firestore.rules');
  await writeFile(rules, await syntheticRules());
  const config = join(directory, 'firebase.json');
  await writeFile(config, JSON.stringify({ firestore:{ rules: 'firestore.rules' }, emulators:{ auth:{ host:'127.0.0.1', port:9099 }, firestore:{ host:'127.0.0.1', port:8080 }, ui:{ enabled:false }, singleProjectMode:true } }));
  const command = process.argv.includes('--explorer') ? 'bash scripts/e2e/run-agentic-inside-emulators.sh'
    : 'TAI_AUTH_EMULATOR=1 TAI_FIREBASE_EMULATORS=1 npx playwright test --config=playwright.supertest.config.ts --project=chromium-' + process.platform;
  const result = spawnSync('npx', ['--yes', 'firebase-tools@13.35.1', 'emulators:exec', '--config', config, '--only', 'auth,firestore', '--project', PROJECT, command], { cwd:resolve('.'), stdio:'inherit', env:{ ...process.env, GCLOUD_PROJECT:PROJECT } });
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive:true, force:true }); }
