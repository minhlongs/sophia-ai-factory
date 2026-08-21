# IP Graph Architecture / Kiến trúc Đồ thị Sở hữu Trí tuệ

> Part of Sophia 2027 Creative Economy OS.
> References: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:210-221`

---

## Table of Contents

- [1. Overview / Tổng quan](#1-overview--tổng-quan)
- [2. Type Definition / Định nghĩa Kiểu](#2-type-definition--định-nghĩa-kiểu)
- [3. IP Types / Các loại IP](#3-ip-types--các-loại-ip)
- [4. Parent-Child Hierarchy / Hệ thống Cha-Con](#4-parent-child-hierarchy--hệ-thống-cha-con)
- [5. Derivative Relationships / Mối quan hệ Bản sao](#5-derivative-relationships--mối-quan-hệ-bản-sao)
- [6. IP Lifecycle / Vòng đời IP](#6-ip-lifecycle--vòng-đời-ip)
- [7. IP & Content Graph Bridge / Cầu nối IP & Nội dung](#7-ip--content-graph-bridge--cầu-nối-ip--nội-dung)
- [8. IP & Creative Memory / IP & Bộ nhớ Sáng tạo](#8-ip--creative-memory--ip--bộ-nhớ-sáng-tạo)
- [9. Scoping & Permissions / Phạm vi & Quyền](#9-scoping--permissions--phạm-vi--quyền)
- [10. Query Patterns / Mẫu Truy vấn](#10-query-patterns--mẫu-truy-vấn)
- [11. References / Tham chiếu](#11-references--tham-chiếu)

---

## 1. Overview / Tổng quan

### EN

The IP Graph is Sophia's system for modeling creative intellectual property relationships. It tracks how creative assets -- universes, worlds, series, characters, themes, and brands -- relate to each other hierarchically, and how they connect to the content that derives from them.

When a creator builds a media business, they don't just make individual videos. They build IP: a brand, characters, story worlds, thematic universes. The IP Graph captures these relationships so that:

- Every piece of content can be traced back to its originating IP.
- Every derivative relationship is tracked.
- Cross-IP opportunities (e.g., a character from Universe A appearing in Universe B) are visible.
- IP value can be measured over time.

### VN

Đồ thị IP là hệ thống của Sophia để mô hình hóa mối quan hệ sở hữu trí tuệ sáng tạo. Nó theo dõi cách các tài sản sáng tạo -- vũ trụ, thế giới, loạt phim, nhân vật, chủ đề và thương hiệu -- liên hệ với nhau theo thứ bậc, và cách chúng kết nối với nội dung bắt nguồn từ chúng.

Khi người sáng tạo xây dựng doanh nghiệp truyền thông, họ không chỉ tạo video riêng lẻ. Họ xây dựng IP: thương hiệu, nhân vật, thế giới câu chuyện, vũ trụ chủ đề. Đồ thị IP nắm bắt các mối quan hệ này để:

- Mỗi nội dung đều có thể truy nguyên về IP gốc.
- Mỗi mối quan hệ bản sao đều được theo dõi.
- Cơ hội liên IP (vd nhân vật từ Vũ trụ A xuất hiện trong Vũ trụ B) đều hiển thị.
- Giá trị IP có thể được đo lường theo thời gian.

---

## 2. Type Definition / Định nghĩa Kiểu

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:210-221`

```typescript
export interface IP {
  id: string;
  workspaceId: string;
  type: 'universe' | 'world' | 'series' | 'character' | 'theme' | 'brand';
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  parentId?: string;
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}
```

### Field Reference / Tham chiếu Trường

| Field | Type | Description (EN) | Mô tả (VN) |
|-------|------|-------------------|-------------|
| `id` | `string` | Unique IP identifier | Định danh IP duy nhất |
| `workspaceId` | `string` | Workspace scope | Phạm vi không gian làm việc |
| `type` | `string` | IP entity type (see Section 3) | Loại thực thể IP (xem Mục 3) |
| `name` | `string` | Human-readable name | Tên đọc được |
| `description` | `string` | Description of the IP | Mô tả về IP |
| `metadata` | `Record<string, unknown>` | Extensible key-value data | Dữ liệu key-value mở rộng |
| `parentId` | `string?` | Parent IP in hierarchy | IP cha trong hệ thống bậc thang |
| `status` | `ContentStatus` | Lifecycle status | Trạng thái vòng đời |
| `createdAt` | `number` | Unix timestamp of creation | Dấu thời gian tạo |
| `updatedAt` | `number` | Unix timestamp of last update | Dấu thời gian cập nhật cuối |

Status values (ref: `seed/types/creative-domain.ts:177`):

```typescript
export type ContentStatus =
  | 'draft'
  | 'planned'
  | 'in_production'
  | 'review'
  | 'approved'
  | 'published'
  | 'archived';
```

---

## 3. IP Types / Các loại IP

The IP Graph defines six entity types organized in a strict hierarchy:

### 3.1 Universe / Vũ trụ (top level)

**What it is:** The broadest creative container. A universe contains everything -- worlds, characters, brands.

**Example:**
- "Mekong Entrepreneur" -- a universe about business in Southeast Asia
- "AI Daily" -- a universe about AI technology insights

**Parent:** None (top of hierarchy)

### 3.2 World / Thế giới

**What it is:** A thematic subdivision within a universe. A world groups related content around a specific domain.

**Example:**
- Inside "Mekong Entrepreneur": "Vietnam Startup Ecosystem", "Thai Tech Scene", "Indonesian Market"
- Inside "AI Daily": "LLM Breakthroughs", "AI Tools for Business", "AI Ethics"

**Parent:** Universe

### 3.3 Series / Loạt phim

**What it is:** A sequence of related content pieces within a world. A series has recurring characters, themes, or narrative arcs.

**Example:**
- "Founder Stories" (a series inside "Vietnam Startup Ecosystem" world)
- "Weekly AI Roundup" (a series inside "LLM Breakthroughs" world)

**Parent:** World

### 3.4 Character / Nhân vật

**What it is:** A recurring persona, brand voice, or narrative figure. Characters can appear across series and worlds.

**Example:**
- "The Analyst" -- a recurring persona in video content
- "Mentor Mai" -- a character who appears across multiple series

**Parent:** Universe (characters can span multiple worlds)

### 3.5 Theme / Chủ đề

**What it is:** A recurring topic, motif, or thematic element. Themes cut across worlds and series.

**Example:**
- "Sustainability" -- appears in multiple worlds
- "AI Ethics" -- cross-cutting theme

**Parent:** Universe

### 3.6 Brand / Thương hiệu

**What it is:** The commercial brand identity. A brand owns the commercial rights to content.

**Example:**
- "Sophia Agency" -- the commercial brand
- "Mekong Insights" -- a sub-brand

**Parent:** Universe

---

## 4. Parent-Child Hierarchy / Hệ thống Cha-Con

### EN

The hierarchy forms a tree:

```
Universe (root)
  |
  +-- World
  |     |
  |     +-- Series
  |     +-- Series
  |
  +-- Character (can span worlds)
  +-- Character
  |
  +-- Theme (cross-cutting)
  +-- Theme
  |
  +-- Brand
```

The `parentId` field (ref: `seed/types/creative-domain.ts:217`) creates the tree edges:
- Universe: `parentId = undefined` (root nodes)
- World: `parentId = universe.id`
- Series: `parentId = world.id`
- Character: `parentId = universe.id` (characters live at universe level, can appear in any world)
- Theme: `parentId = universe.id` (themes cross-cut)
- Brand: `parentId = universe.id` (brands own the commercial layer)

### VN

Hệ thống bậc thang tạo thành cây:

- Universe: `parentId = undefined` (nút gốc)
- World: `parentId = universe.id`
- Series: `parentId = world.id`
- Character: `parentId = universe.id` (nhân vật sống ở cấp vũ trụ, có thể xuất hiện trong bất kỳ thế giới nào)
- Theme: `parentId = universe.id` (chủ đề cắt ngang)
- Brand: `parentId = universe.id` (thương hiệu sở hữu lớp thương mại)

### Constraints / Ràng buộc

1. A World MUST have a Universe parent.
2. A Series MUST have a World parent.
3. A Character MAY be at Universe level (spanning worlds) or World level (specific to one world).
4. A Theme MAY be at Universe level (cross-cutting) or World level (domain-specific).
5. A Brand MUST be at Universe level.

---

## 5. Derivative Relationships / Mối quan hệ Bản sao

### EN

IP entities don't just exist in isolation -- they generate content. The IP Graph connects to the Content Graph through `ContentProject` (ref: `seed/types/creative-domain.ts:223-240`):

```typescript
export interface ContentProject {
  id: string;
  workspaceId: string;
  missionId?: string;
  conceptId?: string;
  storyId?: string;
  creatorId: string;
  brandId?: string;      // <-- links to Brand IP
  title: string;
  description: string;
  format: ContentKind;
  status: ContentStatus;
  budgetCents: number;
  actualCostCents: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
```

The `storyId` field links ContentProject to a Story, which links to IP characters and themes via `Story.characters` and `Story.themes`.

### Derivative Chain / Chuỗi Bản sao

When IP generates content, the derivative chain looks like:

```
IP Universe
  -> Character + Theme
    -> Story (ref: seed/types/creative-domain.ts:196-208)
      -> ContentProject (ref: seed/types/creative-domain.ts:223-240)
        -> ContentAsset (ref: seed/types/creative-domain.ts:242-255)
          -> DerivativeAsset (ref: seed/types/creative-domain.ts:257-266)
```

**DerivativeAsset types** (ref: `seed/types/creative-domain.ts:262`):
```
'clip' | 'thumbnail' | 'quote_card' | 'audio_extract' |
'text_extract' | 'remix' | 'translation' | 'summary'
```

### EN

Every derivative tracks its lineage:
- `sourceAssetId` -- the original asset it derives from
- `parentAssetId` -- the immediate parent in the derivative chain

This enables full traceability: a `clip` derived from a `video` derived from a `script` can be traced back through the entire chain to the originating IP.

### VN

Mỗi bản sao theo dõi dòng dõi:
- `sourceAssetId` -- tài sản gốc mà nó bắt nguồn
- `parentAssetId` -- cha trực tiếp trong chuỗi bản sao

Điều này cho phép truy xuất đầy đủ: một `clip` bắt nguồn từ `video` bắt nguồn từ `script` có thể được truy nguyên qua toàn bộ chuỗi về IP gốc.

---

## 6. IP Lifecycle / Vòng đời IP

### EN

IP entities follow `ContentStatus` transitions:

```
draft -> planned -> in_production -> review -> approved -> published -> archived
```

| Status | Meaning | Allowed Actions |
|--------|---------|-----------------|
| `draft` | Being defined, not yet committed | Edit, delete |
| `planned` | Approved concept, resources allocated | Begin production |
| `in_production` | Content is being created | Track progress |
| `review` | Content submitted for human review | Approve, reject, edit |
| `approved` | Human has approved | Prepare for publish |
| `published` | Live and distributed | Track performance, derive |
| `archived` | No longer active | Read-only, audit access |

### VN

IP theo dõi chuyển trạng thái `ContentStatus`:

| Trạng thái | Ý nghĩa | Hành động cho phép |
|-----------|---------|-------------------|
| `draft` | Đang định nghĩa, chưa cam kết | Chỉnh sửa, xóa |
| `planned` | Khái niệm được phê duyệt, phân bổ nguồn lực | Bắt đầu sản xuất |
| `in_production` | Nội dung đang được tạo | Theo dõi tiến độ |
| `review` | Nội dung gửi người xem xét | Phê duyệt, từ chối, chỉnh sửa |
| `approved` | Người đã phê duyệt | Chuẩn bị xuất bản |
| `published` | Đang hoạt động và phân phối | Theo dõi hiệu suất, tạo bản sao |
| `archived` | Không còn hoạt động | Chỉ đọc, truy cập kiểm toán |

---

## 7. IP & Content Graph Bridge / Cầu nối IP & Nội dung

### EN

The IP Graph and Content Graph are connected through three entities:

1. **Story** (ref: `seed/types/creative-domain.ts:196-208`) -- has `characters: string[]` (IP character IDs) and `themes: string[]`
2. **ContentProject** (ref: `seed/types/creative-domain.ts:223-240`) -- has `storyId` and `brandId`
3. **ContentAsset** (ref: `seed/types/creative-domain.ts:242-255`) -- has `projectId` linking to ContentProject

**Bridge diagram:**
```
IP (character, theme, brand)
  |-- Story.characters / Story.themes
  |
  v
Story (ref: seed/types/creative-domain.ts:196)
  |-- Story.conceptId
  |
  v
CreativeConcept (ref: seed/types/creative-domain.ts:180)
  |-- concept -> ContentProject.conceptId
  |
  v
ContentProject (ref: seed/types/creative-domain.ts:223)
  |-- ContentProject.brandId -> IP Brand
  |-- ContentProject.storyId -> Story
  |
  v
ContentAsset (ref: seed/types/creative-domain.ts:242)
  |
  v
DerivativeAsset (ref: seed/types/creative-domain.ts:257)
```

### VN

Đồ thị IP và Đồ thị Nội dung được kết nối qua ba thực thể:

1. **Story** -- có `characters: string[]` (ID nhân vật IP) và `themes: string[]`
2. **ContentProject** -- có `storyId` và `brandId`
3. **ContentAsset** -- có `projectId` kết nối tới ContentProject

---

## 8. IP & Creative Memory / IP & Bộ nhớ Sáng tạo

### EN

IP relationships inform Creative Memory (ref: `seed/types/creative-domain.ts:115-131`):

- **What IP performs well** updates Performance Memory: "Character X in Series Y generates 3x more engagement than Character Z"
- **Audience response to IP** updates Audience Memory: "Audience prefers stories over character-driven content in this universe"
- **IP brand consistency** updates Identity Memory: "Brand A requires formal tone; Brand B requires casual tone"

This creates a feedback loop:

```
IP Creation -> Content Production -> Performance Data
  -> Memory Update -> Better IP Decisions -> More Effective IP
```

### VN

Mối quan hệ IP thông báo Bộ nhớ Sáng tạo:

- **IP nào hoạt động tốt** cập nhật Bộ nhớ Hiệu suất
- **Phản hồi khán giả với IP** cập nhật Bộ nhớ Khán giả
- **Tính nhất quán thương hiệu IP** cập nhật Bộ nhớ Nhận diện

Điều này tạo vòng lặp phản hồi:

```
Tạo IP -> Sản xuất Nội dung -> Dữ liệu Hiệu suất
  -> Cập nhật Bộ nhớ -> Quyết định IP Tốt hơn -> IP Hiệu quả hơn
```

---

## 9. Scoping & Permissions / Phạm vi & Quyền

### EN

**Workspace isolation:** All IP entities have `workspaceId`. IP data is never shared across workspaces.

**Who can create IP:**
- Operator (human) -- always
- Agent at Autonomy Level 3-4 -- can propose IP with `AgentPermission.scopes` matching the workspace
- Agent at Autonomy Level 0-2 -- requires operator approval before IP is created

**Who can modify IP:**
- Operator -- always
- Agent -- only within permitted scopes, and only IP in `draft` or `planned` status

**Who can archive IP:**
- Operator only. No agent can archive IP without explicit human action.

### VN

**Cô lập không gian làm việc:** Tất cả thực thể IP có `workspaceId`. Dữ liệu IP không bao giờ được chia sẻ giữa các không gian làm việc.

**Ai tạo được IP:**
- Người vận hành -- luôn luôn
- Agent ở Mức 3-4 -- có thể đề xuất IP trong phạm vi được phép
- Agent ở Mức 0-2 -- cần phê duyệt người vận hành trước khi IP được tạo

**Ai sửa được IP:**
- Người vận hành -- luôn luôn
- Agent -- chỉ trong phạm vi được phép, và chỉ IP ở trạng thái `draft` hoặc `planned`

**Ai lưu trữ được IP:**
- Chỉ người vận hành. Không agent nào lưu trữ IP mà không có hành động rõ ràng của con người.

---

## 10. Query Patterns / Mẫu Truy vấn

### EN

Common IP Graph queries:

| Query | Purpose | Returns |
|-------|---------|---------|
| `getIPById(id)` | Look up a specific IP entity | Single IP or null |
| `getIPChildren(parentId)` | Get all children of a universe/world/series | Array of IP |
| `getIPDerivatives(ipId)` | Full tree traversal of IP and its descendants | Nested tree structure |
| `getIPByType(workspaceId, type)` | Filter IP by type (e.g., all characters) | Array of IP |
| `getContentByIP(ipId)` | All content projects linked to this IP | Array of ContentProject |
| `getIPLineage(assetId)` | Trace an asset back to its originating IP | Ordered chain from asset -> IP |

### Performance Considerations / Cân nhắc Hiệu suất

IP Graph queries that traverse the full tree (e.g., `getIPDerivatives`) should use pagination for large graphs. The `parentId` field should be indexed for efficient child lookups.

### VN

Các truy vấn Đồ thị IP phổ biến:

| Truy vấn | Mục đích | Trả về |
|---------|----------|--------|
| `getIPById(id)` | Tra cứu thực thể IP cụ thể | IP đơn hoặc null |
| `getIPChildren(parentId)` | Lấy tất cả con của vũ trụ/thế giới/loạt | Mảng IP |
| `getIPDerivatives(ipId)` | Duyệt toàn bộ cây IP và các con | Cấu trúc cây lồng nhau |
| `getIPByType(workspaceId, type)` | Lọc IP theo loại | Mảng IP |
| `getContentByIP(ipId)` | Tất cả dự án nội dung liên kết IP này | Mảng ContentProject |
| `getIPLineage(assetId)` | Truy nguyên tài sản về IP gốc | Chuỗi có thứ tự |

---

## 11. References / Tham chiếu

| Document | Path |
|----------|------|
| IP Type | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:210-221` |
| ContentStatus | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:177` |
| Story Type | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:196-208` |
| ContentProject | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:223-240` |
| ContentAsset | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:242-255` |
| DerivativeAsset | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:257-266` |
| CreativeMemory | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:115-131` |
| Sophia Constitution | [SOPHIA_2027_CONSTITUTION.md](../strategy/SOPHIA_2027_CONSTITUTION.md) |
| Creative Memory | [CREATIVE_MEMORY.md](./CREATIVE_MEMORY.md) |
| Content Graph | [CONTENT_GRAPH.md](./CONTENT_GRAPH.md) |

---

*This document describes the design intent. Implementation details may be added as the IP Graph repository (`tree/ip-graph/`) is built out during Phase 2 of the 2027 transformation.*
