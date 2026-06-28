/**
 * codemod-rewrite-imports-land.mts
 *
 * Phase 06: Rewrites import paths for land-layer moves.
 * Handles both @/alias imports AND relative imports inside moved files.
 *
 * Usage:
 *   npx tsx scripts/codemod-rewrite-imports-land.mts
 *
 * Land directories moved (all lib/* → land/*):
 *   @/lib/billing/         → @/land/billing/
 *   @/lib/payments/        → @/land/payments/
 *   @/lib/status/          → @/land/status/
 *   @/lib/affiliates/      → @/land/affiliates/
 *   @/lib/affiliates       → @/land/affiliates (loose file)
 *   @/lib/checkout/        → @/land/checkout/
 *   @/lib/orders/          → @/land/orders/
 *   @/lib/payouts/         → @/land/payouts/
 *   @/lib/promo/           → @/land/promo/
 *   @/lib/refunds/         → @/land/refunds/
 *   @/lib/wallet/          → @/land/wallet/
 */

import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(APP_DIR, 'src');
const TESTS_DIR = path.join(APP_DIR, 'tests');

type RewriteRule = [string, string];

// Ordered most-specific to least-specific to avoid prefix conflicts
const RULES: RewriteRule[] = [
  // lib subdirectories → land
  ['@/lib/billing/', '@/land/billing/'],
  ['@/lib/payments/', '@/land/payments/'],
  ['@/lib/status/', '@/land/status/'],
  ['@/lib/affiliates/', '@/land/affiliates/'],
  ['@/lib/checkout/', '@/land/checkout/'],
  ['@/lib/orders/', '@/land/orders/'],
  ['@/lib/payouts/', '@/land/payouts/'],
  ['@/lib/promo/', '@/land/promo/'],
  ['@/lib/refunds/', '@/land/refunds/'],
  ['@/lib/wallet/', '@/land/wallet/'],

  // Loose affiliates.ts at lib root (bare import)
  ['@/lib/affiliates', '@/land/affiliates'],
];

function applyRules(specifier: string): string {
  for (const [prefix, replacement] of RULES) {
    if (prefix.endsWith('/')) {
      // Directory-style prefix
      if (specifier.startsWith(prefix)) {
        return replacement + specifier.slice(prefix.length);
      }
    } else {
      // Bare prefix — match exact or sub-path
      if (specifier === prefix || specifier.startsWith(prefix + '/')) {
        return replacement + specifier.slice(prefix.length);
      }
    }
  }
  return specifier;
}

// Land directories (relative to SRC_DIR) with their new @/land/... prefix
const LAND_GROUPS = [
  { dir: 'lib/billing', landPrefix: 'land/billing' },
  { dir: 'lib/payments', landPrefix: 'land/payments' },
  { dir: 'lib/status', landPrefix: 'land/status' },
  { dir: 'lib/affiliates', landPrefix: 'land/affiliates' },
  { dir: 'lib/checkout', landPrefix: 'land/checkout' },
  { dir: 'lib/orders', landPrefix: 'land/orders' },
  { dir: 'lib/payouts', landPrefix: 'land/payouts' },
  { dir: 'lib/promo', landPrefix: 'land/promo' },
  { dir: 'lib/refunds', landPrefix: 'land/refunds' },
  { dir: 'lib/wallet', landPrefix: 'land/wallet' },
];

// Loose affiliates.ts at lib root
const LOOSE_LAND_FILES = ['affiliates'];

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

  for (const { dir, landPrefix } of LAND_GROUPS) {
    const dirPath = path.join(SRC_DIR, dir);
    walkDir(dirPath, (filePath) => {
      const rel = path.relative(dirPath, filePath);
      const noExt = rel.replace(/\.(ts|tsx)$/, '');
      map.set(filePath, `@/${landPrefix}/${noExt}`.replace(/\\/g, '/'));
    });
  }

  // Add loose land files at lib root
  for (const name of LOOSE_LAND_FILES) {
    for (const ext of ['.ts', '.tsx']) {
      const filePath = path.join(SRC_DIR, 'lib', `${name}${ext}`);
      if (fs.existsSync(filePath)) {
        map.set(filePath, `@/land/${name}`);
      }
    }
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
  console.log(`Move map: ${movedFileMap.size} land files tracked`);

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
        console.log(
          `  [REWRITE] ${path.relative(APP_DIR, sfPath)}: '${moduleSpecifier}' -> '${newSpecifier}'`,
        );
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

    // 3. Rewrite dynamic imports: await import('@/lib/...')
    const text = sf.getFullText();
    let newText = text;
    for (const [prefix, replacement] of RULES) {
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

  console.log(`\n=== Codemod (land layer) complete ===`);
  console.log(`Files changed: ${filesChanged}`);
  console.log(`Imports rewritten: ${importsRewritten}`);
}

main().catch((err) => {
  console.error('Codemod failed:', err);
  process.exit(1);
});
