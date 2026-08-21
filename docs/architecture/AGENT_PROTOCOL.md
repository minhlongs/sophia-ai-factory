# AGENT_PROTOCOL — Agent Runtime Protocol / Giao thức Agent Runtime

> Authoritative protocol for agent lifecycle in Sophia AI Factory.
> Source: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts` lines 370–456.

---

## Lifecycle / Chu kỳ Agent

```
AgentDefinition → AgentContext → AgentDecision → AgentAction → AgentResult
```

Mỗi agent run là một chuỗi có thứ tự: định nghĩa → ngữ cảnh → quyết định → hành động → kết quả.
Each run is a single ordered chain: definition → context → decision → action → result.

---

## 1. AgentDefinition / Định nghĩa Agent

Cite: `creative-domain.ts` lines 382–392.

| Field / Trường | Type | Mô tả / Description |
|---|---|---|
| `id` | `string` | Unique agent identifier / định danh duy nhất |
| `name` | `string` | Human-readable name / tên hiển thị |
| `role` | `string` | Role label (e.g. `video-generator`, `billing-auditor`) / vai trò |
| `capabilities` | `string[]` | Declared capability strings / năng lực đã khai báo |
| `permissions` | `AgentPermission[]` | Tool + scope + approval flags / công cụ, quyền, yêu cầu duyệt |
| `defaultAutonomy` | `AutonomyLevel` | Default autonomy (0–4) / mức tự trị mặc định |
| `maxRetries` | `number` | Max retry attempts before failure / tối đa retries trước khi fail |
| `timeoutMs` | `number` | Hard timeout in milliseconds / thời gian tối đa |
| `modelPolicy?` | `ModelPolicy` | Optional model selection policy / chính sách chọn model |

### AgentPermission / Quyền Agent

Cite: lines 375–380.

| Field | Type | Mô tả |
|---|---|---|
| `tool` | `string` | Tool name being permitted / tên công cụ |
| `scopes` | `string[]` | Scopes (e.g. `read:billing`, `write:assets`) / phạm vi truy cập |
| `requiresApproval` | `boolean` | Whether this tool always needs human approval / có cần duyệt không |
| `maxCostCents?` | `number` | Per-call cost ceiling in cents / chi phí tối đa mỗi lần gọi |

---

## 2. AgentContext / Ngữ cảnh Agent

Cite: lines 394–403.

| Field / Trường | Type | Mô tả / Description |
|---|---|---|
| `workspaceId` | `string` | Workspace tenant / không gian làm việc |
| `missionId?` | `string` | Optional mission binding / nhiệm vụ (tuỳ chọn) |
| `projectId?` | `string` | Optional project binding / dự án (tuỳ chọn) |
| `creativeIdentity?` | `CreativeIdentity` | Brand/identity context / định vị thương hiệu |
| `memory` | `CreativeMemory[]` | Prior memory entries / bộ nhớ trước |
| `autonomyLevel` | `AutonomyLevel` | Effective autonomy for this run / mức tự trị hiệu thực tế |
| `budgetRemainingCents` | `number` | Remaining budget in cents / ngân sách còn lại |
| `correlationId` | `string` | Trace correlation ID / ID theo dõi request |

---

## 3. AgentDecision / Quyết định Agent

Cite: lines 405–411.

| Field / Trường | Type | Mô tả / Description |
|---|---|---|
| `type` | `string` | Decision type (e.g. `generate_video`, `refund_request`) / loại quyết định |
| `reasoning` | `string` | Natural-language rationale / lý do bằng tự nhiên |
| `confidence` | `number` | 0–1 confidence score / độ tin cậy |
| `alternatives?` | `Array<{description, score}>` | Ranked alternatives / các phương án dự phòng |
| `requiresHumanApproval` | `boolean` | Whether human must approve before action / có cần duyệt người dùng |

---

## 4. AgentAction / Hành động Agent

Cite: lines 413–419.

| Field / Trường | Type | Mô tả / Description |
|---|---|---|
| `type` | `string` | Action type / loại hành động |
| `tool` | `string` | Tool being invoked / công cụ được gọi |
| `parameters` | `Record<string, unknown>` | Tool parameters / đối số |
| `estimatedCostCents?` | `number` | Estimated cost / chi phí ước tính |
| `approvalRequired` | `boolean` | Whether this action needs approval / có cần duyệt |

---

## 5. AgentResult / Kết quả Agent

Cite: lines 421–429.

| Field / Trường | Type | Mô tả / Description |
|---|---|---|
| `success` | `boolean` | Whether run completed successfully / có thành công |
| `output?` | `unknown` | Output payload / dữ liệu đầu ra |
| `error?` | `{code, message}` | Error detail if failed / chi tiết lỗi |
| `artifacts` | `string[]` | Asset IDs produced / ID tài sản tạo ra |
| `costCents` | `number` | Actual cost incurred / chi phí thực tế |
| `durationMs` | `number` | Wall-clock duration / thời gian thực tế |
| `provenanceRecordId?` | `string` | Provenance ledger entry / mục lưu trữ nguồn gốc |

---

## 6. AgentApproval / Duyệt Agent

Cite: lines 431–439.

| Field / Trường | Type | Mô tả / Description |
|---|---|---|
| `id` | `string` | Approval record ID / ID bản ghi duyệt |
| `agentRunId` | `string` | Parent run ID / ID run cha |
| `action` | `AgentAction` | Action awaiting approval / hành động chờ duyệt |
| `status` | `'pending' \| 'approved' \| 'rejected'` | Approval state / trạng thái duyệt |
| `reviewedBy` | `string` | Reviewer identity / người duyệt |
| `reviewComment?` | `string` | Optional comment / bình luận tuỳ chọn |
| `reviewedAt?` | `number` | Review timestamp / thời gian duyệt |

---

## 7. AgentRun / Chạy Agent

Cite: lines 441–456.

| Field / Trường | Type | Mô tả / Description |
|---|---|---|
| `id` | `string` | Run ID / ID lần chạy |
| `agentId` | `string` | Agent definition ID / ID định nghĩa agent |
| `workspaceId` | `string` | Workspace / không gian |
| `missionId?` | `string` | Mission / nhiệm vụ |
| `parentRunId?` | `string` | Parent run (sub-agent) / run cha |
| `input` | `Record<string, unknown>` | Input payload / dữ liệu vào |
| `decision?` | `AgentDecision` | Decision taken / quyết định |
| `actions` | `AgentAction[]` | Actions executed / hành động đã thực hiện |
| `result?` | `AgentResult` | Final result / kết quả cuối |
| `status` | `'queued' \| 'running' \| 'completed' \| 'failed' \| 'cancelled' \| 'awaiting_approval'` | Lifecycle state / trạng thái |
| `autonomyLevel` | `AutonomyLevel` | Effective autonomy / mức tự trị |
| `startedAt?` | `number` | Start timestamp / bắt đầu |
| `finishedAt?` | `number` | End timestamp / kết thúc |
| `error?` | `{code, message}` | Terminal error / lỗi cuối |

---

## Supported Operations / Các thao tác hỗ trợ

| Operation / Thao tác | Description / Mô tả |
|---|---|
| **Planning** | `AgentDecision.type` drives plan decomposition / quyết định phân tích kế hoạch |
| **Execution** | `AgentAction[]` executed in order / hành động thực hiện theo thứ tự |
| **Tool invocation** | `AgentAction.tool` + `parameters` / gọi công cụ |
| **Human approval** | `AgentApproval` with `pending → approved|rejected` / duyệt người dùng |
| **Retry** | `AgentDefinition.maxRetries` governs retry budget / retries theo giới hạn |
| **Timeout** | `AgentDefinition.timeoutMs` hard cap / thời gian tối đa |
| **Cancellation** | `AgentRun.status = 'cancelled'` / hủy |
| **Rollback** | Actions must be idempotent or compensatable / hành động phải hoànk được |
| **Audit** | `provenanceRecordId` links to ledger / truy xuất nguồn gốc |
| **Cost tracking** | `AgentResult.costCents` + `budgetRemainingCents` / theo dõi chi phí |
| **Token/model metadata** | `AgentDefinition.modelPolicy` / metadata model |
| **Provenance** | `AgentResult.provenanceRecordId` → ledger entry / nguồn gốc |

---

## Related / Liên quan

- `AUTONOMY.md` — Autonomy level model (0–4) / mô hình mức tự trị
- `creative-domain.ts` lines 370–456 — source of truth / nguồn thực tế