# Provenance — Append-Only Audit Trail / Dòng Ledger Khóa Tạo

> **Authoritative for:** `tree/provenance` — every generated/derived artifact must carry a `ProvenanceRecord`.
> **Layer:** tree (domain-specific reusable) | **Storage:** D1 table `provenance_records`

---

## EN / Tiếng Anh

### What It Is / Là Gì

An **append-only** audit trail. Every artifact — AI-generated video, thumbnail, quote card, translation, or summary — records who/what created it, which model and version, what source it was derived from, human edits, approvals, and license/disclosure status.

**Never** update a record. Only append. The chain is the truth.

### Core Functions / Các Hàm Then Chốt

All exported from `tree/provenance/index.ts` (barrel) → implemented in `tree/provenance/types.ts`.

| Function | Signature | Purpose |
|---|---|---|
| `recordProvenance` | `(record: ProvenanceRecord) => Promise<ProvenanceRecord>` | Insert one append-only row. Auto-generates `id` (`prov_<32 hex>`) and `createdAt` if missing. |
| `getProvenanceChain` | `(assetId: string) => Promise<ProvenanceRecord[]>` | All records for one asset, ordered `created_at ASC`. Full lineage. |
| `getDerivatives` | `(assetId: string) => Promise<ProvenanceRecord[]>` | All records where `derivative_of = assetId`. Children of this asset. |
| `newProvenanceId` | `() => string` | Generate a `prov_`-prefixed 32-hex ID via `crypto.getRandomValues`. |
| `ProvenanceError` | `class extends Error` | `{ code, message }` — thrown on D1 unavailable or INSERT failure. |

### Record Fields / Các Trường Ghi

Mapped from `ProvenanceRow` → `ProvenanceRecord` (`seed/types/creative-domain.ts`):

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | `prov_<32 hex>` |
| `workspaceId` | `string` | Tenant boundary |
| `assetId` | `string` | The artifact this record describes |
| `agentRunId` | `string?` | Which agent run produced it |
| `action` | `ProvenanceAction` | `generate` \| `edit` \| `approve` \| `derive` \| `publish` \| ... |
| `actorType` | `string` | `agent` \| `human` \| `system` |
| `actorId` | `string` | Who performed the action |
| `model` | `string?` | e.g. `openrouter/anthropic/claude-sonnet-4` |
| `modelVersion` | `string?` | Provider-side version string |
| `prompt` | `string?` | Prompt or reference used |
| `sourceAssetId` | `string?` | Parent asset (for derivatives) |
| `humanEdits` | `string?` | JSON or diff of human changes |
| `approvalId` | `string?` | Link to an approval record |
| `derivativeOf` | `string?` | Same as `sourceAssetId` — used by `getDerivatives` |
| `metadata` | `Record<string, unknown>` | Free-form JSON (license, disclosure, tool params) |
| `createdAt` | `number` | Unix seconds |

### How to Use / Cách Dùng

```ts
import { recordProvenance, getProvenanceChain, getDerivatives } from '@/tree/provenance';

// 1. Record a generation
await recordProvenance({
  id: '', // auto-generated
  workspaceId: user.workspaceId,
  assetId: 'asset_abc123',
  action: 'generate',
  actorType: 'agent',
  actorId: 'agent_run_001',
  model: 'openrouter/anthropic/claude-sonnet-4',
  modelVersion: '2026-08-15',
  prompt: 'A cinematic YouTube intro for a tech review channel',
  metadata: { license: 'royalty_free', disclosure: 'ai_generated' },
  createdAt: 0, // auto-set
});

// 2. Record a human edit
await recordProvenance({
  workspaceId: user.workspaceId,
  assetId: 'asset_abc123',
  action: 'edit',
  actorType: 'human',
  actorId: user.id,
  humanEdits: JSON.stringify({ titleChanged: true, durationTrimmed: 3 }),
});

// 3. Record a derivative (thumbnail from video)
await recordProvenance({
  workspaceId: user.workspaceId,
  assetId: 'thumb_xyz789',
  action: 'derive',
  actorType: 'agent',
  actorId: 'agent_run_002',
  sourceAssetId: 'asset_abc123',
  derivativeOf: 'asset_abc123',
  model: 'openai/dall-e-3',
});

// 4. Walk the chain
const chain = await getProvenanceChain('asset_abc123');
const children = await getDerivatives('asset_abc123');
```

### Disclosure Status / Trạng Thái Công Bố

Use `metadata.disclosure` to track whether the artifact is:

- `ai_generated` — fully AI, must be disclosed per platform policy
- `ai_assisted` — human-edited after generation
- `human_created` — no AI involvement
- `royalty_free` / `royalty` / `cc_by` — license tag

### Invariants / Invariant Bắt Buộc

1. **Append-only** — no UPDATE/DELETE on `provenance_records`.
2. `derivativeOf` must reference an existing `assetId` (enforced by application logic, not DB FK).
3. `actorType` is one of `agent`, `human`, `system`.
4. `action` is a `ProvenanceAction` union — do not invent new actions without updating the type.

### Errors / lỗi

| Code | When |
|---|---|
| `D1_UNAVAILABLE` | `getD1()` returned null |
| `INSERT_FAILED` | D1 `.run()` threw — wrapped in `ProvenanceError` |

---

## VN / Tiếng Việt

### Là Gì

Hệ thống **ghi append-only** (chỉ thêm, không sửa). Mỗi sản phẩm — video AI, thumbnail, quote_card, bản dịch, bản tóm tắt — đều ghi lại: ai tạo, model nào, phiên bản nào, từ nguồn nào, chỉnh sửa của con người, duyệt xét, trạng thái giấy phép và công bố.

**Không bao giờ cập nhật** một bản ghi. Chỉ append. Dòng ledger là sự thật.

### Các Hàm Then Chốt

Xuất khẩu từ `tree/provenance/index.ts` → triển khai trong `tree/provenance/types.ts`.

| Hàm | Chữ ký | Mục đích |
|---|---|---|
| `recordProvenance` | `(record) => Promise<ProvenanceRecord>` | Thêm một dòng. Tự tạo `id` và `createdAt` nếu thiếu. |
| `getProvenanceChain` | `(assetId) => Promise<ProvenanceRecord[]>` | Toàn bộ dòng của một sản phẩm, sắp xếp theo thời gian. |
| `getDerivatives` | `(assetId) => Promise<ProvenanceRecord[]>` | Các sản phẩm con (derivative_of = assetId). |
| `newProvenanceId` | `() => string` | Tạo ID `prov_<32 hex>` ngẫu nhiên bảo mật. |
| `ProvenanceError` | class | `{ code, message }` — ném khi D1 không sẵn sàng hoặc INSERT thất bại. |

### Cách Dùng

```ts
import { recordProvenance, getProvenanceChain, getDerivatives } from '@/tree/provenance';

// Ghi một lần tạo
await recordProvenance({
  workspaceId: user.workspaceId,
  assetId: 'asset_abc123',
  action: 'generate',
  actorType: 'agent',
  actorId: 'agent_run_001',
  model: 'openrouter/anthropic/claude-sonnet-4',
  prompt: 'Một intro YouTube điện ảnh cho kênh công nghệ',
  metadata: { license: 'royalty_free', disclosure: 'ai_generated' },
});

// Ghi một lần chỉnh sửa của con người
await recordProvenance({
  workspaceId: user.workspaceId,
  assetId: 'asset_abc123',
  action: 'edit',
  actorType: 'human',
  actorId: user.id,
  humanEdits: JSON.stringify({ titleChanged: true }),
});

// Duyệt dòng ledger
const chain = await getProvenanceChain('asset_abc123');
const children = await getDerivatives('asset_abc123');
```

### Invariant

1. **Chỉ append** — không UPDATE/DELETE trên `provenance_records`.
2. `derivativeOf` phải tham chiếu một `assetId` tồn tại (kiểm tra ở application layer).
3. `actorType` ∈ `{agent, human, system}`.
4. `action` là một `ProvenanceAction` — không tự đặt action mới mà không cập nhật type.