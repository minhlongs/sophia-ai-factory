# Aggregated Codebase Audit Summary Report — mekong-cli

**Date**: 2026-05-31  
**Audited Codebase**: `mekong-cli/src`  
**Focus Areas**: Core Orchestration, Security & Input Validation, Observability & Billing  

---

## 📊 Findings Executive Summary

| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| 🔴 **CRITICAL** | 6 | JWT authentication bypass, License enforcement bypass, API key secret bypass, SQLite transaction race conditions, PII exposure in telemetry, Event loop starvation. |
| 🟡 **IMPORTANT** | 11 | Command injection sanitizer bypass, Insecure strict_mode defaults, Plaintext credential cache, DB connection resource leaks, Telemetry data-loss race conditions, Nested trace span corruption, Multiple synchronous reads, Blocking event loop sync calls. |
| 🟢 **MODERATE** | 7 | Permissive directory/file permissions, Mixed structlog formats, Anomaly baselines concurrency races, Singleton PEV logger timers corruption, Non-thread-safe singleton accessors, Pydantic v1 crash, Tool ID KeyError. |

---

## 🔴 CRITICAL Findings

### 1. JWT Signature Validation Bypass and Tenant Forgery on Gateway Failure
*   **Location**: 
    *   `src/core/auth_tenant.py` (L147-153)
    *   `src/core/auth_jwt.py` (L19-47)
    *   `src/core/raas_auth/auth_gateway_mixin.py` (L102-105)
*   **Description**: JWT signature validation falls back to unverified local validation, trusting unverified JWT payloads on connection failure, permitting tenant forgery. If gateway communication fails (e.g. gateway offline, timeout), `auth_gateway_mixin.py` falls back to `local_validate()`, which decodes the claims using `decode_jwt()` but never validates the signature locally, allowing a client to forge an admin JWT.
*   **Action Items**:
    1. Do not fallback to permissive local validation on connection failure unless the token is matched against a local cryptographically secure offline license key.
    2. Implement client-side JWT signature verification using a pre-configured public key or cached JWKS.
    3. Enforce a fail-closed behavior by default for gateway connection errors.

### 2. Autogenerating Grace Period for Invalid or Missing Licenses (License Bypass)
*   **Location**: 
    *   `src/core/command_authorizer.py` (L522-544, L370-387)
*   **Description**: Autogenerates a 1-hour grace period for missing or invalid licenses, registering it in the KV client. The next run sees `in_grace=True` and allows execution, representing a complete bypass of the licensing check.
*   **Action Items**:
    1. Restrict grace periods only to cached verified licenses during transient network timeouts.
    2. Do not autogenerate a grace period on direct invalid/missing license validation results.

### 3. Discarding and Bypassing API Key Secrets (Authentication Bypass)
*   **Location**: 
    *   `src/core/api_key_manager.py` (L316-333, L88-92, L565)
    *   `src/core/gateway_api.py` (L37-41)
*   **Description**: In `ApiKeyManager.validate_key`, the key secret is only checked if the caller explicitly supplies it. In `gateway_api.py`, no secret is passed, so any API key with a valid ID bypasses authentication. Also, during persistence in `_save_all_keys`, keys are serialized via `to_public_dict()`, which deletes the key secret from the file completely.
*   **Action Items**:
    1. Store encrypted or hashed representations of key secrets on disk (do not strip them during save operations).
    2. Require the API key to be passed in a combined format (e.g. `key_id.key_secret`) and split them before validation.
    3. Enforce a mandatory secret verification check in `validate_key` rather than skipping it if `key_secret` is None.

### 4. SQLite Transaction Race Conditions on Shared DB Connection
*   **Location**: 
    *   `src/core/mcu_gate.py` (L74)
*   **Description**: Using a shared SQLite connection across threads with `check_same_thread=False` causes transaction corruption during concurrent MCUBilling queries. When multiple threads execute `BEGIN IMMEDIATE`, `COMMIT`, or `ROLLBACK` on the same connection object, one thread's commit can finalize another thread's work or raise transaction conflict exceptions.
*   **Action Items**:
    1. Use thread-local connections (e.g. `threading.local()`) or open/close separate connection context managers per database transaction.

### 5. PII Telemetry Exposure via Unhashed Error Messages
*   **Location**: 
    *   `src/core/telemetry_hooks.py` (L190)
*   **Description**: Raw unhashed error message strings are transmitted to the remote gateway, risking leaking API keys, database paths, or customer session IDs.
*   **Action Items**:
    1. Implement a sanitization regex filter to scrub common PII patterns, auth tokens, emails, and path prefixes before event serialization.

### 6. Synchronous PM2 Subprocess Execution Blocks Async Event Loop
*   **Location**: 
    *   `src/daemon/dispatcher.py` (L164, L178, L197)
    *   `src/daemon/worker_pool.py` (L103-109, L217)
    *   `src/daemon/mission_control.py` (L74, L90)
*   **Description**: Uses synchronous `subprocess.run()` to query status and spawn processes, locking the main asyncio event loop during high load and causing event loop starvation.
*   **Action Items**:
    1. Replace `subprocess.run()` with `asyncio.create_subprocess_exec` or execute worker pool queries inside a thread pool using `asyncio.to_thread` or `loop.run_in_executor`.

---

## 🟡 IMPORTANT Findings

### 1. Command Injection Sanitizer Bypass via Newline / Carriage Return
*   **Location**: 
    *   `src/core/command_sanitizer.py` (L45-L74)
    *   `src/security/command_sanitizer.py` (DANGEROUS_PATTERNS)
*   **Description**: Carriage return (`\r`), newline (`\n`), and background ampersand (`&`) separator sequences bypass check block definitions, allowing command injection since only standard shell separators (e.g. `;`, `|`, `&&`) are matched in the regex.
*   **Action Items**:
    1. Add `\r` and `\n` to the command separator regex blacklist in both core and security sanitizers.
    2. Prefer parameterization over raw shell string execution where possible.

### 2. Insecure Defaults in Command Sanitizer strict_mode
*   **Location**: 
    *   `src/core/command_sanitizer.py` (L100)
    *   `src/core/executor.py` (L368)
*   **Description**: Defaults to `strict_mode=False` in the `CommandSanitizer` constructor, allowing suspicious commands (e.g. `eval`, `exec`) to execute and only outputting warnings.
*   **Action Items**:
    1. Default `strict_mode` to `True` in `CommandSanitizer`.
    2. Explicitly pass `strict_mode=True` when instantiating the sanitizer inside `executor.py`.

### 3. Plaintext Credential Exposure in Session Cache
*   **Location**: 
    *   `src/core/auth_session.py` (L63)
    *   `src/core/auth_types.py` (L165-177)
*   **Description**: User credentials are cached in plaintext inside session cache files `~/.mekong/session.json`.
*   **Action Items**:
    1. Store sensitive session credentials inside secure OS credential stores using the existing secure storage backend.
    2. If using file storage, encrypt the file contents using a machine-bound symmetric key.

### 4. SQLite Connection Resource Leak in CreditStore
*   **Location**: 
    *   `src/raas/credits.py` (L122, L246, L279)
*   **Description**: Context managers `with self._connect() as conn:` fail to close SQLite connection instances if exceptions are thrown during query execution, leaking file descriptors.
*   **Action Items**:
    1. Wrap connection management in a utility method or explicitly call `conn.close()` in a `finally` block.

### 5. Concurrency Data Loss & Corruption in Telemetry Cache
*   **Location**: 
    *   `src/core/telemetry_collector.py` (L294)
*   **Description**: The telemetry collector flush writes to a single shared file `telemetry-buffer.json` without any cross-process/thread file locking, leading to partial writes or JSON corruption.
*   **Action Items**:
    1. Implement file-level write locking via `fcntl.flock` or write unique event files.

### 6. Concurrency Data Loss on Telemetry Uploader Buffer Clearing
*   **Location**: 
    *   `src/core/telemetry_uploader.py` (L57-58)
*   **Description**: Deletes the entire cache file upon successful upload, losing events written to the file during the upload process.
*   **Action Items**:
    1. Perform atomic queue/file operations. Under a file lock, read the file, subtract the uploaded event IDs, and write the remaining events back to the file instead of unlinking it.

### 7. Nested Span Hierarchy Corruption in Custom Tracing
*   **Location**: 
    *   `src/core/tracing.py` (L157-158)
*   **Description**: Exiting any nested span resets the trace's current active span to `None` directly, rather than restoring the previous active parent span.
*   **Action Items**:
    1. Implement stack-based trace span storage in `TraceContext`. Pop the ended span and restore the previous span from the stack.

### 8. Duplicate PM2 Queries and Multiple Synchronous Reads of missions.json
*   **Location**: 
    *   `src/daemon/mission_control.py` (L321-368)
*   **Description**: Repeatedly executes PM2 processes and reads configuration file synchronously during metrics updates.
*   **Action Items**:
    1. Cache parsed results and fetch processes in a batch. Parse `missions.json` once, pass the parsed list to helper functions, and pass the fetched worker statuses directly to `get_metrics()`.

### 9. Re-planning Failed DAG Branch Discards Upstream Dependencies
*   **Location**: 
    *   `src/core/planner.py` (L541-625)
*   **Description**: Re-planning step wipes upstream mapping definitions, leading to parallel executor runs executing out of order.
*   **Action Items**:
    1. Modify `replan_failed_branch()` to map the original dependencies of the failed step onto the root tasks of the newly generated replacement branch.

### 10. Missing File Locks on Telemetry and Task Queue Journal
*   **Location**: 
    *   `src/daemon/task_router.py` (L324-353)
*   **Description**: Concurrent read/write on `missions.json` fails to acquire file locks, corrupting JSON data.
*   **Action Items**:
    1. Protect file operations with raw file lock handlers or use the existing `locked_append` from `src.core.file_lock`.

### 11. Blocking Synchronous Calls in Execution and Verification
*   **Location**: 
    *   `src/core/executor.py` (L174, L389, L398)
    *   `src/core/verifier.py` (L387-392)
*   **Description**: Blocks event loops on network requests or disk check calls via `subprocess.run()`, `time.sleep()`, and `requests.request()`.
*   **Action Items**:
    1. Refactor to use asynchronous equivalents (`asyncio.sleep()`, `httpx.AsyncClient`, and `asyncio.create_subprocess_exec`) or offload them to run inside an executor thread pool.

---

## 🟢 MODERATE Findings

### 1. Insecure File Creation and Permissive Directory Permissions
*   **Location**: 
    *   `src/core/auth_session.py` (L71)
    *   `src/core/api_key_manager.py` (L567)
*   **Description**: Files and directory `~/.mekong/` initialized with default open permissions, leaving secrets readable by other local processes.
*   **Action Items**:
    1. Enforce `0o700` directory permission and `0o600` file permissions on creation using `os.open` specifying `mode=0o600`.

### 2. Incomplete Standard Library Log Redirection to Structlog
*   **Location**: 
    *   `src/core/logging_config.py` (L30)
*   **Description**: Standard library logs bypass structlog processors, resulting in mixed JSON and plain-text logging formats.
*   **Action Items**:
    1. Configure standard library logging handlers to format records using `structlog.stdlib.ProcessorFormatter`.

### 3. Race Condition on Anomaly Baseline File Serialization
*   **Location**: 
    *   `src/core/anomaly_detector.py` (L180)
*   **Description**: Thread concurrency causes race conditions when reading/writing baselines file.
*   **Action Items**:
    1. Enforce locks and perform atomic temporary file swap-renaming.

### 4. Shared Timer State Corruption in Singleton PEV Logger
*   **Location**: 
    *   `src/core/pev_structured_logger.py` (L60, L137, L155-156)
*   **Description**: Multiple pipelines executing concurrently overwrite timer metrics since the `self._step_timers` dictionary is keyed only by `step_order`.
*   **Action Items**:
    1. Scope steps timer dictionaries by `(pipeline_id, step_order)` to isolate timer states per pipeline execution.

### 5. Non-Thread-Safe Singleton Accessors
*   **Location**: 
    *   `src/core/pev_structured_logger.py` (L315-320)
    *   `src/core/pev_metrics_collector.py` (L248-253)
*   **Description**: Core singletons lack locking guard during creation, allowing double allocation on initial parallel runs.
*   **Action Items**:
    1. Wrap initialization blocks in a thread lock using `threading.Lock` to ensure thread-safe single-instance creation.

### 6. Potential Pydantic v1 Compatibility Crash in Health Checks
*   **Location**: 
    *   `src/core/pev_health_checks.py` (L112-114)
    *   `src/raas/autopilot.py` (L241)
*   **Description**: Use of `.model_dump()` triggers AttributeError in Pydantic v1.
*   **Action Items**:
    1. Add compatibility check fallback helper to support both v1/v2 schema structures (e.g. fall back to `.dict()`).

### 7. Potential KeyError on Missing Tool Call ID in Local LLM Loop
*   **Location**: 
    *   `src/daemon/agent_loop.py` (L224)
*   **Description**: Attempting to direct access tool ID will raise KeyError if missing from local engine response payload.
*   **Action Items**:
    1. Retrieve key using `.get("id")` and fallback to generated uuid values.
