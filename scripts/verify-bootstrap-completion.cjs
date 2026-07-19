#!/usr/bin/env node

/**
 * Sophia AI Factory — Bootstrap Completion Verification
 * Runs all quality gates and reports final status
 */

const { execSync } = require('child_process');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'apps', 'sophia-ai-factory');

function runCommand(cmd, label) {
  console.log(`\n\x1b[1m>>> ${label}\x1b[0m`);
  try {
    const output = execSync(cmd, { cwd: APP_DIR, encoding: 'utf-8', stdio: 'inherit' });
    return { ok: true, output };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function printStatus(label, ok) {
  const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${icon} ${label}`);
}

console.log('\n\x1b[1;36m╔════════════════════════════════════════════════════╗\x1b[0m');
console.log('\x1b[1;36m║   Sophia AI Factory — Bootstrap Verification      ║\x1b[0m');
console.log('\x1b[1;36m╚════════════════════════════════════════════════════╝\x1b[0m\n');

const results = {};

// 1. i18n validation
results.i18n = runCommand('npm run i18n:validate', 'i18n Translation Keys');
printStatus('i18n validation', results.i18n.ok);

// 2. TypeScript type check
results.typecheck = runCommand('npm run type-check', 'TypeScript Type Check');
printStatus('TypeScript type check', results.typecheck.ok);

// 3. ESLint
results.lint = runCommand('npm run lint', 'ESLint');
printStatus('ESLint', results.lint.ok);

// 4. Tests
results.tests = runCommand('npm test -- --reporter=basic', 'Unit & Integration Tests');
printStatus('Tests', results.tests.ok);

// 5. Build
results.build = runCommand('npm run build', 'Production Build');
printStatus('Production build', results.build.ok);

// Summary
console.log('\n\x1b[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
console.log('\x1b[1mVERIFICATION SUMMARY\x1b[0m\n');

const total = Object.keys(results).length;
const passed = Object.values(results).filter(r => r.ok).length;
const failed = total - passed;

console.log(`Total checks: ${total}`);
console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
if (failed > 0) {
  console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
}

if (failed === 0) {
  console.log('\n\x1b[1;32m✅ ALL SYSTEMS GREEN — BOOTSTRAP COMPLETE\x1b[0m\n');
  console.log('The Sophia AI Factory project is fully bootstrapped and ready for development.\n');
  process.exit(0);
} else {
  console.log('\n\x1b[1;31m❌ BOOTSTRAP INCOMPLETE — REVIEW FAILURES ABOVE\x1b[0m\n');
  console.log('Address the failing checks before proceeding.\n');
  process.exit(1);
}
