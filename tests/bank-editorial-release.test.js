import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, mkdtempSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pack, verifyApprovedBank } from '../scripts/publish_bank.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = row => createHash('sha256').update(JSON.stringify(row)).digest('hex');

it('detecta al publicar cualquier pérdida de datos aprobados, de un archivo o de una marca np', () => {
  const bytes = Buffer.from('[{"i":"X","np":1}]');
  const approved = pack(bytes);
  const release = { schemaVersion: 1, files: { 'T1.01.json': { approvedSha256: approved.sha256 } } };
  expect(() => verifyApprovedBank({ 'T1.01': approved }, release)).not.toThrow();
  expect(() => verifyApprovedBank({}, release)).toThrow(/inventario/);
  expect(() => verifyApprovedBank({ 'T1.02': approved }, release)).toThrow(/aprobación/);
  expect(() => verifyApprovedBank({ 'T1.01': pack(Buffer.from('[{"i":"X"}]')) }, release)).toThrow(/aprobación/);
});

it('vincula cada corrección XML y HTML con sus cuatro alternativas, cita y huellas previa y posterior', () => {
  const changes = read('scripts/bank-editorial/reviewed-web.json');
  const bank = new Map(read('public/data/T3.08.json').map(row => [row.i, row]));
  const answers = {
    'GEN-T3.08-57.v2': 'Una declaración de tipo de documento (DOCTYPE).',
    'GEN-T3.08-316.v1': 'checked="checked".',
    'GEN-T3.08-351.v1': 'Los identificadores de los controles que contribuyen al resultado.',
    'GEN-T3.08-416.v2': '<br />',
  };
  expect(changes.map(change => change.id).sort()).toEqual(Object.keys(answers).sort());
  for (const change of changes) {
    const row = bank.get(change.id);
    expect(hash(row)).toBe(change.afterSha256);
    const prior = { ...row };
    for (const [key, value] of Object.entries(change.before)) {
      if (value === null) delete prior[key];
      else prior[key] = value;
    }
    expect(hash(prior)).toBe(change.beforeSha256);
    expect(row.a[row.c]).toBe(answers[row.i]);
    expect(change.reviewedOptions).toHaveLength(4);
    expect(change.reviewedOptions.every(Boolean)).toBe(true);
    expect(row.u).toBe(change.temario.quote + ' [p. ' + change.temario.page + ']');
    expect(row.n.length).toBeGreaterThan(20);
  }
});

it('revierte y reaplica con huellas exactas, admite reintentos y rechaza cambios intermedios sin pisarlos', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tai-candidate-'));
  const file = join(folder, 'T3.08.json');
  const run = action => spawnSync('python3', ['scripts/bank-editorial/replay.py', '--candidate-dir', folder, action], { encoding: 'utf8' });
  try {
    copyFileSync('public/data/T3.08.json', file);
    const approved = readFileSync(file);
    expect(run('--rollback').stdout).toContain('4 preguntas');
    expect(run('--rollback').stdout).toContain('0 preguntas');
    expect(run('--apply').stdout).toContain('4 preguntas');
    expect(readFileSync(file).equals(approved)).toBe(true);
    expect(run('--apply').stdout).toContain('0 preguntas');
    const modified = read(file);
    modified.find(q => q.i === 'GEN-T3.08-416.v2').c = 3;
    writeFileSync(file, JSON.stringify(modified));
    const drift = readFileSync(file);
    expect(run('--rollback').stderr).toContain('Huella inesperada: GEN-T3.08-416.v2');
    expect(readFileSync(file).equals(drift)).toBe(true);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

it('el publicador se detiene antes de cualquier GET o escritura al detectar un banco sin aprobar', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tai-publish-offline-'));
  try {
    const scripts = join(folder, 'scripts');
    const editorial = join(scripts, 'bank-editorial');
    const data = join(folder, 'public/data');
    mkdirSync(editorial, { recursive: true });
    mkdirSync(data, { recursive: true });
    copyFileSync('scripts/publish_bank.mjs', join(scripts, 'publish_bank.mjs'));
    writeFileSync(join(data, 'topic.json'), '[]');
    writeFileSync(join(editorial, 'release.json'), JSON.stringify({
      schemaVersion: 1, files: { 'topic.json': { approvedSha256: 'invalid' } },
    }));
    const stub = join(folder, 'offline.cjs');
    writeFileSync(stub, 'globalThis.fetch = () => { process.exit(79); };');
    const r = spawnSync(process.execPath, ['--require', stub, join(scripts, 'publish_bank.mjs')], {
      encoding: 'utf8', env: { ...process.env, ACCESS_TOKEN: 'offline-fixture' },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('sin aprobación editorial');
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

it.each([['T3.08', 7], ['T4.07', 2]])('reproduce el lote %s completo y mantiene las muestras y las cuatro opciones trazadas', (topic, count) => {
  const folder = mkdtempSync(join(tmpdir(), 'tai-topic-'));
  try {
    const name = topic + '.json', local = join(folder, name);
    copyFileSync(join('public/data', name), local);
    const approvedBytes = readFileSync(local);
    const approved = new Map(read(local).map(q => [q.i, q]));
    const sample = new Set(read(join('public/sample', name)).map(q => q.i));
    const ledger = read('scripts/bank-editorial/reviewed-' + name);
    expect(ledger).toHaveLength(count);
    for (const entry of ledger) {
      expect(hash(approved.get(entry.id))).toBe(entry.afterSha256);
      expect(approved.get(entry.id).u).toBe(entry.temario.quote + ' [p. ' + entry.temario.page + ']');
      expect(entry.reviewedOptions).toHaveLength(4);
      expect(entry.reviewedOptions.every(reason => reason.length > 10)).toBe(true);
      expect(sample.has(entry.id)).toBe(false);
    }
    const run = action => spawnSync('python3', ['scripts/bank-editorial/replay.py', '--candidate-dir', folder, '--batch', topic, action], { encoding: 'utf8' });
    expect(run('--rollback').stdout).toContain(count + ' preguntas');
    const original = new Map(read(local).map(q => [q.i, q]));
    for (const entry of ledger) expect(hash(original.get(entry.id))).toBe(entry.beforeSha256);
    expect(run('--apply').stdout).toContain(count + ' preguntas');
    expect(readFileSync(local).equals(approvedBytes)).toBe(true);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
