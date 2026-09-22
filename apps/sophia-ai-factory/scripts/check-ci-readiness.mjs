#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dir, '../../../scripts/check-ci-readiness.mjs');
const res = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: resolve(__dir, '../../..'),
});
process.exit(res.status ?? 1);
