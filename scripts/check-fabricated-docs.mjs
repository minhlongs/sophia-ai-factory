#!/usr/bin/env node

/**
 * Documentation Accuracy Checker
 *
 * Scans documentation files for references to APIs, functions, endpoints,
 * and file paths that don't exist in the codebase. Prevents "plausible
 * but fabricated" documentation.
 *
 * Pattern adopted from OmniRoute's check-fabricated-docs.mjs.
 *
 * Usage: node scripts/check-fabricated-docs.mjs [--docs-dir ./docs]
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const DOCS_DIR = process.argv.includes('--docs-dir')
  ? resolve(process.argv[process.argv.indexOf('--docs-dir') + 1])
  : resolve('docs');

const CODE_DIR = resolve('src');

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Patterns that reference code constructs
const REFERENCE_PATTERNS = [
  // Function calls: functionName()
  /\b([a-z][a-zA-Z0-9]*)\(\)/g,
  // Import paths: '@/...'
  /from\s+['"](@\/[a-zA-Z0-9/.-]+)/g,
  // File paths in backticks: `src/...`
  /`((?:src|apps|scripts|tests)\/[a-zA-Z0-9/.-]+\.\w+)`/g,
  // API routes: /api/...
  /(\/api\/[a-zA-Z0-9/.-]+)/g,
];

function walkDir(dir, extensions) {
  const files = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.next' || entry === '.open-next') continue;
        files.push(...walkDir(fullPath, extensions));
      } else if (extensions.has(extname(entry))) {
        files.push(fullPath);
      }
    } catch {
      // Skip inaccessible files
    }
  }
  return files;
}

function loadCodeIndex(codeDir) {
  const index = new Set();
  const codeFiles = walkDir(codeDir, CODE_EXTENSIONS);

  for (const file of codeFiles) {
    const rel = file.replace(process.cwd() + '/', '');
    index.add(rel);

    const content = readFileSync(file, 'utf-8');

    // Index exported function names
    const exportMatches = content.matchAll(
      /export\s+(?:async\s+)?(?:function|const|class)\s+([a-zA-Z0-9_]+)/g,
    );
    for (const m of exportMatches) {
      index.add(m[1]);
    }
  }

  return index;
}

function checkDocs(docFiles, codeIndex) {
  const issues = [];

  for (const docFile of docFiles) {
    const content = readFileSync(docFile, 'utf-8');
    const relDoc = docFile.replace(process.cwd() + '/', '');

    for (const pattern of REFERENCE_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const m of matches) {
        const ref = m[1];

        // Skip common false positives
        if (
          ref.startsWith('@/') && (
            ref.includes('seed/') || ref.includes('tree/') ||
            ref.includes('forest/') || ref.includes('land/')
          )
        ) {
          // Import path — check if file exists
          const tsFile = ref.replace('@/', 'src/') + '.ts';
          const tsxFile = ref.replace('@/', 'src/') + '.tsx';
          const idxFile = ref.replace('@/', 'src/') + '/index.ts';
          if (
            !existsSync(tsFile) && !existsSync(tsxFile) && !existsSync(idxFile) &&
            !codeIndex.has(ref.replace('@/', 'src/'))
          ) {
            issues.push({ file: relDoc, reference: ref, type: 'import-path' });
          }
        } else if (ref.startsWith('src/') || ref.startsWith('scripts/')) {
          // File path reference
          if (!existsSync(ref) && !codeIndex.has(ref)) {
            issues.push({ file: relDoc, reference: ref, type: 'file-path' });
          }
        } else if (ref.startsWith('/api/')) {
          // API route — acceptable in docs (can't easily verify all routes)
        } else if (ref.length > 3 && /^[a-z][a-zA-Z0-9]+$/.test(ref)) {
          // Function name reference
          if (!codeIndex.has(ref)) {
            issues.push({ file: relDoc, reference: ref, type: 'function-name' });
          }
        }
      }
    }
  }

  return issues;
}

// Main
const codeIndex = loadCodeIndex(CODE_DIR);
const docFiles = walkDir(DOCS_DIR, DOC_EXTENSIONS);
const issues = checkDocs(docFiles, codeIndex);

if (issues.length === 0) {
  console.log(`✅ Checked ${docFiles.length} doc files — no fabricated references found.`);
  process.exit(0);
}

console.log(`⚠️  Found ${issues.length} potentially fabricated references:\n`);
for (const issue of issues) {
  console.log(`  ${issue.file}: ${issue.reference} (${issue.type})`);
}

console.log(`\n💡 Review these references — they may reference code that was renamed or removed.`);
process.exit(1);
