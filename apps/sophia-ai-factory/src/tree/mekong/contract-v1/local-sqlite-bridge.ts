/**
 * Real Local SQLite / Python Bridge for `mekong.sophia.execution_contract.v1` (Gate S2)
 *
 * Used strictly in `LOCAL_TEST` mode to execute the real `SophiaExecutionContractV1`
 * runtime in `/Users/macbook/mekong-cli-autonomous-worktree/src/core/contracts/sophia_integration_v1.py`
 * via one-shot `python3 -I` over an isolated SQLite DB path.
 *
 * Uses `process.getBuiltinModule('node:child_process')` so Cloudflare Workers static
 * bundler never traces `node:child_process` into the Edge bundle.
 *
 * Layer: tree/mekong/contract-v1
 */

import { success, failure, type Result } from '@/seed/types/result';
import type { MekongContractOperation } from './contract-types';

export interface LocalBridgeOptions {
  mekongRepoRoot?: string;
  sqliteDbPath: string;
  worktreeRootDir?: string;
}

export interface LocalBridgeError {
  code: 'BRIDGE_UNAVAILABLE' | 'PYTHON_EXECUTION_ERROR' | 'INVALID_BRIDGE_JSON';
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

const PYTHON_BRIDGE_SCRIPT = [
  'import json, sys, pathlib',
  'payload = json.loads(sys.stdin.read())',
  'sys.path.insert(0, payload["repo_root"])',
  'from src.mekongcli.core.goal_engine.store import SQLiteGoalStore',
  'from src.mekongcli.core.goal_engine.service import GoalEngine',
  'from src.mekongcli.core.goal_engine.worktree_manager import WorktreeIsolationManager',
  'from src.core.contracts.sophia_integration_v1 import SophiaExecutionContractV1',
  'store = SQLiteGoalStore(db_path=pathlib.Path(payload["db_path"]))',
  'wt_root = pathlib.Path(payload.get("wt_root") or (payload["db_path"] + "_wt"))',
  'wt_root.mkdir(parents=True, exist_ok=True)',
  'wt = WorktreeIsolationManager(repo_root=wt_root)',
  'engine = GoalEngine(store=store, cwd=wt_root)',
  'contract = SophiaExecutionContractV1(store=store, engine=engine, worktree_manager=wt)',
  'op = payload["operation"]',
  'args = payload.get("args") or {}',
  'fn = getattr(contract, op)',
  'res = fn(args["request"]) if op == "submit_task" else fn(**args)',
  'sys.stdout.write(json.dumps({"ok": True, "data": res}))',
].join('\n');

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
    const parsed = JSON.parse(rawOut.trim()) as { ok?: boolean; data?: T };
    if (!parsed || parsed.ok !== true || parsed.data === undefined) {
      return failure({ code: 'INVALID_BRIDGE_JSON', message: 'Bridge returned malformed envelope' });
    }
    return success(parsed.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failure({ code: 'PYTHON_EXECUTION_ERROR', message: msg });
  }
}
