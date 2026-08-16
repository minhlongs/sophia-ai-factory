#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REPO_DIR = process.cwd();
const BASELINE_PATH = path.join(REPO_DIR, 'stryker-baseline.json');
const CONFIG_PATH = path.join(REPO_DIR, 'stryker.config.mjs');

const TARGET_FILES = [
  'src/land/billing/overage-topup.ts',
  'src/land/billing/nowpayments-ipn-handlers.ts',
  'src/land/billing/usage-aggregator.ts',
];

function buildArgs(targets) {
  const args = ['run'];
  if (targets.length) args.push(...targets);
  return args;
}

async function loadConfig() {
  try {
    await fs.access(CONFIG_PATH);
    return 'stryker.config.mjs present';
  } catch {
    return 'config missing — requires full install or fallback handler';
  }
}

function spawnStryker(targets) {
  const args = buildArgs(targets);

  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, { cwd: REPO_DIR, stdio: 'pipe' });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));

    child.on('close', (code) => {
      resolve({
        code,
        output: Buffer.concat(chunks).toString('utf8'),
      });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function writeBaseline(targets) {
  let reportsDir;
  try {
    reportsDir = await fs.readdir(path.join(REPO_DIR, 'reports', 'mutation'));
  } catch {
    reportsDir = [];
  }

  const snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    targets,
    reportsDir,
  };

  await fs.writeFile(BASELINE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return BASELINE_PATH;
}

async function main() {
  const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : TARGET_FILES;
  const configStatus = await loadConfig();

  if (!configStatus.includes('present')) {
    console.warn(`[phase02][warn] ${configStatus}.`)
  }

  const { code, output } = await spawnStryker(targets);
  console.log(output);

  if (code !== 0) {
    process.exitCode = code;
    return;
  }

  try {
    const baselinePath = await writeBaseline(targets);
    console.log(`[phase02] Updated Stryker baseline at: ${baselinePath}`);
  } catch (err) {
    console.error('[phase02] Failed to update baseline: failed to update baseline');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('[phase02] Failed to update baseline: failed to update baseline');
  process.exit(1);
});