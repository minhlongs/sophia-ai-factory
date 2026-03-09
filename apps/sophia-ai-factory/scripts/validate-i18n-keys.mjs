#!/usr/bin/env node
/**
 * i18n Key Validation Script
 * Extracts t('key') calls with namespace detection and validates against translation files
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { cwd } from 'process';

const ROOT = cwd();
const SRC_DIR = join(ROOT, 'src');
const MESSAGES_DIR = join(ROOT, 'messages');
const LOCALES = ['vi', 'en'];

/**
 * Recursively get all files matching pattern
 */
async function* getFiles(dir, pattern) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* getFiles(fullPath, pattern);
      } else if (pattern.test(entry.name)) {
        yield fullPath;
      }
    }
  } catch (e) {
    // Ignore directory read errors
  }
}

/**
 * Extract namespace from useTranslations() or getTranslations() call
 */
function extractNamespace(content) {
  // Match useTranslations('namespace') or getTranslations("namespace") with dots
  const match = content.match(/(?:useTranslations|getTranslations)\(['"`]([a-zA-Z_.]+)['"`]\)/);
  return match ? match[1] : null;
}

/**
 * Extract translation keys from file content with namespace
 */
function extractKeys(content, filePath) {
  const keys = [];
  const namespace = extractNamespace(content);

  // Match t('key') and t(`key`) syntax
  const regex = /\bt\(['"`]([a-zA-Z0-9_.]+)['"`]\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    let key = match[1];

    // Prepend namespace if present
    if (namespace) {
      key = `${namespace}.${key}`;
    }

    keys.push({
      key,
      file: filePath,
      line: lineNum,
      rawKey: match[1]
    });
  }
  return keys;
}

/**
 * Get nested value from object by dot path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Load JSON file
 */
async function loadJson(file) {
  const content = await readFile(file, 'utf-8');
  return JSON.parse(content);
}

/**
 * Main validation function
 */
async function validate() {
  console.log('🔍 Scanning for i18n keys...\n');

  // Load translation files
  const translations = {};
  for (const locale of LOCALES) {
    try {
      translations[locale] = await loadJson(join(MESSAGES_DIR, `${locale}.json`));
    } catch (e) {
      console.error(`❌ Cannot load ${locale}.json: ${e.message}`);
      process.exit(1);
    }
  }

  // Extract all keys from source files
  const allKeys = new Map(); // key -> [{file, line}]
  const filesToScan = [
    join(SRC_DIR, '**/*.tsx'),
    join(SRC_DIR, '**/*.ts')
  ];

  for (const pattern of filesToScan) {
    const regex = /\.tsx$|\.ts$/;
    for await (const file of getFiles(SRC_DIR, regex)) {
      try {
        const content = await readFile(file, 'utf-8');
        const keys = extractKeys(content, relative(ROOT, file));
        for (const { key, file: f, line } of keys) {
          if (!allKeys.has(key)) {
            allKeys.set(key, []);
          }
          allKeys.get(key).push({ file: f, line });
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
  }

  // Validate keys against translations
  const missingKeys = [];
  const usedRootKeys = new Set();

  let totalKeys = 0;
  for (const [key, locations] of allKeys) {
    totalKeys += locations.length;

    // Check if key exists in vi.json
    const hasKey = getNestedValue(translations.vi, key) !== undefined;
    if (!hasKey) {
      missingKeys.push({ key, locations });
      continue;
    }

    // Track used root keys
    const rootKey = key.split('.')[0];
    usedRootKeys.add(rootKey);
  }

  // Report results
  console.log('📊 Summary:');
  console.log(`   Total t() calls: ${totalKeys}`);
  console.log(`   Unique keys: ${allKeys.size}`);
  console.log(`   Missing keys: ${missingKeys.length}`);
  console.log();

  if (missingKeys.length === 0) {
    console.log('✅ All translation keys found!\n');
    process.exit(0);
  }

  console.error('❌ Missing translation keys:\n');
  for (const { key, locations } of missingKeys) {
    console.error(`   "${key}"`);
    for (const loc of locations.slice(0, 3)) { // Show max 3 locations
      console.error(`      at ${loc.file}:${loc.line}`);
    }
    if (locations.length > 3) {
      console.error(`      ... and ${locations.length - 3} more`);
    }
    console.error();
  }

  console.error(`\n💡 Run "npm run i18n:autofill" to auto-generate missing keys\n`);
  process.exit(1);
}

validate().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
