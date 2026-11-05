// Las fuentes del sistema y WebKit varían entre plataformas. CI reconstruye la
// referencia visual aprobada en su propio runner, independiente del candidato.
// Un rediseño intencional actualiza baseline-ref.txt tras revisar sus capturas.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
const refFile = 'tests/e2e/baseline-ref.txt';
if (!existsSync(refFile)) {
  // Primera referencia visual de este proyecto y sistema operativo.
  run('npm', ['run', 'test:e2e', '--', '--update-snapshots=missing']);
  run('npm', ['run', 'test:e2e']);
} else {
  const ref = readFileSync(refFile, 'utf8').trim();
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error('Referencia de fase 0 inválida');
  const tmp = mkdtempSync(join(tmpdir(), 'tai-baseline-'));
  try {
    writeFileSync(join(tmp, 'source.tar'), execFileSync('git', ['archive', ref], { maxBuffer: 100 * 1024 * 1024 }));
    run('tar', ['-xf', 'source.tar'], tmp);
    run('npm', ['ci'], tmp);
    // La referencia solo genera capturas de rutas. Las comprobaciones funcionales
    // completas corren después contra la versión candidata, donde se mantienen
    // todos los tests de teclado, subrayado, persistencia y navegación.
    const routeSnapshotNames = 'home|quiz|result|test|sim|examenes|cards|stats|settings|temario|falladas|errores|lectura|relampago|trampas|acceso';
    run('npx', ['playwright', 'test', 'tests/e2e/routes.spec.ts', '--grep', routeSnapshotNames, '--update-snapshots'], tmp);
    const snapshots = resolve('tests/e2e/snapshots');
    const candidateSnapshots = join(tmp, 'candidate-snapshots');
    cpSync(snapshots, candidateSnapshots, { recursive: true });
    try {
      // Usa el baseline aprobado solo durante la comparación. No sobrescribas
      // snapshots staged o locales del checkout del candidato.
      cpSync(join(tmp, 'tests/e2e/snapshots'), snapshots, { recursive: true });
      run('npm', ['run', 'test:e2e']);
    } finally {
      rmSync(snapshots, { recursive: true, force: true });
      cpSync(candidateSnapshots, snapshots, { recursive: true });
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
