# Batch Video Generation Architecture Research
**Date:** 2026-05-24 | **Scope:** Sophia AI Factory bulk video pipeline | **Status:** Actionable recommendations

---

## 1. Competitor Patterns (Verified)

**InVideo.ai** (cost leader): CSV batch import → 5–10min per video | Max plan includes API access | $1.20/video
**Pictory** (enterprise): REST API + templated branding | Webhook-based job status | $1.98/video | 20K+ companies
**Synthesia** (avatar-heavy): Manual per-video input | Less optimized for short-form scaling | $5.16/video

**Recommendation:** Adopt InVideo's CSV-first + API-driven approach; Pictory's webhook reliability pattern.

---

## 2. Inngest Fan-Out Architecture (RECOMMENDED)

**Pattern:** Single batch event → N parallel video functions (one-to-many).

**Implementation:**
```
1. CSV upload → create batch_job event with metadata
2. Inngest step.sendEvent() fires N events (one per row)
3. Each video renders independently via parallel Inngest function
4. Failures in one video don't block others
5. Polling/webhooks track completion
```

**Key advantage:** Parallel execution + independent failure domains. Each video takes N concurrent slots in Inngest queue.

**Scale limit:** Inngest handles 1000s of concurrent functions; beyond that, batch into waves (e.g., 500 videos/wave).

---

## 3. D1 + R2 Storage Strategy

**D1 (metadata):**
- `batch_jobs` table: job_id, user_id, csv_path, total_count, status, created_at
- `batch_videos` table: job_id, row_index, script, engine (HeyGen|Kling|Wan), status, output_url, cost
- `batch_progress` table: job_id, completed, failed, estimated_completion (for UI polling)

**Constraints:** D1 batch() supports 100KB statements; split into 50–100 video inserts per batch.

**R2 (outputs):**
- `/batches/{job_id}/input.csv` — original upload
- `/batches/{job_id}/videos/{row_index}.mp4` — final video
- `/batches/{job_id}/logs/{row_index}.json` — per-video metadata (duration, cost, engine used)

---

## 4. Progress Tracking UI (React Pattern)

Use **shadcn/ui Progress** + WebSocket polling on D1 `batch_progress`:
- Overall progress bar (completed / total)
- Table row per video: status badge (pending|rendering|done|failed), ETA, cost accumulated
- Real-time WebSocket subscription to `batch_progress` → 2s refresh
- Pause/resume/cancel buttons (update D1 status, signal Inngest via step.sendEvent)

---

## 5. Rate Limiting & Cost Control (CRITICAL)

**Per-batch budget gate:**
- Calculate total cost before dispatch (N videos × engine_cost)
- User approves or caps tier (e.g., 100 videos max, $200 spend limit)
- Inngest step: check budget before firing video job; cancel if exceeded

**Engine-level rate limits:**
- HeyGen: ~10 req/min; queue in Redis if burst
- Kling 3.0: ~5 req/min; stagger invocations
- Wan2.1: ~2 req/min; wave batches into 5-video chunks

**Progress webhook:** Report cost per-video back to D1 `batch_videos.cost` in real-time.

---

## 6. Recommended Architecture (Sophia Implementation)

```
CSV Upload → D1 batch_jobs
    ↓
/api/batch/start → validate budget, create N rows in batch_videos
    ↓
Inngest fan-out: 1 event → 500 parallel video functions (wave 1)
    ↓
Each function: script → [HeyGen|Kling] visual → TTS → compose → R2 upload
    ↓
Update D1 batch_progress + batch_videos (status, cost, output_url)
    ↓
Frontend polls D1 batch_progress, displays live dashboard
    ↓
Webhook callback: POST to customer endpoint when batch done
```

**Timeline:** Setup 3–5 days (D1 schema + Inngest fan-out + cost gate logic).

**Cost per video:** Inherit from single pipeline; batch = same unit cost, zero overhead.

---

## Unresolved Questions

- **Wave strategy:** Split 10K videos into 500-video waves or 100-video waves? (Tradeoff: latency vs. concurrency)
- **Retry budget:** How many retries per failed video before marking as failed-final?
- **Resume after restart:** If Inngest worker crashes mid-batch, can we resume from last checkpoint?

Sources:
- [InVideo Batch Processing](https://flowith.io/blog/invideo-pricing-2026-free-vs-plus-vs-max/)
- [Pictory Bulk Generation](https://docs.pictory.ai/docs/bulk-video-generation-usecase)
- [Inngest Fan-Out](https://www.inngest.com/docs/guides/fan-out-jobs)
- [Inngest Step Parallelism](https://www.inngest.com/docs/guides/step-parallelism)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Batch Architecture Patterns](https://ideausher.com/blog/ai-video-infrastructure-architecture/)
- [Rate Limiting Guide](https://www.levo.ai/resources/blogs/api-rate-limiting-guide-2026)
