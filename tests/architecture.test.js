import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { baselineGrowth, checkArchitecture, scanArchitecture } from '../scripts/check-architecture.mjs';
const roots = [];
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'tai-architecture-')); roots.push(root);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), body);
  }
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@adapters/*': ['src/adapters/*'] } } }));
  return root;
}
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
describe('architecture migration boundaries', () => {
  it('rejects static, reexported, dynamic and aliased infrastructure from core', () => {
    const root = fixture({ 'src/core/domain/rules.ts': "import '@adapters/db'; export * from '../../adapters/db'; const load = () => import('../../adapters/db');", 'src/adapters/db.ts': 'export const db = 1;' });
    expect(scanArchitecture(root).filter(x => x.kind === 'layer-import').reduce((sum, item) => sum + item.count, 0)).toBe(1);
  });
  it('rejects frameworks and migration packages in the core', () => {
    const root = fixture({ 'src/core/application/actions.ts': "import 'zustand/vanilla'; import 'zod'; import 'idb';" });
    expect(scanArchitecture(root).filter(x => x.kind === 'core-package')).toHaveLength(3);
  });
  it('rejects new legacy modules, dependencies, DOM rendering and eslint directives', () => {
    const root = fixture({ 'src/app/new.ts': "import '../old/legacy'; node.innerHTML = 'x'; node.insertAdjacentHTML('beforeend', 'x'); // eslint-disable-next-line\n node['outerHTML'] = 'y';", 'src/old/legacy.ts': '' });
    expect(new Set(scanArchitecture(root).map(x => x.kind))).toEqual(new Set(['legacy-module', 'legacy-import', 'html-write', 'lint-disable']));
  });
  it('allows legacy dependencies only in app composition roots', () => {
    const root = fixture({
      'src/app/stats-composition.ts': "import '../core/application/legacy-engine';",
      'src/features/stats/page.tsx': "import '../../core/application/legacy-engine';",
    });
    const legacyImports = scanArchitecture(root).filter(item => item.kind === 'legacy-import');
    expect(legacyImports).toHaveLength(1);
    expect(legacyImports[0].file).toBe('src/features/stats/page.tsx');
  });
  it('allows only the exact existing debt and detects a second occurrence and moved debt', () => {
    const root = fixture({ 'src/app/view.ts': "node.innerHTML = 'x';" });
    const baseline = scanArchitecture(root).map(item => ({ ...item, reason: 'existing renderer', task: 'phase-1' }));
    writeFileSync(join(root, 'baseline.json'), JSON.stringify(baseline));
    expect(checkArchitecture(root, 'baseline.json').violations).toEqual([]);
    writeFileSync(join(root, 'src/app/view.ts'), "node.innerHTML = 'x'; node.innerHTML = 'y';");
    expect(checkArchitecture(root, 'baseline.json').violations).toHaveLength(1);
    writeFileSync(join(root, 'src/app/renamed.ts'), "node.innerHTML = 'x';");
    expect(checkArchitecture(root, 'baseline.json').violations.some(x => x.file.endsWith('renamed.ts'))).toBe(true);
  });
  it('rejects widening the exception manifest itself', () => {
    const existing = { file: 'src/app/view.ts', kind: 'html-write', detail: 'innerHTML', count: 1 };
    expect(baselineGrowth([{ ...existing, count: 2 }], [existing])).toHaveLength(1);
    expect(baselineGrowth([{ ...existing, file: 'src/app/new.ts' }], [existing])).toHaveLength(1);
    expect(baselineGrowth([], [existing])).toEqual([]);
  });
  it('ignores comments and string literals that mention dependencies', () => {
    const root = fixture({ 'src/core/domain/rules.ts': "// import 'react';\nconst text = `node.innerHTML = 'x'; import('idb')`;" });
    expect(scanArchitecture(root)).toEqual([]);
  });
});
  it('rejects type-only imports and constant-template dynamic imports from legacy adapters', () => {
    const root = fixture({
      'src/core/domain/types.ts': "export type Leaked = import('../../adapters/db').Db; export type AlsoLeaked = import(`../../adapters/db`).Db;",
      'src/core/application/load.ts': 'export const load = () => import(`../../adapters/db`);',
      'src/adapters/db.ts': 'export interface Db {}',
    });
    const findings = scanArchitecture(root).filter(item => item.kind === 'layer-import');
    expect(findings.reduce((sum, item) => sum + item.count, 0)).toBe(2);
    expect(findings.some(item => item.file.endsWith('load.ts'))).toBe(true);
  });
