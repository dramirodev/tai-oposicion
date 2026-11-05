import { afterAll, expect, it } from 'vitest';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporaryRoots = [];
afterAll(() => temporaryRoots.forEach(root => rmSync(root, { recursive: true, force: true })));

it('restaura los snapshots del candidato aunque falle la comparación visual', () => {
  const root = mkdtemp();
  const fixture = join(root, 'baseline-fixture');
  const checkout = join(root, 'candidate');
  const fakeBin = join(root, 'fake-bin');
  const baselineImage = 'baseline-image';
  const candidateImage = 'candidate-image';
  const imagePath = 'tests/e2e/snapshots/chromium-darwin/home-light.png';
  const baselineImageFile = join(fixture, imagePath);
  const candidateImageFile = join(checkout, imagePath);
  mkdirSync(join(fixture, 'tests/e2e/snapshots/chromium-darwin'), { recursive:true });
  mkdirSync(join(checkout, 'scripts'), { recursive:true });
  mkdirSync(join(checkout, 'tests/e2e/snapshots/chromium-darwin'), { recursive:true });
  mkdirSync(fakeBin, { recursive:true });
  writeFileSync(baselineImageFile, baselineImage);
  writeFileSync(candidateImageFile, candidateImage);
  writeFileSync(join(checkout, 'tests/e2e/snapshots/chromium-darwin/candidate-only.png'), 'candidate-only');
  writeFileSync(join(checkout, 'tests/e2e/baseline-ref.txt'), 'a'.repeat(40));
  writeFileSync(join(checkout, 'scripts/e2e-baseline.mjs'), readFileSync(resolve('scripts/e2e-baseline.mjs')));
  writeExecutable(join(fakeBin, 'git'), '#!/bin/sh\nexec /usr/bin/tar -cf - -C "$BASELINE_FIXTURE" .\n');
  writeExecutable(join(fakeBin, 'npm'), '#!/bin/sh\nif [ "$1" = "run" ] && [ "$2" = "test:e2e" ]; then\n  test "$(cat tests/e2e/snapshots/chromium-darwin/home-light.png)" = baseline-image || exit 12\n  exit 23\nfi\nexit 0\n');
  writeExecutable(join(fakeBin, 'npx'), '#!/bin/sh\nexit 0\n');

  const child = spawnSync(process.execPath, [join(checkout, 'scripts/e2e-baseline.mjs')], {
    cwd:checkout,
    encoding:'utf8',
    env:{ ...process.env, PATH:`${fakeBin}:${process.env.PATH}`, BASELINE_FIXTURE:fixture },
  });

  expect(child.status).not.toBe(0);
  expect(readFileSync(candidateImageFile, 'utf8')).toBe(candidateImage);
  expect(readFileSync(join(checkout, 'tests/e2e/snapshots/chromium-darwin/candidate-only.png'), 'utf8')).toBe('candidate-only');

  function mkdtemp() {
    const directory = join(tmpdir(), `tai-baseline-runner-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(directory, { recursive:true });
    temporaryRoots.push(directory);
    return directory;
  }
  function writeExecutable(path, contents) {
    writeFileSync(path, contents);
    chmodSync(path, 0o755);
  }
});
