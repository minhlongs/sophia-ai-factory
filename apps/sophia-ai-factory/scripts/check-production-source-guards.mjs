import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const sourceRoot = resolve('src');
const excludedConsoleFiles = new Set([
  'seed/utils/logger-internals.ts',
  'seed/utils/logger/logger-internals.ts',
  'seed/utils/crypto-utils-signing.ts',
]);
const violations = [];

function isExcludedTestFile(filePath) {
  const normalized = relative(sourceRoot, filePath).split(sep).join('/');
  return (
    normalized.split('/').some((segment) => segment === '__tests__' || segment === 'test') ||
    /\.(test|spec)\.(ts|tsx)$/.test(normalized)
  );
}

async function listTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) return [path];
    return [];
  }));
  return nested.flat();
}

function reportViolation(filePath, sourceFile, node, rule) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  violations.push(`${relative(process.cwd(), filePath)}:${line + 1}: ${rule}`);
}

for (const filePath of await listTypeScriptFiles(sourceRoot)) {
  if (isExcludedTestFile(filePath)) continue;

  const source = await readFile(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const relativePath = relative(sourceRoot, filePath).split(sep).join('/');
  const checkConsole = !excludedConsoleFiles.has(relativePath) && !relativePath.startsWith('sdk/');

  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      reportViolation(filePath, sourceFile, node, 'explicit any type');
    }

    if (
      checkConsole &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'console' &&
      ['log', 'warn', 'error'].includes(node.expression.name.text)
    ) {
      reportViolation(filePath, sourceFile, node, `console.${node.expression.name.text} call`);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  console.error(`FAIL: ${violations.length} production source guard violation(s)`);
  process.exit(1);
}

console.log('PASS: no explicit any types or prohibited console calls in production source');
