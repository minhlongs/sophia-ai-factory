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