import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function gitOutput(repoRoot, args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
}

export function captureSourceIdentity(repoRoot) {
  const status = gitOutput(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  const diff = gitOutput(repoRoot, ['diff', 'HEAD', '--binary']);
  const untracked = gitOutput(repoRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  const commitSha = gitOutput(repoRoot, ['rev-parse', 'HEAD'])?.trim() ?? null;
  const fingerprint = createHash('sha256');
  const changedPaths = status === null
    ? null
    : status.split('\n').filter(Boolean).map((line) => line.slice(3)).sort().join('\n');
  fingerprint.update(changedPaths ?? 'git-status-unavailable');
  fingerprint.update(diff ?? 'git-diff-unavailable');

  if (untracked) {
    for (const relativePath of untracked.split('\0').filter(Boolean)) {
      const absolutePath = resolve(repoRoot, relativePath);
      try {
        if (statSync(absolutePath).isFile()) {
          fingerprint.update(relativePath);
          fingerprint.update(readFileSync(absolutePath));
        }
      } catch {
        fingerprint.update(`${relativePath}:unreadable`);
      }
    }
  }

  return {
    commitSha,
    worktreeClean: status === '',
    changedPathCount: status ? status.split('\n').filter(Boolean).length : 0,
    worktreeFingerprint: status !== null && diff !== null && untracked !== null ? fingerprint.digest('hex') : null,
  };
}

export function sourceIdentityMatchesAtBoundaries(start, end) {
  return typeof start?.commitSha === 'string' && start.commitSha.length > 0 &&
    typeof start.worktreeFingerprint === 'string' && /^[0-9a-f]{64}$/.test(start.worktreeFingerprint) &&
    start.commitSha === end?.commitSha && start.worktreeFingerprint === end?.worktreeFingerprint;
}
