/**
 * codemod-rewrite-imports-tree.mts
 *
 * Phase 04: Rewrites import paths for tree-layer moves.
 * Handles both @/alias imports AND relative imports inside moved files.
 *
 * Usage:
 *   npx tsx scripts/codemod-rewrite-imports-tree.mts
 *
 * Tree directories moved:
 *   @/lib/admin/      → @/tree/admin/
 *   @/lib/audit/      → @/tree/audit/
 *   @/lib/byok/       → @/tree/byok/
 *   @/lib/clients/    → @/tree/clients/
 *   @/lib/credentials/→ @/tree/credentials/
 *   @/lib/crypto/     → @/tree/crypto/
 *   @/lib/gateway/    → @/tree/gateway/
 *   @/lib/handover/   → @/tree/handover/
 *   @/lib/telegram/   → @/tree/telegram/
 *   @/app/setup-wizard/components/ → @/tree/components/setup-wizard/
 */

import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(APP_DIR, 'src');
const TESTS_DIR = path.join(APP_DIR, 'tests');

type RewriteRule = [string, string];

// Ordered from most-specific to least-specific
const RULES: RewriteRule[] = [
  // lib subdirectories → tree
  ['@/lib/admin/', '@/tree/admin/'],
  ['@/lib/audit/', '@/tree/audit/'],
  ['@/lib/byok/', '@/tree/byok/'],
  ['@/lib/clients/', '@/tree/clients/'],
  ['@/lib/credentials/', '@/tree/credentials/'],
  ['@/lib/crypto/', '@/tree/crypto/'],
  ['@/lib/gateway/', '@/tree/gateway/'],
  ['@/lib/handover/', '@/tree/handover/'],
  ['@/lib/telegram/', '@/tree/telegram/'],
  // setup-wizard components (non-route)
  ['@/app/setup-wizard/components/', '@/tree/components/setup-wizard/'],
  // Phase 03 deferral: audit/crypto-utils dynamic import fix
  // Dynamic imports in seed/security/api-key-validator.test.ts:
  //   await import('@/lib/audit/crypto-utils') → '@/tree/audit/crypto-utils'
  // These are handled by the @/lib/audit/ rule above.
];

function applyRules(specifier: string): string {
  for (const [prefix, replacement] of RULES) {
    if (specifier === prefix || specifier.startsWith(prefix)) {
      return replacement + specifier.slice(prefix.length);
    }
  }
  return specifier;
}

// Tree directories (relative to SRC_DIR) with their new @/tree/... prefix
const TREE_GROUPS = [
  { dir: 'lib/admin', treePrefix: 'tree/admin' },
  { dir: 'lib/audit', treePrefix: 'tree/audit' },
  { dir: 'lib/byok', treePrefix: 'tree/byok' },
  { dir: 'lib/clients', treePrefix: 'tree/clients' },
  { dir: 'lib/credentials', treePrefix: 'tree/credentials' },
  { dir: 'lib/crypto', treePrefix: 'tree/crypto' },
  { dir: 'lib/gateway', treePrefix: 'tree/gateway' },
  { dir: 'lib/handover', treePrefix: 'tree/handover' },
  { dir: 'lib/telegram', treePrefix: 'tree/telegram' },
  { dir: 'app/setup-wizard/components', treePrefix: 'tree/components/setup-wizard' },
];

function walkDir(dir: string, cb: (f: string) => void): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, cb);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      cb(full);
    }
  }
}

function buildMovedFileAbsoluteToAliasMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const { dir, treePrefix } of TREE_GROUPS) {
    const dirPath = path.join(SRC_DIR, dir);
    walkDir(dirPath, (filePath) => {
      const rel = path.relative(dirPath, filePath);
      const noExt = rel.replace(/\.(ts|tsx)$/, '');
      map.set(filePath, `@/${treePrefix}/${noExt}`.replace(/\\/g, '/'));
    });
  }

  return map;
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(APP_DIR, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    addFilesFromTsConfig: false,
  });

  project.addSourceFilesAtPaths([
    path.join(SRC_DIR, '**/*.ts'),
    path.join(SRC_DIR, '**/*.tsx'),
    ...(fs.existsSync(TESTS_DIR)
      ? [path.join(TESTS_DIR, '**/*.ts'), path.join(TESTS_DIR, '**/*.tsx')]
      : []),
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`Loaded ${sourceFiles.length} source files`);

  const movedFileMap = buildMovedFileAbsoluteToAliasMap();
  console.log(`Move map: ${movedFileMap.size} tree files tracked`);

  let filesChanged = 0;
  let importsRewritten = 0;

  for (const sf of sourceFiles) {
    let fileChanged = false;
    const sfPath = sf.getFilePath();

    // 1. Rewrite @/alias imports
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

      // 2. Rewrite relative imports from within moving files
      if (moduleSpecifier.startsWith('.') && movedFileMap.has(sfPath)) {
        const sfDir = path.dirname(sfPath);
        let resolvedTarget = path.resolve(sfDir, moduleSpecifier);
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
          const aliasNoExt = targetAlias.replace(/\.(ts|tsx)$/, '');
          importDecl.setModuleSpecifier(aliasNoExt);
          fileChanged = true;
          importsRewritten++;
          console.log(
            `  [REL->ABS] ${path.relative(APP_DIR, sfPath)}: '${moduleSpecifier}' -> '${aliasNoExt}'`,
          );
        }
      }
    }

    // 3. Rewrite dynamic imports: await import('@/lib/audit/...')
    // ts-morph doesn't natively walk call expressions for module specifiers,
    // so we do a text-level fixup for dynamic import strings.
    const text = sf.getFullText();
    let newText = text;
    for (const [prefix, replacement] of RULES) {
      // Match dynamic import("@/lib/audit/...") or import('@/lib/byok/...')
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(import\\s*\\(\\s*['"\`])${escaped}`, 'g');
      const replaced = newText.replace(re, `$1${replacement}`);
      if (replaced !== newText) {
        const count = (newText.match(re) || []).length;
        importsRewritten += count;
        fileChanged = true;
        newText = replaced;
        console.log(
          `  [DYN-IMPORT] ${path.relative(APP_DIR, sfPath)}: dynamic import '${prefix}' -> '${replacement}'`,
        );
      }
    }
    if (newText !== text) {
      sf.replaceWithText(newText);
    }

    if (fileChanged) {
      filesChanged++;
    }
  }

  console.log(`\nSaving changes...`);
  await project.save();

  console.log(`\n=== Codemod (tree layer) complete ===`);
  console.log(`Files changed: ${filesChanged}`);
  console.log(`Imports rewritten: ${importsRewritten}`);
}

main().catch((err) => {
  console.error('Codemod failed:', err);
  process.exit(1);
});
