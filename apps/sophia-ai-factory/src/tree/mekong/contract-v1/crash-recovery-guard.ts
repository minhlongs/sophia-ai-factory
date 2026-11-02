/**
 * Sophia-Side SIGKILL Crash & Worktree Wipe Protection Guard (Gate S6)
 *
 * Neutralizes the Mekong `WorktreeIsolationManager.allocate()` wipe hazard
 * (`worktree_manager.py:121-128,168-174`) without modifying `minhlongs/mekong-cli`:
 * 1. Scopes task/correlation keys per attempt (`${baseTaskId.slice(0, 48)}__att${attemptNo}`, <= 64 chars)
 *    so retry attempt N+1 never collides with or cleans up attempt N's crashed worktree.
 * 2. Harvests uncommitted files from a crashed attempt worktree into a quarantine directory
 *    before any retry is dispatched.
 * 3. Enforces `HUMAN_REVIEW_REQUIRED` fail-closed gate when `sideEffectUncertain = true`.
 *
 * Layer: tree/mekong/contract-v1
 */

export interface CrashPreservationResult {
  scopedTaskId: string;
  preservedPath: string | null;
  preservedFiles: string[];
  harvestedFromWorktree: boolean;
}

export interface CrashRetryGateDecision {
  allowAutoRetry: boolean;
  status: 'AUTO_RETRY_PERMITTED' | 'HUMAN_REVIEW_REQUIRED';
  nextAttemptNo: number;
  nextScopedTaskId: string;
  reasonEn: string;
  reasonVi: string;
}

export function buildAttemptScopedTaskId(baseTaskId: string, attemptNo: number): string {
  const safeAttempt = Math.max(1, Math.floor(attemptNo));
  const sanitizedBase = baseTaskId.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'task';
  const suffix = `__att${safeAttempt}`;
  const maxBaseLen = Math.max(8, 64 - suffix.length);
  return `${sanitizedBase.slice(0, maxBaseLen)}${suffix}`;
}

interface DynamicFs {
  existsSync(p: string): boolean;
  mkdirSync(p: string, opts?: { recursive?: boolean }): void;
  readdirSync(p: string, opts?: { withFileTypes?: boolean }): Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  copyFileSync(src: string, dest: string): void;
}

function getNodeFs(): DynamicFs | null {
  try {
    // Dynamic module resolution via globalThis.process.getBuiltinModule (Node 22+)
    // keeps node:fs out of the Cloudflare Worker static Edge bundle without eval().
    const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => DynamicFs } }).process;
    if (proc?.getBuiltinModule) {
      return proc.getBuiltinModule('node:fs');
    }
    return null;
  } catch {
    return null;
  }
}

export function inspectAndPreserveCrashedAttempt(input: {
  crashedWorktreeDir: string;
  quarantineRootDir: string;
  baseTaskId: string;
  crashedAttemptNo: number;
}): CrashPreservationResult {
  const scopedTaskId = buildAttemptScopedTaskId(input.baseTaskId, input.crashedAttemptNo);
  const fs = getNodeFs();
  if (!fs || !fs.existsSync(input.crashedWorktreeDir)) {
    return { scopedTaskId, preservedPath: null, preservedFiles: [], harvestedFromWorktree: false };
  }

  const destDir = `${input.quarantineRootDir.replace(/\/+$/, '')}/${scopedTaskId}_quarantine`;
  fs.mkdirSync(destDir, { recursive: true });
  const preservedFiles: string[] = [];

  const copyRecursive = (srcDir: string, targetDir: string, relPrefix: string): void => {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const srcPath = `${srcDir}/${entry.name}`;
      const dstPath = `${targetDir}/${entry.name}`;
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        copyRecursive(srcPath, dstPath, relPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, dstPath);
        preservedFiles.push(relPath);
      }
    }
  };

  copyRecursive(input.crashedWorktreeDir, destDir, '');
  return {
    scopedTaskId,
    preservedPath: destDir,
    preservedFiles,
    harvestedFromWorktree: preservedFiles.length > 0,
  };
}

export function evaluateCrashRetryGate(input: {
  baseTaskId: string;
  crashedAttemptNo: number;
  sideEffectUncertain: boolean;
  preservedPath?: string | null;
}): CrashRetryGateDecision {
  const nextAttemptNo = Math.max(1, input.crashedAttemptNo) + 1;
  const nextScopedTaskId = buildAttemptScopedTaskId(input.baseTaskId, nextAttemptNo);
  if (input.sideEffectUncertain) {
    return {
      allowAutoRetry: false,
      status: 'HUMAN_REVIEW_REQUIRED',
      nextAttemptNo,
      nextScopedTaskId,
      reasonEn: `Crash quarantine active (${input.preservedPath ?? 'no-path'}): side-effect uncertain, human review required before retry.`,
      reasonVi: `Đã cách ly tiến trình crash (${input.preservedPath ?? 'no-path'}): chưa rõ tác vụ phụ, cần CEO duyệt trước khi chạy lại.`,
    };
  }
  return {
    allowAutoRetry: true,
    status: 'AUTO_RETRY_PERMITTED',
    nextAttemptNo,
    nextScopedTaskId,
    reasonEn: `Safe to retry on isolated attempt key ${nextScopedTaskId}.`,
    reasonVi: `An toàn chạy lại trên nhánh cách ly ${nextScopedTaskId}.`,
  };
}
