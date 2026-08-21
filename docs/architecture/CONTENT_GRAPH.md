# Content Graph Architecture / Kiến trúc Đồ thị Nội dung

> Part of Sophia 2027 Creative Economy OS.
> References: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:173-266`

---

## Table of Contents

- [1. Overview / Tổng quan](#1-overview--tổng-quan)
- [2. Lifecycle Stages / Giai đoạn Vòng đời](#2-lifecycle-stages--giai-đoạn-vòng-đời)
- [3. Type Definitions / Định nghĩa Kiểu](#3-type-definitions--định-nghĩa-kiểu)
- [4. Content Concept / Khái niệm Nội dung](#4-content-concept--khái-niệm-nội-dung)
- [5. Story / Câu chuyện](#5-story--câu-chuyện)
- [6. Content Project / Dự án Nội dung](#6-content-project--dự-án-nội-dung)
- [7. Content Asset / Tài sản Nội dung](#7-content-asset--tài-sản-nội-dung)
- [8. Derivative Asset / Tài sản Bản sao](#8-derivative-asset--tài-sản-bản-sao)
- [9. Status Flow / Luồng Trạng thái](#9-status-flow--luồng-trạng-thái)
- [10. Content Kinds / Các loại Nội dung](#10-content-kinds--các-loại-nội-dung)
- [11. Graph Relationships / Mối quan hệ Đồ thị](#11-graph-relationships--mối-quan-hệ-đồ-thị)
- [12. Provenance Integration / Tích hợp Truy xuất nguồn gốc](#12-provenance-integration--tích-hợp-truy-xuất-nguồn-gốc)
- [13. Distribution Connection / Kết nối Phân phối](#13-distribution-connection--kết-nối-phân-phối)
- [14. Performance Tracking / Theo dõi Hiệu suất](#14-performance-tracking--theo-dõi-hiệu-suất)
- [15. Query Patterns / Mẫu Truy vấn](#15-query-patterns--mẫu-truy-vấn)
- [16. References / Tham chiếu](#16-references--tham-chiếu)

---

## 1. Overview / Tổng quan

### EN

The Content Graph is Sophia's system for modeling the full content lifecycle -- from initial idea to published derivative. It provides typed, traceable entities at every stage, enabling:

- Full lifecycle visibility: where is this content in the pipeline?
- Derivative tracking: what was created from what?
- Budget tracking: how much did each stage cost?
- Performance attribution: which content generated which revenue?

The Content Graph builds on existing video/content abstractions in `land/video/` and `land/publishing/` -- it does NOT replace them. It adds a typed domain layer on top.

### VN

Đồ thị Nội dung là hệ thống của Sophia để mô hình hóa toàn bộ vòng đời nội dung -- từ ý tưởng ban đầu đến bản sao đã xuất bản. Nó cung cấp các thực thể có kiểu, có thể truy nguyên ở mọi giai đoạn, cho phép:

- Hiển thị đầy đủ vòng đời: nội dung này đang ở đâu trong quy trình?
- Theo dõi bản sao: cái gì được tạo ra từ cái gì?
- Theo dõi ngân sách: mỗi giai đoạn tốn bao nhiêu?
- Gán hiệu suất: nội dung nào tạo ra doanh thu nào?

Đồ thị Nội dung xây dựng trên các trừu tượng video/nội dung hiện có trong `land/video/` và `land/publishing/` -- nó KHÔNG thay thế chúng. Nó thêm lớp domain có kiểu ở trên cùng.

---

## 2. Lifecycle Stages / Giai đoạn Vòng đời

The full content lifecycle:

```
Idea -> Concept -> Brief -> Script -> Storyboard -> Production -> Asset -> Derivative -> Distribution -> Performance
```

### Stage Map to Types / Ánh xạ Giai đoạn sang Kiểu

| Stage | Sophia Type | Ref |
|-------|------------|-----|
| Idea | (stored in Creative Memory) | `seed/types/creative-domain.ts:115-131` |
| Concept | `CreativeConcept` | `seed/types/creative-domain.ts:180-194` |
| Brief | (part of `ContentProject.description`) | `seed/types/creative-domain.ts:234` |
| Script | `ContentAsset` (type: `'script'`) | `seed/types/creative-domain.ts:246` |
| Storyboard | `ContentAsset` (type: `'storyboard'`) | `seed/types/creative-domain.ts:246` |
| Production | (tracked via `ContentProject.status = 'in_production'`) | `seed/types/creative-domain.ts:235` |
| Asset | `ContentAsset` | `seed/types/creative-domain.ts:242-255` |
| Derivative | `DerivativeAsset` | `seed/types/creative-domain.ts:257-266` |
| Distribution | `DistributionPlan` | `seed/types/creative-domain.ts:272-281` |
| Performance | `PerformanceEvent` / `PerformanceSnapshot` | `seed/types/creative-domain.ts:312-347` |

### EN

Not every content piece goes through all stages. A simple social media post may jump from Concept directly to Asset. A complex video series may go through every stage. The graph supports both paths.

### VN

Không phải mọi nội dung đều đi qua tất cả giai đoạn. Một bài đăng mạng xã hội đơn giản có thể nhảy từ Concept trực tiếp đến Asset. Một loạt video phức tạp có thể đi qua mọi giai đoạn. Đồ thị hỗ trợ cả hai con đường.

---

## 3. Type Definitions / Định nghĩa Kiểu

### Shared Base Types / Kiểu Cơ sở Chung

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:177-178`

```typescript
export type ContentStatus =
  | 'draft' | 'planned' | 'in_production'
  | 'review' | 'approved' | 'published' | 'archived';

export type ContentKind =
  | 'video_short' | 'video_long' | 'image'
  | 'audio' | 'article' | 'carousel' | 'mixed';
```

---

## 4. Content Concept / Khái niệm Nội dung

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:180-194`

```typescript
export interface CreativeConcept {
  id: string;
  workspaceId: string;
  missionId?: string;
  title: string;
  hook: string;
  format: ContentKind;
  targetChannel: string[];
  audience: string;
  estimatedDuration?: number;
  tags: string[];
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}
```

### EN

**What it represents:** The initial creative idea -- a concept for content that hasn't been scripted or produced yet. This is where the "vision" stage of the flywheel becomes concrete.

**Key fields:**
- `hook` -- the attention-grabbing opening. This is what the audience sees first.
- `targetChannel` -- which platforms this concept is intended for.
- `audience` -- who this content is for.
- `tags` -- searchable labels for finding related concepts.

**Lifecycle:** Concept is created during the VISION phase. It may be approved, modified, or abandoned before moving to Story/Project stage.

### VN

**Nó đại diện cho:** Ý tưởng sáng tạo ban đầu -- khái niệm về nội dung chưa được viết kịch bản hay sản xuất. Đây là nơi "giai đoạn tưởng tượng" của con lăn trở nên cụ thể.

**Các trường chính:**
- `hook` -- phần mở đầu thu hút sự chú ý. Đây là điều khán giả thấy đầu tiên.
- `targetChannel` -- nền tảng nào khái niệm này hướng tới.
- `audience` -- nội dung này dành cho ai.
- `tags` -- nhãn tìm được để tìm các khái niệm liên quan.

---

## 5. Story / Câu chuyện

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:196-208`

```typescript
export interface Story {
  id: string;
  workspaceId: string;
  conceptId?: string;
  title: string;
  synopsis: string;
  characters: string[]; // IP character IDs
  themes: string[];
  arc: string; // narrative arc description
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}
```

### EN

**What it represents:** A narrative wrapper that connects a creative concept to its IP entities (characters, themes). A Story groups related content pieces under a unified narrative.

**Key fields:**
- `conceptId` -- links back to the originating `CreativeConcept`
- `characters` -- IP character IDs (from IP Graph) that appear in this story
- `themes` -- thematic elements (from IP Graph) explored in this story
- `arc` -- the narrative arc: beginning, conflict, resolution

**Bridge role:** Story is the bridge between Content Graph and IP Graph. It references IP characters and themes by ID, creating a typed link between the creative output and the intellectual property.

### VN

**Nó đại diện cho:** Wrapper kể chuyện kết nối khái niệm sáng tạo với các thực thể IP (nhân vật, chủ đề). Story nhóm các nội dung liên quan dưới một câu chuyện thống nhất.

**Vai trò cầu nối:** Story là cầu nối giữa Đồ thị Nội dung và Đồ thị IP. Nó tham chiếu nhân vật và chủ đề IP bằng ID, tạo liên kết có kiểu giữa đầu ra sáng tạo và sở hữu trí tuệ.

---

## 6. Content Project / Dự án Nội dung

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:223-240`

```typescript
export interface ContentProject {
  id: string;
  workspaceId: string;
  missionId?: string;
  conceptId?: string;
  storyId?: string;
  creatorId: string;
  brandId?: string;
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

### EN

**What it represents:** A production project -- the container for all work related to creating a specific piece of content. This is the central hub of the Content Graph.

**Key fields:**
- `missionId` -- links to the parent Mission (if part of a larger campaign)
- `conceptId` -- links to the originating CreativeConcept
- `storyId` -- links to the Story (narrative wrapper)
- `brandId` -- links to the Brand IP
- `budgetCents` / `actualCostCents` -- budget tracking per project

**Centrality:** ContentProject is the hub that connects:
- Upstream: Mission, CreativeConcept, Story
- Downstream: ContentAsset, DerivativeAsset
- Lateral: DistributionPlan, PerformanceEvent, RevenueEvent
- IP: Brand, Character, Theme

### VN

**Nó đại diện cho:** Dự án sản xuất -- container cho tất cả công việc liên quan đến tạo một nội dung cụ thể. Đây là trung tâm của Đồ thị Nội dung.

**Trung tâm:** ContentProject là trung tâm kết nối:
- upstream: Mission, CreativeConcept, Story
- downstream: ContentAsset, DerivativeAsset
- ngang: DistributionPlan, PerformanceEvent, RevenueEvent
- IP: Brand, Character, Theme

---

## 7. Content Asset / Tài sản Nội dung

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:242-255`

```typescript
export interface ContentAsset {
  id: string;
  projectId: string;
  workspaceId: string;
  type: 'script' | 'storyboard' | 'audio' | 'video' | 'image' | 'subtitle' | 'thumbnail';
  storageKey?: string; // R2 key if applicable
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status: ContentStatus;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
```

### EN

**What it represents:** A concrete, stored piece of content -- the actual files and metadata for a produced asset.

**Asset types:**
| Type | Description |
|------|-------------|
| `script` | Written content (text, dialogue, narration) |
| `storyboard` | Visual sequence plan for video |
| `audio` | Sound file (voiceover, music, effects) |
| `video` | Video file (the main production output) |
| `image` | Static image (photos, illustrations) |
| `subtitle` | Text overlay or subtitle file |
| `thumbnail` | Preview image for distribution |

**Storage:** `storageKey` maps to Cloudflare R2 storage (ref: `seed/r2/`). The asset's actual binary data lives in R2; the ContentAsset holds the metadata and pointer.

### VN

**Nó đại diện cho:** Một nội dung cụ thể, đã lưu trữ -- các file thực tế và metadata cho tài sản đã sản xuất.

**Lưu trữ:** `storageKey` ánh xạ đến kho Cloudflare R2. Dữ liệu nhị phân thực tế của tài sản sống trong R2; ContentAsset giữ metadata và con trỏ.

---

## 8. Derivative Asset / Tài sản Bản sao

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:257-266`

```typescript
export interface DerivativeAsset {
  id: string;
  workspaceId: string;
  sourceAssetId: string;
  parentAssetId: string;
  type: 'clip' | 'thumbnail' | 'quote_card' | 'audio_extract'
      | 'text_extract' | 'remix' | 'translation' | 'summary';
  storageKey?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}
```

### EN

**What it represents:** A piece of content derived from a `ContentAsset`. Derivatives are how one asset becomes many -- a video becomes clips, thumbnails, quotes, translations.

**Derivative types:**
| Type | Source | Output |
|------|--------|--------|
| `clip` | video | Shorter video segment |
| `thumbnail` | video/image | Preview image for a platform |
| `quote_card` | video/audio/text | Image with text overlay for social media |
| `audio_extract` | video/audio | Extracted audio track |
| `text_extract` | video/audio/text | Extracted text (subtitles, transcript) |
| `remix` | any | Modified version (different pacing, style) |
| `translation` | any | Translated version (different language) |
| `summary` | any | Condensed version |

**Lineage fields:**
- `sourceAssetId` -- the original ContentAsset this derives from (always the "root" asset)
- `parentAssetId` -- the immediate parent (could be another DerivativeAsset for chain derivatives)

This enables multi-hop derivation: a `summary` derived from a `clip` derived from a `video` can be traced back through the chain.

### VN

**Nó đại diện cho:** Nội dung bắt nguồn từ một `ContentAsset`. Bản sao là cách một tài sản trở thành nhiều -- video trở thành clip, hình thu nhỏ, trích dẫn, bản dịch.

**Các trường dòng dõi:**
- `sourceAssetId` -- ContentAsset gốc mà nó bắt nguồn
- `parentAssetId` -- cha trực tiếp (có thể là DerivativeAsset khác cho chuỗi bản sao)

Điều này cho phép suy đoạn đa hop: một `summary` bắt nguồn từ `clip` bắt nguồn từ `video` có thể được truy nguyên qua chuỗi.

---

## 9. Status Flow / Luồng Trạng thái

### EN

All content entities share the same `ContentStatus` lifecycle:

```
draft -> planned -> in_production -> review -> approved -> published -> archived
```

**Stage-specific status usage:**

| Stage | Typical Status | Notes |
|-------|---------------|-------|
| Concept | `draft` -> `approved` or `archived` | Concepts are approved or abandoned |
| Story | `draft` -> `planned` | Stories are planned before production |
| Project | `draft` -> `planned` -> `in_production` -> `review` -> `approved` | Full production lifecycle |
| Asset | `in_production` -> `review` -> `approved` -> `published` | Created during production |
| Derivative | `draft` -> `published` (simpler lifecycle) | Created from existing assets |

### Transition Rules / Quy tắc Chuyển trạng thái

| From | Allowed To | Trigger |
|------|-----------|---------|
| `draft` | `planned`, `archived` | Planning phase |
| `planned` | `in_production` | Production begins |
| `in_production` | `review` | Content ready for review |
| `review` | `approved`, `draft` | Human review (approve or send back) |
| `approved` | `published` | Distribution initiated |
| `published` | `archived` | Content lifecycle complete |

### VN

Tất cả thực thể nội dung chia sẻ vòng đời `ContentStatus` giống nhau.

Các quy tắc chuyển trạng thái đảm bảo nội dung luôn di chuyển về phía trước trong quy trình, không nhảy ngang giai đoạn.

---

## 10. Content Kinds / Các loại Nội dung

Ref: `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:178`

```typescript
export type ContentKind =
  | 'video_short' | 'video_long' | 'image'
  | 'audio' | 'article' | 'carousel' | 'mixed';
```

### Kind Matrix / Ma trận loại

| Kind | Typical Platform | Duration | Asset Types |
|------|-----------------|----------|-------------|
| `video_short` | TikTok, YouTube Shorts, Instagram Reels | 15-60s | video, thumbnail, subtitle |
| `video_long` | YouTube, Facebook | 3-30min | video, thumbnail, subtitle, storyboard |
| `image` | Instagram, Pinterest, X | N/A | image, thumbnail |
| `audio` | Spotify, Apple Podcasts | 5-60min | audio |
| `article` | Blog, Medium, Substack | N/A | text (stored as script asset) |
| `carousel` | Instagram, LinkedIn | N/A | image (multiple) |
| `mixed` | Cross-platform | Varies | combination of above |

### EN

ContentKind determines which asset types are required and which distribution channels are appropriate. A `video_short` requires a `video` asset and `thumbnail`; a `mixed` kind may require all asset types.

### VN

ContentKind xác định loại tài sản nào cần thiết và kênh phân phối nào phù hợp. `video_short` cần tài sản `video` và `thumbnail`; loại `mixed` có thể cần tất cả loại tài sản.

---

## 11. Graph Relationships / Mối quan hệ Đồ thị

### EN

The complete Content Graph entity relationship diagram:

```
Mission
  |
  v
CreativeConcept (ref: 180-194)
  |
  +-- targetChannel[]
  +-- tags[]
  |
  v
Story (ref: 196-208)
  |
  +-- characters[] --> IP (character)
  +-- themes[] --> IP (theme)
  |
  v
ContentProject (ref: 223-240)  <--- CENTRAL HUB
  |
  +-- missionId --> Mission
  +-- conceptId --> CreativeConcept
  +-- storyId --> Story
  +-- brandId --> IP (brand)
  +-- budgetCents / actualCostCents
  |
  v
ContentAsset (ref: 242-255)
  |
  +-- projectId --> ContentProject
  +-- type (script/storyboard/audio/video/image/subtitle/thumbnail)
  +-- storageKey --> R2
  |
  v
DerivativeAsset (ref: 257-266)
  |
  +-- sourceAssetId --> ContentAsset (original)
  +-- parentAssetId --> ContentAsset or DerivativeAsset (chain)
  +-- type (clip/thumbnail/quote_card/audio_extract/text_extract/remix/translation/summary)
  +-- storageKey --> R2
```

**Connected systems (outside Content Graph):**
- `DistributionPlan` (ref: `seed/types/creative-domain.ts:272`) -- connects ContentProject to platforms
- `PerformanceEvent` (ref: `seed/types/creative-domain.ts:312`) -- tracks events per asset/project
- `PerformanceSnapshot` (ref: `seed/types/creative-domain.ts:327`) -- aggregated metrics per asset/channel
- `RevenueEvent` (ref: `seed/types/creative-domain.ts:355`) -- revenue per asset/project
- `ProvenanceRecord` (ref: `seed/types/creative-domain.ts:511`) -- audit trail per asset
- `Experiment` (ref: `seed/types/creative-domain.ts:536`) -- A/B tests per project

### VN

Đồ thị Nội dung đầy đủ bắt đầu từ Mission, đi qua CreativeConcept và Story, tập trung tại ContentProject, rồi lan rộng ra ContentAsset và DerivativeAsset. Mỗi thực thể có thể được kết nối với DistributionPlan, PerformanceEvent, RevenueEvent và ProvenanceRecord.

---

## 12. Provenance Integration / Tích hợp Truy xuất nguồn gốc

### EN

Every ContentAsset and DerivativeAsset has an associated `ProvenanceRecord` (ref: `seed/types/creative-domain.ts:511-528`):

```typescript
export interface ProvenanceRecord {
  id: string;
  workspaceId: string;
  assetId: string;          // <-- links to ContentAsset.id or DerivativeAsset.id
  agentRunId?: string;      // which agent run created/modified this
  action: ProvenanceAction; // created, generated, edited, approved, etc.
  actorType: 'human' | 'agent' | 'system';
  actorId: string;
  model?: string;           // which AI model was used
  modelVersion?: string;
  prompt?: string;          // the prompt that generated this (for audit)
  sourceAssetId?: string;   // for derived content
  humanEdits?: string;      // description of human edits
  approvalId?: string;      // link to approval record
  derivativeOf?: string;    // parent asset for derivations
  metadata: Record<string, unknown>;
  createdAt: number;
}
```

**Provenance actions** (ref: `seed/types/creative-domain.ts:501-509`):
```
'created' | 'generated' | 'edited' | 'approved' |
'rejected' | 'published' | 'derived' | 'archived'
```

### VN

Mỗi ContentAsset và DerivativeAsset đều có `ProvenanceRecord` liên kết. Hệ thống truy xuất nguồn gốc ghi lại ai đã tạo, chỉnh sửa, phê duyệt hay xuất bản mỗi tài sản, với thông tin về model AI đã sử dụng và prompt đã tạo ra nó.

---

## 13. Distribution Connection / Kết nối Phân phối

### EN

Content flows to distribution through `DistributionPlan` (ref: `seed/types/creative-domain.ts:272-306`):

```typescript
export interface DistributionPlan {
  id: string;
  projectId: string;        // <-- links to ContentProject.id
  workspaceId: string;
  channels: ChannelConfig[];
  scheduleAt?: number;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  createdAt: number;
  updatedAt: number;
}
```

Each channel in the plan has its own configuration:

```typescript
export interface ChannelConfig {
  channel: string;       // 'youtube' | 'tiktok' | 'x' | ...
  assetId: string;       // <-- which ContentAsset to distribute
  title?: string;
  description?: string;
  tags?: string[];
  publishAt?: number;
  settings: Record<string, unknown>;
}
```

And each published piece is tracked as a `DistributionAsset`:

```typescript
export interface DistributionAsset {
  id: string;
  workspaceId: string;
  planId: string;
  assetId: string;
  channel: string;
  platformPostId?: string;  // ID on the platform (YouTube video ID, etc.)
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
  scheduledAt: number;
  postedAt?: number;
  analytics: Record<string, unknown>;
  error?: string;
  createdAt: number;
}
```

### EN

One ContentProject can have multiple DistributionPlans (one per campaign wave or platform set). Each plan distributes specific ContentAssets to specific channels with channel-specific metadata.

### VN

Một ContentProject có thể có nhiều DistributionPlan (một cho mỗi đợt chiến dịch hoặc tập hợp nền tảng). Mỗi plan phân phối ContentAsset cụ thể đến kênh cụ thể với metadata riêng cho kênh đó.

---

## 14. Performance Tracking / Theo dõi Hiệu suất

### EN

After distribution, performance is tracked via two types:

**PerformanceEvent** (ref: `seed/types/creative-domain.ts:312-325`) -- individual events:
```typescript
export interface PerformanceEvent {
  id: string;
  workspaceId: string;
  assetId: string;           // ContentAsset or DerivativeAsset ID
  projectId: string;         // ContentProject ID
  entityType: string;        // 'asset' | 'mission' | 'campaign'
  entityId: string;
  channel: string;           // platform name
  eventType: string;         // 'impression' | 'view' | 'click' | 'like' | 'share' | 'save' | 'follow' | 'conversion' | 'revenue'
  count: number;
  valueCents?: number;
  recordedAt: number;
  rawData?: Record<string, unknown>;
}
```

**PerformanceSnapshot** (ref: `seed/types/creative-domain.ts:327-347`) -- aggregated metrics:
```typescript
export interface PerformanceSnapshot {
  id: string;
  workspaceId: string;
  assetId: string;
  channel: string;
  snapshotDate: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchTimeSeconds: number;
  retention3s: number;
  retention30s: number;
  followerDelta: number;
  leadDelta: number;
  revenueCents: number;
  costCents: number;
  creativeRoi: number;      // <-- computed ROI per asset per channel
}
```

### EN

Performance data feeds back into the Content Graph lifecycle:

1. **PerformanceEvent** provides real-time event tracking per asset per channel.
2. **PerformanceSnapshot** provides daily aggregated metrics.
3. **creativeRoi** on the snapshot enables the North Star metric (EOPCU) calculation.
4. Data flows to Creative Memory to update performance-related learnings.

### VN

Dữ liệu hiệu suất chảy ngược vào vòng đời Đồ thị Nội dung:

1. **PerformanceEvent** cung cấp theo dõi sự kiện thời gian thực.
2. **PerformanceSnapshot** cung cấp số liệu tổng hợp hàng ngày.
3. **creativeRoi** trên snapshot cho phép tính chỉ số La bàn (EOPCU).
4. Dữ liệu chảy đến Bộ nhớ Sáng tạo để cập nhật bài học liên quan đến hiệu suất.

---

## 15. Query Patterns / Mẫu Truy vấn

### EN

Common Content Graph queries:

| Query | Purpose | Returns |
|-------|---------|---------|
| `getContentLineage(projectId)` | Full lifecycle trace of a project | Ordered chain: Mission -> Concept -> Story -> Project -> Assets -> Derivatives |
| `getContentAssets(projectId)` | All assets for a project | Array of ContentAsset |
| `getAssetDerivatives(assetId)` | All derivatives of an asset | Array of DerivativeAsset (with chain depth) |
| `getContentByStatus(workspaceId, status)` | Filter content by lifecycle status | Array of ContentProject |
| `getContentByFormat(workspaceId, kind)` | Filter by content kind | Array of ContentProject |
| `getContentPerformance(projectId)` | Join with PerformanceEvent/Snapshot | Performance data per asset per channel |
| `getContentBudget(projectId)` | Budget vs actual cost | `budgetCents`, `actualCostCents`, delta |
| `getContentDistribution(projectId)` | Distribution status across platforms | Array of DistributionPlan with status |

### Performance Considerations / Cân nhắc Hiệu suất

- `getContentLineage` traverses multiple entity types. Implement with joins, not N+1 queries.
- `getAssetDerivatives` supports tree traversal. Use pagination for assets with many derivatives.
- `getContentPerformance` joins ContentAsset with PerformanceSnapshot. Consider materialized views for frequently accessed performance data.

### VN

Các truy vấn phổ biến bao gồm theo dõi dòng dõi đầy đủ, lọc theo trạng thái và loại, và truy vấn hiệu suất được kết hợp. Các truy vấn phức tạp như `getContentLineage` nên triển khai với join, không phải N+1 query.

---

## 16. References / Tham chiếu

| Document | Path |
|----------|------|
| Domain Types (Full) | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts` (661 lines) |
| ContentStatus | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:177` |
| ContentKind | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:178` |
| CreativeConcept | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:180-194` |
| Story | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:196-208` |
| IP | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:210-221` |
| ContentProject | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:223-240` |
| ContentAsset | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:242-255` |
| DerivativeAsset | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:257-266` |
| DistributionPlan | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:272-281` |
| ChannelConfig | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:283-291` |
| DistributionAsset | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:293-306` |
| PerformanceEvent | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:312-325` |
| PerformanceSnapshot | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:327-347` |
| RevenueEvent | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:355-367` |
| ProvenanceRecord | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts:511-528` |
| Sophia Constitution | [SOPHIA_2027_CONSTITUTION.md](../strategy/SOPHIA_2027_CONSTITUTION.md) |
| Creative Memory | [CREATIVE_MEMORY.md](./CREATIVE_MEMORY.md) |
| IP Graph | [IP_GRAPH.md](./IP_GRAPH.md) |

---

*This document describes the design intent. Implementation details may be added as the Content Graph repository (`tree/content-graph/`) is built out during Phase 2 of the 2027 transformation. Existing video/content abstractions in `land/video/` and `land/publishing/` are NOT replaced -- the Content Graph adds a typed domain layer on top.*
