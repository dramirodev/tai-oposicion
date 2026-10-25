import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const normalized = value => value.replaceAll('\\', '/');
const layer = file => normalized(file).split('/')[1];
const legacy = file => /(?:^|\/)legacy(?:[./-]|$)|\/[^/]*legacy[^/]*\.[cm]?[jt]sx?$/.test(file);
function filesIn(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? filesIn(join(directory, entry.name)) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [join(directory, entry.name)] : []);
}
export function scanArchitecture(rootDirectory) {
  const root = resolve(rootDirectory), configPath = ts.findConfigFile(root, ts.sys.fileExists);
  const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile).config : {};
  const options = ts.parseJsonConfigFileContent(config, ts.sys, root).options;
  const findings = new Map();
  function add(file, kind, detail) {
    const key = JSON.stringify([file, kind, detail]), old = findings.get(key);
    findings.set(key, { file, kind, detail, count: (old?.count || 0) + 1 });
  }
  for (const absolute of filesIn(join(root, 'src'))) {
    const file = normalized(relative(root, absolute)), text = readFileSync(absolute, 'utf8');
    if (legacy(file)) add(file, 'legacy-module', file);
    const source = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true);
    function dependency(specifier) {
      const resolved = ts.resolveModuleName(specifier, absolute, options, ts.sys).resolvedModule?.resolvedFileName;
      const target = resolved && !resolved.includes('node_modules') ? normalized(relative(root, resolved))
        : specifier.startsWith('.') ? normalized(relative(root, resolve(dirname(absolute), specifier))) : specifier;
      if (legacy(target)) add(file, 'legacy-import', target);
      if (layer(file) === 'core' && /^(react(?:-dom|-router)?|firebase|zustand|idb|zod)(\/|$)/.test(specifier)) add(file, 'core-package', specifier);
      const forbidden = {
        core: ['adapters', 'app', 'features', 'shared'],
        adapters: ['app', 'features', 'shared'],
        features: ['adapters', 'app'], shared: ['adapters', 'app'],
      };
      if (target.startsWith('src/') && (forbidden[layer(file)] || []).includes(layer(target))) add(file, 'layer-import', target);
      if (target.startsWith('src/') && (/\/(dto|view-models)\//.test(target)) &&
        (layer(file) !== layer(target) || layer(file) !== 'adapters' && !file.startsWith(dirname(target) + '/'))) add(file, 'representation-import', target);
      if (layer(file) === 'adapters' && target.startsWith('src/core/application/')) add(file, 'layer-import', target);
    }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependency(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) dependency(node.arguments[0].text);
      const property = expression => ts.isPropertyAccessExpression(expression) ? expression.name.text
        : ts.isElementAccessExpression(expression) && expression.argumentExpression && ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : '';
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && ['innerHTML', 'outerHTML'].includes(property(node.left))) add(file, 'html-write', property(node.left));
      if (ts.isCallExpression(node) && property(node.expression) === 'insertAdjacentHTML') add(file, 'html-write', 'insertAdjacentHTML');
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'dangerouslySetInnerHTML') add(file, 'html-write', 'dangerouslySetInnerHTML');
      ts.forEachChild(node, visit);
    }
    visit(source);
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, source.languageVariant, text);
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if ([ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia].includes(token)) {
        const directives = scanner.getTokenText().match(/eslint-disable(?:-next-line|-line)?\b[^\r\n*]*/g) || [];
        directives.forEach(directive => add(file, 'lint-disable', directive.trim()));
      }
    }
  }
  return [...findings.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function baselineGrowth(current, previous) {
  const key = item => JSON.stringify([item.file, item.kind, item.detail]);
  const allowed = new Map(previous.map(item => [key(item), item.count]));
  return current.filter(item => item.count > (allowed.get(key(item)) || 0));
}
export function checkArchitecture(rootDirectory, baselinePath = 'scripts/architecture-baseline.json') {
  const current = scanArchitecture(rootDirectory);
  const baseline = JSON.parse(readFileSync(resolve(rootDirectory, baselinePath), 'utf8'));
  if (!Array.isArray(baseline) || baseline.some(item => !item.reason || !item.task || !Number.isInteger(item.count) || item.count < 1)) throw new Error('Baseline de arquitectura inválida: cada excepción necesita razón, tarea y recuento.');
  const key = item => JSON.stringify([item.file, item.kind, item.detail]);
  const allowed = new Map(baseline.map(item => [key(item), item.count]));
  return { violations: current.filter(item => item.count > (allowed.get(key(item)) || 0)), findings: current };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.cwd();
  const { violations, findings } = checkArchitecture(root);
  const ref = process.env.ARCHITECTURE_BASE_REF || 'HEAD';
  let previous;
  try { previous = execFileSync('git', ['show', `${ref}:scripts/architecture-baseline.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) {
    // The first adoption has no baseline. Only that specific missing path is allowed.
    const stderr = String(error.stderr || '');
    if (!stderr.includes('does not exist in') && !stderr.includes('exists on disk, but not in')) throw error;
  }
  if (previous) {
    const current = JSON.parse(readFileSync(join(root, 'scripts/architecture-baseline.json'), 'utf8'));
    violations.push(...baselineGrowth(current, JSON.parse(previous)).map(item => ({ ...item, kind: 'baseline-growth' })));
  }
  if (violations.length) {
    console.error('Nuevas violaciones de arquitectura:\n' + violations.map(item => `${item.file}: ${item.kind} ${item.detail} (${item.count})`).join('\n'));
    process.exitCode = 1;
  } else console.log(`Arquitectura: sin deuda nueva; ${findings.length} excepciones pendientes.`);
}
