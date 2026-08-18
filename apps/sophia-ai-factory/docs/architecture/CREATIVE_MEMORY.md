# Creative Memory Architecture / Kiến Trúc Nhớ Sáng Tạo

> **Layer**: tree (domain-specific reusable)
> **Module**: `src/tree/creative-memory/` (`index.ts`, `types.ts`, `decay.ts`)
> **Database Table**: `creative_memory` (migration `0234_creative_memory.sql`)
> **Status**: Production-ready (Phase 4 — Creative Learning Loop)

---

## Purpose / Mục Đích

Creative Memory is Sophia's persistent, versioned knowledge store. It captures what the platform learns about a workspace's creative preferences, audience behavior, and performance patterns — across missions, campaigns, and time.

**Nhớ sáng tạo là kho kiến thức liên tục, có phiên bản của Sophia.** Nó ghi lại điều mà nền tảng đã học về sở thích sáng tạo, hành vi đối tượng, và hiệu suất — qua các nhiệm vụ, chiến dịch, và thời gian.

Unlike a cache, Creative Memory:
- **Version increments** on every update (audit trail) — mỗi lần cập nhật tăng version để truy xuất lại lịch sử
- **Scopes** entries to global / campaign / project / channel — phân biệt remembered insight theo phạm vi
- **Tracks confidence** (high / medium / low) and source (human_edit / agent_inference / performance / import) — biết độ tin cậy và nguồn gốc của mỗi ghi nhớ
- **Stores evidence** as JSON (supporting events, A/B test IDs, human approvals) — lưu bằng chứng để kiểm tra lại

---

## Seven Categories / Bảy Loại Nhớ

| Category / Loại | Stores / Lưu gì | Example / Ví dụ |
|---|---|---|
| `identity` | Workspace brand voice, tone, values | "Brand này dùng ngôn ngữ trang trọng, không dùng emoji" |
| `creative` | Content formulas, hooks, structures that work | "Hook dạng 'You won't believe...' có CTR cao hơn 23%" |
| `audience` | Audience segments, preferences, pain points | "Đối tượng 25-34 quan tâm đến tiết kiệm thời gian" |
| `performance` | Metric patterns by channel/format/time | "YouTube Shorts trung bình 1,800 views, peak 18:00 ICT" |
| `business` | Pricing, packaging, monetization learnings | "Gói Pro 29 USD có conversion cao nhất" |
| `operational` | Automation rules, workflow preferences | "Tự động xuất bản khi đã có 3 variant approved" |
| `provenance` | Where insights came from (source, agent, timestamp) | "Insight này từ experiment #456, decided 2026-08-15" |

---

## Decay Mechanics / Cơ Chế Suy Giảm

Memories without reinforcement lose confidence over time. This models real-world forgetting — an insight from 6 months ago matters less than one from yesterday.

**Cơ chế:** Exponential decay with a **30-day half-life**. Each memory has a numeric base confidence (high=1.0, medium=0.6, low=0.3). At read time, the effective score is:

```
effective_score = base_confidence × 0.5^(elapsed_days / 30)
```

| Elapsed / Trôi qua | Effective score (from high) | Result / Kết quả |
|---|---|---|
| 0 days | 1.00 | Full confidence |
| 15 days | 0.71 | Still active |
| 30 days | 0.50 | Half-life reached |
| 60 days | 0.25 | Approaching stale |
| 90 days | 0.13 | Effectively inactive |

**Reinforcement (làm mới):** Any update to a memory resets its `updatedAt` timestamp, restoring full base confidence. This happens automatically when:
- `recordLearning()` writes a new signal
- `strategy-feedback.ts` stores a recommendation
- `experiment-feedback-cron.ts` writes a winner
- An operator manually edits the memory

**Filtering:** `filterActiveMemories()` prunes entries below a minimum score (default 0.2). Strategy generation only reads active memories — stale insights never pollute recommendations.

**Lưu ý:** Decay is computed at read time, not stored. No background job prunes the table. Old rows remain for audit trail but are filtered out by application logic.

---

## Experiment Winner Tracking / Lưu Dấu Experiment Thắng

Phase 4 connects A/B experiments to creative memory through a daily cron:

1. **Run experiment** — Variant generator creates A/B for thumbnail, caption, hook, or CTA.
2. **Collect results** — Runner publishes variants, tracks impressions and conversions.
3. **Decide winner** — Picker compares CTR/conversion, marks experiment `decided`.
4. **Write to memory** — `experiment-feedback-cron.ts` (daily) finds all `decided` experiments and writes the winning variant to `creative_memory` under key `experiment:<id>:winner`.

**Idempotent:** Re-running the cron for the same experiment overwrites the same memory key. No duplicates.

**Kết quả:** Winners become permanent creative memory. The next cycle's variant generator can reference past winners when creating new experiments. The flywheel closes: experiment → winner → memory → better next experiment.

---

## The LEARN Loop / Vòng Lặp LEARN

```
CREATE (tạo nội dung)
    ↓
DISTRIBUTE (phân phối qua các kênh)
    ↓
MEASURE (đo lường: views, engagement, revenue)
    ↓
AGGREGATE (tổng hợp mỗi 15 phút)
    ↓
SIGNAL → creative_memory (tín hiệuperformance)
    ↓
LEARN
  ├─ LEARNING VELOCITY: học hỏi đang nhanh hay chậm? (daily)
  ├─ STRATEGY FEEDBACK: AI đề xuất 1 hành động cụ thể (≥5 signals)
  └─ EXPERIMENT WINNER: ghi nhớ variant thắng (daily)
    ↓
APPLY (áp dụng vào lần tạo tiếp theo)
    ↓
(loop repeats — học hỏi được tích lũy)
```

**Flywheel effect:** Each cycle's learnings feed the next cycle's creation. Over weeks, the workspace's content improves compounding — velocity score rises, strategy recommendations get more precise, experiment winners accumulate.

---

## Integration / Tích Hợp

| Direction | Connection |
|---|---|
| **Forest → Tree** | `performance-aggregation.ts`, `learning-velocity-cron.ts`, `strategy-feedback.ts`, `experiment-feedback-cron.ts` all call `recordLearning()` / `upsertMemory()` |
| **Land → Tree** | Billing actions read `business` memories for pricing context |
| **Forest → Tree** | Inngest jobs read `audience` memories before content generation |
| **Tree → Tree** | Mission lifecycle reads `creative` memories when creating goals |
| **Seed → Tree** | Domain types define the schema (`creative-domain.ts`) |

---

## Migration / Migration

**File**: `migrations/0234_creative_memory.sql`  
**Applied**: 2026-08-16 (production D1)

---

## See Also / Xem thêm

- `PERFORMANCE_INTELLIGENCE.md` — Performance aggregation pipeline and learning velocity
- `src/seed/types/creative-domain.ts` — CreativeMemory, MemoryCategory, MemoryConfidence types
- `src/seed/types/learning-velocity.ts` — LearningVelocityMetric types
- `src/forest/inngest/functions/` — All four cron functions that write to creative memory
- `src/forest/ab/` — A/B experiment framework