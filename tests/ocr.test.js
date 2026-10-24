import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
it('audita bancos pequeños y opciones mal formadas sin modificar las fuentes', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'tai-ocr-'));
  try {
    mkdirSync(path.join(root, 'public/data'), { recursive: true });
    const file = path.join(root, 'public/data/T1.01.json');
    const source = JSON.stringify([
      { i: 'ok', q: 'Pregunta limpia', a: ['Uno', 'Dos'], c: 0 },
      { i: 'bad', q: 'Otra pregunta', a: [null, 4], c: true },
      { i: 'agency', q: 'Agencia de Ciberseguridad de la UE', a: ['ENISA', 'Otra'], c: 0 },
    ]);
    writeFileSync(file, source);
    writeFileSync(path.join(root, 'public/data/supuestos.json'), '{}');
    const out = path.join(root, 'out');
    const result = spawnSync('python3', [path.resolve('public/data/revision-ocr/audit.py'), '--root', root, '--output', out], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const candidates = JSON.parse(readFileSync(path.join(out, 'candidatos.json')));
    expect(candidates.map(r => r.id)).toEqual(['bad']);
    expect(candidates[0].reasons).toContain('índice correcto fuera de rango');
    expect(JSON.parse(readFileSync(path.join(out, 'muestra-300.json')))).toHaveLength(2);
    expect(readFileSync(file, 'utf8')).toBe(source);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
