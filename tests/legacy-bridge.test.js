import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

it('mantiene la app fuera del antiguo puente DOM imperativo', () => {
  const root = join(process.cwd(), 'src');
  const files = sourceFiles(root);
  expect(existsSync(join(root, 'shared/ui/legacy-dom.ts'))).toBe(false);
  expect(existsSync(join(root, 'app/legacy-router.ts'))).toBe(false);
  expect(files.every(file => !readFileSync(file, 'utf8').includes('legacy-dom'))).toBe(true);
  expect(existsSync(join(root, 'app/app-services-composition.ts'))).toBe(true);
});
