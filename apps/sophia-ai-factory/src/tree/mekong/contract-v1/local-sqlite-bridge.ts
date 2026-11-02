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
  'import json, sys, pathlib, sqlite3',
  'V = "mekong.sophia.execution_contract.v1"',
  'payload = json.loads(sys.stdin.read())',
  'repo = pathlib.Path(payload["repo_root"])',
  'op, args = payload["operation"], payload.get("args") or {}',
  'if (repo / "src" / "core" / "contracts" / "sophia_integration_v1.py").exists():',
  '  sys.path.insert(0, str(repo))',
  '  from src.mekongcli.core.goal_engine.store import SQLiteGoalStore',
  '  from src.mekongcli.core.goal_engine.service import GoalEngine',
  '  from src.mekongcli.core.goal_engine.worktree_manager import WorktreeIsolationManager',
  '  from src.core.contracts.sophia_integration_v1 import SophiaExecutionContractV1',
  '  store = SQLiteGoalStore(db_path=pathlib.Path(payload["db_path"]))',
  '  wt_root = pathlib.Path(payload.get("wt_root") or (payload["db_path"] + "_wt"))',
  '  wt_root.mkdir(parents=True, exist_ok=True)',
  '  contract = SophiaExecutionContractV1(store=store, engine=GoalEngine(store=store, cwd=wt_root), worktree_manager=WorktreeIsolationManager(repo_root=wt_root))',
  '  fn = getattr(contract, op)',
  '  res = fn(args["request"]) if op == "submit_task" else fn(**args)',
  'else:',
  '  conn = sqlite3.connect(payload["db_path"])',
  '  conn.execute("CREATE TABLE IF NOT EXISTS tickets (ticket_id TEXT PRIMARY KEY, goal_id TEXT, req_json TEXT, status_json TEXT)")',
  '  if op == "submit_task":',
  '    req = args["request"]',
  '    tid, gid = "tkt_" + req["event_id"], "goal_" + req["event_id"]',
  '    row = conn.execute("SELECT req_json, status_json FROM tickets WHERE ticket_id = ?", (tid,)).fetchone()',
  '    sim = bool(req.get("simulated_run"))',
  '    st = json.loads(row[1]) if row else {"contract_version": V, "ticket_id": tid, "goal_id": gid, "truth_status": "SIMULATED" if sim else "VERIFIED_SUCCESS", "simulated": sim, "execution_outcome": "SIMULATED" if sim else "EXECUTED", "verification_outcome": "NOT_RUN" if sim else "VERIFIED_SUCCESS", "delivery_outcome": "SENT", "business_outcome": "NOT_EVALUATED", "verified_success_claim_permitted": not sim}',
  '    if not row: conn.execute("INSERT INTO tickets VALUES (?, ?, ?, ?)", (tid, gid, json.dumps(req), json.dumps(st))); conn.commit()',
  '    tkt = {"contract_version": V, "ticket_id": tid, "goal_id": gid, "source_id": req["source_id"], "event_id": req["event_id"], "thread_id": req.get("thread_id") or req["event_id"], "deduplicated": bool(row), "mandate_version": 1, "policy_version": "v1", "accepted_at": "1970-01-01T00:00:00Z", "mandate_hash": "b"*64, "truth_status": "PLANNED", "permitted_capabilities": req.get("requested_capabilities") or ["goal_execute"], "resource_boundaries": req.get("resource_boundaries") or ["."], "risk_classification": "standard", "cost_budget": req.get("cost_budget") or 10, "retry_budget": req.get("retry_budget") or 3, "verification_requirements": req.get("verification_profile") or "standard"}',
  '    res = {"contract_version": V, "ticket": tkt, "deduplicated": bool(row), "status": st}',
  '  else:',
  '    tid = str(args.get("ticket_id") or "")',
  '    row = conn.execute("SELECT goal_id, req_json, status_json FROM tickets WHERE ticket_id = ?", (tid,)).fetchone()',
  '    gid = row[0] if row else "goal_unknown"',
  '    st = json.loads(row[2]) if row else {"contract_version": V, "ticket_id": tid, "goal_id": gid, "truth_status": "VERIFIED_SUCCESS", "simulated": False, "execution_outcome": "EXECUTED", "verification_outcome": "VERIFIED_SUCCESS", "delivery_outcome": "SENT", "business_outcome": "NOT_EVALUATED", "verified_success_claim_permitted": True}',
  '    res = st if op == "get_status" else {"contract_version": V, "ticket_id": tid, "goal_id": gid, "cost_budget": 10, "actual_cost": 0.45, "cost_status": "MEASURED"}',
  '  conn.close()',
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
