# Performance Intelligence Architecture / Hiệu Suất Thông Minh

> **Layer**: forest (infrastructure orchestration) + tree (domain reusable)
> **Module**: `src/forest/inngest/functions/performance-aggregation.ts`, `src/forest/inngest/functions/learning-velocity-cron.ts`, `src/forest/inngest/functions/strategy-feedback.ts`, `src/forest/analytics/queries/`
> **Database Tables**: `performance_events`, `learning_velocity`, `creative_memory`, `roi_records`, `experiments`, `experiment_variants`, `experiment_results`
> **Status**: Production-ready (Phase 4 — Creative Learning Loop)

---

## Purpose / Mục Đích

Performance Intelligence turns raw content metrics into actionable creative decisions. It answers:
- Which content formats drive the highest engagement?
- Do CTAs in video descriptions increase click-through?
- What audience segments respond to which creative approaches?
- Which A/B test variant won, and why?
- How fast is our learning improving over time?

**Hiệu suất thông minh biến dữ liệu thô thành quyết định sáng tạo.** Nó trả lời: dạng nội dung nào tạo tương tác cao nhất? CTA trong mô tả video có tăng CTR không? Đối tượng nào phản ứng tốt với phong cách nào? Variant A/B nào đã thắng và tại sao? Học hỏi đang cải thiện nhanh chóng?

---

## The Aggregation Pipeline / Pipeline Tổng Hợp

Performance data flows through four stages every day:

1. **Collect (Thu thập)** — Each content publish records events (views, engagement, revenue, cost) into `performance_events`.
2. **Aggregate (Tổng hợp)** — A cron job runs **every 15 minutes** (`performance-aggregation.ts`). It reads the last 24 hours of events, groups them by workspace, and computes averages (mean views, mean engagement, mean revenue per channel).
3. **Signal (Tín hiệu)** — High-confidence aggregates are written to `creative_memory` as `performance:<channel>:<metric>` entries. These become the memory signals that strategy generation reads.
4. **Learn (Học hỏi)** — A daily cron (`learning-velocity-cron.ts`) compares early-period vs late-period performance to compute a **learning velocity score (0-100)**. A second daily job (`strategy-feedback.ts`) fires when ≥5 high-confidence signals accumulate and uses BYOK OpenRouter to generate one actionable strategy recommendation.

```
PERFORMANCE EVENTS
       ↓ (every 15 min)
AGGREGATION CRON → workspace averages
       ↓
CREATIVE MEMORY SIGNALS (performance:<channel>:<metric>)
       ↓ (daily)
LEARNING VELOCITY → improvement rate 0-100
       ↓ (≥5 signals)
STRATEGY FEEDBACK → AI-generated recommendation
       ↓
APPLIED TO NEXT CREATION CYCLE
```

---

## Learning Velocity Metrics / Chỉ Số Học Hỏi

Learning velocity measures **how fast a workspace improves** after applying learnings. It is computed per (workspace, entity_type, channel):

| Metric / Chỉ số | Value / Giá trị | Meaning / Ý nghĩa |
|---|---|---|
| `velocityScore` | 0-100 | How fast metrics improve in the 7-day window |
| `eventCount` | integer | Number of performance events sampled |
| `trend` | improving / stable / declining | Direction of change vs previous window |
| `windowStartMs` / `windowEndMs` | timestamp | 7-day comparison window |

**How it works / Cách hoạt động:** The cron splits the 7-day window into early (days 0-3) and late (days 4-7). It compares the average metric values between the two halves. If late > early → `improving`. If roughly equal → `stable`. If late < early → `declining`.

**Ví dụ thực tế:** A workspace's YouTube shorts improve from 2,000 views (early) to 3,400 views (late) → velocityScore 70, trend `improving`. The next strategy cycle prioritizes the format that drove that gain.

---

## Strategy Feedback Loop / Vòng Lặp Phản Hồi Chiến Lược

When ≥5 high-confidence signals accumulate in `creative_memory` for a workspace, `strategy-feedback.ts` triggers:

1. **Collects signals** — Reads active (non-decayed) `performance` and `audience` memories.
2. **Calls AI** — Uses the workspace's BYOK OpenRouter key via `resilientChatCompletion` (with circuit breaker protection). The prompt asks for ONE actionable recommendation in a specific category.
3. **Writes back** — The recommendation is stored in `creative_memory` under key `strategy:<timestamp>:recommendation` with category (content_type, posting_schedule, audience_targeting, thumbnail, hook, general) and confidence level.
4. **Applied flag** — Each recommendation tracks `applied: boolean` and `appliedAt` so the platform can later measure whether the advice worked.

**Lưu ý quan trọng:** If the AI call fails (no BYOK key, circuit open, rate-limited), the function returns `{ generated: false, reason: 'ai_error' }` and logs the failure. It never throws. The system degrades gracefully.

---

## A/B Experiment Winner Tracking / The Dấu Hiệu Experiment

Phase 4 extended the A/B framework beyond thumbnails to captions, hooks, and CTAs:

| Step | Component | Description |
|---|---|---|
| 1. Generate | `content-variant-generator.ts` | Creates two variants (A/B) for caption, hook, or CTA. Uses BYOK OpenRouter when available; deterministic fallback otherwise. |
| 2. Run | `thumbnail-ab-runner.ts` | Publishes variants, collects impressions + conversions. |
| 3. Decide | `winner-picker.ts` | Compares CTR/conversion; picks winner (`a`, `b`, or `no_winner`). Marks experiment `decided`. |
| 4. Learn | `experiment-feedback-cron.ts` (daily) | Reads `decided` experiments, writes the winning variant to `creative_memory` as `experiment:<id>:winner`. Idempotent — re-running overwrites the same key. |

**Kết quả:** Winners become permanent creative memory. The next cycle's variant generator can reference past winners when creating new experiments.

---

## ROI & Cross-Channel Analytics / Phân Tích ROI & Kênh Đa

Two read-only resolvers (no writes, no side effects) answer business questions:

- **`content-roi-resolver.ts`** — Joins `content_projects` + `roi_records` + `performance_events`. Returns per-project ROI (revenueCents / costCents), workspace totals, and a boolean `hasData`. Handles zero-data gracefully: returns `hasData: false` and empty arrays instead of errors.
- **`cross-channel-resolver.ts`** — Aggregates the same data per channel provider (all 14 channels: tiktok, youtube, instagram, pinterest, linkedin, etc.). Returns zero-filled channel rows when no data exists so the API response shape stays consistent.

---

## Integration / Tích Hợp

| Direction | Connection |
|---|---|
| **Forest → Land** | Aggregated metrics feed billing/quota decisions |
| **Forest → Tree** | `recordLearning()` stores insights into `creative_memory` |
| **Tree → Forest** | Performance events trigger Inngest aggregation jobs |
| **Forest → Agent Protocol** | Agents query performance before content generation |

---

## See Also / Xem thêm

- `src/seed/types/creative-domain.ts` — Experiment, PerformanceEvent, CreativeMemory types
- `src/seed/types/learning-velocity.ts` — LearningVelocityMetric, VelocitySnapshot types
- `src/seed/types/performance-feedback.ts` — StrategyRecommendation, FeedbackCycle types
- `src/tree/creative-memory/` — Where learning is stored and decayed
- `CREATIVE_MEMORY.md` — Memory architecture and decay mechanics
- `migrations/0243_performance_events.sql`, `0249_learning_velocity.sql` — D1 schemas