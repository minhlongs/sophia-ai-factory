# Creative Memory Architecture / Kiến trúc Bộ nhớ Sáng tạo

> Part of Sophia 2027 Creative Economy OS.
> References: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:100-131`

---

## Table of Contents

- [1. Overview / Tổng quan](#1-overview--tổng-quan)
- [2. Type Definition / Định nghĩa Kiểu](#2-type-definition--định-nghĩa-kiểu)
- [3. Memory Categories / Phân loại Bộ nhớ](#3-memory-categories--phân-loại-bộ-nhớ)
- [4. Memory Properties / Thuộc tính Bộ nhớ](#4-memory-properties--thuộc-tính-bộ-nhớ)
- [5. Memory Scoping / Phạm vi Bộ nhớ](#5-memory-scoping--phạm-vi-bộ-nhớ)
- [6. Versioning / Phiên bản hóa](#6-versioning--phiên-bản-hóa)
- [7. Confidence Levels / Mức độ Tin cậy](#7-confidence-levels--mức-độ-tin-cậy)
- [8. Evidence Tracking / Theo dõi Bằng chứng](#8-evidence-tracking--theo-dõi-bằng-chứng)
- [9. Lifecycle / Vòng đời](#9-lifecycle--vòng-đời)
- [10. Permissions & Audit / Quyền & Kiểm toán](#10-permissions--audit--quyền--kiểm-toán)
- [11. Integration Points / Điểm Tích hợp](#11-integration-points--điểm-tích-hợp)
- [12. References / Tham chiếu](#12-references--tham-chiếu)

---

## 1. Overview / Tổng quan

### EN

Creative Memory is Sophia's system for learning and remembering what works in creative decisions. It is a typed, versioned, scoped, and auditable knowledge store that persists across missions, campaigns, and projects.

Think of it as the platform's "institutional memory" -- the accumulated understanding of what content performs well, what the audience responds to, and what creative decisions led to success or failure.

### VN

Bộ nhớ Sáng tạo là hệ thống học hỏi và ghi nhớ của Sophia về những gì hiệu quả trong quyết định sáng tạo. Đây là kho kiến thức có kiểu, phiên bản, phạm vi và kiểm toán, tồn tại xuyên suốt các nhiệm vụ, chiến dịch và dự án.

Nó giống như "bộ nhớ tổ chức" của nền tảng -- sự hiểu biết tích lũy về nội dung nào hoạt động tốt, khán giả phản hồi thế nào, và quyết định sáng tạo nào dẫn đến thành công hay thất bại.

---

## 2. Type Definition / Định nghĩa Kiểu

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:115-131`

```typescript
export interface CreativeMemory {
  id: string;
  workspaceId: string;
  category: MemoryCategory;
  key: string;
  value: unknown;
  confidence: MemoryConfidence;
  source: string;
  evidence: string;
  scope: 'global' | 'campaign' | 'project' | 'channel';
  scopeId?: string;
  version: number;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}
```

### Field Reference / Tham chiếu Trường

| Field | Type | Description (EN) | Mô tả (VN) |
|-------|------|-------------------|-------------|
| `id` | `string` | Unique identifier | Định danh duy nhất |
| `workspaceId` | `string` | Workspace scope | Phạm vi không gian làm việc |
| `category` | `MemoryCategory` | Type of memory (see Section 3) | Loại bộ nhớ (xem Mục 3) |
| `key` | `string` | Human-readable memory key, e.g. `'best_hook_format'` | Key bộ nhớ đọc được, vd `'best_hook_format'` |
| `value` | `unknown` | The actual learned insight (JSON-serializable) | Thông tin chi tiết đã học được (có thể serialize JSON) |
| `confidence` | `MemoryConfidence` | How certain we are (see Section 7) | Mức độ chắc chắn (xem Mục 7) |
| `source` | `string` | Origin: `'performance'`, `'human_edit'`, `'agent_inference'`, or `'import'` | Nguồn: hiệu suất, chỉnh sửa suy luận agent, hoặc nhập |
| `evidence` | `string` | JSON array of supporting event/asset IDs | Mảng JSON các ID sự kiện/tài sản hỗ trợ |
| `scope` | `string` | Where this memory applies (see Section 5) | Bộ nhớ này áp dụng ở đâu (xem Mục 5) |
| `scopeId` | `string?` | ID of the specific scope entity | ID của thực thể phạm vi cụ thể |
| `version` | `number` | Version counter (increments on update) | Đếm phiên bản (tăng khi cập nhật) |
| `isDeleted` | `boolean` | Soft-delete flag. `true` = excluded from queries | Cờ xóa mềm. `true` = bị loại khỏi truy vấn |
| `createdAt` | `number` | Unix timestamp of creation | Dấu thời gian tạo |
| `updatedAt` | `number` | Unix timestamp of last update | Dấu thời gian cập nhật cuối |
| `expiresAt` | `number?` | Optional expiry. Past-current = treated as deleted | Hết hạn tuỳ chọn. Quá hiện tại = coi như đã xóa |

---

## 3. Memory Categories / Phân loại Bộ nhớ

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:104-111`

```typescript
export type MemoryCategory =
  | 'identity'
  | 'creative'
  | 'audience'
  | 'performance'
  | 'business'
  | 'operational'
  | 'provenance';
```

### 3.1 Identity Memory / Bộ nhớ Nhận diện

**What it stores:** Brand voice decisions, tone preferences, positioning choices, visual identity patterns.

**Examples:**
- `"brand_voice"` -- "Sharp, analytical, Vietnamese/SEA context. No corporate jargon."
- `"forbidden_pattern"` -- "Never use clickbait titles that misrepresent content."
- `"tone_preference"` -- "Warm and authoritative, casual but not sloppy."

**Source:** Primarily `human_edit` (operator defines brand). May also come from `agent_inference` (agent suggests tone adjustments based on performance).

### 3.2 Creative Memory / Bộ nhớ Sáng tạo

**What it stores:** What creative approaches work -- formats, hooks, pacing, structures, styles.

**Examples:**
- `"best_hook_format"` -- "Question + shocking stat outperforms statement + CTA by 2.3x"
- `"video_pacing"` -- "60-second videos retain best at 8-10 second intervals between cuts"
- `"thumbnail_style"` -- "Bold text + contrasting colors = highest CTR"

**Source:** `performance` (derived from analytics), `agent_inference` (pattern recognition).

### 3.3 Audience Memory / Bộ nhớ Khán giả

**What it stores:** Audience demographics, behavior patterns, preferences, engagement triggers.

**Examples:**
- `"primary_audience"` -- "Vietnamese founders, 25-40, interested in AI + business"
- `"peak_hours"` -- "Highest engagement: 7-9 AM and 8-10 PM ICT"
- `"response_pattern"` -- "Educational content gets 3x more saves than entertainment"

**Source:** `performance` (analytics-derived), `import` (external research data).

### 3.4 Performance Memory / Bộ nhớ Hiệu suất

**What it stores:** What performs well, what doesn't -- metrics patterns, ROI insights, cost efficiency.

**Examples:**
- `"roi_benchmark"` -- "Video shorts average $2.10 EOPCU; long-form averages $8.50"
- `"cost_efficiency"` -- "GPT-4o scripts cost 40% less than Claude 3.5 with similar quality"
- `"platform_roi"` -- "TikTok 1.8x YouTube for follower growth, 0.6x for revenue"

**Source:** `performance` (direct metric analysis).

### 3.5 Business Memory / Bộ nhớ Kinh doanh

**What it stores:** Pricing insights, conversion patterns, monetization learnings, tier-specific behaviors.

**Examples:**
- `"conversion_trigger"` -- "Free trial users who create first mission within 48h convert at 73%"
- `"churn_signal"` -- "3+ failed video generations in a week = 89% churn risk"
- `"upsell_pattern"` -- "After 10 published videos, show premium features comparison"

**Source:** `performance`, `human_edit` (business decisions).

### 3.6 Operational Memory / Bộ nhớ Vận hành

**What it stores:** System performance, error patterns, optimization opportunities, deployment learnings.

**Examples:**
- `"peak_load"` -- "Highest API load: 2-4 PM ICT weekdays"
- `"error_pattern"` -- "D-ID timeout errors spike on Fridays -- use fallback provider"
- `"cache_effectiveness"` -- "LLM cache hit rate 34% -- consider increasing TTL"

**Source:** `performance` (system metrics), `agent_inference`.

### 3.7 Provenance Memory / Bộ nhớ Truy xuất nguồn gốc

**What it stores:** Metadata about content provenance patterns -- which agent/model combinations produce the best outcomes.

**Examples:**
- `"best_model_for_script"` -- "Claude 3.5 produces scripts with 15% higher engagement than GPT-4o for this audience"
- `"agent_performance"` -- "Script-writer agent v2.3 has 94% approval rate vs 78% for v2.2"
- `"derivation_success"` -- "Short clips from long-form with hook-first structure get 2.8x more views"

**Source:** `performance`, `agent_inference`.

---

## 4. Memory Properties / Thuộc tính Bộ nhớ

### EN

Every memory entry must be:

1. **Typed** -- Has a `MemoryCategory`. No untyped freeform memory.
2. **Versioned** -- `version` increments on every update. Previous versions are preserved (append-only).
3. **Scoped** -- Applies to a specific scope (global, campaign, project, or channel). Never unscoped.
4. **Inspectable** -- The `key` is human-readable. The `value` is JSON-serializable. Anyone can read and understand.
5. **Editable** -- Operator can modify any memory at any time. No agent protection from human override.
6. **Deletable** -- Soft-delete via `isDeleted: true`. Data is excluded from queries but preserved for audit.
7. **Auditable** -- Every change is recorded with timestamp, source, and version.
8. **Permission-aware** -- Only agents with matching `AgentPermission.scopes` can read/write within that scope.

### VN

Mục bộ nhớ phải:

1. **Có kiểu** -- Có `MemoryCategory`. Không có bộ nhớ dạng text tự do.
2. **Phiên bản hóa** -- `version` tăng mỗi lần cập nhật. Phiên bản trước được giữ lại.
3. **Có phạm vi** -- Áp dụng cho phạm vi cụ thể (toàn cục, chiến dịch, dự án, hoặc kênh). Không bao giờ không có phạm vi.
4. **Có thể kiểm tra** -- `key` đọc được. `value` serialize được JSON. Bất kỳ ai cũng có thể đọc và hiểu.
5. **Có thể chỉnh sửa** -- Người vận hành có thể sửa bất kỳ bộ nhớ nào bất cứ lúc nào.
6. **Có thể xóa** -- Xóa mềm qua `isDeleted: true`. Dữ liệu bị loại khỏi truy vấn nhưng được giữ cho kiểm toán.
7. **Có thể kiểm toán** -- Mỗi thay đổi được ghi lại với dấu thời gian, nguồn và phiên bản.
8. **Nhận biết quyền** -- Chỉ agent có `AgentPermission.scopes` phù hợp mới đọc/ghi trong phạm vi đó.

---

## 5. Memory Scoping / Phạm vi Bộ nhớ

Ref: `seed/types/creative-domain.ts:124-125`

```typescript
scope: 'global' | 'campaign' | 'project' | 'channel';
scopeId?: string;
```

### Scope Levels / Cấp độ Phạm vi

| Scope | `scopeId` | Applies To | Example |
|-------|-----------|------------|---------|
| `global` | `undefined` | Entire workspace | "Our brand voice is sharp and analytical" |
| `campaign` | Campaign ID | Specific campaign | "This campaign's audience prefers Vietnamese captions" |
| `project` | Project ID | Specific content project | "This video series uses a 3-act structure" |
| `channel` | Channel name | Specific platform | "YouTube shorts get 3x more saves than TikTok" |

### Scope Resolution / Giải quyết Phạm vi

When an agent queries memory, the resolution order is:

1. **Most specific scope first** (project/channel) -- if a project-specific memory exists, use it.
2. **Campaign scope** -- if no project memory, check campaign.
3. **Global scope** -- fallback to workspace-wide memory.

This allows operators to override global learnings with project-specific or channel-specific insights.

### EN

Scoping prevents memory pollution. A learning about TikTok audience behavior (`scope: 'channel', scopeId: 'tiktok'`) should not override a YouTube-specific insight (`scope: 'channel', scopeId: 'youtube'`).

### VN

Phạm vi ngăn ô nhiễm bộ nhớ. Một bài học về hành vi khán giả TikTok không nên ghi đè insight cụ thể cho YouTube.

---

## 6. Versioning / Phiên bản hóa

Ref: `seed/types/creative-domain.ts:126`

```typescript
version: number;
```

### How Versioning Works / Cách phiên bản hóa hoạt động

1. **New memory:** `version = 1`
2. **Update:** `version++` (increments by 1)
3. **Append-only:** Previous versions are never overwritten. The repository maintains version history.
4. **Soft delete:** `isDeleted = true`, `version` does not increment. The memory is hidden from queries but preserved.

### EN

Versioning enables:
- **Learning decay:** Older memories can be weighted less if version is old and confidence hasn't been refreshed.
- **Conflict resolution:** When two agents propose different values for the same key, the version number helps determine which is newer.
- **Audit trail:** Every change is traceable. The version counter is a tamper-evident signal.

### VN

Phiên bản hóa cho phép:
- **Suy giảm học tập:** Bộ nhớ cũ có thể được đánh trọng số thấp hơn nếu phiên bản cũ và tin cậy chưa được làm mới.
- **Giải quyết xung đột:** Khi hai agent đề xuất giá trị khác nhau cho cùng key, số phiên bản giúp xác định cái nào mới hơn.
- **Dấu vết kiểm toán:** Mỗi thay đổi đều có thể truy nguyên.

---

## 7. Confidence Levels / Mức độ Tin cậy

Ref: `seed/types/creative-domain.ts:113`

```typescript
export type MemoryConfidence = 'high' | 'medium' | 'low';
```

### Confidence Assignment / Gán mức tin cậy

| Level | When Assigned | Example |
|-------|--------------|---------|
| `low` | Agent inference from small dataset | "Based on 3 videos, question hooks seem better" |
| `medium` | Statistical pattern from moderate data | "From 20 videos, question hooks have 1.5x higher CTR" |
| `high` | Confirmed by significant data or human validation | "Operator confirmed + 50 videos show question hooks win by 2x" |

### Confidence Evolution / Tiến hóa Tin cậy

Confidence is NOT static. It evolves:

1. `agent_inference` creates memory with `low` confidence
2. More data accumulates via `performance` events
3. Learning loop upgrades confidence to `medium` when sample size is sufficient
4. Operator validation or high statistical significance upgrades to `high`

### EN

Confidence affects how heavily an agent weights a memory in decision-making. High-confidence memories have stronger influence on agent behavior.

### VN

Tin cậy ảnh hưởng đến mức độ mà agent trọng số một bộ nhớ trong ra quyết định. Bộ nhớ tin cậy cao có ảnh hưởng mạnh hơn đến hành vi agent.

---

## 8. Evidence Tracking / Theo dõi Bằng chứng

Ref: `seed/types/creative-domain.ts:123`

```typescript
evidence: string; // JSON array of supporting events/ids
```

### EN

Every memory entry must cite supporting evidence. The `evidence` field is a JSON-encoded array of references to the events, assets, or experiments that support the memory's claim.

**Example:**
```json
{
  "evidence": "[\"event:perf_abc123\", \"asset:vid_def456\", \"exp:exp_ghi789\"]"
}
```

Evidence types:
- `event:*` -- Performance event IDs (ref: `PerformanceEvent` at `seed/types/creative-domain.ts:312-325`)
- `asset:*` -- Content asset IDs (ref: `ContentAsset` at `seed/types/creative-domain.ts:242-255`)
- `exp:*` -- Experiment IDs (ref: `Experiment` at `seed/types/creative-domain.ts:536-553`)
- `mission:*` -- Mission IDs (ref: `Mission` at `seed/types/creative-domain.ts:473-495`)

Evidence makes memories **falsifiable** -- operators can trace back to see what data supports a claim.

### VN

Mục bộ nhớ phải trích dẫn bằng chứng hỗ trợ. Trường `evidence` là mảng mã hóa JSON chứa các tham chiếu đến sự kiện, tài sản hoặc thử nghiệm.

Điều này khiến bộ nhớ **có thể kiểm chứng** -- người vận hành có thể truy nguyên để xem dữ liệu nào hỗ trợ một tuyên bố.

---

## 9. Lifecycle / Vòng đời

### EN

```
CREATE  -->  USE  -->  UPDATE  -->  DECAY  -->  ARCHIVE
  |           |          |            |            |
  v           v          v            v            v
version=1   decisions  version++   confidence   isDeleted=true
new memory  inform     new insight  drops       hidden from
            agents     versioned     or expires  queries
```

**States:**
1. **Active** (`isDeleted: false`): Used in agent decisions, queries, recommendations.
2. **Expired** (`expiresAt` < now): Treated as deleted. No longer influences decisions.
3. **Soft-deleted** (`isDeleted: true`): Hidden from queries. Preserved for audit.
4. **Archived** (`isDeleted: true` + old version): Long-term storage, query-excluded.

### VN

**Các trạng thái:**
1. **Đang dùng** (`isDeleted: false`): Được sử dụng trong quyết định agent, truy vấn, đề xuất.
2. **Hết hạn** (`expiresAt` < hiện tại): Coi như đã xóa. Không còn ảnh hưởng đến quyết định.
3. **Xóa mềm** (`isDeleted: true`): Ẩn khỏi truy vấn. Được giữ cho kiểm toán.
4. **Lưu trữ** (`isDeleted: true` + phiên bản cũ): Lưu trữ dài hạn, loại khỏi truy vấn.

---

## 10. Permissions & Audit / Quyền & Kiểm toán

### EN

**Who can read:** All agents within the workspace that have `AgentPermission.scopes` matching the memory's scope.

**Who can write:**
- The operator (human) -- always, for any memory.
- Agent at Autonomy Level 3-4 -- can write to memories within their permitted scopes.
- Agent at Autonomy Level 0-2 -- can only propose memory updates; operator approval required.

**Audit requirements:**
- Every write operation (create, update, delete) must be logged.
- The log entry must include: actor (human/agent ID), timestamp, previous version, new version, scope.
- Audit logs are append-only and immutable.

### VN

**Ai đọc được:** Tất cả agent trong không gian làm việc có `AgentPermission.scopes` khớp phạm vi bộ nhớ.

**Ai ghi được:**
- Người vận hành (con người) -- luôn luôn, cho bất kỳ bộ nhớ nào.
- Agent ở Mức 3-4 -- có thể ghi vào bộ nhớ trong phạm vi được phép.
- Agent ở Mức 0-2 -- chỉ có thể đề xuất cập nhật bộ nhớ; cần phê duyệt người vận hành.

**Yêu cầu kiểm toán:**
- Mỗi thao tác ghi (tạo, cập nhật, xóa) phải được ghi nhật ký.
- Nhật ký phải bao gồm: tác giả, dấu thời gian, phiên bản trước, phiên bản mới, phạm vi.
- Nhật ký kiểm toán chỉ bổ sung và không thể thay đổi.

---

## 11. Integration Points / Điểm Tích hợp

### EN

Creative Memory connects to these Sophia subsystems:

| Subsystem | Relationship | Direction |
|-----------|-------------|-----------|
| **Agent Protocol** | Agents read memory for decision context | Memory -> Agent |
| **Creative Identity** | Identity memory informs brand consistency | Memory <-> Identity |
| **Mission Lifecycle** | Missions generate learnings that update memory | Mission -> Memory |
| **Performance Tracking** | Performance events provide evidence for memory confidence | Performance -> Memory |
| **Learning Loop** | Analyzes performance, updates memory, generates recommendations | Performance -> Memory -> Recommendations |
| **Content Graph** | Content metadata provides context for creative memory | Content -> Memory |
| **Experiments** | Experiment results update performance memory | Experiment -> Memory |

### VN

Bộ nhớ Sáng tạo kết nối với các hệ thống con của Sophia:

| Hệ thống con | Mô tả | Chiều |
|-------------|-------|-------|
| **Giao thức Agent** | Agent đọc bộ nhớ cho bối cảnh ra quyết định | Bộ nhớ -> Agent |
| **Nhận diện Sáng tạo** | Bộ nhớ nhận diện hỗ trợ nhất quán thương hiệu | Bộ nhớ <-> Nhận diện |
| **Vòng đời Nhiệm vụ** | Nhiệm vụ tạo ra bài học cập nhật bộ nhớ | Nhiệm vụ -> Bộ nhớ |
| **Theo dõi Hiệu suất** | Sự kiện hiệu suất cung cấp bằng chứng cho tin cậy | Hiệu suất -> Bộ nhớ |
| **Vòng lặp Học** | Phân tích hiệu suất, cập nhật bộ nhớ, tạo đề xuất | Hiệu suất -> Bộ nhớ -> Đề xuất |
| **Đồ thị Nội dung** | Metadata nội dung cung cấp bối cảnh cho bộ nhớ | Nội dung -> Bộ nhớ |
| **Thử nghiệm** | Kết quả thử nghiệm cập nhật bộ nhớ hiệu suất | Thử nghiệm -> Bộ nhớ |

---

## 12. References / Tham chiếu

| Document | Path |
|----------|------|
| Domain Types (Memory) | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:100-131` |
| Domain Types (Full) | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts` (661 lines) |
| Agent Protocol Types | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:370-456` |
| Performance Events | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:312-347` |
| Experiment Types | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:534-562` |
| Sophia Constitution | [SOPHIA_2027_CONSTITUTION.md](../strategy/SOPHIA_2027_CONSTITUTION.md) |
| IP Graph | [IP_GRAPH.md](./IP_GRAPH.md) |
| Content Graph | [CONTENT_GRAPH.md](./CONTENT_GRAPH.md) |

---

*This document describes the design intent. Implementation details may be added as the Creative Memory repository (`tree/creative-memory/`) is built out during Phase 2 of the 2027 transformation.*
