export interface SourceIdentity {
  commitSha: string | null;
  worktreeClean: boolean;
  changedPathCount: number;
  worktreeFingerprint: string | null;
}

export function captureSourceIdentity(repoRoot: string): SourceIdentity;
export function sourceIdentityMatchesAtBoundaries(start: SourceIdentity, end: SourceIdentity): boolean;
