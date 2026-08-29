# Autonomy Failure Taxonomy — Phase G (Measure Only)

> Measurement doc. NO fixes, NO code changes. Every claim cites a verified file:line.
> Canonical events are emitted side-channel (non-fatal) into `performance_events`
> via `emitLoopEvent` (`tree/performance/loop-events.ts:153`).

## 1. Taxonomy class -> definition -> source codes -> producing file:line

The runner emits ONE `agent.failed` event per failed node and stamps it with a
`failure_class` computed live by `classifyAutonomyFailure`
(`production-graph-runner.ts:463`, `loop-events.ts:91-116`).

| # | Class | Definition | Existing codes that map to it | Producer (file:line) |
|---|---|---|---|---|
| 1 | `REASONING_ERROR` | Model ran out of tokens / produced incomplete or truncated reasoning | `REASONING_ERROR` (code) ; message regex `reasoning\|max.?tokens\|incomplete\|truncated` | `loop-events.ts:113`. Runner node-failure stamps `code: 'NODE_FAILED'` (`production-graph-runner.ts:442`) — classification only matches when the NODE_FAILED message carries the trigger keywords; otherwise falls through to UNKNOWN. |
| 2 | `BAD_CONTEXT` | Missing or corrupt run context (identity, workspace, input shape) | `BAD_CONTEXT` (code) ; message regex `context\|not.?found\|missing` | `loop-events.ts:111`. Runner node-failure emits `code: 'NODE_FAILED'` (`production-graph-runner.ts:442`); matches only when NODE_FAILED message contains the context keywords. |
| 3 | `BAD_MEMORY` | Memory retrieval failed or returned corrupt/invalid memories | `BAD_MEMORY` (code) ; message regex `memory\|retrieval` | `loop-events.ts:112`. No runner emit produces a code containing these strings today; real signal arrives only when the upstream `AgentResult.error.message` matches the regex (currently falls through to UNKNOWN in practice). |
| 4 | `TOOL_ERROR` | Function/tool invocation failed (invalid args, tool exec error, schema violation) | `TOOL_ERROR` (code) ; message regex `tool\|function.?call` | `loop-events.ts:108`. No runner emit produces a code containing these strings today; classified only when the upstream `AgentResult.error.message` matches the regex. |
| 5 | `PROVIDER_ERROR` | Provider API rejected the call (auth, 401/403, bad key, malformed response) | `PROVIDER_ERROR` (code) ; message regex `provider\|api.?key\|unauthorized\|401\|403` | `loop-events.ts:109`. Wired to the seed-layer `FailureKind.AUTH_FAILURE` / `tree/ai-providers/errors.ts:17` (`AIProviderErrorCode.AUTH_FAILURE`) path — those FailureKind values are not re-mapped to autonomy classes, so they reach the runner as a generic NODE_FAILED and are classified only when the provider error message matches the regex. |
| 6 | `TIMEOUT` | Node, provider, or step exceeded deadline (AbortError, deadline exceeded) | `TIMEOUT` (code) ; message regex `timeout\|timed.?out\|deadline` | `loop-events.ts:110`. Maps `seed/types/failure-kind.ts:16` `FailureKind.TIMEOUT` and the message-based branch at `failure-kind.ts:55` (`classifyError`). Runner again only classifies if the propagated NODE_FAILED message carries the timeout keywords. |
| 7 | `PERMISSION_ERROR` | Action not permitted by policy/role/autonomy level | `PERMISSION_DENIED` (code) ; message regex `permission\|not allowed` | `loop-events.ts:104`. **No existing producer** — neither the runner (`production-graph-runner.ts:89-99` `GraphRunnerErrorCode`) nor `quota/` nor `billing/` emit a `PERMISSION_DENIED` code. NEW SIGNAL NEEDED. |
| 8 | `APPROVAL_ERROR` | Human rejected the approval gate, or the gate timed out | `APPROVAL_REJECTED`, `APPROVAL_TIMEOUT` (code) ; context `approvalOutcome in {rejected, timeout}` | `loop-events.ts:102,105`. Real producer: `production-graph-runner.ts:359-370` emits code `APPROVAL_REJECTED`/`APPROVAL_TIMEOUT` on the gate path (note: those events flow through `approval.rejected` emit at `:346-356`; the runner does NOT re-emit them as `agent.failed`, so this class is signaled via `approval.rejected.reasonCode`). |
| 9 | `COST_LIMIT` | Mission budget exhausted before/while running the node | `BUDGET_EXCEEDED` (code) ; context `budgetExhausted` ; message regex `budget\|spent\|cost` | `loop-events.ts:103`. Real producer: `production-graph-runner.ts:381-391` emits `code: 'BUDGET_EXCEEDED'` and returns. That failure path does NOT call `emitAgentFailed` — the budget terminal fail bypasses the Q7 emitter. The `BUDGET_EXCEEDED` code is recovered from the Inngest event `production.graph.failed.errorCode` (`production-graph-runner.ts:801-824`), NOT from `performance_events`. |
| 10 | `POLICY_BLOCK` | Autonomy/compliance policy forbids the action (tier gate, autonomy level) | `POLICY_BLOCK` (code) ; message regex `policy\|autonomy.?level` | `loop-events.ts:106`. **No existing producer** — the code string `POLICY_BLOCK` is defined in the taxonomy (`loop-events.ts:79`) but nothing in `src/` emits it. NEW SIGNAL NEEDED. |
| 11 | `USER_AMBIGUITY` | User intent was ambiguous / required clarification to proceed | `USER_AMBIGUITY` (code) ; message regex `ambiguous\|clarif` ; context `userInterventionRequired` | `loop-events.ts:107,114`. **No existing producer** in `src/`. NEW SIGNAL NEEDED. |
| 12 | `UNKNOWN` | Catch-all when no code/message matches any class | fallback | `loop-events.ts:115`. Real producer: every `agent.failed` whose `code`/`message` doesn't trip any branch. This is the dominant class at the moment because the runner stamps `code: 'NODE_FAILED'` (`production-graph-runner.ts:442`), which is NOT in the classification table — unless its message happens to match a keyword regex. |

### Classes with NO existing producer (new signal needed)

- `PERMISSION_ERROR` — no `PERMISSION_DENIED` code is emitted anywhere (verified by grep across `src/`).
- `POLICY_BLOCK` — defined at `loop-events.ts:79`, never emitted.
- `USER_AMBIGUITY` — defined at `loop-events.ts:80`, never emitted.

These three are taxonomy placeholders for signals that do not yet exist in the
emitter layer. They MUST NOT be fabricated during measurement; they count as
zero until an emitter is wired.

## 2. `classifyAutonomyFailure()` reference spec

Pure function at `tree/performance/loop-events.ts:91-116`, exported via
`tree/performance/index.ts:39`. Signature:

```ts
function classifyAutonomyFailure(
  error: unknown,
  context?: {
    code?: string;
    message?: string;
    approvalOutcome?: 'approved' | 'rejected' | 'timeout' | 'skipped';
    budgetExhausted?: boolean;
    permissionDenied?: boolean;
    userInterventionRequired?: boolean;
  }
): AutonomyFailureClass
```

Input normalization (`loop-events.ts:99-100`):
- `code` = `context.code ?? error.code ?? ''`, upper-cased.
- `message` = `context.message ?? (Error ? error.message : '')`, lower-cased.

Priority-ordered branch table (top-down; FIRST match wins):

| Priority | Branch condition | Returns |
|---|---|---|
| 1 | `approvalOutcome` in `['rejected','timeout']` | `APPROVAL_ERROR` |
| 2 | `budgetExhausted` OR `code==='BUDGET_EXCEEDED'` OR message matches `/budget\|spent\|cost/i` | `COST_LIMIT` |
| 3 | `permissionDenied` OR `code==='PERMISSION_DENIED'` OR message matches `/permission\|not allowed/i` | `PERMISSION_ERROR` |
| 4 | `code==='APPROVAL_REJECTED'` OR `code==='APPROVAL_TIMEOUT'` | `APPROVAL_ERROR` |
| 5 | `code==='POLICY_BLOCK'` OR message matches `/policy\|autonomy.?level/i` | `POLICY_BLOCK` |
| 6 | `code==='USER_AMBIGUITY'` OR message matches `/ambiguous\|clarif/i` | `USER_AMBIGUITY` |
| 7 | `code==='TOOL_ERROR'` OR message matches `/tool\|function.?call/i` | `TOOL_ERROR` |
| 8 | `code==='PROVIDER_ERROR'` OR message matches `/provider\|api.?key\|unauthorized\|401\|403/i` | `PROVIDER_ERROR` |
| 9 | `code==='TIMEOUT'` OR message matches `/timeout\|timed.?out\|deadline/i` | `TIMEOUT` |
| 10 | `code==='BAD_CONTEXT'` OR message matches `/context\|not.?found\|missing/i` | `BAD_CONTEXT` |
| 11 | `code==='BAD_MEMORY'` OR message matches `/memory\|retrieval/i` | `BAD_MEMORY` |
| 12 | `code==='REASONING_ERROR'` OR message matches `/reasoning\|max.?tokens\|incomplete\|truncated/i` | `REASONING_ERROR` |
| 13 | `userInterventionRequired` | `USER_AMBIGUITY` |
| **fallback** | none of the above | **`UNKNOWN`** (`loop-events.ts:115`) |

Note the priority trap: `PROVIDER_ERROR` (branch 8) will swallow a message
containing "401" even if it was really a timeout string — but only after TIMEOUT
(branch 9) was checked first, so timeout keywords still win. `BUDGET_EXCEEDED`
must reach the helper as either `context.budgetExhausted`, `code`, or a message
containing "budget/spent/cost" — the runner's `BUDGET_EXCEEDED` return value at
`production-graph-runner.ts:390` is NOT passed through `classifyAutonomyFailure`
(no `emitAgentFailed` call on that path).

## 3. Measuring each class from Phase C canonical events

All classes are derived from events in `REALITY_LOOP_EVENT_TYPES`
(`loop-events.ts:40-54`). Canonical measurement surface:

- **PRIMARY signal** — `agent.failed` events (`loop-events.ts:44`), one per
  failed node. Each carries `failure_class` stamped by the runner
  (`loop-emitters-runner.ts:104`, computed at
  `production-graph-runner.ts:463` via `classifyAutonomyFailure`). To count a
  class: `SELECT failure_class, COUNT(*) FROM performance_events WHERE
  event_type='agent.failed' GROUP BY failure_class`. This is the ONLY event
  that carries `failure_class` directly.

- **SUPPLEMENTARY signals** (do not carry `failure_class`; they bound the denominator / add context):
  - `mission.created` → total missions started (funnel denominator for Q7/Q8).
  - `mission.abandoned` → missions that never reached completion; carries
    `reason` + `stage` (`loop-emitters-runner.ts:36-48`). NOTE: `reason` is a
    free-text field, NOT the structured `GraphRunnerErrorCode`. The runner
    terminal-fails call `emitFailed` (`production-graph-runner.ts:801-824`),
    which sends the Inngest event `production.graph.failed` (with
    `errorMessage` carrying the `GraphRunnerErrorCode` string such as
    `BUDGET_EXCEEDED`) — that code is NOT written into the loop
    `mission.abandoned` row. To recover `COST_LIMIT` / `APPROVAL_ERROR` you
    must read `production.graph.failed.errorCode` from Inngest event logs, not
    from `performance_events`. `mission.abandoned.reason` alone is insufficient.
  - `agent.started` → pairs with `agent.failed` to compute per-node failure
    rate; `agent.failed` without a matching `agent.started` indicates a
    side-channel emit miss (logging only, not a flow abort — `loop-events.ts:170`).
  - `approval.requested` / `approval.approved` / `approval.rejected` → feed
    `APPROVAL_ERROR` via `reasonCode` (`APPROVAL_REJECTED`/`APPROVAL_TIMEOUT`)
    at `loop-emitters-runner.ts:174-187`. `approval.rejected` is the canonical
    human-rejection signal (Q6).
  - `creative.accepted` / `creative.rejected` → NOT failure classes; they track
    creative acceptance (Q3), not autonomy breaks. Do not mix into this taxonomy.
  - `memory.used` / `memory.corrected` → feed `BAD_MEMORY` as a secondary signal;
    `memory.corrected` counts cases the system had to fix its own recall.
  - `mission.cost_recorded` → feeds `COST_LIMIT` as an economic signal (Q4),
    complementing `BUDGET_EXCEEDED` recovered from `production.graph.failed`.

Concrete rule: a failure class is "measured" iff it appears in the
`failure_class` column of an `agent.failed` row; for `COST_LIMIT` and
`APPROVAL_ERROR` the authoritative source is the Inngest event
`production.graph.failed.errorCode` (`production-graph-runner.ts:819`), NOT the
loop `performance_events` table. `BAD_MEMORY`, `PERMISSION_ERROR`, `POLICY_BLOCK`,
`USER_AMBIGUITY` currently have no event producer and MUST be reported as zero
until wired.

## 4. Known limitations — what events alone cannot classify

1. **Silent provider hang (no `agent.failed` event).** If a provider stalls and
   the Inngest step itself times out (step-level deadline), the runner may
   terminal-fail without ever reaching the `emitAgentFailed` call at
   `production-graph-runner.ts:454`. That miss leaves no `agent.failed` row and
   the failure is invisible to event-based taxonomy counts. Needs runner-level
   step-timeout telemetry (not yet emitted).

2. **Runner-stamped `NODE_FAILED` is opaque.** The canonical runner wraps every
   upstream failure as `code: 'NODE_FAILED'`
   (`production-graph-runner.ts:442`). Since `NODE_FAILED` is not in the
   `classifyAutonomyFailure` table, classification relies entirely on the
   upstream message regex. If the upstream `AgentResult.error.message` is
   generic (e.g. "Agent returned success=false"), the class collapses to
   `UNKNOWN`. The original upstream error code is lost at the runner boundary.

3. **Budget / approval terminal fails bypass `agent.failed`.**
   `BUDGET_EXCEEDED` (`production-graph-runner.ts:388-390`) and
   `APPROVAL_REJECTED`/`APPROVAL_TIMEOUT` (`:367-370`) call `failTerminal` +
   `emitFailed` but NOT `emitAgentFailed`, so they produce no `agent.failed`
   row and carry no `failure_class`. The codes are recovered from the Inngest
   event `production.graph.failed.errorCode` (`production-graph-runner.ts:819`).
   The loop `mission.abandoned` event carries a free-text `reason` field
   (`loop-emitters-runner.ts:46`), NOT the structured `GraphRunnerErrorCode`, so
   it cannot be used to recover these classes.

4. **Side-channel loss is silent.** `emitLoopEvent` swallows all write errors
   and returns `false` (`loop-events.ts:169-177`). A D1 write failure for an
   `agent.failed` event means the failure is counted nowhere, with no alert.
   Telemetry health can only be observed via the logger warn at `:170`.

5. **`BAD_CONTEXT`, `BAD_MEMORY`, `TOOL_ERROR` have no dedicated emitter.** The
   runner only emits them when the upstream message regex matches; absent that,
   the real upstream failure code is flattened to UNKNOWN.

Bottom line: the taxonomy is a best-effort lower bound. UNKNOWN counts are
expected to be high until (a) the runner propagates the upstream error code
instead of collapsing to `NODE_FAILED`, and (b) the three missing producers
(`PERMISSION_DENIED`, `POLICY_BLOCK`, `USER_AMBIGUITY`) are wired. Measure first;
do not fix in this phase.

---
PHASE G WRITTEN: /Users/macbook/sophia-ai-factory/docs/reality-loop/AUTONOMY_FAILURE_TAXONOMY.md
