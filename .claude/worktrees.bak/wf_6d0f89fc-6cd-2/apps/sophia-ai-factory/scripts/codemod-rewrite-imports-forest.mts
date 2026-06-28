/**
 * codemod-rewrite-imports-forest.mts
 *
 * Phase 05: Rewrites import paths for forest-layer moves.
 * Handles both @/alias imports AND relative imports inside moved files.
 *
 * Usage:
 *   npx tsx scripts/codemod-rewrite-imports-forest.mts
 *
 * Forest directories moved:
 *   @/lib/agents/         → @/forest/agents/
 *   @/lib/email/          → @/forest/email/
 *   @/lib/api-keys/       → @/forest/api-keys/
 *   @/lib/outbox/         → @/forest/outbox/
 *   @/lib/quota/          → @/forest/quota/
 *   @/lib/usage-metering/ → @/forest/usage-metering/
 *   @/lib/missions/       → @/forest/missions/
 *   @/lib/raas/           → @/forest/raas/
 *   @/lib/inngest/        → @/forest/inngest/
 *   @/lib/raas-*          → @/forest/raas-* (loose raas files at lib root)
 *   @/components/         → @/forest/components/
 *   @/hooks/              → @/forest/hooks/
 *   @/middleware/         → @/forest/middleware/ (NOT middleware.ts root)
 *   @/worker/             → @/forest/worker/
 *
 * Relative import fixes in entry files (middleware.ts, middleware-api-handler.ts):
 *   ./lib/usage-metering  → @/forest/usage-metering
 *   ./lib/raas-gate       → @/forest/raas-gate
 *   ./lib/signals/*       → stays (signals not moved in phase 05)
 *   ./middleware/tenant-isolation → @/forest/middleware/tenant-isolation
 */

import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(APP_DIR, 'src');
const TESTS_DIR = path.join(APP_DIR, 'tests');

type RewriteRule = [string, string];

// Ordered from most-specific to least-specific to avoid prefix conflicts
const RULES: RewriteRule[] = [
  // lib subdirectories → forest
  ['@/lib/agents/', '@/forest/agents/'],
  ['@/lib/email/', '@/forest/email/'],
  ['@/lib/api-keys/', '@/forest/api-keys/'],
  ['@/lib/outbox/', '@/forest/outbox/'],
  ['@/lib/quota/', '@/forest/quota/'],
  ['@/lib/usage-metering/', '@/forest/usage-metering/'],
  ['@/lib/missions/', '@/forest/missions/'],
  ['@/lib/raas/', '@/forest/raas/'],
  ['@/lib/inngest/', '@/forest/inngest/'],

  // Loose raas-* files at lib root (exact matches + prefix)
  ['@/lib/raas-audit', '@/forest/raas-audit'],
  ['@/lib/raas-gate', '@/forest/raas-gate'],
  ['@/lib/raas-gateway-client', '@/forest/raas-gateway-client'],
  ['@/lib/raas-gateway-types', '@/forest/raas-gateway-types'],
  ['@/lib/raas-key-generator', '@/forest/raas-key-generator'],
  ['@/lib/raas-schema', '@/forest/raas-schema'],
  ['@/lib/raas-service-key-operations', '@/forest/raas-service-key-operations'],
  ['@/lib/raas-service-types-and-constants', '@/forest/raas-service-types-and-constants'],
  ['@/lib/raas-service', '@/forest/raas-service'],

  // Top-level directories → forest
  ['@/components/', '@/forest/components/'],
  ['@/hooks/', '@/forest/hooks/'],
  ['@/middleware/', '@/forest/middleware/'],
  ['@/worker/', '@/forest/worker/'],
];

function applyRules(specifier: string): string {
  for (const [prefix, replacement] of RULES) {
    if (prefix.endsWith('/')) {
      // Directory-style prefix: match if specifier starts with prefix
      if (specifier.startsWith(prefix)) {
        return replacement + specifier.slice(prefix.length);
      }
    } else {
      // Bare prefix (loose files like '@/lib/raas-gate'):
      // match exact or sub-path like '@/lib/raas-gate/something'
      if (specifier === prefix || specifier.startsWith(prefix + '/')) {
        return replacement + specifier.slice(prefix.length);
      }
    }
  }
  return specifier;
}

// Forest directories (relative to SRC_DIR) with their new @/forest/... prefix
const FOREST_GROUPS = [
  { dir: 'lib/agents', forestPrefix: 'forest/agents' },
  { dir: 'lib/email', forestPrefix: 'forest/email' },
  { dir: 'lib/api-keys', forestPrefix: 'forest/api-keys' },
  { dir: 'lib/outbox', forestPrefix: 'forest/outbox' },
  { dir: 'lib/quota', forestPrefix: 'forest/quota' },
  { dir: 'lib/usage-metering', forestPrefix: 'forest/usage-metering' },
  { dir: 'lib/missions', forestPrefix: 'forest/missions' },
  { dir: 'lib/raas', forestPrefix: 'forest/raas' },
  { dir: 'lib/inngest', forestPrefix: 'forest/inngest' },
  { dir: 'components', forestPrefix: 'forest/components' },
  { dir: 'hooks', forestPrefix: 'forest/hooks' },
  { dir: 'middleware', forestPrefix: 'forest/middleware' },
  { dir: 'worker', forestPrefix: 'forest/worker' },
];

// Loose raas-* files at lib root that move to forest root
const LOOSE_RAAS_FILES = [
  'raas-audit',
  'raas-gate',
  'raas-gateway-client',
  'raas-gateway-types',
  'raas-key-generator',
  'raas-schema',
  'raas-service-key-operations',
  'raas-service-types-and-constants',
  'raas-service',
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

  for (const { dir, forestPrefix } of FOREST_GROUPS) {
    const dirPath = path.join(SRC_DIR, dir);
    walkDir(dirPath, (filePath) => {
      const rel = path.relative(dirPath, filePath);
      const noExt = rel.replace(/\.(ts|tsx)$/, '');
      map.set(filePath, `@/${forestPrefix}/${noExt}`.replace(/\\/g, '/'));
    });
  }

  // Add loose raas-* files
  for (const name of LOOSE_RAAS_FILES) {
    for (const ext of ['.ts', '.tsx']) {
      const filePath = path.join(SRC_DIR, 'lib', `${name}${ext}`);
      if (fs.existsSync(filePath)) {
        map.set(filePath, `@/forest/${name}`);
      }
      // Also test files
      const testPath = path.join(SRC_DIR, 'lib', `${name}.test${ext}`);
      if (fs.existsSync(testPath)) {
        map.set(testPath, `@/forest/${name}.test`);
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
  console.log(`Move map: ${movedFileMap.size} forest files tracked`);

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

    // 3. Rewrite dynamic imports: await import('@/lib/...')
    const text = sf.getFullText();
    let newText = text;
    for (const [prefix, replacement] of RULES) {
      // Match dynamic import("@/lib/...") or import('@/components/...')
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

  console.log(`\n=== Codemod (forest layer) complete ===`);
  console.log(`Files changed: ${filesChanged}`);
  console.log(`Imports rewritten: ${importsRewritten}`);
}

main().catch((err) => {
  console.error('Codemod failed:', err);
  process.exit(1);
});
