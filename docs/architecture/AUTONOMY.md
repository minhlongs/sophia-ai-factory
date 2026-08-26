# AUTONOMY — Autonomy Level Model / Mô hình Mức độ Tự trị

> Authoritative autonomy model for Sophia AI Factory agents.
> Types: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts` line 373 (`AutonomyLevel = 0 | 1 | 2 | 3 | 4`).
> Implementation: `apps/sophia-ai-factory/src/land/autonomy/`.

---

## Overview / Tổng quan

Autonomy is a **5-level ladder** (0–4). Higher levels grant the agent more decision freedom but always within policy boundaries.
Tự trị là một **thang bậc 5 cấp** (0–4). Cấp cao hơn cho phép agent tự quyết định nhiều hơn, nhưng vẫn trong khung chính sách.

| Level / Cấp | Name / Tên | Behavior / Hành vi |
|---|---|---|
| 0 | Manual / Thủ công | Human does every action; AI never acts / người dùng làm mọi việc, AI không hành động |
| 1 | Suggest / Đề xuất | AI proposes actions; human must approve all / AI đề xuất, người dùng duyệt tất cả |
| 2 | Approve-on-demand / Duyệt khi cần | AI executes freely; pauses for approval only on high-risk actions / AI tự thực hiện, dừng duyệt cho hành động cao rủi ro |
| 3 | Bounded / Có giới hạn | AI executes within declared permissions and budget; auto-rejects out-of-scope / AI thực hiện trong quyền + ngân sách, từ chối ngoài phạm vi |
| 4 | Continuous / Liên tục | AI runs continuously; policy engine enforces limits; human intervenes only on anomaly / AI chạy liên tục, chính sách bắt buộc; người dùng can thiệp khi bất thường |

---

## Level Detail / Chi tiết từng cấp

### Level 0 — Manual / Thủ công
- Agent runs in **observation-only** mode.
- Every `AgentAction` requires explicit human instruction.
- No `AgentDecision` is executed without a human command.
- Dùng cho: sensitive financial ops, production config changes.
- **Duyệt:** `review` — every action must be reviewed.

### Level 1 — Suggest / Đề xuất
- Agent produces `AgentDecision` + `AgentAction` proposals.
- `requiresHumanApproval = true` on **all** actions.
- Human reviews via `AgentApproval` (`pending → approved|rejected`).
- Agent never executes until `status = 'approved'`.
- **Duyệt:** `review` + `approve`/`reject` on every action.

### Level 2 — Approve-on-demand / Duyệt khi cần
- Agent executes low-risk actions autonomously.
- `AgentPermission.requiresApproval = true` gates **only** high-risk tools.
- `AgentRun.status` becomes `'awaiting_approval'` when an approval-gated action is reached.
- Human approves or rejects the specific action; run resumes or aborts.
- **Duyệt:** `approve`/`reject` per gated action; `edit` allowed on action parameters before approval.

### Level 3 — Bounded / Có giới hạn
- Agent executes autonomously **within** `AgentPermission` scopes and `budgetRemainingCents`.
- Out-of-scope actions are **auto-rejected** (no human round-trip).
- `maxRetries` and `timeoutMs` from `AgentDefinition` are hard limits.
- Human retains `undo` and `pause` rights.
- **Duyệt:** `undo`, `pause`, `reject` (post-hoc); `approve` not required per action.

### Level 4 — Continuous / Liên tục
- Agent runs unattended; policy engine is the sole gate.
- `AgentContext.budgetRemainingCents` is decremented automatically; run halts at 0.
- Human intervenes only on anomaly detection (cost spike, unexpected tool call, repeated failure).
- **Duyệt:** `pause`, `resume`, `reject` (policy override); `undo` on anomaly.
- Self-healing: `retry` up to `maxRetries`, then `rollback` to last known-good state.

---

## Operations / Các thao tác

| Operation / Thao tác | Level availability / khả dụng | Mô tả / Description |
|---|---|---|
| **review** | 0, 1, 2 | Human inspects decision/action before execution / xem xét trước khi thực hiện |
| **approve** | 1, 2 | Human approves a gated action / duyệt hành động bị_gate |
| **reject** | 1, 2, 3, 4 | Human rejects a proposal or action / từ chối hành động |
| **edit** | 1, 2 | Human modifies action parameters before approval / sửa đối số trước duyệt |
| **undo** | 2, 3, 4 | Human rolls back last action / hoàn tác hành động cuối |
| **retry** | 2, 3, 4 | Agent retries within `maxRetries` / thử lại trong giới hạn |
| **pause** | 3, 4 | Human pauses a running agent / dừng agent đang chạy |
| **resume** | 3, 4 | Human resumes a paused agent / tiếp tục agent đã dừng |

---

## Implementation / Triển khai

Cite: `src/land/autonomy/`.

### `land/autonomy/index.ts`
Barrel re-export module. Exports `./actions` only.
Module re-export. Chỉ xuất `./actions`.

### `land/autonomy/actions.ts`
Server Actions (`'use server'`) wrapping the `tree/autonomy` layer with auth and workspace checks.

| Action / Hành động | Signature / Khóa | Mô tả / Description |
|---|---|---|
| `getAutonomyConfigAction` | `(workspaceId?) => Result<{level, agentType, overrides}, AutonomyActionError>` | Reads current autonomy config for workspace / đọc cấu hình tự trị hiện tại |
| `setAutonomyLevelAction` | `({level, agentType?}) => Result<void, AutonomyActionError>` | Sets autonomy level (0–4) after Zod validation + membership check / đặt mức tự trị |

**Auth flow:** `getCurrentUser()` → `getPrimaryWorkspaceId()` → `assertWorkspaceMembership()` → `tree/autonomy` repo call.
**Error codes:** `VALIDATION_ERROR`, `NOT_AUTHENTICATED`, `DB_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `REPO_ERROR`, `INTERNAL`.
**All results use `Result<T, E>`** — no thrown exceptions across action boundaries.
Tất cả kết quả dùng `Result<T, E>` — không throw exception qua biên độ hành động.

### Enforcement points / Điểm bắt buộc
- `SetAutonomyLevelSchema`: `z.coerce.number().int().min(0).max(4)` — levels strictly 0–4.
- `agentType` defaults to `'global'`; per-agent overrides supported via `overrides` field.
- Membership check prevents cross-workspace autonomy tampering.

---

## Related / Liên quan

- `AGENT_PROTOCOL.md` — Agent lifecycle (Definition → Context → Decision → Action → Result)
- `seed/types/creative-domain.ts` line 373 — `AutonomyLevel` type
- `tree/autonomy` — repo layer (underlying `getAutonomyConfig` / `setAutonomyLevel`)

---

## Phase 3 addition: mission-type autonomy policies / Thêm Phase 3: chính sách tự trị theo loại nhiệm vụ

> Added 2026-08-27 (Sophia 2027 Phase 3 — Autonomous Factory).
> Thêm ngày 2026-08-27 (Sophia 2027 Phase 3 — Nhà Máy Sản Xuất Tự Động).

### Operator tiers L0–L3 / Các cấp điều khiển L0–L3

The 5-level ladder above maps onto operator-facing tiers. Tier L2 (Supervised) is the **built-in default** when nothing is configured.
Thang bậc 5 cấp ở trên ánh xạ lên các cấp điều khiển. Cấp **L2 (Giám sát)** là **mặc định** khi chưa cấu hình gì.

| Operator tier / Cấp | Stored autonomy | Behavior / Hành vi runtime |
|---|---|---|
| **L0** Manual / Thủ công | 0 | No automatic runs — everything goes through the console. / Không chạy tự động — mọi việc qua điều khiển. |
| **L1** Assisted / Hỗ trợ | 2 | Agents do read-only work; every draft needs human review. / AI chỉ làm việc đọc; mọi bản nháp cần người duyệt. |
| **L2** Supervised / Giám sát (**default / mặc định**) | 3 | Agents run freely through content steps; **publish nodes always require approval**. / AI chạy tự do các bước nội dung; **các node đăng luôn cần duyệt**. |
| **L3** Full auto / Tự động hoàn toàn | 4 | No approval; blocked by `max_cost_cents_per_run` + `max_auto_retries`. / Không cần duyệt; bị giới hạn bởi ngân sách và số lần thử lại. |

### Storage / Lưu trữ

`mission_type_policies` (migration `migrations/0257_production_factory.sql`), keyed by `(workspace_id, mission_type)`:

```
id TEXT PK · workspace_id · mission_type · autonomy_tier INTEGER DEFAULT 2
require_publish_approval INTEGER DEFAULT 1 · max_cost_cents_per_run INTEGER NULL
max_auto_retries INTEGER DEFAULT 3 · created_at · updated_at
UNIQUE(workspace_id, mission_type)
```

Workspace-global policy lives in the same table with `mission_type = 'global'`. The `creative_missions.mission_type` column (new in 0257, `DEFAULT 'general'`) enables per-mission-type policies.

### Effective autonomy resolver / Bộ giải quyết tự trị thực tế

`src/tree/autonomy/effective-autonomy.ts` — `resolveEffectiveAutonomy({ workspaceId, missionType, missionAutonomyLevel })`. Priority chain:

1. mission-type policy (`mission_type_policies` row for the exact type)
2. workspace global policy (same table, `mission_type = 'global'`)
3. legacy autonomy config (`getAutonomyConfig` — stored level passed through untouched, preserving today's deny-if-level<3 behavior)
4. built-in default: **L2 Supervised, `require_publish_approval = 1`** (fail-closed)

`buildEffectiveAutonomy` is pure and deterministic — identical inputs always yield an identical result. A mission-row `autonomy_level` only ever **caps** the stored level (fail-closed direction: never unlocks). Any read failure degrades down the chain and lands on the built-in default; the function never throws.

Policy shape carried on `AgentContext.effectivePolicy` (optional field on `AgentContext` — backward compatible: `undefined` ⇒ old behavior byte-for-byte):

```
{ tier, storedLevel, requiresApproval(actionType), budgetCapCents, maxAutoRetries }
```

`requiresApproval` is `tier <= 2 && require_publish_approval && actionType.startsWith('publish')` — L3 full-auto never requires approval.

### Enforcement / Thực thi

`src/tree/agent-protocol/agent-executor.ts` — surgical edit only: the two `isGateAllowed` call sites now read `context.effectivePolicy` and delegate to `isGateAllowed` (defined at line 118). Signature `executeAgent(definition, context, registry)` is unchanged. Legacy paths without `effectivePolicy` keep today's exact behavior.

### UI surface / Giao diện người dùng

The existing `/dashboard/settings/autonomy` page is extended (no new page): `src/components/autonomy-settings.tsx` gains a per-mission-type table; `src/land/autonomy/actions.ts` gains `listMissionTypePoliciesAction` and `setMissionTypePolicyAction`.

### Approval gate wiring / Kết nối cổng duyệt

Publish nodes in a production graph (`src/forest/inngest/functions/production-graph-runner.ts`) call `requestApprovalAndAwait` when the effective policy requires approval (tiers ≤ L2). Full-auto tiers (L3) grant the `publish_content` token directly — no human gate. See [PRODUCTION_FACTORY.md](../PRODUCTION_FACTORY.md) §3 for the pause-and-await mechanism and the `*/15` timeout cron safety net.

### Related / Liên quan

- [PRODUCTION_FACTORY.md](../PRODUCTION_FACTORY.md) — production graph DAG, approval gates, retry/resume, dashboard
- `tree/autonomy/policy-repo.ts` — `getMissionTypePolicy`, `listMissionTypePolicies`, `setMissionTypePolicy`, `deleteMissionTypePolicy`, `DEFAULT_MAX_AUTO_RETRIES`
- `seed/types/production-factory.ts` — `AutonomyTier = 0|1|2|3`, `MissionTypePolicy`