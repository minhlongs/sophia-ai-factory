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
  const stringForm = content.match(/(?:useTranslations|getTranslations)\(['"`]([a-zA-Z_.]+)['"`]\)/);
  if (stringForm) return stringForm[1];
  // Match object form: getTranslations({ locale, namespace: 'name.space' })
  const objectForm = content.match(/(?:useTranslations|getTranslations)\(\s*\{[^}]*namespace:\s*['"`]([a-zA-Z_.]+)['"`]/);
  return objectForm ? objectForm[1] : null;
}

/**
 * Extract translation keys from file content with namespace.
 *
 * Returns { keys, dynamicPrefixes }:
 *   - keys: static t('foo.bar') calls (resolvable, must exist in vi.json)
 *   - dynamicPrefixes: template-literal t(`foo.${x}.bar`) calls; we validate
 *     the resolvable static prefix (text before the first `${`) as a partial
 *     namespace path and surface any unresolved prefixes.
 */
function extractKeys(content, filePath) {
  const keys = [];
  const dynamicPrefixes = [];
  const namespace = extractNamespace(content);

  // Static keys: t('key') / t("key") / t(`key`) with no interpolation
  const staticRegex = /\bt\(['"`]([a-zA-Z0-9_.]+)['"`]\)/g;
  let match;
  while ((match = staticRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    let key = match[1];
    if (namespace) key = `${namespace}.${key}`;
    keys.push({ key, file: filePath, line: lineNum, rawKey: match[1] });
  }

  // Dynamic keys: t(`...${...}...`) — extract static prefix before first ${
  const dynamicRegex = /\bt\(`([^`]*?)\$\{[^}]+\}[^`]*`\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const rawPrefix = match[1];
    // Skip when prefix is empty (e.g. t(`${entirelyDynamic}`)) — cannot validate
    if (!rawPrefix) continue;
    // Trim trailing dot for partial-path lookup (e.g. "steps." -> "steps")
    const cleanPrefix = rawPrefix.endsWith('.') ? rawPrefix.slice(0, -1) : rawPrefix;
    if (!cleanPrefix) continue;
    let prefix = cleanPrefix;
    if (namespace) prefix = `${namespace}.${prefix}`;
    dynamicPrefixes.push({ prefix, file: filePath, line: lineNum, raw: match[0] });
  }

  return { keys, dynamicPrefixes };
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
  const allDynamicPrefixes = new Map(); // prefix -> [{file, line}]
  const filesToScan = [
    join(SRC_DIR, '**/*.tsx'),
    join(SRC_DIR, '**/*.ts')
  ];

  for (const pattern of filesToScan) {
    const regex = /\.tsx$|\.ts$/;
    for await (const file of getFiles(SRC_DIR, regex)) {
      try {
        const content = await readFile(file, 'utf-8');
        const { keys, dynamicPrefixes } = extractKeys(content, relative(ROOT, file));
        for (const { key, file: f, line } of keys) {
          if (!allKeys.has(key)) allKeys.set(key, []);
          allKeys.get(key).push({ file: f, line });
        }
        for (const { prefix, file: f, line } of dynamicPrefixes) {
          if (!allDynamicPrefixes.has(prefix)) allDynamicPrefixes.set(prefix, []);
          allDynamicPrefixes.get(prefix).push({ file: f, line });
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

  // Validate dynamic prefixes. Supports two shapes:
  //   A) `parent.${var}.child` → static prefix ends with "." → parent must be object
  //   B) `parent.literal_${var}` → static prefix ends with literal text → parent must
  //      be object AND at least one child must start with that literal text.
  const unresolvedPrefixes = [];
  for (const [prefix, locations] of allDynamicPrefixes) {
    const lastDot = prefix.lastIndexOf('.');
    const parentPath = lastDot >= 0 ? prefix.slice(0, lastDot) : '';
    const literalRemainder = lastDot >= 0 ? prefix.slice(lastDot + 1) : prefix;
    const parent = parentPath ? getNestedValue(translations.vi, parentPath) : translations.vi;
    const parentIsObject = parent !== undefined && typeof parent === 'object' && parent !== null;
    if (!parentIsObject) {
      unresolvedPrefixes.push({ prefix, locations });
      continue;
    }
    if (literalRemainder === '') continue; // shape A satisfied (e.g. "steps.")
    const hasMatchingChild = Object.keys(parent).some((k) => k.startsWith(literalRemainder));
    if (!hasMatchingChild) unresolvedPrefixes.push({ prefix, locations });
  }

  // Report results
  console.log('📊 Summary:');
  console.log(`   Total t() calls: ${totalKeys}`);
  console.log(`   Unique static keys: ${allKeys.size}`);
  console.log(`   Dynamic key prefixes: ${allDynamicPrefixes.size}`);
  console.log(`   Missing static keys: ${missingKeys.length}`);
  console.log(`   Unresolved dynamic prefixes: ${unresolvedPrefixes.length}`);
  console.log();

  if (unresolvedPrefixes.length > 0) {
    console.error('⚠️  Unresolved dynamic-key prefixes (parent path missing or not an object):\n');
    for (const { prefix, locations } of unresolvedPrefixes) {
      console.error(`   "${prefix}.*"`);
      for (const loc of locations.slice(0, 3)) {
        console.error(`      at ${loc.file}:${loc.line}`);
      }
      if (locations.length > 3) {
        console.error(`      ... and ${locations.length - 3} more`);
      }
      console.error();
    }
  }

  if (missingKeys.length === 0 && unresolvedPrefixes.length === 0) {
    console.log('✅ All translation keys found!\n');
    process.exit(0);
  }

  if (missingKeys.length === 0 && unresolvedPrefixes.length > 0) {
    console.error('❌ Validation failed: unresolved dynamic prefixes detected.\n');
    process.exit(1);
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
