// El generador debe funcionar desde otra carpeta y fallar sin alterar el banco existente.
import { describe, it, expect, afterEach } from 'vitest';
import { copyFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('build_data.py');
const dirs = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'tai-bank-')); dirs.push(root);
  const bank = path.join(root, 'banco con espacios'), temario = path.join(root, 'temario'), sup = path.join(root, 'supuestos'), out = path.join(root, 'salida');
  for (const dir of [bank, path.join(bank, 'generadas'), temario, sup, out]) mkdirSync(dir, { recursive: true });
  const json = (file, data) => writeFileSync(file, JSON.stringify(data));
  const q = { id: 'O-1', ids_duplicados: ['O-legacy'], tema: 'T2.01', enunciado: 'Pregunta de prueba', opciones: { a: 'Uno', b: 'Dos', c: 'Tres', d: 'Cuatro' }, correcta: 'b', tipo: 'D', convocatoria: '2024', plantilla: 'definitiva' };
  json(path.join(bank, 'banco_literal.json'), { preguntas: [q, { ...q, id: 'S-1', ids_duplicados: [], supuesto_id: 'S1' }] });
  json(path.join(bank, 'banco_academia.json'), { preguntas: [] });
  json(path.join(bank, 'generadas', 'banco_generado_T2.01.json'), { preguntas: [{ ...q, id: 'G-1', ids_duplicados: [], revision: { estado: 'verificada' }, cita_temario: [{ texto: 'Fuente de prueba' }] }] });
  json(path.join(sup, 'supuestos.json'), { S1: { convocatoria: '2024', texto: 'Caso práctico' } });
  json(path.join(sup, 'supuestos_academia.json'), {});
  writeFileSync(path.join(temario, 'T2.01 Hardware - Temario.txt'), 'Temario de prueba');
  return { root, bank, temario, sup, out };
}
function run(f, args = [], env = {}, generator = script) {
  return spawnSync('python3', [generator, ...args], { cwd: f.root, encoding: 'utf8', env: { ...process.env, ...env } });
}
const flags = f => ['--bank-dir', f.bank, '--supuestos-dir', f.sup, '--temario-dir', f.temario, '--out-dir', f.out];
describe('generación portable del banco', () => {
  it('genera preguntas, índices y supuestos desde rutas explícitas ajenas al directorio de trabajo', () => {
    const f = fixture(), r = run(f, flags(f));
    expect(r.status, r.stderr).toBe(0);
    const read = name => JSON.parse(readFileSync(path.join(f.out, name), 'utf8'));
    expect(read('index.json')).toEqual({ temas: [{ w: 1, id: 'T2.01', nombre: 'Hardware', n: 2, O: 1, A: 0, G: 1 }], n: 2, nsup: 1 });
    expect(read('T2.01.json')[0]).toMatchObject({ i: 'O-1', o: 'O', c: 1, a: ['Uno', 'Dos', 'Tres', 'Cuatro'] });
    expect(read('T2.01.json')[1]).toMatchObject({ i: 'G-1', o: 'G', u: 'Fuente de prueba', v: 1 });
    expect(r.stdout).toContain('No publicable');
    expect(read('supuestos.json').S1.q).toHaveLength(1);
    expect(read('meta.json')['O-1']).toEqual(['T2.01', 'O', 'D', [], 0]);
    expect(read('meta.json')['O-legacy']).toEqual(['T2.01', 'O', 'D', [], 0, 'O-1']);
    expect(read('T2.01.json').some(question => question.i === 'O-legacy')).toBe(false);
  });
  it('acepta variables de entorno y da prioridad a los argumentos', () => {
    const f = fixture(), r = run(f, ['--out-dir', f.out], { BANK_DIR: f.bank, SUPUESTOS_DIR: f.sup, TEMARIO_DIR: f.temario, OUT_DIR: path.join(f.root, 'otra') });
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(readFileSync(path.join(f.out, 'index.json'))).n).toBe(2);
  });
  it('informa de entradas ausentes antes de modificar la salida', () => {
    const f = fixture(); rmSync(path.join(f.sup, 'supuestos.json'));
    writeFileSync(path.join(f.out, 'T2.01.json'), 'conservar');
    const r = run(f, flags(f));
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('supuestos.json');
    expect(readFileSync(path.join(f.out, 'T2.01.json'), 'utf8')).toBe('conservar');
  });
});

it('reconstruye exactamente la edición aprobada y confina cambios desconocidos a candidatos', () => {
  const f = fixture();
  expect(run(f, flags(f)).status).toBe(0);
  const published = path.join(f.root, 'public/data');
  const editorial = path.join(f.root, 'scripts/bank-editorial');
  mkdirSync(published, { recursive: true });
  mkdirSync(editorial, { recursive: true });
  const generator = path.join(f.root, 'build_data.py');
  copyFileSync(script, generator);
  copyFileSync(path.resolve('scripts/bank_release.py'), path.join(f.root, 'scripts/bank_release.py'));
  copyFileSync(path.resolve('scripts/citation_release.py'), path.join(f.root, 'scripts/citation_release.py'));
  const files = {};
  const sha = value => createHash('sha256').update(value).digest('hex');
  for (const name of readdirSync(f.out)) {
    const raw = JSON.parse(readFileSync(path.join(f.out, name)));
    if (name === 'T2.01.json') raw[1].v = 0; // La fuente se autoetiquetó «verificada».
    const approved = structuredClone(raw);
    if (name === 'T2.01.json') Object.assign(approved[1], { np: 1, c: 3, n: 'Clave corregida' });
    if (name === 'supuestos.json') approved.S1.q[0].np = 1;
    const bytes = JSON.stringify(approved);
    files[name] = { sourceBuildSha256: sha(JSON.stringify(raw)), approvedSha256: sha(bytes) };
    writeFileSync(path.join(published, name), bytes);
  }
  writeFileSync(path.join(editorial, 'release.json'), JSON.stringify({ schemaVersion: 1, files }));
  const build = out => run(f, flags({ ...f, out }), {}, generator);
  const checkApproved = dir => {
    expect(readdirSync(dir).sort()).toEqual(Object.keys(files).sort());
    for (const [name, entry] of Object.entries(files)) {
      expect(sha(readFileSync(path.join(dir, name)))).toBe(entry.approvedSha256);
    }
  };
  expect(build(f.out).status).toBe(0);
  checkApproved(f.out);

  const generated = path.join(f.bank, 'generadas/banco_generado_T2.01.json');
  const incoming = JSON.parse(readFileSync(generated));
  incoming.preguntas[0].enunciado = 'Cambio sobrevenido';
  writeFileSync(generated, JSON.stringify(incoming));
  const blocked = build(published);
  expect(blocked.status).not.toBe(0);
  expect(blocked.stderr).toContain('Reconstrucción sin aprobación');
  checkApproved(published);
  const candidate = build(f.out);
  expect(candidate.status, candidate.stderr).toBe(0);
  expect(candidate.stdout).toContain('No publicable');
  expect(JSON.parse(readFileSync(path.join(f.out, 'T2.01.json')))[1]).toMatchObject({ np: 1, v: 1, q: 'Cambio sobrevenido' });
});
