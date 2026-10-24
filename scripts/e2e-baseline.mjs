// Las fuentes del sistema y WebKit varían entre plataformas. CI reconstruye la
// fase 0 en su propio runner; nunca actualiza referencias desde la app migrada.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
const refFile = 'tests/e2e/baseline-ref.txt';
if (!existsSync(refFile)) {
  // Primera fase: crear la referencia de la app todavía sin React en este SO.
  run('npm', ['run', 'test:e2e', '--', '--update-snapshots=missing']);
} else {
  const ref = readFileSync(refFile, 'utf8').trim();
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error('Referencia de fase 0 inválida');
  const tmp = mkdtempSync(join(tmpdir(), 'tai-baseline-'));
  try {
    writeFileSync(join(tmp, 'source.tar'), execFileSync('git', ['archive', ref], { maxBuffer: 100 * 1024 * 1024 }));
    run('tar', ['-xf', 'source.tar'], tmp);
    run('npm', ['ci'], tmp);
    // Referencia idéntica de versión para los textos técnicos; #ver small se enmascara.
    run('npm', ['run', 'test:e2e', '--', '--update-snapshots'], tmp);
    cpSync(join(tmp, 'tests/e2e/snapshots'), resolve('tests/e2e/snapshots'), { recursive: true });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
run('npm', ['run', 'test:e2e']);
