#!/usr/bin/env node
/**
 * Bootstrap Completion Verification
 * Runs all quality gates and reports status.
 */

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function runCommand(cmd, label) {
  try {
    console.log(`\n\x1b[1m${label}\x1b[0m`);
    const output = execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
    console.log(`✅ ${label} - PASS`);
    return true;
  } catch (err) {
    console.log(`❌ ${label} - FAIL`);
    return false;
  }
}

console.log('\n\x1b[1;36m=== Sophia AI Factory Bootstrap Verification ===\x1b[0m\n');

const results = {
  'i18n:validate': runCommand('npm run i18n:validate', 'i18n:validate'),
  'Type-check': runCommand('npm run type-check', 'Type-check'),
  'Lint': runCommand('npm run lint', 'Lint'),
  'Tests': runCommand('npm test -- --run', 'Tests'),
  'Build': runCommand('npm run build', 'Build'),
};

console.log('\n\x1b[1;36m=== Summary ===\x1b[0m');
let allPassed = true;
Object.entries(results).forEach(([name, passed]) => {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (!passed) allPassed = false;
});

if (allPassed) {
  console.log('\n\x1b[1;32m✅ Bootstrap complete — all gates passed.\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\n\x1b[1;31m❌ Bootstrap incomplete — some gates failed.\x1b[0m\n');
  process.exit(1);
}
