#!/usr/bin/env node
/**
 * i18n Auto-Fill Script
 * Auto-generates missing translation keys with English fallback values
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { cwd } from 'process';
import { execSync } from 'child_process';

const ROOT = cwd();
const MESSAGES_DIR = join(ROOT, 'messages');
const LOCALES = ['vi', 'en'];

/**
 * Get nested value from object by dot path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Set nested value in object by dot path
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((o, k) => {
    if (!(k in o)) o[k] = {};
    return o[k];
  }, obj);
  target[lastKey] = value;
}

/**
 * Convert key path to human-readable label
 */
function keyToLabel(key) {
  const lastPart = key.split('.').pop();
  return lastPart
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase());
}

/**
 * Load JSON file
 */
async function loadJson(file) {
  const content = await readFile(file, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save JSON file with consistent formatting
 */
async function saveJson(file, data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  await writeFile(file, content, 'utf-8');
}

/**
 * Extract missing keys by running validate script
 */
function getMissingKeys() {
  try {
    execSync('node scripts/validate-i18n-keys.mjs', {
      stdio: 'pipe',
      cwd: ROOT
    });
    return []; // No missing keys if script exits successfully
  } catch (e) {
    // Get both stdout and stderr
    const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    const missingKeys = [];
    const lines = output.split('\n');
    let inMissingSection = false;

    for (const line of lines) {
      // Start capturing after "Missing translation keys:" header
      if (line.includes('Missing translation keys:')) {
        inMissingSection = true;
        continue;
      }

      // Stop at hint or empty section
      if (line.includes('💡') || line.includes('Run "npm run')) {
        break;
      }

      if (!inMissingSection) continue;

      // Match key lines: starts with quote after whitespace
      const match = line.match(/^\s*["']([a-zA-Z0-9_.]+)["']$/);
      if (match) {
        missingKeys.push(match[1]);
      }
    }

    // Deduplicate
    return [...new Set(missingKeys)];
  }
}

/**
 * Main auto-fill function
 */
async function autofill() {
  console.log('🔍 Detecting missing translation keys...\n');

  // Get missing keys
  const missingKeys = getMissingKeys();

  if (missingKeys.length === 0) {
    console.log('✅ No missing keys found!\n');
    process.exit(0);
  }

  console.log(`📝 Found ${missingKeys.length} missing keys\n`);

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

  // Auto-fill missing keys
  let addedCount = 0;
  for (const key of missingKeys) {
    // Check if already exists
    if (getNestedValue(translations.vi, key)) continue;

    // Generate fallback value
    const label = keyToLabel(key);

    // Add to vi.json (Vietnamese uses English text as fallback)
    setNestedValue(translations.vi, key, label);

    // Add to en.json (English uses same label)
    setNestedValue(translations.en, key, label);

    addedCount++;
    console.log(`   + Added: "${key}" → "${label}"`);
  }

  console.log();

  // Save updated translations
  for (const locale of LOCALES) {
    const file = join(MESSAGES_DIR, `${locale}.json`);
    await saveJson(file, translations[locale]);
    console.log(`💾 Saved ${locale}.json`);
  }

  console.log(`\n✅ Added ${addedCount} missing translation keys\n`);
  console.log('⚠️  Please review and update Vietnamese translations manually\n');
}

autofill().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
