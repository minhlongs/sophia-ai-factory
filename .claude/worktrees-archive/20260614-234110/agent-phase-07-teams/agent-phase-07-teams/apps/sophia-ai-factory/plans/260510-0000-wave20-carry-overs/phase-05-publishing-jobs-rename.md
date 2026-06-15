# Phase 05 — `publishing_jobs.video_job_id` → `video_id` Rename

## Context Links

- Wave 18 carry-over (low-priority maintenance)
- Source comments scattered across publish path: `publish-execute.ts:225-316`, `schedule-publish.ts:5-75` all explain "video_job_id stores videos.id (post Wave 16 Phase 02)"
- Migration baseline: `migrations/0099-publishing-jobs-add-provider.sql`

## Overview

- **Priority:** P2
- **Effort:** 2h
- **Status:** ⏳ IN PROGRESS
- **Description:** The `publishing_jobs.video_job_id` column actually stores `videos.id`. Misleading name added every-PR friction. Rename column + sweep code references for clarity. ENGINE_MISSIONS.video_job_id is OUT OF SCOPE — that one legitimately stores wan-video-job-id (external Wan API).

## Key Insights

- D1 / SQLite ≥3.25 supports `ALTER TABLE … RENAME COLUMN` — single-statement atomic rename, indexes preserved.
- Sophia is pre-launch / low-traffic — brief window between migration apply + code deploy is acceptable. Doctrine for **this phase only** flips the order: migration FIRST, then `npm run deploy:full`.
- Two schema files reference the column: canonical `migrations/0099` is current state; legacy template `src/seed/db/migrations/20260503_publishing.sql` is for fresh setups (must update too).
- 10 source files + 1 test fixture + 1 unit test reference `video_job_id` for publishing_jobs context.

## Requirements

### Functional
- F1. New migration `0101-publishing-jobs-rename-video-job-id-to-video-id.sql` — single `ALTER TABLE publishing_jobs RENAME COLUMN`.
- F2. All `publishing_jobs` SQL queries + INSERT objects + interface fields use `video_id`.
- F3. `engine_missions.video_job_id` UNTOUCHED.
- F4. Existing tests still pass after sweep.

### Non-Functional
- NF1. Zero `video_job_id` references in any `publishing_jobs` context after rename.
- NF2. No new test required if existing 9 tests in `publish-execute-video-url-wave17.test.ts` cover the field — just rename their assertions.
- NF3. Apply migration BEFORE deploy (override default doctrine — documented in commit).

## Architecture

```
migrations/0101-publishing-jobs-rename-video-job-id-to-video-id.sql (NEW)
    └── ALTER TABLE publishing_jobs RENAME COLUMN video_job_id TO video_id;

src/forest/publishing/schedule-publish.ts          MODIFY (3 refs)
src/forest/inngest/functions/video-publish.ts      MODIFY (1 ref)
src/forest/inngest/functions/publish-execute.ts    MODIFY (5 refs)
src/forest/inngest/functions/__tests__/...         MODIFY (9 refs in test)
src/app/[locale]/dashboard/videos/[id]/page.tsx    MODIFY (2 refs)
src/app/api/v1/videos/[id]/distribute/route.ts     MODIFY (2 refs)
src/app/api/v1/distribute/jobs/[videoId]/status/route.ts MODIFY (2 refs)
src/lib/publishing/scheduler.ts                    MODIFY (1 ref)
src/lib/publishing/publisher-interface.ts          MODIFY (1 ref)
src/seed/db/migrations/20260503_publishing.sql     MODIFY (template — fresh setups)
tests/e2e/_fixtures/free100-db-helpers.ts          MODIFY (1 ref)
```

## Implementation Steps

1. Write migration 0101.
2. Sweep all `publishing_jobs` source + test files: rename `video_job_id` → `video_id` (column name in SQL, property in INSERT objects, interface field).
3. Update CREATE TABLE template + e2e helper for consistency.
4. Run `npm test` → all pass.
5. Run `npm run build` → 0 errors.
6. Commit single atomic change.
7. Apply migration: `npx wrangler d1 execute sophia-raas-db --file=migrations/0101-publishing-jobs-rename-video-job-id-to-video-id.sql --remote`
8. Deploy: `npm run deploy:full`.
9. Verify SHA + HTTP 200.

## Todo List

- [ ] Migration 0101
- [ ] Sweep 10 source files
- [ ] Update test fixture + unit test
- [ ] Update CREATE TABLE template
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Commit
- [ ] Apply migration to remote D1
- [ ] `npm run deploy:full`
- [ ] SHA verify + HTTP 200

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Live old code reads `video_job_id` after migration applied | M | M | Migration → deploy gap is ≤30s; pre-launch zero traffic |
| Forgot a query reference, runtime error | L | M | Comprehensive grep + test pass + build pass |
| `engine_missions.video_job_id` accidentally renamed | L | H | Explicit scope: only `publishing_jobs` table referenced in migration |
| D1 doesn't support RENAME COLUMN | L | H | SQLite ≥3.25 supports it; D1 confirmed on 3.42+ |

## Security Considerations

- Pure schema clarity refactor. No auth/permissions changed.

## Next Steps

- Wave 20 wrap: phases 02 + 04 still pending. Phase 02 (Telegram step split) flagged risky multi-step refactor.
