#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dir, '../apps/sophia-ai-factory/scripts/verify-user-video-flow-live.mjs');
const res = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: resolve(__dir, '../apps/sophia-ai-factory'),
});
process.exit(res.status ?? 1);
