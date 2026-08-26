# PRODUCTION FACTORY — Autonomous Multi-Agent Production / Nhà Máy Sản Xuất Tự Động

> Phase 3 (Autonomous Factory) — Sophia 2027.
> Last updated: 2026-08-27. All claims below are verified against source code in `apps/sophia-ai-factory/`.
> Cập nhật lần cuối: 2026-08-27. Mọi mô tả dưới đây đã được kiểm chứng trực tiếp trong mã nguồn.

---

## What this is / Đây là gì

**EN:** The Production Factory lets a team of AI agents produce content for you automatically, step by step, like an assembly line. You choose how much freedom the agents have. Before anything is published, the system can stop and ask for your approval. You can watch everything on the System Health dashboard.

**VI:** Nhà Máy Sản Xuất cho phép một nhóm trợ lý AI tự động tạo nội dung cho bạn theo từng bước, giống như một dây chuyền. Bạn chọn mức độ tự do của AI. Trước khi bất cứ gì được đăng tải, hệ thống có thể dừng lại và xin phép bạn. Bạn theo dõi mọi thứ trên trang Sức Khỏe Hệ Thống.

---

## For customers (no technical background) / Dành cho khách hàng

### How it works, in plain words / Cách hoạt động, nói đơn giản

1. 🧩 **You pick a recipe** — for example "Article Factory" (research → write draft → polish & publish).
   👉 **Bạn chọn một công thức** — ví dụ "Nhà Máy Bài Viết" (nghiên cứu → viết nháp → hoàn thiện & đăng).
2. 🤖 **AI agents do each step** — one agent researches, another writes, another polishes.
   👉 **Mỗi trợ lý AI làm một bước** — một trợ lý nghiên cứu, một trợ lý viết, một trợ lý hoàn thiện.
3. ✋ **You stay in control** — depending on the autonomy level you chose, the system pauses and asks you before publishing.
   👉 **Bạn luôn nắm quyền** — tùy mức tự trị bạn chọn, hệ thống sẽ dừng và hỏi bạn trước khi đăng tải.
4. 🔄 **If something fails, it retries automatically** — with increasing waiting time, up to a limit you can set.
   👉 **Nếu có lỗi, hệ thống tự thử lại** — thời gian chờ tăng dần, đến giới hạn bạn đặt.
5. 📊 **You watch the results** — the System Health dashboard shows completion rate, pending approvals, spend, and more.
   👉 **Bạn theo dõi kết quả** — trang Sức Khỏe Hệ Thống hiển thị tỷ lệ hoàn thành, danh sách chờ duyệt, chi phí, v.v.

### The four autonomy levels / Bốn mức tự trị

| Level / Mức | Name / Tên | What happens / Điều gì xảy ra |
|---|---|---|
| **L0** | Manual / Thủ công | No automatic runs — everything is done by you. / Không chạy tự động — mọi việc do bạn làm. |
| **L1** | Assisted / Hỗ trợ | Agents only do read-only work; every draft needs your review. / AI chỉ làm việc đọc; mọi bản nháp cần bạn duyệt. |
| **L2** | Supervised / Giám sát (**default / mặc định**) | Agents run freely through content steps, but **publishing always asks for your approval first**. / AI chạy tự do các bước nội dung, nhưng **đăng tải luôn hỏi bạn trước**. |
| **L3** | Full auto / Tự động hoàn toàn | Agents run without approval, limited by a budget cap and retry limit you set. / AI chạy không cần duyệt, giới hạn bởi ngân sách và số lần thử lại bạn đặt. |

**Safe by default / An toàn mặc định:** if you never configure anything, the system uses **L2 Supervised with publish approval required** — agents can work, but nothing is published without your OK.
Nếu bạn không cấu hình gì, hệ thống dùng **L2 Giám sát với bắt buộc duyệt trước khi đăng** — AI làm việc được, nhưng không gì được đăng nếu bạn chưa đồng ý.

### Where to look / Xem ở đâu

- 📊 **System Health dashboard / Trang Sức Khỏe Hệ Thống:** `/dashboard/system-health` (Vietnamese: `/vi/dashboard/system-health`)
- ✅ **Approvals / Danh sách duyệt:** `/dashboard/approvals`
- ⚙️ **Autonomy settings / Cài đặt tự trị:** `/dashboard/settings/autonomy`

---

## Technical architecture / Kiến trúc kỹ thuật

> Audience: developers. Layer paths are relative to `apps/sophia-ai-factory/`.

### 1. Multi-agent production graph (DAG)

A production graph is a directed acyclic graph of agent nodes. Contracts live in `src/seed/types/production-factory.ts`:

- `GraphNodeDefinition` — one node = one agent run (`agentSlug`, optional `isPublishNode`, optional `inputJson`)
- `GraphEdgeDefinition` — `{ from, to }`
- `GraphDefinition` — `{ nodes, edges }`, stored as JSON in `production_graphs.definition_json`

**Validation** (`src/tree/production-graph/validate.ts`, pure and deterministic) rejects with stable error codes:
`EMPTY_GRAPH` · `DUPLICATE_NODE_ID` · `UNKNOWN_EDGE_NODE` · `UNKNOWN_AGENT` · `CYCLE_DETECTED` (iterative DFS, three-color marking) · `MULTIPLE_SINKS` / `NO_SINK` (exactly one sink required). Output is a `ValidatedGraph` with `sinkIds` and a Kahn-algorithm `topologicalOrder` (ties broken by definition order).

**Storage** (migration `migrations/0257_production_factory.sql`, additive-only):

| Table | Purpose |
|---|---|
| `mission_type_policies` | per-(workspace, mission_type) autonomy policy: `autonomy_tier`, `require_publish_approval`, `max_cost_cents_per_run`, `max_auto_retries` |
| `production_graphs` | graph templates/instances (`definition_json`, `UNIQUE(workspace_id, slug)`) |
| `production_graph_runs` | one execution: `status`, `phase`, `node_states_json` checkpoint, `output_json`, `error_json`, `total_cost_cents`, `total_tokens`, `retry_count` |
| `creative_missions.mission_type` | new column, `DEFAULT 'general'` (enables per-mission-type policies) |

Run status lifecycle: `queued → running → awaiting_approval → completed | failed | cancelled`.
Phases: `planning | executing | awaiting_approval | publishing | review`.

**Built-in templates** (`src/tree/production-graph/templates.ts`, 3 deterministic linear DAGs; sink is always the publish node):

| Slug | Nodes | Agents |
|---|---|---|
| `article-factory` | research → draft → polish (publish) | `sophia-researcher`, `sophia-editor` |
| `video-brief` | research → script-brief → thumbnail-copy (publish) | `sophia-researcher`, `sophia-strategist` |
| `repurpose-derivative` | summarize → thread → newsletter (publish) | `sophia-editor`, `sophia-strategist` |

`ensureTemplatesSeeded(workspaceId)` is idempotent: existing slugs are left untouched; a concurrent insert is treated as already-seeded (`CONFLICT` swallowed). Graph ids are deterministic: `graph_{workspaceId}_{slug}`.

The three graph agents are registered in `src/tree/agent-protocol/graph-agents.ts`. Editor and strategist carry the `publish_content` permission with `requiresApproval: true` — the executor hard-fails `AUTONOMY_DENIED` unless the runner supplies the tool id in `context.approvedActionIds`.

### 2. Graph runner (Inngest function)

`src/forest/inngest/functions/production-graph-runner.ts` — consumes `production.graph.started`, `retries: 1`. Sequence:

1. Load run / graph / mission (fail codes `RUN_NOT_FOUND`, `GRAPH_NOT_FOUND`, `MISSION_NOT_FOUND`)
2. Validate definition against `agentDefinitionRegistry` slugs (`INVALID_GRAPH`)
3. Guarded flip `queued → running` (phase `executing`)
4. `resolveEffectiveAutonomy({ workspaceId, missionType, missionAutonomyLevel })` — fail-closed policy
5. Build per-run BYOK provider registry keyed to the mission creator (`buildProviders`, OpenRouter + Claude-Fable, `autoRegister: true`) — direct call, never inside `step.run` (live provider objects must not cross the serialization boundary)
6. `hydrateNodeStates` — resume path: nodes already `completed`/`skipped` in `node_states_json` are skipped
7. Node loop in topological order:
   - Publish node + policy requires approval → flip to `awaiting_approval` (phase `publishing`) → `requestApprovalAndAwait` (24h window, `APPROVAL_TIMEOUT_MS`). Rejected → `APPROVAL_REJECTED`; timeout → `APPROVAL_TIMEOUT`. Approved (or gate `skipped`) → `approvedActionIds = [publish_content]`
   - Publish node at full-auto tier → token granted directly, no human gate
   - Budget guard before each node: `mission.budgetCents - spentCents - totalCostCents <= 0` → `BUDGET_EXCEEDED`
   - `initAgentRun` (run id `{graphRunId}:{nodeId}:{retryCount}`) → `executeAgent(definition, context, providerRegistry)` with `effectivePolicy` on the context
   - Failure → node marked failed, checkpoint written, run failed with `NODE_FAILED`
   - Success → cost/tokens accumulated, `recordSpend` (non-fatal), checkpoint, `recordPerformanceEvent('graph_node_completed')` (non-fatal)
8. Terminal success: `completeRun` with sink node output → emit `production.graph.completed` → `advanceMissionToReview(missionId)`

Events (`src/seed/inngest/event-types.ts`): `production.graph.started` / `production.graph.completed` / `production.graph.failed` (payloads typed in `seed/types/production-factory.ts`).

### 3. Human approval gates (pause-and-await)

`src/forest/inngest/functions/agent-approval-gate.ts` — `requestApprovalAndAwait(input, deps)`:

1. Memoized approval id (stable across Inngest retries)
2. `createApproval` row with `timeout_at`
3. Guarded flip `running → awaiting_approval`; if the run already moved on, the gate returns `skipped` (never fails)
4. Emits `agent.approval.requested` — **the first real sender of this event** in the codebase
5. Awaits `agent.approval.resolved` via a filter-loop adapter (`waitForResolution`, max 64 passes): Inngest `waitForEvent` match can only compare against the triggering event, so each resolved event is inspected and only a matching `approvalId` wakes the wait. Step ids are unique per attempt+pass so retries create fresh waits
6. Outcomes: `approved` (returns `approvedActionIds`) · `rejected` (run failed `APPROVAL_REJECTED`) · `timeout` (run failed `APPROVAL_TIMEOUT`)

Humans approve/reject on the existing console (`/dashboard/approvals`, ApprovalQueue) — `land/creative-mission/actions.ts` emits `agent.approval.resolved`, which wakes the waiting runner. Zero new approval UI.

**Timeout safety net:** `src/forest/inngest/functions/approval-timeout-cron.ts` (cron `*/15 * * * *`, `retries: 2`) calls `expireStaleApprovals()` (`src/tree/mission/agent-run-repo.ts`) — pending approvals past `timeout_at` are expired and their awaiting runs failed with `APPROVAL_TIMEOUT`. Guarded and idempotent, so overlapping sweeps are safe.

### 4. Autonomy levels L0–L3

See [AUTONOMY.md](./architecture/AUTONOMY.md) for the full model. Summary: operator tiers L0–L3 map onto the canonical `AutonomyLevel` 0–4 via `TIER_TO_STORED_LEVEL = { 0: 0, 1: 2, 2: 3, 3: 4 }` (`src/tree/autonomy/effective-autonomy.ts`). The resolver is fail-closed: no policy anywhere → built-in default **L2 Supervised, `require_publish_approval = 1`**. A mission-row `autonomy_level` only ever CAPS the stored level.

### 5. Retry / resume with backoff

**Backoff math** (`src/tree/mission/retry-backoff.ts`, pure module):

```
delay(retryCount) = min(30 min, 5 min · 2^retryCount)
retryCount 0 → 5 min · 1 → 10 min · 2 → 20 min · ≥3 → capped 30 min
```

`nextRetryAtMs`, `isRetryDue`, `isRetriesExhausted` — no I/O, no clocks, fully deterministic.

**Rollback cron** (`src/forest/inngest/functions/agent-rollback-cron.ts`, cron `*/5 * * * *`, `retries: 0`):

- Scans ALL failed runs oldest-first (`SCAN_LIMIT = 100`) — the old fixed 30-minute window is gone, so runs that failed hours ago are no longer abandoned
- Retry cap per (workspace, mission_type) from `mission_type_policies.max_auto_retries`; fallback `DEFAULT_MAX_AUTO_RETRIES = 3` when the table is absent/unreadable (non-fatal)
- Retries exhausted → guarded flip to `cancelled` with `error_json.code = 'RETRIES_EXHAUSTED'` (terminal — no more scan churn)
- Otherwise, once backoff elapsed → guarded claim (`WHERE id=? AND status='failed'`, `meta.changes === 0` skips losers of a double-scan race) and re-dispatch `agent.mission.started` with the SAME runId (resume path)
- Runs without a `mission_id` are left failed and logged (the executor requires a mission)

**Graph resume:** the runner re-hydrates node states from `node_states_json` and skips completed nodes (checkpoint written after every node).

### 6. Production monitoring dashboard

**Page:** `src/app/[locale]/dashboard/system-health/page.tsx` (`force-dynamic`, bilingual via `next-intl` namespace `productionMonitoring` — 27 keys, symmetric in `messages/en.json` and `messages/vi.json`). Membership resolution: first org by `created_at`. Mounts KPI cards, the pending-approvals list, and the previously-orphaned `HarnessHealthCard` (inside `QueryProvider`).

**KPIs** (`src/land/production-monitoring/dashboard-summary.ts`, pure read module, `Result<T,E>`):

| KPI | Source |
|---|---|
| Pipeline completion % | `production_graph_runs` completed / (completed + failed) |
| Approval turnaround (median hours) | `agent_approvals` resolved durations, scoped via owning `agent_runs.workspace_id` |
| Retry success % | completed runs with `retry_count > 0` / completed |
| Spend per run (avg cents) | terminal `total_cost_cents` / terminal runs |
| Active runs | status in (`queued`, `running`, `awaiting_approval`) |
| Pending approvals | `agent_approvals` status `pending` |

Empty database is safe: ratios degrade to `null` ("no data"), counts to 0. Timestamp discipline: `production_graph_runs` stores milliseconds; `agent_approvals` stores seconds (converted at the boundary).

**Server action:** `src/land/production-monitoring/actions.ts` — `getDashboardSummaryAction`: Zod validation → `getCurrentUser()` → `org_members` membership check (IDOR prevention) → summary.

**Alerts** (`src/tree/alerts/production-alert-triggers.ts`, via `createRealtimeAlert`; `AlertType` union extended additively in `realtime-alert-types.ts`):

| Trigger | Type | Severity |
|---|---|---|
| Run cancelled, retries exhausted | `production.run_cancelled` | high |
| Approval expired past deadline | `production.approval_expired` | critical if >4h overdue, else medium |
| Budget cap reached/warning | `production.budget_cap` | high at ≥100%, else medium |

No-Tech doctrine respected: alerts are in-app inbox + customer-declared webhooks (BYOK). No third-party cron registration, no operator tokens.

### 7. Wiring

- Barrel: `src/forest/inngest/functions/index.ts` exports `./production-graph-runner` and `./approval-timeout-cron`
- Serve: `src/app/api/inngest/route.ts` — Inngest serve array grew 34 → **36** (`productionGraphRunner`, `approvalTimeoutCron`)

---

## Test evidence / Bằng chứng kiểm thử

| Area | Test file | Tests |
|---|---|---|
| Graph repo | `src/tree/production-graph/__tests__/repo.test.ts` | 26 |
| Graph validation | `src/tree/production-graph/__tests__/validate.test.ts` | 11 |
| Templates | `src/tree/production-graph/__tests__/templates.test.ts` | 13 |
| Graph runner | `src/forest/inngest/functions/__tests__/production-graph-runner.test.ts` | 16 |
| Approval gate | `src/forest/inngest/functions/__tests__/agent-approval-gate.test.ts` | 7 |
| Approval timeout cron | `src/forest/inngest/functions/__tests__/approval-timeout-cron.test.ts` | 4 |
| Rollback cron (backoff/terminal) | `src/forest/inngest/functions/__tests__/agent-rollback-cron.test.ts` | 18 |
| Effective autonomy resolver | `src/tree/autonomy/__tests__/effective-autonomy.test.ts` | 18 |
| Retry backoff math | `src/tree/mission/__tests__/retry-backoff.test.ts` | 16 |
| Dashboard summary | `src/land/production-monitoring/__tests__/dashboard-summary.test.ts` | 9 |
| Dashboard actions | `src/land/production-monitoring/__tests__/actions.test.ts` | 6 |
| **Total Phase 3 scoped** | | **144** |

Plus lane gates: schema/types 21 tests (Lane A), autonomy 100/100 (Lane B), approval 29 scoped + 128 broader (Lane C), retry/resume 37 (Lane D), graph engine 79 incl. existing validate (Lane E), client-merge 9/9 + build exit 0 (Lane F), monitoring 23/23 (Lane G).

---

## Known follow-ups / Việc tiếp theo

- Publish-gate for the existing YouTube content pipeline (`youtube-content-pipeline.ts`) was deliberately NOT touched in Phase 3 (protected, live pipeline) — a separate follow-up.
- KPI targets (completion > 90%, approval turnaround < 4h, retry success > 85%) are now MEASURED on the dashboard; production baselines require real run data post-deploy.

## Related / Liên quan

- [AUTONOMY.md](./architecture/AUTONOMY.md) — autonomy level model + mission-type policies / mô hình tự trị + chính sách theo loại nhiệm vụ
- [AGENT_PROTOCOL.md](./architecture/AGENT_PROTOCOL.md) — agent lifecycle / vòng đời agent
- [SOPHIA_2027_ROADMAP.md](./roadmap/SOPHIA_2027_ROADMAP.md) — Phase 3 section / phần Phase 3
