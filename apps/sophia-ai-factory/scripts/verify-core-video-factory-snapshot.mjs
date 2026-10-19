#!/usr/bin/env node
/** Run the deterministic core proof from a read-only temporary Git worktree. */
import { spawnSync, execFileSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSourceIdentity, sourceIdentityMatchesAtBoundaries } from './core-proof-source-identity.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: appRoot, encoding: 'utf8' }).trim();
const tempRoot = mkdtempSync(join(tmpdir(), 'sophia-core-proof-snapshot-'));
const snapshotRoot = join(tempRoot, 'repo');
const originalIdentity = captureSourceIdentity(repoRoot);

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: repoRoot, stdio: 'pipe', ...options });
}

function copyUntrackedFiles() {
  const output = git(['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  for (const path of output.split('\0').filter(Boolean)) {
    const source = resolve(repoRoot, path);
    const destination = resolve(snapshotRoot, path);
    mkdirSync(dirname(destination), { recursive: true });
    if (lstatSync(source).isSymbolicLink()) {
      symlinkSync(readlinkSync(source), destination);
    } else {
      copyFileSync(source, destination);
    }
  }
}

function copyLocalTestInputs() {
  for (const generatedTypes of ['.next/types', '.next/dev/types']) {
    const source = resolve(appRoot, generatedTypes);
    if (!existsSync(source)) continue;
    const target = resolve(snapshotRoot, relative(repoRoot, source));
    cpSync(source, target, { recursive: true });
  }

  for (const dependencyPath of ['node_modules', 'apps/sophia-ai-factory/node_modules']) {
    const source = resolve(repoRoot, dependencyPath);
    if (!existsSync(source)) continue;
    symlinkSync(source, resolve(snapshotRoot, dependencyPath), 'dir');
  }
  appendFileSync(resolve(snapshotRoot, '.git/info/exclude'), '\nnode_modules\napps/sophia-ai-factory/node_modules\n');

  // TypeScript incremental metadata is disposable and ignored by Git.
  const tsBuildInfo = resolve(snapshotRoot, 'apps/sophia-ai-factory/tsconfig.tsbuildinfo');
  rmSync(tsBuildInfo, { force: true });
  symlinkSync(join(tempRoot, 'tsconfig.tsbuildinfo'), tsBuildInfo);
}

function makeReadOnly(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      makeReadOnly(child);
      chmodSync(child, 0o555);
    } else {
      const mode = lstatSync(child).mode;
      chmodSync(child, mode & 0o111 ? 0o555 : 0o444);
    }
  }
  chmodSync(path, 0o555);
}

function runProof() {
  const snapshotIdentity = captureSourceIdentity(snapshotRoot);
  if (!sourceIdentityMatchesAtBoundaries(originalIdentity, snapshotIdentity)) {
    const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: snapshotRoot, encoding: 'utf8' }).stdout.trim();
    throw new Error(`Snapshot identity mismatch (source ${originalIdentity.commitSha}/${originalIdentity.changedPathCount}/${originalIdentity.worktreeFingerprint}; snapshot ${snapshotIdentity.commitSha}/${snapshotIdentity.changedPathCount}/${snapshotIdentity.worktreeFingerprint}; paths: ${status})`);
  }

  makeReadOnly(snapshotRoot);
  const evidenceDir = resolve(repoRoot, 'apps/sophia-ai-factory/plans/reports');
  mkdirSync(evidenceDir, { recursive: true });
  const proofScript = resolve(snapshotRoot, 'apps/sophia-ai-factory/scripts/verify-core-video-factory.mjs');
  const result = spawnSync(process.execPath, [proofScript], {
    cwd: resolve(snapshotRoot, 'apps/sophia-ai-factory'),
    stdio: 'inherit',
    env: {
      ...process.env,
      SOPHIA_CORE_VIDEO_PROOF: '1',
      SOPHIA_VIDEO_PROVIDER: 'mock',
      SOPHIA_CORE_VIDEO_EXECUTION_MODE: 'immutable-readonly-worktree',
      SOPHIA_CORE_VIDEO_SOURCE_IDENTITY: JSON.stringify(originalIdentity),
      SOPHIA_CORE_VIDEO_EVIDENCE_DIR: evidenceDir,
    },
  });
  return result.status ?? 1;
}

let exitCode = 1;
try {
  const cloned = spawnSync('git', ['clone', '--shared', '--quiet', repoRoot, snapshotRoot], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (cloned.status !== 0) throw new Error(cloned.stderr || 'Could not create temporary Git snapshot');

  const patch = spawnSync('git', ['diff', 'HEAD', '--binary'], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  if (patch.status !== 0) throw new Error('Could not capture tracked source changes for the proof snapshot');
  if (patch.stdout.length > 0) git(['apply', '--binary', '-'], { cwd: snapshotRoot, input: patch.stdout });

  copyUntrackedFiles();
  copyLocalTestInputs();
  exitCode = runProof();
} catch (error) {
  console.error(`Immutable proof snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  const makeWritable = (path) => {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) makeWritable(child);
      chmodSync(child, 0o700);
    }
    chmodSync(path, 0o700);
  };
  makeWritable(snapshotRoot);
  rmSync(tempRoot, { recursive: true, force: true });
}

process.exit(exitCode);
