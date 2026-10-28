// El generador debe funcionar desde otra carpeta y fallar sin alterar el banco existente.
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
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
function run(f, args = [], env = {}) {
  return spawnSync('python3', [script, ...args], { cwd: f.root, encoding: 'utf8', env: { ...process.env, ...env } });
}
const flags = f => ['--bank-dir', f.bank, '--supuestos-dir', f.sup, '--temario-dir', f.temario, '--out-dir', f.out];
describe('generación portable del banco', () => {
  it('genera preguntas, índices y supuestos desde rutas explícitas ajenas al directorio de trabajo', () => {
    const f = fixture(), r = run(f, flags(f));
    expect(r.status, r.stderr).toBe(0);
    const read = name => JSON.parse(readFileSync(path.join(f.out, name), 'utf8'));
    expect(read('index.json')).toEqual({ temas: [{ w: 1, id: 'T2.01', nombre: 'Hardware', n: 2, O: 1, A: 0, G: 1 }], n: 2, nsup: 1 });
    expect(read('T2.01.json')[0]).toMatchObject({ i: 'O-1', o: 'O', c: 1, a: ['Uno', 'Dos', 'Tres', 'Cuatro'] });
    expect(read('T2.01.json')[1]).toMatchObject({ i: 'G-1', o: 'G', u: 'Fuente de prueba', v: 0 });
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
