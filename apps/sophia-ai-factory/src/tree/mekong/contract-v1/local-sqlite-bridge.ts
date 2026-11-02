/**
 * Real Local SQLite / Python Bridge for `mekong.sophia.execution_contract.v1` (Gate S2, Supreme #02.1 P4)
 *
 * Used strictly in `LOCAL_TEST` mode to execute the `SophiaExecutionContractV1`
 * runtime in `/Users/macbook/mekong-cli-autonomous-worktree/src/core/contracts/sophia_integration_v1.py`
 * (or the standalone 10-operation SQLite fallback when the checkout is absent) via one-shot `python3 -I`.
 *
 * Uses `process.getBuiltinModule('node:child_process')` so Cloudflare Workers static
 * bundler never traces `node:child_process` into the Edge bundle.
 *
 * Layer: tree/mekong/contract-v1
 */

import { success, failure, type Result } from '@/seed/types/result';
import type { MekongContractOperation } from './contract-types';
import { PYTHON_BRIDGE_SCRIPT } from './local-sqlite-python-script';

export interface LocalBridgeOptions {
  mekongRepoRoot?: string;
  sqliteDbPath: string;
  worktreeRootDir?: string;
}

export interface LocalBridgeError {
  code: 'BRIDGE_UNAVAILABLE' | 'PYTHON_EXECUTION_ERROR' | 'INVALID_BRIDGE_JSON' | 'NOT_FOUND' | 'UNSUPPORTED_OPERATION';
  message: string;
}

interface ChildProcessModule {
  execFileSync(
    file: string,
    args: readonly string[],
    options: { input: string; encoding: 'utf-8'; timeout: number; env: Record<string, string | undefined> }
  ): string;
}

const DEFAULT_MEKONG_ROOT = '/Users/macbook/mekong-cli-autonomous-worktree';

function getChildProcess(): ChildProcessModule | null {
  try {
    const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => ChildProcessModule } }).process;
    return proc?.getBuiltinModule ? proc.getBuiltinModule('node:child_process') : null;
  } catch {
    return null;
  }
}

export function invokeLocalMekongContract<T = Record<string, unknown>>(
  operation: MekongContractOperation,
  args: Record<string, unknown>,
  options: LocalBridgeOptions
): Result<T, LocalBridgeError> {
  const cp = getChildProcess();
  if (!cp) {
    return failure({
      code: 'BRIDGE_UNAVAILABLE',
      message: 'node:child_process is unavailable in Edge runtime; use LOCAL_TEST only in Node test runner',
    });
  }

  const repoRoot = options.mekongRepoRoot ?? DEFAULT_MEKONG_ROOT;
  const stdinPayload = JSON.stringify({
    repo_root: repoRoot,
    db_path: options.sqliteDbPath,
    wt_root: options.worktreeRootDir ?? `${options.sqliteDbPath}_wt`,
    operation,
    args,
  });

  try {
    const rawOut = cp.execFileSync('python3', ['-I', '-c', PYTHON_BRIDGE_SCRIPT], {
      input: stdinPayload,
      encoding: 'utf-8',
      timeout: 15000,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    const parsed = JSON.parse(rawOut.trim()) as {
      ok?: boolean;
      data?: T;
      code?: LocalBridgeError['code'];
      message?: string;
    };
    if (!parsed) {
      return failure({ code: 'INVALID_BRIDGE_JSON', message: 'Bridge returned empty envelope' });
    }
    if (parsed.ok === false) {
      return failure({
        code: parsed.code ?? 'PYTHON_EXECUTION_ERROR',
        message: parsed.message ?? 'Bridge operation rejected',
      });
    }
    if (parsed.ok !== true || parsed.data === undefined) {
      return failure({ code: 'INVALID_BRIDGE_JSON', message: 'Bridge returned malformed envelope' });
    }
    return success(parsed.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failure({ code: 'PYTHON_EXECUTION_ERROR', message: msg });
  }
}
