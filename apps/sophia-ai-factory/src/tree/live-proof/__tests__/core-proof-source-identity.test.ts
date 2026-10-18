import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { captureSourceIdentity, sourceIdentityMatchesAtBoundaries } from '../../../../scripts/core-proof-source-identity.mjs';

const tempDirs: string[] = [];

function createGitFixture() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'sophia-proof-source-'));
  tempDirs.push(repoRoot);
  execFileSync('git', ['init', '-q'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.name', 'Proof Test'], { cwd: repoRoot });
  execFileSync('git', ['config', 'user.email', 'proof-test@example.invalid'], { cwd: repoRoot });
  writeFileSync(join(repoRoot, 'tracked.txt'), 'committed source\n');
  execFileSync('git', ['add', 'tracked.txt'], { cwd: repoRoot });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: repoRoot });
  return repoRoot;
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('core proof source identity', () => {
  it('returns a valid repeatable identity for an unchanged full repository', () => {
    const repoRoot = createGitFixture();
    const start = captureSourceIdentity(repoRoot);
    const end = captureSourceIdentity(repoRoot);

    expect(start.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(start.worktreeFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(start.worktreeClean).toBe(true);
    expect(sourceIdentityMatchesAtBoundaries(start, end)).toBe(true);
  });

  it('detects tracked content changes between snapshots', () => {
    const repoRoot = createGitFixture();
    const start = captureSourceIdentity(repoRoot);
    writeFileSync(join(repoRoot, 'tracked.txt'), 'changed source\n');
    const end = captureSourceIdentity(repoRoot);

    expect(sourceIdentityMatchesAtBoundaries(start, end)).toBe(false);
  });

  it('does not treat staging the same source content as a source change', () => {
    const repoRoot = createGitFixture();
    writeFileSync(join(repoRoot, 'tracked.txt'), 'changed source\n');
    const unstaged = captureSourceIdentity(repoRoot);
    execFileSync('git', ['add', 'tracked.txt'], { cwd: repoRoot });
    const staged = captureSourceIdentity(repoRoot);

    expect(unstaged.worktreeFingerprint).toBe(staged.worktreeFingerprint);
    expect(sourceIdentityMatchesAtBoundaries(unstaged, staged)).toBe(true);
  });

  it('includes untracked files at the repository root', () => {
    const repoRoot = createGitFixture();
    const start = captureSourceIdentity(repoRoot);
    const rootFile = join(repoRoot, 'new-migration.sql');
    writeFileSync(rootFile, 'ALTER TABLE example ADD COLUMN value TEXT;\n');
    const end = captureSourceIdentity(repoRoot);

    expect(start.worktreeFingerprint).not.toBe(end.worktreeFingerprint);
    expect(sourceIdentityMatchesAtBoundaries(start, end)).toBe(false);
  });
});
