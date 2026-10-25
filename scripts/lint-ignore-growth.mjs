import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export function readIgnoreList(configText) {
  const block = configText.match(/ignores:\s*\[([\s\S]*?)\]/)?.[1];
  if (block === undefined) throw new Error('No se encontró el bloque ignores en eslint.config.mjs');
  return Array.from(block.matchAll(/'([^']+)'|"([^"]+)"/g), match => match[1] ?? match[2]);
}

export function findAddedIgnores(current, baseline) {
  const old = new Set(baseline);
  return current.filter(entry => !old.has(entry));
}

function matches(pattern, file) {
  let source = '^';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      source += '.*';
      index++;
    } else if (char === '*') source += '[^/]*';
    else source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`${source}$`).test(file);
}

export function findAddedCoverage(current, baseline, files) {
  return files.filter(file => current.some(pattern => matches(pattern, file))
    && !baseline.some(pattern => matches(pattern, file)));
}

function trackedFiles(ref) {
  const previous = execFileSync('git', ['ls-tree', '-r', '--name-only', ref], { encoding: 'utf8' });
  const current = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' });
  return [...new Set([...previous.split('\n'), ...current.split('\n')].filter(Boolean))];
}

function main() {
  const base = process.env.LINT_BASE_REF || 'HEAD^';
  const previous = execFileSync('git', ['show', `${base}:eslint.config.mjs`], { encoding: 'utf8' });
  const current = readFileSync('eslint.config.mjs', 'utf8');
  const added = findAddedCoverage(readIgnoreList(current), readIgnoreList(previous), trackedFiles(base));
  if (added.length) {
    console.error(`Se añadieron exclusiones de ESLint respecto a ${base}:\n${added.map(item => `  - ${item}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Sin nuevas exclusiones de ESLint respecto a ${base}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
