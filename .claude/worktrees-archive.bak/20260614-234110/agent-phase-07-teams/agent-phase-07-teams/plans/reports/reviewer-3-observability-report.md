# Observability and Telemetry Audit Report — mekong-cli

**Date**: 2026-05-31
**Audited Codebase**: mekong-cli (`src/`)
**Target Area**: Telemetry, OTel tracing overhead, MCU billing database contention, resource leaks, PII exposure in logs/metrics, and Pydantic v1 compatibility.

---

## Review Summary

**Verdict**: REQUEST_CHANGES

### Rationale
Although the unit tests pass successfully, the codebase contains major concurrency flaws, transaction isolation risks, database connection leaks, and potential PII telemetry exposure. In particular, the shared SQLite connection state in `MCUGate`, file handle resource leaks in `CreditStore`, and telemetry data-loss race conditions must be resolved before this system is shipped to production.

---

## Findings

### [CRITICAL] Finding 1: SQLite Transaction Race Conditions on Shared DB Connection
- **What**: Concurrent threads calling transaction functions on `MCUGate` will collide and interfere because they share a single connection object `self._conn` created with `check_same_thread=False`.
- **Where**: `src/core/mcu_gate.py` (L74)
  - `self._conn = sqlite3.connect(self._db_path, check_same_thread=False)`
- **Why**: SQLite connections are not thread-safe. When multiple threads execute `BEGIN IMMEDIATE`, `COMMIT`, or `ROLLBACK` on the same connection object:
  1. A thread will raise `sqlite3.OperationalError: cannot start a transaction within a transaction` if another thread has already begun one.
  2. Transaction operations can overlap, leading to one thread committing or rolling back the work of another thread.
- **Suggestion**: Use thread-local connections (e.g. `threading.local()`) or instantiate a new connection using a context manager for each transaction operation.

### [CRITICAL] Finding 2: PII Telemetry Exposure via Unhashed Error Messages
- **What**: Telemetry events capture and transmit raw, unhashed error messages to the gateway backend.
- **Where**: `src/core/telemetry_hooks.py` (L190)
  - `error_message=error_message,`
- **Why**: Error messages and stack traces often contain sensitive user data (PII), absolute local directory paths (e.g., `/Users/username/secrets/...`), API keys, email addresses, database URLs, and environment variables. Sending them unhashed exposes private user information.
- **Suggestion**: Implement a sanitization regex filter to scrub common PII patterns, auth tokens, emails, and path prefixes before event serialization.

### [IMPORTANT] Finding 3: SQLite Connection Resource Leak in CreditStore
- **What**: Multiple methods in `CreditStore` leak SQLite connection handles.
- **Where**: `src/raas/credits.py` (L122, L246, L279)
  - `with self._connect() as conn:` in `get_balance()`, `add()`, and `get_history()`.
- **Why**: In Python, `with sqlite3.connect(...) as conn` manages database transactions (committing/rolling back). It does **not** close the connection handle upon block exit. As a result, every call to these methods leaves a connection open, leaking file descriptors and eventually leading to process exhaustion and OOM crashes.
- **Suggestion**: Wrap connection management in a utility method or explicitly call `conn.close()` in a `finally` block:
  ```python
  conn = self._connect()
  try:
      # database actions
  finally:
      conn.close()
  ```

### [IMPORTANT] Finding 4: Concurrency Data Loss & Corruption in Telemetry Cache
- **What**: The telemetry collector flush method writes to a single shared file `telemetry-buffer.json` without any cross-process/thread file locking.
- **Where**: `src/core/telemetry_collector.py` (L294)
  - `def _flush(self) -> None:`
- **Why**: If multiple CLI processes or daemon threads execute concurrently and flush the buffer at similar times, they will read the same file, append events locally, and overwrite each other's changes, leading to telemetry data loss or corrupted JSON files.
- **Suggestion**: Implement file-level advisory locking (e.g., using `portalocker` or `fcntl`) when reading/writing the `telemetry-buffer.json` file.

### [IMPORTANT] Finding 5: Concurrency Data Loss on Telemetry Uploader Buffer Clearing
- **What**: The telemetry uploader unlinks (deletes) the entire telemetry buffer file after uploading events, ignoring any new events written during the upload.
- **Where**: `src/core/telemetry_uploader.py` (L57-58)
  - `self._collector.clear_buffer()`
- **Why**: The uploader gets pending events, sends them via HTTP (which takes time), and then unlinks the buffer file. Any telemetry events written by concurrent tasks *during* the HTTP post duration are deleted and permanently lost.
- **Suggestion**: Perform atomic queue/file operations. Under a file lock, read the file, subtract the uploaded event IDs, and write the remaining events back to the file instead of unlinking it.

### [IMPORTANT] Finding 6: Nested Span Hierarchy Corruption in Custom Tracing
- **What**: Entering and exiting nested spans in custom tracing destroys the span parenting pointer.
- **Where**: `src/core/tracing.py` (L157-158)
  - `self._parent_context._set_current_span(None)`
- **Why**: Exiting any span resets the trace's current active span to `None` directly, rather than restoring the previous active parent span. If there are nested spans, when the child exits, the parent span's context is lost, causing subsequent spans to be attached to the root trace.
- **Suggestion**: Store active spans in a stack (a thread-local list) within `TraceContext`. Pop the ended span and restore the previous span from the stack.

### [MODERATE] Finding 7: Incomplete Standard Library Log Redirection to Structlog
- **What**: Standard library log outputs are configured separately and do not route format-wise to structlog.
- **Where**: `src/core/logging_config.py` (L30)
  - `logging.basicConfig(level=log_level, format="%(message)s")`
- **Why**: Logs emitted by third-party packages (e.g., `requests`, `uvicorn`, `fastapi`) will print as raw strings bypassing structlog's JSON processors, causing unstructured text to mix with structured JSON in the log aggregator.
- **Suggestion**: Configure standard library logging handlers to format records using `structlog.stdlib.ProcessorFormatter`.

### [MODERATE] Finding 8: Potential Pydantic v1 Compatibility Crash in Health Checks and Autopilot
- **What**: Health checks and autopilot endpoints utilize `model_dump()`, which is a Pydantic v2 method.
- **Where**:
  - `src/core/pev_health_checks.py` (L112)
  - `src/raas/autopilot.py` (L241)
- **Why**: When deployed on environments or integrated with projects locked to Pydantic v1 (which uses `.dict()`), calling `.model_dump()` will cause a crash with `AttributeError`.
- **Suggestion**: Use a version-resilient serializer fallback helper:
  ```python
  def dump_model(model):
      return model.model_dump() if hasattr(model, 'model_dump') else model.dict()
  ```

---

## Verified Claims

I have independently run the billing and telemetry test suites to verify system correctness:

1. **Billing & MCU Gate Tests**:
   - Command: `poetry run pytest tests/billing/ tests/core/test_mcu_billing.py tests/test_mcu_gate.py`
   - Outcome: **PASS** (all isolated database tests passed)
   - Scope: Checks lock balances, seeds, refunds, and isolations under sequential execution.

2. **Custom Tracing & Telemetry Tests**:
   - Command: `poetry run pytest tests/test_tracing.py tests/test_pev_telemetry.py tests/test_tiered_telemetry.py`
   - Outcome: **PASS** (all tests passed)
   - Scope: Verifies trace lifecycle, tiered storage, and metric collectors.
   - Note on Tracing: The current test `test_nested_spans` passes only because it never executes `__enter__` on the nested span inside a nested block, which fails to trigger the `_set_current_span(None)` parent loss bug.

---

## Coverage Gaps
- **Concurrent DB contention**: The test suite does not include concurrent thread stress-testing for `MCUGate` or `CreditStore`. Real-world concurrency will trigger SQLite lock errors/race conditions that unit tests miss.
- **PII Exposure Validation**: Telemetry events lack integration tests verifying whether PII leaks are blocked.

---

# Adversarial Review & Challenge Report

**Overall Risk Assessment**: HIGH

## Challenges

### [Critical] Challenge 1: SQLite Connection Exhaustion Crash
- **Assumption challenged**: That Python's `with sqlite3.connect() as conn` automatically closes the connection.
- **Attack scenario**: High volume API requests to the `/health` or `/autopilot` endpoints or constant daemon polling will invoke `get_balance` and `get_history` repeatedly.
- **Blast radius**: The process will quickly run out of file descriptors (OS limit reached), raising `sqlite3.OperationalError: unable to open database file` or OS socket failure, causing complete downtime of the `mekong-cli` daemon.
- **Mitigation**: Implement strict connection cleanup via standard `try/finally` blocks and a centralized connection management lifecycle.

### [Critical] Challenge 2: Telemetry Data Loss via Uploader Race Condition
- **Assumption challenged**: The telemetry queue operates sequentially and does not receive new events during the upload.
- **Attack scenario**: While the CLI is running a long orchestration task, it flushes telemetry events to the API backend. During the network POST request, the CLI completes a step and appends a new event to `telemetry-buffer.json`.
- **Blast radius**: Once the HTTP request finishes successfully, the uploader calls `clear_buffer()`, unlinking the buffer file. The newly logged event is permanently deleted without ever being sent.
- **Mitigation**: Read-modify-write the buffer file under lock, deleting only the specific items that were uploaded.

### [High] Challenge 3: Transaction Pollution on Concurrent Requests
- **Assumption challenged**: That `check_same_thread=False` allows safe concurrent transactions on a shared connection.
- **Attack scenario**: Two parallel web requests try to lock MCU credits for the same tenant at the same time.
- **Blast radius**: The shared SQLite connection will attempt overlapping `BEGIN IMMEDIATE` blocks, throwing exceptions. Worse, one request's `COMMIT` will finalize changes for both requests, resulting in incorrect balance locked state.
- **Mitigation**: Restructure `MCUGate` to fetch a connection from a thread-local object or pool for each operation.

---

## Stress Test Scenarios

- **Concurrent MCUGate lock check**: Run 10 parallel threads invoking `check_and_lock` on `MCUGate` concurrently.
  - *Expected behavior*: All locks either succeed or fail gracefully with concurrency busy timeouts.
  - *Predicted behavior*: Random transaction crashes (`cannot start a transaction within a transaction`) and database corruption. (FAIL)

- **Connection leak check**: Invoke `get_balance` in a loop 2000 times.
  - *Expected behavior*: Process runs successfully with constant file descriptor count.
  - *Predicted behavior*: File descriptor exhaustion crash. (FAIL)
