/**
 * codemod-rewrite-imports.mts
 *
 * Rewrites import paths across all TS/TSX files in src/ and tests/
 * according to a JSON map of { oldAliasPattern: newAliasPattern }.
 *
 * Usage:
 *   npx tsx scripts/codemod-rewrite-imports.mts
 *
 * The script applies the hardcoded seed-layer move map.
 * Run ONCE before git mv to validate import rewrites; run again
 * if codemod needs re-application.
 */

import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';
import fs from 'fs';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(APP_DIR, 'src');
const TESTS_DIR = path.join(APP_DIR, 'tests');

// -----------------------------------------------------------------------
// Import rewrite rules: ordered from most-specific to least-specific.
// Each entry: [matchPrefix, replacePrefix]
// The codemod replaces `from 'matchPrefix...'` with `from 'replacePrefix...'`
// -----------------------------------------------------------------------
type RewriteRule = [string, string];

const RULES: RewriteRule[] = [
  // Standalone better-auth files (before generic @/lib/ rule)
  ['@/lib/better-auth-client', '@/seed/auth/better-auth-client'],
  ['@/lib/better-auth-server', '@/seed/auth/better-auth-server'],
  ['@/lib/better-auth-session', '@/seed/auth/better-auth-session'],
  // lib subdirectories
  ['@/lib/db/', '@/seed/db/'],
  ['@/lib/utils/', '@/seed/utils/'],
  ['@/lib/security/', '@/seed/security/'],
  ['@/lib/health/', '@/seed/health/'],
  ['@/lib/auth/', '@/seed/auth/'],
  // top-level directories
  ['@/types/', '@/seed/types/'],
  ['@/config/', '@/seed/config/'],
  ['@/components/ui/', '@/seed/components/ui/'],
];

// -----------------------------------------------------------------------
// Relative path fixes for files that will MOVE.
// When a file at old path A imports from relative '../foo', after moving
// to new path B the relative import may be wrong.
// We handle this by converting all relative imports between moved files
// to absolute @/seed/... imports.
// -----------------------------------------------------------------------

function applyRules(specifier: string): string {
  for (const [prefix, replacement] of RULES) {
    if (specifier === prefix || specifier.startsWith(prefix)) {
      return replacement + specifier.slice(prefix.length);
    }
  }
  return specifier;
}

// Files that will move: their current absolute path -> new @/seed/... path
// Used to rewrite relative imports between moved files
function buildMovedFileAbsoluteToAliasMap(): Map<string, string> {
  const map = new Map<string, string>();

  const groups = [
    { dir: 'lib/db', seedPrefix: 'seed/db' },
    { dir: 'lib/utils', seedPrefix: 'seed/utils' },
    { dir: 'lib/security', seedPrefix: 'seed/security' },
    { dir: 'lib/health', seedPrefix: 'seed/health' },
    { dir: 'lib/auth', seedPrefix: 'seed/auth' },
    { dir: 'types', seedPrefix: 'seed/types' },
    { dir: 'config', seedPrefix: 'seed/config' },
    { dir: 'components/ui', seedPrefix: 'seed/components/ui' },
  ];

  const baFiles = ['better-auth-client', 'better-auth-server', 'better-auth-session'];

  for (const { dir, seedPrefix } of groups) {
    const dirPath = path.join(SRC_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    walkDir(dirPath, (filePath) => {
      const rel = path.relative(dirPath, filePath);
      const noExt = rel.replace(/\.(ts|tsx)$/, '');
      map.set(filePath, `@/${seedPrefix}/${noExt}`.replace(/\\/g, '/'));
    });
  }

  for (const ba of baFiles) {
    const p = path.join(SRC_DIR, 'lib', `${ba}.ts`);
    if (fs.existsSync(p)) {
      map.set(p, `@/seed/auth/${ba}`);
    }
  }

  return map;
}

function walkDir(dir: string, cb: (f: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, cb);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      cb(full);
    }
  }
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(APP_DIR, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    addFilesFromTsConfig: false,
  });

  // Add all TS/TSX source files
  project.addSourceFilesAtPaths([
    path.join(SRC_DIR, '**/*.ts'),
    path.join(SRC_DIR, '**/*.tsx'),
    ...(fs.existsSync(TESTS_DIR) ? [path.join(TESTS_DIR, '**/*.ts'), path.join(TESTS_DIR, '**/*.tsx')] : []),
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`Loaded ${sourceFiles.length} source files`);

  const movedFileMap = buildMovedFileAbsoluteToAliasMap();
  console.log(`Move map: ${movedFileMap.size} files tracked`);

  let filesChanged = 0;
  let importsRewritten = 0;

  for (const sf of sourceFiles) {
    let fileChanged = false;
    const sfPath = sf.getFilePath();

    const importDecls = sf.getImportDeclarations();
    for (const importDecl of importDecls) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const newSpecifier = applyRules(moduleSpecifier);

      if (newSpecifier !== moduleSpecifier) {
        importDecl.setModuleSpecifier(newSpecifier);
        fileChanged = true;
        importsRewritten++;
        console.log(`  [REWRITE] ${path.relative(APP_DIR, sfPath)}: '${moduleSpecifier}' -> '${newSpecifier}'`);
        continue;
      }

      // Handle relative imports from within moving files
      if (moduleSpecifier.startsWith('.') && movedFileMap.has(sfPath)) {
        // This file is moving; check if its relative target is also moving
        const sfDir = path.dirname(sfPath);
        let resolvedTarget = path.resolve(sfDir, moduleSpecifier);
        // Try with extensions
        for (const ext of ['.ts', '.tsx', '.js']) {
          if (fs.existsSync(resolvedTarget + ext)) {
            resolvedTarget = resolvedTarget + ext;
            break;
          }
          const indexPath = path.join(resolvedTarget, `index${ext}`);
          if (fs.existsSync(indexPath)) {
            resolvedTarget = indexPath;
            break;
          }
        }

        const targetAlias = movedFileMap.get(resolvedTarget);
        if (targetAlias) {
          // Strip extension from alias
          const aliasNoExt = targetAlias.replace(/\.(ts|tsx)$/, '');
          importDecl.setModuleSpecifier(aliasNoExt);
          fileChanged = true;
          importsRewritten++;
          console.log(`  [REL->ABS] ${path.relative(APP_DIR, sfPath)}: '${moduleSpecifier}' -> '${aliasNoExt}'`);
        }
      }
    }

    if (fileChanged) {
      filesChanged++;
    }
  }

  console.log(`\nSaving changes...`);
  await project.save();

  console.log(`\n=== Codemod complete ===`);
  console.log(`Files changed: ${filesChanged}`);
  console.log(`Imports rewritten: ${importsRewritten}`);
}

main().catch((err) => {
  console.error('Codemod failed:', err);
  process.exit(1);
});
