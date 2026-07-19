# Phase 02: Batch Video Generation

**Priority:** P0 | **Status:** TODO | **Est:** 3-5 days
**Depends on:** Phase 01 (brand kit applied to batch videos)

## Overview

Users upload CSV/JSON dataset → system fans out N parallel Inngest video jobs → progress dashboard tracks each video.

## Requirements

### Functional
- CSV/JSON upload with column mapping (brand, topic, tone, CTA, etc.)
- Validation: max 500 videos/batch, required fields check
- Pre-batch cost estimation and budget approval
- Inngest fan-out: 1 batch event → N parallel video-generate jobs
- Per-video status tracking: queued → generating → composing → done/failed
- Batch progress dashboard: progress bar + per-video table
- Download all as ZIP or individual video links
- Cancel batch (cancel remaining unstarted jobs)

### Non-functional
- Rate limiting per engine: HeyGen 10req/min, Kling 5req/min, Wan 2req/min
- Wave processing: batch 50-100 videos per wave to avoid queue saturation
- D1 batch inserts in 50-video chunks (100KB statement limit)
- Resume-from-checkpoint after worker crash

## Architecture

### D1 Schema
```sql
CREATE TABLE batch_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending|processing|completed|cancelled|failed
  total_videos INTEGER NOT NULL,
  completed_videos INTEGER DEFAULT 0,
  failed_videos INTEGER DEFAULT 0,
  estimated_cost_cents INTEGER DEFAULT 0,
  actual_cost_cents INTEGER DEFAULT 0,
  input_r2_key TEXT, -- uploaded CSV
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE batch_videos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  batch_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  status TEXT DEFAULT 'queued', -- queued|generating|composing|done|failed|cancelled
  video_job_id TEXT, -- FK to video_jobs
  input_data TEXT NOT NULL, -- JSON row from CSV
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (batch_id) REFERENCES batch_jobs(id)
);
```

### Inngest Fan-Out Pattern
```
batch/created → for each row:
  step.invoke('video/generate', { batchId, rowIndex, inputData })
  → existing video pipeline (script→visual→tts→compose→publish)
  → step.run('update-batch-progress', ...)
```

## Files to Create/Modify

### Create
- `src/seed/db/migrations/NNNN_batch_jobs.sql`
- `src/seed/db/repositories/batch-jobs-repo.ts`
- `src/app/actions/batch-generate-action.ts`
- `src/app/[locale]/dashboard/videos/batch/page.tsx`
- `src/app/[locale]/dashboard/videos/batch/components/batch-upload-form.tsx`
- `src/app/[locale]/dashboard/videos/batch/components/batch-progress-dashboard.tsx`
- `src/forest/inngest/functions/batch-video-fanout.ts`
- `src/lib/video/batch-csv-parser.ts`

### Modify
- `src/forest/inngest/functions/video-generate.ts` — accept batch context
- `src/forest/quota/video-quota.ts` — batch budget pre-approval
- `src/seed/config/tiers/video-quota-tiers.ts` — batch limits per tier

## Implementation Steps

- [ ] 1. D1 migration: batch_jobs + batch_videos tables
- [ ] 2. batch-jobs-repo.ts with CRUD + progress aggregation
- [ ] 3. batch-csv-parser.ts: parse CSV, validate columns, map to video input schema
- [ ] 4. batch-generate-action.ts: upload CSV → R2, validate, create batch_job, estimate cost
- [ ] 5. batch-video-fanout.ts: Inngest function — fan out to N video-generate jobs with wave throttling
- [ ] 6. Modify video-generate.ts to accept batchId/rowIndex, update batch_videos status
- [ ] 7. Batch upload form UI: CSV upload, column mapping preview, cost estimate, approve button
- [ ] 8. Batch progress dashboard: polling progress bar, per-video status table, cancel button
- [ ] 9. Download ZIP endpoint
- [ ] 10. Tests: CSV parsing, fan-out, progress tracking, cancellation

## Success Criteria

- Upload 10-row CSV → 10 videos generated in parallel
- Progress dashboard shows real-time per-video status
- Cost guardrail prevents over-budget batches
- Cancel stops remaining unstarted jobs
