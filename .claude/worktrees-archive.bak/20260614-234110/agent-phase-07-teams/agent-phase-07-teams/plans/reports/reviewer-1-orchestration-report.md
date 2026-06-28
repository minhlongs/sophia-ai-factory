# Mekong CLI Orchestration Audit Report

**Date**: 2026-05-31
**Status**: COMPLETE
**Scope**: Core orchestration execution flow, daemon loops, state mutability, concurrent tasks, locking, and race conditions inside the `src/` directory (specifically core, daemon, security, billing, telemetry).

---

## Executive Summary
An in-depth audit of the mekong-cli orchestration and daemon system has been completed. The audit focused on finding potential logic bugs, concurrency flaws, locking issues, and race conditions. A total of 9 findings were identified, categorized into 1 CRITICAL, 4 IMPORTANT, and 4 MODERATE issues. 
Additionally, the test suite was executed to verify baseline correctness:
- **Command Run**: `pytest` (full suite)
- **Result**: 6347 passed, 46 skipped in 326.46s (all tests passed successfully).

---

## Detailed Findings

### 1. [CRITICAL] Synchronous PM2 Subprocess Execution Blocks Async Event Loop
- **Description**: The daemon dispatch loop runs asynchronously on a single-threaded Python `asyncio` event loop. However, inside `WorkerPool.refresh_status()`, the PM2 process list is queried using a synchronous subprocess call (`subprocess.run(["pm2", "jlist", ...])`). Since `refresh_status()` is called via `get_available_worker()` and `list_workers()` inside the dispatch path, the entire event loop blocks waiting for PM2. If PM2 is slow or hangs, this halts the entire daemon, causing timeout of heartbeats and starvation of concurrent tasks.
- **Citations**:
  - `src/daemon/worker_pool.py:L103` (`subprocess.run` inside `_run_pm2`)
  - `src/daemon/worker_pool.py:L183` (calling `self.refresh_status()` synchronously inside `get_available_worker`)
  - `src/daemon/dispatcher.py:L164` (calling `get_available_worker` synchronously)
- **Remediation**: Refactor `_run_pm2` to be asynchronous using `asyncio.create_subprocess_exec` or delegate the call to a thread pool via `asyncio.to_thread` / `loop.run_in_executor`. Update downstream callers in the execution chain to be async.

---

### 2. [IMPORTANT] Duplicate PM2 Queries and Multiple Synchronous Reads of missions.json
- **Description**: The dashboard status summary API endpoint `get_status_summary()` exhibits severe redundant synchronous I/O and process execution. It performs a blocking PM2 query twice (once in `get_worker_status()` and once in `get_metrics()`). In addition, it reads and parses the entire `missions.json` file from disk synchronously 5 separate times within a single execution path (throughput, success rate, queue depth, average response time, and dispatch queue calculations). This creates severe performance bottlenecks and CPU/IO blocking as `missions.json` grows.
- **Citations**:
  - `src/daemon/mission_control.py:L321-368` (calls inside `get_status_summary()`)
  - `src/daemon/mission_control.py:L144` (duplicate call to `get_worker_status()` inside `get_metrics()`)
  - `src/daemon/mission_control.py:L152-155` (multiple reads via throughput, success_rate, queue_depth, avg_response_time)
  - `src/daemon/mission_control.py:L330` (calls to `get_dispatch_queue()` which reads `missions.json` again)
- **Remediation**:
  1. Pass the fetched `workers` list directly into `get_metrics(workers)` to avoid the second PM2 invocation.
  2. Read and parse `missions.json` once at the beginning of `get_status_summary()`, and pass the loaded list/dict of missions to each metrics calculator.

---

### 3. [IMPORTANT] Re-planning Failed DAG Branch Discards Upstream Dependencies
- **Description**: When a step in a recipe fails, `replan_failed_branch()` is invoked to re-plan only the failed step and its downstream dependents. However, the newly generated steps are offset by `next_order` but are never linked back to the successful upstream steps that the failed step originally depended on. The new steps' dependencies lists only contain internal dependencies (offset by `next_order`), leaving their connection to the kept upstream steps empty (`[]`). This breaks DAG execution ordering, allowing the new branch to run out of order before successful prerequisites complete.
- **Citations**:
  - `src/core/planner.py:L609-612` (setting dependencies offset by `next_order` only)
  - `src/core/planner.py:L592` (decomposing the goal in isolation)
- **Remediation**: Modify `replan_failed_branch()` so that the first step(s) in the newly decomposed task list (i.e. those with no internal dependencies) inherit the dependencies of the original failed step (`failed_step.dependencies`).

---

### 4. [IMPORTANT] Missing File Locks on Telemetry and Task Queue Journal
- **Description**: The `TaskRouter._log_mission()` method logs execution telemetry by reading the shared `missions.json` file, appending the new entry, and rewriting the file to disk using standard synchronous file writes. It does not use any locks. Under concurrent execution (e.g. multiple workers completing tasks at the same time), this causes a classic read-modify-write race condition that leads to data corruption or missing logs.
- **Citations**:
  - `src/daemon/task_router.py:L324-353` (raw read/write inside `_log_mission()`)
- **Remediation**: Use an advisory file lock (e.g., using `fcntl.flock` or the existing `locked_append` helper) to serialize writes, or migrate the journal format to JSON Lines (JSONL) to allow atomic appends.

---

### 5. [IMPORTANT] Blocking Synchronous Calls in Execution and Verification
- **Description**: Both `_execute_api_step()` (via `requests.request()`) and `_execute_custom_check()` (via `subprocess.run()`) execute blocking synchronous operations inside the core engine. When these are executed within DAG execution threads (which use a thread pool), they block threads for up to 30 seconds (default timeout), limiting overall throughput. If called directly from an async context, they block the main event loop entirely.
- **Citations**:
  - `src/core/executor.py:L174` (synchronous `requests.request` call)
  - `src/core/verifier.py:L387-392` (synchronous `subprocess.run` call)
- **Remediation**: Replace `requests` with an async HTTP client (e.g., `httpx` or `aiohttp`) and wrap `subprocess.run` in `asyncio.create_subprocess_exec` or run it via `asyncio.to_thread` / `run_in_executor`.

---

### 6. [MODERATE] Race Condition on Anomaly Baseline File Serialization
- **Description**: In `src/core/anomaly_detector.py`, the anomaly baseline file is written to disk via `_save_baselines()` without any lock or synchronization. Multiple concurrent recording operations can cause concurrent writes, leading to data loss or file corruption. In addition, the internal metrics dictionary `self._baselines` is not protected against concurrent thread modifications.
- **Citations**:
  - `src/core/anomaly_detector.py:L180-191` (`_save_baselines()`)
  - `src/core/anomaly_detector.py:L212-234` (`record_metric()`)
- **Remediation**: Protect the `self._baselines` dictionary and the file saving operation with a threading lock (`threading.Lock`), and apply a file lock when writing to disk.

---

### 7. [MODERATE] Shared Timer State Corruption in Singleton PEV Logger
- **Description**: The structured PEV logger is accessed as a singleton via `get_pev_logger()`. It uses a shared `self._step_timers` dictionary to keep track of step execution durations, using `step_order` (an integer) as the key. If multiple pipelines or concurrent steps execute simultaneously, they will overwrite each other's step timers (e.g. step 1 in pipeline A overwrites step 1 in pipeline B), corrupting duration calculations. Access to `_step_timers` is also not synchronized for multi-threaded safety.
- **Citations**:
  - `src/core/pev_structured_logger.py:L60` (`self._step_timers`)
  - `src/core/pev_structured_logger.py:L137` (writing to `_step_timers`)
  - `src/core/pev_structured_logger.py:L156` (popping from `_step_timers`)
- **Remediation**: Key the timers dictionary by a composite key like `(pipeline_id, step_order)` or `(thread_id, step_order)`, or store timers in thread-local storage (`threading.local()`).

---

### 8. [MODERATE] Non-Thread-Safe Singleton Accessors
- **Description**: The singleton getter methods `get_pev_logger()` and `get_pev_metrics()` construct global singleton instances without any thread synchronization. In multi-threaded scenarios, concurrent calls during initialization can cause multiple instances to be constructed, leading to race conditions and duplicate instances.
- **Citations**:
  - `src/core/pev_structured_logger.py:L315-320` (`get_pev_logger()`)
  - `src/core/pev_metrics_collector.py:L248-253` (`get_pev_metrics()`)
- **Remediation**: Use a thread lock (`threading.Lock`) with a double-checked locking pattern to ensure thread-safe single-instance initialization.

---

### 9. [MODERATE] Potential KeyError on Missing Tool Call ID in Local LLM Loop
- **Description**: The agent loop in `src/daemon/agent_loop.py` executes tool calls based on LLM outputs by directly accessing keys like `tc["id"]` and subkeys in `tc["function"]` without checks. When using local LLMs or custom adapters, missing fields will raise a `KeyError` and crash the loop.
- **Citations**:
  - `src/daemon/agent_loop.py:L214-226` (processing of `tool_calls`)
- **Remediation**: Implement defensive dictionary access (e.g. using `tc.get("id")` and `tc.get("function", {})`) with graceful error handling for missing schema keys.
