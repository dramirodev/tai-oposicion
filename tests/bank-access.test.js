import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { SAMPLE_SIZE, buildSample, pickSample } from '../scripts/build_sample.mjs';
import { loadLocal } from '../scripts/publish_bank.mjs';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const topicFiles = readdirSync('public/data').filter(file => /^T\d\.\d\d\.json$/.test(file)).sort();
const globToRegExp = glob => new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*') + '$');
const hostingIgnored = path => read('firebase.json').hosting.ignore.some(glob => globToRegExp(glob).test(path));

it('picks a deterministic, evenly spread sample of active questions', () => {
  const questions = Array.from({ length: 100 }, (_, index) => ({ i: `Q-${index}` }));
  const meta = { 'Q-0': ['T1.01', 'O', 'I', [], 2, 'Q-99'] };

  const sample = pickSample(questions, meta);

  expect(sample).toHaveLength(SAMPLE_SIZE);
  expect(sample).toEqual(pickSample(questions, meta));
  expect(sample.map(question => question.i)).not.toContain('Q-0');
  expect(new Set(sample.map(question => question.i)).size).toBe(SAMPLE_SIZE);
  expect(pickSample(questions.slice(0, 4), {})).toHaveLength(4);
});

it('publishes ten questions per topic and nothing that is not in the full bank', () => {
  const meta = read('public/data/meta.json');
  expect(readdirSync('public/sample').sort()).toEqual(topicFiles);
  for (const file of topicFiles) {
    const sample = read(join('public/sample', file)), bank = new Map(read(join('public/data', file)).map(question => [question.i, question]));
    expect(sample.length, file).toBeGreaterThan(0);
    expect(sample.length, file).toBeLessThanOrEqual(SAMPLE_SIZE);
    for (const question of sample) {
      expect(bank.get(question.i), `${file} ${question.i}`).toEqual(question);
      expect(meta[question.i]?.[5], `${question.i} retirada`).toBeFalsy();
    }
  }
});

it('keeps the committed sample in sync with the generator', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tai-sample-'));

  buildSample('public/data', directory);

  for (const file of topicFiles) expect(readFileSync(join(directory, file), 'utf8'), file).toBe(readFileSync(join('public/sample', file), 'utf8'));
});

it('does not deploy the full bank, the scenarios or the cards, but keeps what guests need', () => {
  for (const file of topicFiles) expect(hostingIgnored(`data/${file}`), file).toBe(true);
  expect(hostingIgnored('data/supuestos.json')).toBe(true);
  for (const file of readdirSync('public/cards')) expect(hostingIgnored(`cards/${file}`), file).toBe(true);
  for (const file of readdirSync('public/explanations')) expect(hostingIgnored(`explanations/${file}`), file).toBe(true);
  for (const file of ['data/index.json', 'data/meta.json', 'sw.js', 'index.html', ...topicFiles.map(topic => `sample/${topic}`)]) {
    expect(hostingIgnored(file), file).toBe(false);
  }
});

it('does not precache private files in the service worker shell, which would break its installation once they are not deployed', () => {
  for (const file of ['public/sw.js', 'vite.config.mjs']) {
    const shell = /(?:const SHELL|const shell) = \[[^\]]*\]/.exec(readFileSync(file, 'utf8'))?.[0] ?? '';
    expect(shell, file).toContain('index.html');
    expect(shell, file).not.toMatch(/explanations|cards\/|data\/T/);
  }
});

it('publishes the bank and the cards to Firestore without name collisions', () => {
  const published = Object.keys(loadLocal());

  expect(published).toEqual(expect.arrayContaining(['index', 'meta', 'supuestos', 'T1.01', 'cards_index', 'cards_T1.01', 'explanations_index']));
  expect(new Set(published).size).toBe(published.length);
  expect(published.some(name => name.startsWith('sample'))).toBe(false);
});

it('still publishes the bank when there are no cards or explanations directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'tai-publish-')), data = join(root, 'data');
  mkdirSync(data);
  writeFileSync(join(data, 'T1.01.json'), '[]');

  expect(Object.keys(loadLocal(data, join(root, 'cards'), join(root, 'explanations')))).toEqual(['T1.01']);
});
