import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive:true, force:true }); });
function launch({ project = 'demo-tai-auth', existingMemory = false, wrongDirectory = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tai-explorer-isolation-')); roots.push(root);
  const run = join(root, 'test-results-explorer', 'run-test'); mkdirSync(run, { recursive:true });
  if (existingMemory) writeFileSync(join(run, 'agent_memory.sqlite'), 'preserved memory');
  const probe = `import json, os, runpy, sys, types
sys.modules['dotenv'] = types.SimpleNamespace(dotenv_values=lambda *a, **k: {'GOOGLE_API_KEY':'synthetic-not-a-real-key', 'GCLOUD_PROJECT':'production', 'MCP_SERVERS_CONFIG':'external'})
def capture(executable, args):
 print(json.dumps({'provider':os.environ['LLM_PROVIDER'], 'syntheticKey':os.environ['GOOGLE_API_KEY']=='synthetic-not-a-real-key', 'project':os.environ['GCLOUD_PROJECT'], 'mcp':os.environ['MCP_SERVERS_CONFIG'], 'tracing':os.environ['LANGSMITH_TRACING'], 'args':args[2:]}))
os.execv = capture
script = sys.argv[1]
sys.argv = [script, '--provider', 'gemini']
runpy.run_path(script, run_name='__main__')`;
  return spawnSync('python3', ['-c', probe, resolve('scripts/e2e/launch-isolated-explorer.py')], {
    cwd:wrongDirectory ? root : run, encoding:'utf8', env:{ ...process.env,
      ROOT:root, EXPLORER:join(root,'explorer'), TAI_EXPLORER_RUN_DIR:run,
      GCLOUD_PROJECT:project, FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099', FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
      GOOGLE_API_KEY:'', GEMINI_API_KEY:'',
    },
  });
}
it('launches only Gemini in fresh memory without importing unrelated dotenv settings', () => {
  const result = launch(); expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout.trim().split('\n').at(-1))).toMatchObject({ provider:'gemini', syntheticKey:true, project:'demo-tai-auth', mcp:'', tracing:'false' });
});
it('refuses production, an existing memory database and an unexpected working directory', () => {
  for (const options of [{ project:'production' }, { existingMemory:true }, { wrongDirectory:true }]) {
    const result = launch(options); expect(result.status).not.toBe(0); expect(result.stderr).toContain('fresh isolated directory');
  }
});
