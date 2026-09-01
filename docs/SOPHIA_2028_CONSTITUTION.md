# Sophia 2028 Constitution / Hiến pháp Sophia 2028

> Version: 2.0 · Effective: 2026-09-01 (supersedes v1.1, effective 2026-08-25)
> Codename: Creative Economy OS
> **Supersedes `SOPHIA_2027_CONSTITUTION.md` v1.1 (`docs/strategy/`).** That document is now a historical reference — do not edit it.
> Canonical copy: this file (repo-root `docs/`). App-side copies are mirrors — do not edit them.
> Code citations use symbol anchors (verified against HEAD `d7ba0c83` on 2026-09-01).

---

## Table of Contents

- [1. Mission / Sứ mệnh](#1-mission--sứ-mệnh)
- [2. Product Identity / Nhận diện sản phẩm](#2-product-identity--nhận-diện-sản-phẩm)
- [3. Product Non-Goals / Những gì KHÔNG phải mục tiêu](#3-product-non-goals--những-gì-không-phải-mục-tiêu)
- [4. North Star / La bàn](#4-north-star--la-bàn)
- [5. Creative Economy Thesis / Luận đề Kinh tế Sáng tạo](#5-creative-economy-thesis--luận-đề-kinh-tế-sáng-tạo)
- [6. Human Creative Ownership / Chủ sở hữu Sáng tạo](#6-human-creative-ownership--chủ-sở-hữu-sáng-tạo)
- [7. Agent Autonomy Rules / Quy tắc Tự động hóa](#7-agent-autonomy-rules--quy-tắc-tự-động-hóa)
- [8. System Graphs / Các đồ thị Hệ thống](#8-system-graphs--các-đồ-thị-hệ-thống)
- [9. Provenance / Truy xuất nguồn gốc](#9-provenance--truy-xuất-nguồn-gốc)
- [10. Monetization / Kiếm tiền](#10-monetization--kiếm-tiền)
- [11. Data Flywheel / Con lăn Dữ liệu](#11-data-flywheel--con-lăn-dữ-liệu)
- [12. Model-Agnostic Architecture / Kiến trúc Không phụ thuộc Model](#12-model-agnostic-architecture--kiến-trúc-không-phụ-thuộc-model)
- [13. Sovereignty Boundaries / Ranh giới Chủ quyền](#13-sovereignty-boundaries--ranh-giới-chủ-quyền)
- [14. Security / Bảo mật](#14-security--bảo-mật)
- [15. Privacy / Quyền riêng tư](#15-privacy--quyền-riêng-tư)
- [16. Governance / Quản trị](#16-governance--quản-trị)
- [17. Quality / Chất lượng](#17-quality--chất-lượng)
- [18. 2028 KPIs / Chỉ số 2028](#18-2028-kpis--chỉ-số-2028)
- [19. Architecture Principles / Nguyên tắc Kiến trúc](#19-architecture-principles--nguyên-tắc-kiến-trúc)
- [20. Delete List / Danh sách Xóa](#20-delete-list--danh-sách-xóa)
- [21. Decision Rules / Quy tắc Ra quyết định](#21-decision-rules--quy-tắc-ra-quyết-định)
- [22. References / Tham chiếu](#22-references--tham-chiếu)
- [23. Production Hardening Doctrine / Giáo lý Bảo vệ Production](#23-production-hardening-doctrine--giáo-lý-bảo-vệ-production)
- [Amendment Changelog / Nhật ký Sửa đổi](#amendment-changelog--nhật-ký-sửa-đổi)

---

## 1. Mission / Sứ mệnh

### EN

Sophia AI Factory transforms non-technical CEOs into autonomous media business operators. AI generates content. Agents orchestrate workflows. **Human owns taste and final creative authority.**

Sophia's mission is to provide the economic infrastructure that turns a single creative idea into revenue-generating content across multiple platforms, with the operator retaining full creative control at every stage.

### VN

Sophia AI Factory chuyển đổi các CEO không biết kỹ thuật thành những nhà vận hành doanh nghiệp truyền thông tự động. AI tạo nội dung. Agent điều phối quy trình. **Con người sở hữu gu thẩm mỹ và quyền sáng tạo cuối cùng.**

Sứ mệnh của Sophia là cung cấp hạ tầng kinh tế biến một ý tưởng sáng tạo duy nhất thành nội dung tạo ra doanh thu trên nhiều nền tảng, với người vận hành giữ toàn quyền kiểm soát sáng tạo ở mọi giai đoạn.

---

## 2. Product Identity / Nhận diện sản phẩm

### EN

- **What it is:** A Creative Economy Operating System -- a SaaS platform that helps creators produce, distribute, and monetize content at scale.
- **What it is NOT:** An AI video factory, a content farm, a social media scheduler, or a replacement for human creativity.
- **Target user:** Non-technical CEOs running Revenue-as-a-Service (RaaS) businesses.
- **Core value proposition:** Turn creative ideas into economic output with full ownership and provenance.
- **Shipped state (2026-09-01):** Agent protocol, Creative Memory, Provenance, Mission Lifecycle, Autonomy Levels, Experiment Engine, Distribution OS, Commerce modules, Reality Loop v1 (11/13 emitters wired), revenue ingestion (YouTube + TikTok Shop), bilingual Creative Economy dashboard, internal Reality Loop dashboard, and Production Hardening (alerts + budget governance) are live in production. 8682 tests pass on HEAD `d7ba0c83`. See the [2028 Roadmap](../roadmap/SOPHIA_2028_ROADMAP.md).

### VN

- **Nó là gì:** Hệ điều hành Kinh tế Sáng tạo -- nền tảng SaaS giúp người sáng tạo sản xuất, phân phối và kiếm tiền từ nội dung ở quy mô lớn.
- **Nó KHÔNG phải là:** Nhà máy video AI, trang trại nội dung, trình lập lịch mạng xã hội, hay sự thay thế cho sáng tạo của con người.
- **Người dùng mục tiêu:** CEO không biết kỹ thuật vận hành doanh nghiệp Dịch vụ dưới dạng Doanh thu (RaaS).
- **Giá trị cốt lõi:** Biến ý tưởng sáng tạo thành đầu ra kinh tế với toàn quyền sở hữu và truy xuất nguồn gốc.
- **Trạng thái đã triển khai (2026-09-01):** Agent protocol, Bộ nhớ Sáng tạo, Truy xuất nguồn gốc, Vòng đời Mission, Mức Tự động hóa, Experiment Engine, Hệ thống Phân phối, Module Thương mại, Reality Loop v1 (11/13 emitter hoạt động), ingestion doanh thu (YouTube + TikTok Shop), dashboard Kinh tế Sáng tạo song ngữ, dashboard Reality Loop nội bộ, và Bảo vệ Production (cảnh báo + quản trị ngân sách) đã hoạt động trên production. 8682 bài kiểm tra pass trên HEAD `d7ba0c83`. Xem [Lộ trình 2028](../roadmap/SOPHIA_2028_ROADMAP.md).

---

## 3. Product Non-Goals / Những gì KHÔNG phải mục tiêu

### EN

Sophia explicitly does NOT aim to:

1. **Replace human creative judgment.** AI generates options; humans decide.
2. **Maximize video count.** Quality and economic output per creative unit matter more than volume.
3. **Become a general-purpose AI platform.** Sophia is a creative-economy-focused product, not an AI model hub.
4. **Generate deepfakes or misleading content.** All content must be ethical, legal, and transparent.
5. **Own the creator's IP.** The operator owns everything -- Sophia is infrastructure, not a content owner.
6. **Handle operator-level infrastructure.** No third-party cron registrations, no operator observability tokens per the No-Tech Doctrine.

### VN

Sophia rõ ràng KHÔNG nhằm:

1. **Thay thế phán đoán sáng tạo của con người.** AI tạo ra các phương án; con người quyết định.
2. **Tối đa số lượng video.** Chất lượng và đầu ra kinh tế trên mỗi đơn vị sáng tạo quan trọng hơn số lượng.
3. **Trở thành nền tảng AI tổng quát.** Sophia là sản phẩm tập trung vào kinh tế sáng tạo, không phải trung tâm model AI.
4. **Tạo nội dung deepfake hoặc gây hiểu lầm.** Tất cả nội dung phải đạo đức, hợp pháp và minh bạch.
5. **Sở hữu IP của người sáng tạo.** Người vận hành sở hữu tất cả -- Sophia là hạ tầng, không phải chủ sở hữu nội dung.
6. **Quản lý hạ tầng cấp vận hành.** Không đăng ký cron bên ngoài, không token observability cho vận hành theo Giáo lý Không-Tech.

---

## 4. North Star / La bàn

### EN

**North Star Metric: Creative Leverage** — economic output per creative unit.

Creative Leverage is the total revenue generated per distinct creative idea (concept, story, or mission). It replaces the old "number of videos" metric. One concept, one name: "Creative Leverage" is the term used everywhere in Sophia; the formula below is its measurement definition (historically abbreviated EOPCU — that abbreviation is retired as a brand term).

**Measurement definition:**
```
Creative Leverage = (total revenue from content derived from one creative unit) / (cost to produce all derivatives)
```

**Why this matters:**
- It measures what actually matters -- money, not volume.
- It incentivizes quality over quantity.
- It accounts for the full content lifecycle: idea -> production -> distribution -> revenue.
- It naturally captures the compound effect: one good idea becomes 10+ derivatives across platforms.

### VN

**Chỉ số La bàn: Đòn bẩy Sáng tạo (Creative Leverage)** — đầu ra kinh tế trên mỗi đơn vị sáng tạo.

Đòn bẩy Sáng tạo là tổng doanh thu tạo ra trên mỗi ý tưởng sáng tạo riêng biệt (khái niệm, câu chuyện, hoặc nhiệm vụ). Nó thay thế chỉ số cũ "số lượng video". Một khái niệm, một tên gọi: "Creative Leverage" là thuật ngữ dùng thống nhất trong Sophia; công thức dưới đây là định nghĩa đo lường của nó (tên viết tắt cũ EOPCU không còn được dùng làm thuật ngữ).

**Định nghĩa đo lường:**
```
Creative Leverage = (tổng doanh thu từ nội dung bắt nguồn từ một đơn vị sáng tạo) / (chi phí sản xuất tất cả các bản sao)
```

**Tại sao điều này quan trọng:**
- Đo lường điều thực sự quan trọng -- tiền, không phải số lượng.
- Thúc đẩy chất lượng hơn số lượng.
- Tính đến toàn bộ vòng đời nội dung: ý tưởng -> sản xuất -> phân phối -> doanh thu.
- Tự nhiên nắm bắt hiệu ứng kép: một ý tưởng hay trở thành 10+ bản sao trên nhiều nền tảng.

---

## 5. Creative Economy Thesis / Luận đề Kinh tế Sáng tạo

### EN

The Creative Economy Thesis rests on three observations:

1. **Content is a compounding asset.** A single well-crafted idea generates derivatives (clips, thumbnails, quotes, translations, summaries) that each independently generate revenue. Most creators only capture the first-order output.

2. **Distribution is the bottleneck.** Creators produce content but fail to distribute across all viable platforms. The marginal cost of distributing an additional derivative is near-zero for AI, but the marginal revenue is real.

3. **Data compounds creative intuition.** When you know what works (performance data), who watches (audience data), and what to make next (memory data), each subsequent creative decision improves. This is a flywheel that only accelerates.

Sophia's economic model: **VISION -> CREATE -> DISTRIBUTE -> MEASURE -> LEARN -> COMPOUND.**

### VN

Luận đề Kinh tế Sáng tạo dựa trên ba quan sát:

1. **Nội dung là tài sản cộng dồn.** Một ý tưởng được tạo dựng kỹ lưỡng sẽ tạo ra các bản sao (đoạn clip, hình thu nhỏ, câu trích dẫn, bản dịch, bản tóm tắt) mà mỗi bản đều tạo ra doanh thu độc lập. Hầu hết người sáng tạo chỉ nắm bắt được đầu ra cấp đầu tiên.

2. **Phân phối là nút thắt cổ chai.** Người sáng tạo tạo nội dung nhưng không phân phối được trên tất cả nền tảng khả thi. Chi phí biên để phân phối thêm một bản sao gần như bằng không với AI, nhưng doanh thu biên là thật.

3. **Dữ liệu cộng dồn trực giác sáng tạo.** Khi bạn biết điều gì hiệu quả (dữ liệu hiệu suất), ai xem (dữ liệu khán giả), và nên làm gì tiếp theo (dữ liệu bộ nhớ), mỗi quyết định sáng tạo tiếp theo đều cải thiện. Đây là con lăn chỉ có tăng tốc.

Mô hình kinh tế của Sophia: **TƯỞNG TƯỢNG -> TẠO -> PHÂN PHỐI -> ĐO LƯỜNG -> HỌC -> CỘNG DỒN.**

---

## 6. Human Creative Ownership / Chủ sở hữu Sáng tạo

### EN

**Critical principle: AI generates. Agents orchestrate. Human owns taste and final creative authority.**

Every piece of content in Sophia can be traced to its origin. The human operator:

- **Approves** before publish at Autonomy Levels 0-2. (Ref: `AutonomyLevel` in `seed/types/creative-domain.ts` -- `AutonomyLevel = 0 | 1 | 2 | 3 | 4`)
- **Reviews** agent decisions at Levels 3-4 (post-publish audit).
- **Edits** any memory, identity, or content at any time.
- **Overrides** any agent decision. No agent action is irreversible without explicit human approval.
- **Owns all IP.** Sophia never claims ownership over generated content.

The operator's `CreativeIdentity` (interface `CreativeIdentity` in `seed/types/creative-domain.ts`) defines the brand voice, tone, beliefs, and constraints that ALL agents must respect.

### VN

**Nguyên tắc quan trọng: AI tạo ra. Agent điều phối. Con người sở hữu gu thẩm mỹ và quyền sáng tạo cuối cùng.**

Mỗi nội dung trong Sophia đều có thể truy nguyên về nguồn gốc. Người vận hành:

- **Phê duyệt** trước khi xuất bản ở Mức Tự động hóa 0-2. (Tham chiếu: `AutonomyLevel` trong `seed/types/creative-domain.ts` -- `AutonomyLevel = 0 | 1 | 2 | 3 | 4`)
- **Xem xét** quyết định của agent ở Mức 3-4 (kiểm toán sau xuất bản).
- **Chỉnh sửa** bất kỳ bộ nhớ, nhận diện hay nội dung nào bất cứ lúc nào.
- **Ghi đè** bất kỳ quyết định nào của agent. Không có hành động agent nào là không thể đảo ngược mà không có sự phê duyệt rõ ràng của con người.
- **Sở hữu toàn bộ IP.** Sophia không bao giờ tuyên bố sở hữu nội dung được tạo ra.

`CreativeIdentity` của người vận hành (interface `CreativeIdentity` trong `seed/types/creative-domain.ts`) định nghĩa giọng thương hiệu, tông, niềm tin và ràng buộc mà TẤT CẢ agent phải tuân thủ.

---

## 7. Agent Autonomy Rules / Quy tắc Tự động hóa

### EN

Every autonomous action by an agent must have four properties:

| Property | Description | Example |
|----------|-------------|---------|
| **Permission** | What the agent is allowed to do | `AgentPermission.tool = 'generate_script'` |
| **Scope** | Boundaries of the action | `AgentPermission.scopes = ['campaign:123']` |
| **Audit trail** | Permanent record of what happened | `ProvenanceRecord` (interface in `seed/types/creative-domain.ts`) |
| **Rollback path** | Ability to undo | `isDeleted: boolean` on CreativeMemory; status transitions on Mission |

**Autonomy Levels** (ref: `AutonomyLevel` in `seed/types/creative-domain.ts`):

| Level | Name | Human Involvement | Typical Use |
|-------|------|-------------------|-------------|
| 0 | Manual | Human does everything | New users, critical content |
| 1 | Assisted | Agent suggests, human decides | Early campaigns, learning |
| 2 | Supervised | Agent acts, human approves before publish | Most operators, default |
| 3 | Monitored | Agent acts freely, human reviews after | Proven operators, lower-stakes content |
| 4 | Autonomous | Agent acts independently | System tasks, routine operations |

**Approval level mapping** (ref: `AgentPermission.requiresApproval` in `seed/types/creative-domain.ts`):

- Levels 0-2: `requiresApproval = true` for all publish actions
- Level 3: `requiresApproval = false` for publish, `true` for high-cost actions
- Level 4: `requiresApproval = false` for all actions; budget cap via `maxCostCents`

### VN

Mỗi hành động tự động bởi agent phải có bốn thuộc tính:

| Thuộc tính | Mô tả | Ví dụ |
|-----------|-------|-------|
| **Quyền** | Agent được phép làm gì | `AgentPermission.tool = 'generate_script'` |
| **Phạm vi** | Giới hạn của hành động | `AgentPermission.scopes = ['campaign:123']` |
| **Dấu vết kiểm toán** | Ghi vĩnh viễn những gì đã xảy ra | `ProvenanceRecord` (interface trong `seed/types/creative-domain.ts`) |
| **Đường lùi** | Khả năng đảo ngược | `isDeleted: boolean` trên CreativeMemory; chuyển trạng thái trên Mission |

**Mức Tự động hóa** (tham chiếu: `AutonomyLevel` trong `seed/types/creative-domain.ts`):

| Mức | Tên | Mức độ Tham gia của Người | Sử dụng điển hình |
|-----|-----|--------------------------|-------------------|
| 0 | Thủ công | Người làm tất cả | Người mới, nội dung quan trọng |
| 1 | Hỗ trợ | Agent đề xuất, người quyết định | Chiến dịch đầu tiên, học hỏi |
| 2 | Giám sát | Agent thực hiện, người phê duyệt trước xuất bản | Hầu hết vận hành, mặc định |
| 3 | Theo dõi | Agent tự do thực hiện, người xem xét sau | Vận hành kinh nghiệm, nội dung ít rủi ro |
| 4 | Tự động | Agent hoạt động độc lập | Nhiệm vụ hệ thống, vận hành định kỳ |

---

## 8. System Graphs / Các đồ thị Hệ thống

Sophia tracks four interconnected graphs that together model the entire creative economy:

### 8.1 Creative Memory / Bộ nhớ Sáng tạo
- What the system has learned from past creative decisions.
- Typed, versioned, scoped, auditable.
- Detailed spec: see [CREATIVE_MEMORY.md](../architecture/CREATIVE_MEMORY.md)

### 8.2 IP Graph / Đồ thị Sở hữu Trí tuệ
- Relationships between creative IP entities: universe -> world -> series -> character -> theme -> brand.
- Tracks derivative chains and ownership.
- Detailed spec: see [IP_GRAPH.md](../architecture/IP_GRAPH.md)

### 8.3 Content Graph / Đồ thị Nội dung
- Full content lifecycle: idea -> concept -> brief -> script -> storyboard -> production -> asset -> derivative -> distribution -> performance.
- Each stage has typed entities with cross-references.
- Detailed spec: see [CONTENT_GRAPH.md](../architecture/CONTENT_GRAPH.md)

### 8.4 Distribution Graph / Đồ thị Phân phối
- Multi-platform publishing: YouTube, TikTok, X, Instagram, blog.
- Tracks per-platform performance and optimization.
- Defined by `DistributionPlan`, `ChannelConfig`, `DistributionAsset` (interfaces in `seed/types/creative-domain.ts`)

### EN

These four graphs are not independent. They form a **Data Flywheel** (Section 11): Memory informs IP creation, IP drives Content production, Content flows to Distribution, Distribution generates Performance data, Performance updates Memory. The cycle compounds.

### VN

Bốn đồ thị này không độc lập. Chúng tạo thành **Con lăn Dữ liệu** (Mục 11): Bộ nhớ định hướng tạo IP, IP thúc đẩy sản xuất Nội dung, Nội dung chảy đến Phân phối, Phân phối tạo dữ liệu Hiệu suất, Hiệu suất cập nhật Bộ nhớ. Vòng lặp cộng dồn.

---

## 9. Provenance / Truy xuất nguồn gốc

### EN

Every asset in Sophia has an append-only provenance record (ref: `ProvenanceRecord` in `seed/types/creative-domain.ts`). Provenance is now a shipped subsystem: `src/tree/provenance/` plus the `provenanceBridge` Inngest function.

Provenance records track:
- **Who** created or modified the asset (human, agent, or system)
- **What** action was taken (created, generated, edited, approved, rejected, published, derived, archived)
- **How** (which AI model, which prompt, which version)
- **Why** (which approval, which mission, which campaign)

Provenance is **immutable by design**. Records can be appended but never modified or deleted. This ensures:

- Full audit trail for any content piece
- Ability to trace a derivative back to its origin
- Accountability for AI-generated content
- Compliance with emerging AI content disclosure requirements

### VN

Mỗi tài sản trong Sophia đều có bản ghi truy xuất nguồn gốc chỉ bổ sung (tham chiếu: `ProvenanceRecord` trong `seed/types/creative-domain.ts`). Truy xuất nguồn gốc hiện đã là hệ thống con hoạt động: `src/tree/provenance/` và hàm Inngest `provenanceBridge`.

Bản ghi truy xuất nguồn gốc theo dõi:
- **Ai** đã tạo hoặc chỉnh sửa tài sản (con người, agent, hay hệ thống)
- **Hành động** nào đã được thực hiện (tạo, tạo bởi AI, chỉnh sửa, phê duyệt, từ chối, xuất bản, bản sao, lưu trữ)
- **Cách thức** nào (model AI nào, prompt nào, phiên bản nào)
- **Tại sao** (phê duyệt nào, nhiệm vụ nào, chiến dịch nào)

Truy xuất nguồn gốc **không thể thay đổi theo thiết kế**. Bản ghi có thể được bổ sung nhưng không bao giờ bị sửa đổi hoặc xóa.

---

## 10. Monetization / Kiếm tiền

### EN

Sophia monetizes through a tiered subscription model (ref: `TIER_CONFIGS` in `seed/config/tiers/`):

| Tier | Target | Key Features |
|------|--------|-------------|
| **BASIC** | New creators | Limited missions, basic distribution, limited channels |
| **PREMIUM** | Growing creators | More missions, full distribution, analytics, experiments |
| **ENTERPRISE** | Scaling businesses | Unlimited missions, all channels, advanced analytics, API access |
| **MASTER** | Agency operators | Full platform, white-label, multi-workspace, priority support |

Revenue events are tracked per-asset and per-project (ref: `RevenueEvent` in `seed/types/creative-domain.ts`). Live revenue producers write into `performance_events`: YouTube (`event_type='revenue'`, `src/land/analytics/revenue-ingestion.ts`) and TikTok Shop conversions (`event_type='conversion'`, `src/land/analytics/tiktok-revenue-ingestion.ts`), both consumed by the bilingual Creative Economy dashboard.

**Protected flows** (DO NOT BREAK):
1. Setup Wizard -- BYOK onboarding
2. Telegram Bot -- @Sophia_Bbot
3. NOWPayments IPN webhook -- tier activation

### VN

Sophia kiếm tiền qua mô hình đăng ký theo bậc (tham chiếu: `TIER_CONFIGS` trong `seed/config/tiers/`):

| Bậc | Đối tượng | Tính năng chính |
|-----|-----------|-----------------|
| **BASIC** | Người sáng tạo mới | Giới hạn nhiệm vụ, phân phối cơ bản, ít kênh |
| **PREMIUM** | Người sáng tạo đang phát triển | Nhiều nhiệm vụ hơn, phân phối đầy đủ, phân tích, thử nghiệm |
| **ENTERPRISE** | Doanh nghiệp mở rộng | Nhiệm vụ không giới hạn, tất cả kênh, phân tích nâng cao, API |
| **MASTER** | Nhà vận hành đại lý | Đầy đủ nền tảng, white-label, đa không gian làm việc, hỗ trợ ưu tiên |

---

## 11. Data Flywheel / Con lăn Dữ liệu

### EN

The Data Flywheel is the core engine of compounding value:

```
VISION -> CREATE -> DISTRIBUTE -> MEASURE -> LEARN -> COMPOUND
   ^                                                       |
   +-------------------------------------------------------+
```

**Stage 1: VISION** -- Gather market signals, audience data, competitor analysis. Define creative thesis.

**Stage 2: CREATE** -- Generate content using agents. Create derivatives. Record provenance.

**Stage 3: DISTRIBUTE** -- Publish across platforms. Track per-channel performance.

**Stage 4: MEASURE** -- Collect performance events. Build snapshots. Calculate ROI per creative unit.

**Stage 5: LEARN** -- Extract insights. Update Creative Memory. Refine Creative Identity.

**Stage 6: COMPOUND** -- Apply learned insights to next vision cycle. Each iteration is smarter than the last.

The flywheel is powered by `CreativeMemory` (interface in `seed/types/creative-domain.ts`) which persists learnings across missions. Creative Memory is now shipped: `src/tree/creative-memory/` + API route `src/app/api/creative-memory/route.ts`.

### VN

Con lăn Dữ liệu là cỗ máy cốt lõi tạo ra giá trị cộng dồn:

**Giai đoạn 1: TƯỞNG TƯỢNG** -- Thu thập tín hiệu thị trường, dữ liệu khán giả, phân tích đối thủ. Xác định luận đề sáng tạo.

**Giai đoạn 2: TẠO** -- Tạo nội dung bằng agent. Tạo bản sao. Ghi truy xuất nguồn gốc.

**Giai đoạn 3: PHÂN PHỐI** -- Xuất bản trên nhiều nền tảng. Theo dõi hiệu suất theo kênh.

**Giai đoạn 4: ĐO LƯỜNG** -- Thu thập sự kiện hiệu suất. Xây dựng snapshot. Tính ROI trên mỗi đơn vị sáng tạo.

**Giai đoạn 5: HỌC** -- Trích xuất thông tin chi tiết. Cập nhật Bộ nhớ Sáng tạo. Tinh chỉnh Nhận diện Sáng tạo.

**Giai đoạn 6: CỘNG DỒN** -- Áp dụng những gì đã học vào chu kỳ tưởng tượng tiếp theo. Mỗi lần lặp đều thông minh hơn lần trước.

---

## 12. Model-Agnostic Architecture / Kiến trúc Không phụ thuộc Model

### EN

Sophia uses a provider abstraction layer (ref: `seed/ai/provider-interface.ts`) that decouples the platform from any specific AI model.

**Key principles:**
- Never hard-code a model name. Use `ModelPolicy` (interface in `seed/types/creative-domain.ts`) to specify capability and cost requirements.
- `AIProvider` (interface in `seed/types/creative-domain.ts`) supports multiple provider types: `openai_compatible`, `openrouter`, `byok_api_key`, `local`.
- Model routing is dynamic: `ModelRequest` specifies what's needed, `ModelResponse` reports what was used (interfaces in `seed/types/creative-domain.ts`).
- Provider selection is per-run and BYOK-keyed: the agent protocol's per-run provider registry resolves providers from the mission creator's own keys.
- Users bring their own keys (BYOK) -- the platform never owns API keys.

**What this means for operators:** Switch AI providers without changing anything. Your content and memory persist regardless of which model generated it.

### VN

Sophia sử dụng lớp trừu tượng nhà cung cấp (tham chiếu: `seed/ai/provider-interface.ts`) tách nền tảng khỏi bất kỳ model AI cụ thể nào.

**Nguyên tắc chính:**
- Không bao giờ hard-code tên model. Sử dụng `ModelPolicy` (interface trong `seed/types/creative-domain.ts`) để xác định yêu cầu năng lực và chi phí.
- `AIProvider` (interface trong `seed/types/creative-domain.ts`) hỗ trợ nhiều loại nhà cung cấp.
- Routing model là động: `ModelRequest` xác định nhu cầu, `ModelResponse` báo cáo đã dùng gì.
- Chọn nhà cung cấp theo từng lần chạy và theo key BYOK: registry nhà cung cấp per-run của agent protocol phân giải từ key của chính người tạo mission.
- Người dùng tự mang key (BYOK) -- nền tảng không bao giờ sở hữu key API.

---

## 13. Sovereignty Boundaries / Ranh giới Chủ quyền

### EN

Sophia operates within a multi-system architecture. The boundaries are:

| System | Owns | Does NOT Own |
|--------|------|-------------|
| **Sophia** | Creative economy: missions, content, IP, memory, distribution, experiments | Horizontal control plane, shared infra |
| **Mekong** | Control plane: user management, billing, shared infrastructure, multi-app orchestration | Creative content, IP ownership, distribution |
| **Buzz** | Execution layer: autonomy enforcement, task routing, queue management | Creative decisions, content ownership |

**Sophia's scope:** Everything related to creating, distributing, and monetizing content. The creative economy flywheel.

**What Sophia MUST NOT become:** A horizontal platform like Mekong or an execution layer like Buzz. Sophia is creative-economy-focused.

### VN

Sophia hoạt động trong kiến trúc đa hệ thống. Các ranh giới là:

| Hệ thống | Sở hữu | KHÔNG Sở hữu |
|-----------|--------|--------------|
| **Sophia** | Kinh tế sáng tạo: nhiệm vụ, nội dung, IP, bộ nhớ, phân phối, thử nghiệm | Hạ tầng điều khiển ngang, hạ tầng chung |
| **Mekong** | Hạ tầng điều khiển: quản lý người dùng, thanh toán, hạ tầng chung, đa ứng dụng | Nội dung sáng tạo, sở hữu IP, phân phối |
| **Buzz** | Lớp thực thi: thực thi tự động, định tuyến tác vụ, quản lý hàng đợi | Quyết định sáng tạo, sở hữu nội dung |

---

## 14. Security / Bảo mật

### EN

- **Zero secrets in code.** All API keys, tokens, and credentials stored via BYOK Setup Wizard or encrypted in database. Never hard-coded.
- **Circuit breaker** on all external HTTP calls (ref: `apps/sophia-ai-factory/CLAUDE.md` financial code patterns).
- **Result<T,E> pattern** for all financial and critical operations. Never throw -- return success/failure.
- **No console.log in production.** Use structured logger only.
- **Input validation** via Zod on all API inputs.
- **Rate limiting** via Cloudflare KV.

### VN

- **Không có bí mật trong code.** Tất cả key API, token và thông tin xác thực được lưu qua Setup Wizard BYOK hoặc mã hóa trong database.
- **Ngắt mạch** trên tất cả gọi HTTP bên ngoài.
- **Mẫu Result<T,E>** cho tất cả hoạt động tài chính và quan trọng. Không bao giờ throw -- trả về thành công/thất bại.
- **Không console.log trong sản phẩm.** Chỉ sử dụng logger có cấu trúc.
- **Xác thực đầu vào** qua Zod trên tất cả đầu vào API.
- **Giới hạn tốc độ** qua Cloudflare KV.

---

## 15. Privacy / Quyền riêng tư

### EN

- User data stays in the user's workspace. No cross-workspace data leakage.
- AI provider keys are encrypted references, never plaintext. (Ref: `AIProvider.apiKeyRef` in `seed/types/creative-domain.ts`)
- Provenance records are workspace-scoped.
- No content is shared across workspaces unless the operator explicitly exports.

### VN

- Dữ liệu người dùng ở trong không gian làm việc của người dùng. Không rò rỉ dữ liệu giữa các không gian.
- Key nhà cung cấp AI là tham chiếu mã hóa, không bao giờ văn bản thuần.
- Bản ghi truy xuất nguồn gốc được giới hạn theo không gian làm việc.
- Không có nội dung nào được chia sẻ giữa các không gian trừ khi người vận hành chủ động xuất khẩu.

---

## 16. Governance / Quản trị

### EN

**Who decides what gets built:**
- The operator (CEO) sets the creative vision and business goals.
- Sophia's agents propose execution plans within autonomy level constraints.
- Human approval is required at Levels 0-2 before any publish action.

**Who decides platform direction:**
- Platform architecture decisions follow this Constitution.
- Breaking changes require updating this document first.
- All changes must pass quality gates (Section 17).

### VN

**Ai quyết định những gì được xây dựng:**
- Người vận hành (CEO) đặt tầm nhìn sáng tạo và mục tiêu kinh doanh.
- Agent của Sophia đề xuất kế hoạch thực thi trong giới hạn mức tự động hóa.
- Phê duyệt của con người là bắt buộc ở Mức 0-2 trước mọi hành động xuất bản.

---

## 17. Quality / Chất lượng

### EN

**Quality Gates (every deploy):**
1. `npm run build` -- 0 TypeScript errors
2. `npm test` -- all tests pass
3. `npm run lint` -- 0 new errors, no new `eslint-disable`
4. Deploy SHA match verification
5. Protected flow smoke test (Setup Wizard, Telegram, NOWPayments)

**Code Standards:**
- Zero `:any` types
- Zero `console.log` in production
- Zod validation on all API inputs
- Server Actions for data mutations
- `Result<T,E>` pattern for financial code
- No `eslint-disable` comments without tracked exception

### VN

**Cửa sổ Chất lượng (mỗi lần triển khai):**
1. `npm run build` -- 0 lỗi TypeScript
2. `npm test` -- tất cả bài kiểm tra pass
3. `npm run lint` -- 0 lỗi mới, không `eslint-disable` mới
4. Xác nhận khớp SHA triển khai
5. Kiểm tra khói luồng được bảo vệ (Setup Wizard, Telegram, NOWPayments)

---

## 18. 2028 KPIs / Chỉ số 2028

### EN

**Baseline (2026-09-01, HEAD `d7ba0c83`):** 8682 tests pass. Revenue producers are live (YouTube `event_type='revenue'`, TikTok `event_type='conversion'`) and the Creative Economy dashboard consumes them. Reality Loop v1 has 11 of 13 canonical emitters wired into production call sites (`creative.edited` and `memory.corrected` are deferred -- no edit/correction UI exists yet). The internal Reality Loop dashboard (`src/app/[locale]/dashboard/reality-loop/`) reads from `performance_events` via `src/land/reality-loop/insights.ts`. Production hardening is live: `createRealtimeAlert` writes into `user_alerts`, `BudgetTracker` enforces tenant-scoped budget governance, and Sentry captures errors with opt-in symbolication.

| KPI | Target | Measurement |
|-----|--------|-------------|
| **Creative Leverage** (North Star) | >$5 per creative unit within 6 months of first revenue event | Revenue / creative units per quarter (post-revenue-ingestion baseline) |
| **Derivative Ratio** | >10 derivatives per creative idea | Assets created / creative concepts per month |
| **Distribution Coverage** | >3 platforms per content project | Platforms with published derivatives / total platforms |
| **Memory Hit Rate** | >70% of agent decisions reference memory | Memory-informed decisions / total decisions per month |
| **Reality Loop Emitter Coverage** | 13/13 wired by end of Q1 2029 | Wired emitters / 13 canonical events |
| **Operator Satisfaction** | >4.5/5 on creative control survey | Quarterly operator survey |
| **Content ROI** | >3x across all channels | Total revenue / total production cost |
| **Test Count Floor** | >= 8682 (no regression) | `npm test` must not drop below baseline |

### VN

| Chỉ số | Mục tiêu | Đo lường |
|--------|---------|----------|
| **Creative Leverage** (La bàn) | >$5 trên mỗi đơn vị sáng tạo trong 6 tháng từ sự kiện doanh thu đầu tiên | Doanh thu / đơn vị sáng tạo theo quý (sau baseline ingestion) |
| **Tỷ lệ Bản sao** | >10 bản sao trên mỗi ý tưởng sáng tạo | Tài sản tạo ra / khái niệm sáng tạo mỗi tháng |
| **Phạm vi Phân phối** | >3 nền tảng trên mỗi dự án nội dung | Nền tảng đã xuất bản / tổng nền tảng |
| **Tỷ lệ Hit Bộ nhớ** | >70% quyết định agent tham chiếu bộ nhớ | Quyết định có bộ nhớ / tổng quyết định mỗi tháng |
| **Độ phủ Emitter Reality Loop** | 13/13 hoạt động cuối Q1 2029 | Emitter hoạt động / 13 sự kiện chuẩn |
| **Sự hài lòng của Nhà vận hành** | >4.5/5 trên khả sát kiểm soát sáng tạo | Khảo sát hàng quý |
| **ROI Nội dung** | >3x trên tất cả kênh | Tổng doanh thu / tổng chi phí sản xuất |
| **Sàn số lượng Test** | >= 8682 (không suy giảm) | `npm test` không được giảm dưới baseline |

---

## 19. Architecture Principles / Nguyên tắc Kiến trúc

### EN

1. **Strangler Pattern.** Wrap existing systems, migrate gradually, never rewrite from scratch.
2. **Layer Discipline.** seed -> tree -> forest -> land. No circular imports.
3. **Extend, Don't Replace.** Especially `seed/ai/provider-interface.ts` -- it is already model-agnostic.
4. **Type Everything.** All domain entities are defined in `seed/types/creative-domain.ts`. No ad-hoc objects.
5. **Result<T,E> for Financial Code.** Never throw in money-related operations.
6. **Append-Only Audit.** Provenance records are immutable. Memory versions are append-only.
7. **Scoped by Workspace.** Every entity has `workspaceId`. No cross-workspace data access.
8. **BYOK Always.** Operator self-configures all integrations. No operator-side credentials required.

### VN

1. **Mẫu Strangler.** Bọc hệ thống hiện tại, di chuyển dần, không bao giờ viết lại từ đầu.
2. **Kỷ luật Lớp.** seed -> tree -> forest -> land. Không vòng lặp import.
3. **Mở rộng, Không thay thế.** Đặc biệt `seed/ai/provider-interface.ts` -- nó đã trừu tượng model.
4. **Gõ Type Mọi thứ.** Tất cả thực thể domain được định nghĩa trong `seed/types/creative-domain.ts`.
5. **Result<T,E> cho Code Tài chính.** Không bao giờ throw trong hoạt động liên quan tiền.
6. **Chỉ Bổ sung Kiểm toán.** Bản ghi truy xuất nguồn gốc không thể thay đổi.
7. **Phạm vi theo Không gian.** Mỗi thực thể có `workspaceId`. Không truy cập dữ liệu giữa các không gian.
8. **BYOK Luôn luôn.** Người vận hành tự cấu hình mọi tích hợp.

---

## 20. Delete List / Danh sách Xóa

### EN

**What Sophia does NOT keep:**

1. **No raw AI prompts in memory.** Only derived insights and confidence scores. The `prompt` field on `ProvenanceRecord` (`seed/types/creative-domain.ts`) is for audit, not memory.
2. **No expired data.** Memory entries with `expiresAt` past current time are treated as deleted (field on `CreativeMemory` in `seed/types/creative-domain.ts`).
3. **No soft-deleted data in queries.** `isDeleted: true` entries are excluded from all queries (field on `CreativeMemory` in `seed/types/creative-domain.ts`).
4. **No orphaned derivatives.** When a source asset is archived, its derivatives are flagged for review.
5. **No abandoned experiments.** Experiments in `draft` status older than 30 days are auto-cancelled.

### VN

**Sophia KHÔNG giữ:**

1. **Không lưu prompt AI thô trong bộ nhớ.** Chỉ các thông tin chi tiết được trích xuất và điểm tin cậy.
2. **Không lưu dữ liệu hết hạn.** Mục bộ nhớ có `expiresAt` quá thời gian hiện tại được coi là đã xóa.
3. **Không truy vấn dữ liệu đã xóa mềm.** Mục có `isDeleted: true` bị loại khỏi tất cả truy vấn.
4. **Không giữ bản sao mồ côi.** Khi tài sản gốc bị lưu trữ, các bản sao của nó được đánh dấu để xem xét.

---

## 21. Decision Rules / Quy tắc Ra quyết định

### EN

1. **Code before docs.** Document what exists, not what's planned.
2. **Verified over plausible.** Every code reference in docs must cite a real file:line.
3. **Operator-first.** If a feature requires operator-side setup that the operator cannot do themselves, it is out of scope (No-Tech Doctrine).
4. **Protected flows always.** Setup Wizard, Telegram Bot, NOWPayments are sacred. Never break them.
5. **One phase at a time.** Follow the implementation plan. Test, verify, commit. Then next phase.
6. **Deprecate, never delete.** Mark old code as deprecated. Remove only after migration is verified.
7. **When in doubt, check the Constitution.** This document is the single source of truth for product direction.

### VN

1. **Code trước Docs.** Ghi lại những gì tồn tại, không phải những gì được lên kế hoạch.
2. **Đã xác minh hơn có vẻ đúng.** Mọi tham chiếu code trong docs phải trích dẫn file:line thật.
3. **Ưu tiên Người vận hành.** Nếu tính năng yêu cầu thiết lập phía vận hành mà vận hành không tự làm được, nó nằm ngoài phạm vi.
4. **Luôn bảo vệ luồng được bảo vệ.** Setup Wizard, Telegram Bot, NOWPayments là thiêng liêng.
5. **Một giai đoạn mỗi lần.** Theo kế hoạch triển khai. Kiểm tra, xác minh, commit. Rồi giai đoạn tiếp.
6. **Đánh dấu cũ, không xóa.** Đánh dấu code cũ là deprecated. Chỉ xóa sau khi di chuyển được xác minh.
7. **Khi nghi ngờ, kiểm tra Hiến pháp.** Tài liệu này là nguồn duy nhất cho hướng sản phẩm.

---

## 22. References / Tham chiếu

| Document | Path |
|----------|------|
| Domain Types | `apps/sophia-ai-factory/src/seed/types/creative-domain.ts` |
| Creative Economy Contracts | `apps/sophia-ai-factory/src/seed/types/creative-economy/` (canonical barrel) |
| AI Provider Interface | `apps/sophia-ai-factory/src/seed/ai/provider-interface.ts` |
| Creative Memory Architecture | [CREATIVE_MEMORY.md](../architecture/CREATIVE_MEMORY.md) |
| IP Graph Architecture | [IP_GRAPH.md](../architecture/IP_GRAPH.md) |
| Content Graph Architecture | [CONTENT_GRAPH.md](../architecture/CONTENT_GRAPH.md) |
| Reality Loop Report | `docs/reality-loop/REALITY_LOOP_REPORT.md` |
| Reality Loop Scorecard | `docs/reality-loop/SOPHIA_VALUE_SCORECARD.md` |
| Reality Loop Taxonomy | `docs/reality-loop/AUTONOMY_FAILURE_TAXONOMY.md` |
| 2028 Roadmap | [SOPHIA_2028_ROADMAP.md](../roadmap/SOPHIA_2028_ROADMAP.md) |
| Implementation Plan | `.orchestrate/latest/plan.md` |
| Code Standards | `apps/sophia-ai-factory/CLAUDE.md` |
| Deploy Verification | `.claude/rules/sophia-deploy-verify.md` |
| Layer Architecture | `.claude/rules/sophia-layer-architecture.md` |
| No-Tech Doctrine | `.claude/rules/sophia-no-tech-doctrine.md` |
| Handover Rules | `.claude/rules/sophia-handover-rules.md` |

---

## 23. Production Hardening Doctrine / Giáo lý Bảo vệ Production

### EN

**Effective:** 2026-09-01. This section codifies the production safeguards that are now live on HEAD `d7ba0c83`. It supplements the No-Tech Doctrine (`.claude/rules/sophia-no-tech-doctrine.md`) with binding rules for alerting, budget governance, and Reality Loop observability.

**23.1 Alerting (CF-native, no operator credentials)**

All production alerts are emitted through `createRealtimeAlert` (`src/land/alerts/realtime-alert-mutations.ts`) which writes into the `user_alerts` table. Alert triggers (`src/land/alerts/realtime-alert-triggers.ts`) fire on usage thresholds, license expiration, and webhook delivery failures. The quota alert subsystem (`src/land/alerts/quota/`) handles scheduled evaluation and delivery. **No operator-provided credentials are required** for alerting to function -- the platform is self-contained.

**23.2 Budget Governance**

`BudgetTracker` (`src/tree/budget/budget-tracker.ts`) enforces tenant-scoped budget governance with overrun protection. Every autonomous agent action checks usable budget before execution. Budget overrun triggers `logger.warn` and blocks further spend until the operator adjusts the budget. This is the financial guardrail that makes Autonomy Level 4 safe.

**23.3 Sentry Opt-In Symbolication**

Sentry SDK is wired in `sentry.client.config.ts` + `sentry.server.config.ts`. Error capture is **always active**. Source-map upload (symbolication) requires `SENTRY_AUTH_TOKEN` at deploy time -- this is **optional** per the No-Tech Doctrine. Without it, errors are still captured; stack traces are minified. `SKIP_SENTRY_BUILD=1` is the M1 16GB OOM workaround -- it skips build-time wrapping but runtime error capture is unaffected. `wrangler tail` is the canonical real-time error stream regardless of Sentry state.

**23.4 Reality Loop Observability**

Reality Loop v1 (`src/tree/performance/loop-events.ts`) emits 13 canonical event types into `performance_events`. As of 2026-09-01, 11 of 13 have production call sites:

| Wired (11) | Deferred (2) |
|---|---|
| `mission.created`, `mission.abandoned`, `agent.started`, `agent.failed`, `approval.requested`, `approval.approved`, `approval.rejected`, `creative.accepted`, `creative.rejected`, `memory.used`, `mission.cost_recorded` | `creative.edited` (no edit UI), `memory.corrected` (no correction UI) |

All emitters are **side-channel, non-fatal, idempotent**: `emitLoopEvent` wraps the write in try/catch + `logger.warn`, so a measurement failure never aborts the product flow. Event IDs use FNV-1a 64-bit hash (`loopEventId`) for deterministic idempotency. The internal dashboard (`src/app/[locale]/dashboard/reality-loop/`) reads via `src/land/reality-loop/insights.ts`.

**23.5 Honest Ceiling**

Per the No-Tech Doctrine, the honest score ceiling under no-operator-credential constraints is **91.5/100**. Going higher requires either (a) operator infra (rejected by doctrine), or (b) sustained operational track record (months of DR drills, monthly restore tests). This is not a gap -- it is the intended design.

### VN

**Có hiệu lực:** 2026-09-01. Mục này mã hóa các biện pháp bảo vệ production hiện đang hoạt động trên HEAD `d7ba0c83`. Nó bổ sung Giáo lý Không-Tech (`.claude/rules/sophia-no-tech-doctrine.md`) với quy tắc ràng buộc cho cảnh báo, quản trị ngân sách, và quan sát Reality Loop.

**23.1 Cảnh báo (CF-native, không cần credential vận hành)**

Tất cả cảnh báo production được phát qua `createRealtimeAlert` (`src/land/alerts/realtime-alert-mutations.ts`) ghi vào bảng `user_alerts`. Trigger cảnh báo (`src/land/alerts/realtime-alert-triggers.ts`) kích hoạt khi vưỡt ngưỡng sử dụng, hết hạn license, và thất bại gửi webhook. Hệ thống con cảnh báo quota (`src/land/alerts/quota/`) xử lý đánh gia và gửi theo lịch. **Không cần credential từ vận hành** để cảnh báo hoạt động -- nền tảng tự chứa.

**23.2 Quản trị Ngân sách**

`BudgetTracker` (`src/tree/budget/budget-tracker.ts`) thực thi quản trị ngân sách theo tenant với bảo vệ vượt ngưỡng. Mọi hành động agent tự động kiểm tra ngân sách khả dụng trước khi thực thi. Vượt ngân sách kích hoạt `logger.warn` và chặn chi tiêu tiếp cho đến khi vận hành điều chỉnh. Đây là rào cản tài chính giúp Mức Tự động hóa 4 an toàn.

**23.3 Sentry Opt-In Symbolication**

Sentry SDK được dây trong `sentry.client.config.ts` + `sentry.server.config.ts`. Bắt lỗi **luôn hoạt động**. Tải source-map (symbolication) cần `SENTRY_AUTH_TOKEN` lúc deploy -- đây là **tùy chọn** theo Giáo lý Không-Tech. Nếu không có, lỗi vẫn được bắt; stack trace bị nén. `SKIP_SENTRY_BUILD=1` là giải pháp M1 16GB OOM -- bỏ qua build-time wrapping nhưng bắt lỗi runtime không ảnh hưởng. `wrangler tail` là dòng lỗi real-time chuẩn bất kể trạng thái Sentry.

**23.4 Quan sát Reality Loop**

Reality Loop v1 (`src/tree/performance/loop-events.ts`) phát 13 loại sự kiện chuẩn vào `performance_events`. Tính đến 2026-09-01, 11/13 có call site production:

| Hoạt động (11) | Hoãn (2) |
|---|---|
| `mission.created`, `mission.abandoned`, `agent.started`, `agent.failed`, `approval.requested`, `approval.approved`, `approval.rejected`, `creative.accepted`, `creative.rejected`, `memory.used`, `mission.cost_recorded` | `creative.edited` (không có UI edit), `memory.corrected` (không có UI correction) |

Tất cả emitter đều **side-channel, non-fatal, idempotent**: `emitLoopEvent` bọc ghi trong try/catch + `logger.warn`, vì vật lỗi đo lường không bao giờ hủy bỏ luồng sản phẩm. ID sự kiện dùng FNV-1a 64-bit hash (`loopEventId`) cho idempotent xác định. Dashboard nội bộ (`src/app/[locale]/dashboard/reality-loop/`) đọc qua `src/land/reality-loop/insights.ts`.

**23.5 Trần Thành Thật**

Theo Giáo lý Không-Tech, trần điểm thành thật dưới ràng buộc không-credential-vận-hành là **91.5/100**. Để cao hơn cần (a) hạ tầng vận hành (bị từ chối bởi giáo lý), hoặc (b) hồ sơ vận hành bền vững (tháng diễn tập DR, test restore hàng tháng). Đây không phải lỗ hổng -- đây là thiết kế dự định.

---

## Amendment Changelog / Nhật ký Sửa đổi

### v2.0 — 2026-09-01 (ratified alongside Reality Loop v1 ship + Production Hardening)

| Change | Why |
|--------|-----|
| Supersedes `SOPHIA_2027_CONSTITUTION.md` v1.1 (`docs/strategy/`) | 2028 constitution moves to repo-root `docs/` as canonical copy; 2027 version frozen as historical reference |
| §2 Product Identity updated to 2028 shipped state: Distribution OS (`src/tree/distribution/`), Commerce modules (`src/land/commerce/`), Reality Loop v1 (11/13 emitters wired), Production Hardening (alerts + budget governance) | v1.1 predated Distribution+Commerce ship and Reality Loop wiring; 2028 baseline reflects what is actually live on HEAD `d7ba0c83` |
| §18 KPIs renamed to **2028 KPIs** with post-revenue-ingestion baseline: Creative Leverage measured from first revenue event, Reality Loop emitter coverage (11/13 wired, 13/13 target by Q1 2029), test count floor >= 8682 | v1.1 KPIs were framed before revenue ingestion and Reality Loop shipped; 2028 baseline is empirically grounded |
| New §23 **Production Hardening Doctrine**: alerting (`createRealtimeAlert` + `user_alerts`), budget governance (`BudgetTracker`), Sentry opt-in symbolication, Reality Loop observability (11/13 wired table), honest ceiling 91.5/100 | Codifies safeguards now live on HEAD `d7ba0c83` that were not yet shipped when v1.1 was ratified |
| §22 References updated: added Reality Loop report/scorecard/taxonomy, 2028 Roadmap link, removed stale recon links | v1.1 referenced the 08-25 recon refresh; 2028 references point to the canonical Reality Loop docs and the new 2028 roadmap |
| Version 1.1 -> 2.0; Effective 2026-08-25 -> 2026-09-01; header states supersession of v1.1 | Major version bump reflects shipped-state leap (Distribution+Commerce+Reality Loop+Hardening) beyond a patch |

### v1.1 — 2026-08-25 (ratified alongside Recon Refresh 2026-08-25)

| Change | Why |
|--------|-----|
| North Star unified to **Creative Leverage** (mission verbatim: "economic output per creative unit"); EOPCU retained only as the retired abbreviation of the measurement formula (§4, §18) | Root copy said "EOPCU", app copy said "Creative Leverage" -- one concept, one name, one section |
| All file:line citations converted to **symbol-name anchors** (`AutonomyLevel`, `CreativeIdentity`, `ProvenanceRecord`, `CreativeMemory`, `RevenueEvent`, `ModelPolicy`, `AIProvider`, `apiKeyRef`, `TIER_CONFIGS`) and re-verified by grep against HEAD `125c48e51` (§6, §7, §8, §9, §10, §11, §12, §15, §20) | `creative-domain.ts` grew to 663 lines; line numbers drift on every refactor, symbols survive |
| Fixed stale path `seed/config/tiers.ts` -> `seed/config/tiers/` (`TIER_CONFIGS`) (§10) | File no longer exists at the cited path; tiers live in the `seed/config/tiers/` directory |
| KPI baselines + framing updated to shipped state; cross-linked the 08-25 refresh (§2, §18) | Agent protocol, memory, provenance, mission lifecycle, autonomy, experiments, and revenue producers are now live -- v1.0 framing predated them |
| §22 references updated: domain types 663 lines, creative-economy contracts barrel added, recon links point to `../architecture/` (original frozen + latest refresh) | Old §22 cited 661 lines and a broken relative link to the recon file |
| Version 1.0 -> 1.1; Effective 2026-08-20 -> 2026-08-25; canonical-copy header added | Ratification of the reconciled single source of truth (root `docs/` canonical per P2 decision) |

### v1.0 — 2026-08-20

Initial ratification. 22 sections, bilingual EN+VN.

---

*This Constitution is a living document. Update it before changing product direction. Every update must preserve backward compatibility with existing content and data.*
