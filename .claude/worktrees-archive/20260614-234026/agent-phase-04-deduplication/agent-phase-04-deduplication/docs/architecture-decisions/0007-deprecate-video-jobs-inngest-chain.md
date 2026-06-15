# ADR 0007 — Deprecate `video_jobs` Inngest Chain

**Status:** Accepted
**Date:** 2026-05-17
**Decision Owner:** Sophia AI Factory maintainer (CC CLI auto-mode)
**Related plan:** `plans/260517-0310-next-sweep-inngest-export-hardening-playbook/phase-01-inngest-video-jobs-cleanup.md`
**Audit report:** `plans/260517-0310-next-sweep-inngest-export-hardening-playbook/reports/phase-01-inngest-audit.md`

## Context

Phase 06 of the original Sophia roadmap shipped an Inngest-based video pipeline:

```
POST /api/videos/generate
        │
        ▼
createVideoJob() → INSERT INTO video_jobs (status='queued')
        │
        ▼
inngest.send('video.requested')
        │
        ▼
videoScripting → videoTTS → videoVisual → videoCompose → videoUpload → videoPublish
        │
        ▼
(creates publishing_jobs rows for auto-publish channels)
```

This chain was registered in `src/app/api/inngest/route.ts` and is referenced by:
- `src/lib/video/video-job-pipeline.ts` (called by `POST /api/videos/generate`)
- `src/forest/inngest/functions/url-revenue-video-handler.ts` (URL-to-Revenue moat feature)
- `src/lib/factory/url-to-revenue.ts:111` (dispatches `url_revenue.video.requested`)
- 5 land/forest read consumers (observability, cascade-delete, analytics, quota)

## Problem

Production D1 query on 2026-05-17 confirmed:

```bash
$ npx wrangler d1 execute sophia-raas-db --remote \
    --command "SELECT 1 FROM video_jobs LIMIT 1;"
ERROR: no such table: video_jobs: SQLITE_ERROR [code: 7500]
```

The `video_jobs` table was created in migration `0031-video-pipeline-jobs.sql`. The `d1_migrations` tracking table on remote shows only migrations `0001`, `0005`, `0006`, `0030` and a handful of others applied — **migration 0031 was never applied to production**.

Consequence: the entire Phase 06 video chain has been silent-failing since inception. Every `inngest.send` for `video.requested` or `url_revenue.video.requested` dispatches, the handler fires, the first `INSERT INTO video_jobs` call errors immediately, Inngest retries 2× then permanently fails.

Meanwhile, the canonical customer-facing video generation path has been running through a different pipeline since 2026-Q1:
- `video:create` mission → HeyGen avatar API → HeyGen webhook → `complete-video-from-webhook.ts` → upserts `videos` table (different schema, different status FSM, no Inngest involvement).

The `videos` table is fully populated, indexed (P27 `completed_at` index applied this session), and tracked by the active P27 render benchmark endpoint.

## Decision

Deprecate the `video_jobs` Inngest chain. Specifically:

1. **Remove from Inngest serve registration** (`src/app/api/inngest/route.ts`): `videoScripting`, `videoTTS`, `videoVisual`, `videoCompose`, `videoUpload`, `videoPublish`, `urlRevenueVideoHandler`.
2. **JSDoc `@deprecated` tag** on all 7 handler files. Files kept (not deleted) for test coverage and historical context.
3. **Replace `inngest.send('url_revenue.video.requested')`** in `src/lib/factory/url-to-revenue.ts` with a `logger.warn` no-op. URL-to-Revenue jobs are still persisted in `url_to_revenue_jobs`; video generation is delegated to the HeyGen mission flow.
4. **`POST /api/videos/generate`** returns HTTP 410 Gone with replacement hint pointing to `/api/missions`. 401 for unauthenticated callers preserved.
5. **Migration `0031-video-pipeline-jobs.sql`** kept as historical artifact. Do NOT delete.
6. **Read consumers** (observability, cascade-delete, analytics, quota) left untouched. D1 silently no-ops `DELETE FROM` on missing tables; observability queries return null/error which upstream handles. Future phase may migrate these consumers to `videos` table.

## Alternatives Considered

### Alt A: Apply migration 0031 to remote D1

Risk: would resurrect 7 handlers that have never run successfully in prod. Their integrations with HeyGen, ElevenLabs, R2 storage, and the cost ledger have never been end-to-end tested against the real `video_jobs` schema. Resurrection without a smoke-test pass would be reckless.

Product value: zero — HeyGen path already covers the customer need. Resurrecting Phase 06 chain would introduce duplicate code paths and confuse the ownership story.

### Alt B: Env-gate harder + keep registration

The current `url-to-revenue.ts` already env-gates on `INNGEST_EVENT_KEY` being set. Both keys ARE set in prod. Tightening the env-gate to also check D1 schema state would be a logic kludge masking the underlying fact (table missing) rather than addressing it.

### Alt C: Migrate handlers to use `videos` table

Would require rewriting all 7 handlers to map their FSM (`queued|scripting|tts_pending|visual_pending|composing|uploaded|published|failed`) onto the `videos` table FSM (`queued|processing|completed|failed|failed_permanent`). High effort, high risk, zero product value (HeyGen path already works).

## Consequences

### Positive
- Stops silent Inngest retry/permanent-fail noise on every URL-to-Revenue dispatch.
- Reduces Inngest serve handler complexity (`functions` array shrinks from 19 to 12).
- Clarifies canonical video pipeline (HeyGen webhook → `videos`).
- Removes dead-code surface area for future contributors to grep.

### Negative / Risks
- `POST /api/videos/generate` callers (if any) get 410 instead of the previous 500 (functionally identical for caller, but observable change).
- Observability dashboards that JOIN `video_jobs` will continue to return null/error. Tracked as follow-up in audit report's "Unresolved Questions" section.
- The `url-to-revenue.ts` orchestrator's `dispatchVideoRequest` function is now a no-op stub. If a future revival of URL-to-Revenue video generation is desired, the function must be re-implemented against the HeyGen mission path.

### Neutral
- Migration 0031 stays as historical artifact. New contributors may be confused by the schema/code mismatch — JSDoc `@deprecated` tags should make intent clear.

## Revival Trigger

If a future product decision requires reviving Phase 06's video_jobs chain:
1. Apply migration 0031 to remote D1: `npx wrangler d1 execute sophia-raas-db --file=migrations/0031-video-pipeline-jobs.sql --remote`.
2. End-to-end test the chain in staging before re-adding handlers to `src/app/api/inngest/route.ts` serve registration.
3. Open a new ADR superseding this one.

Alternatively, prefer migrating the URL-to-Revenue feature to dispatch HeyGen mission calls instead of resurrecting Phase 06.

## References

- Plan: `plans/260517-0310-next-sweep-inngest-export-hardening-playbook/phase-01-inngest-video-jobs-cleanup.md`
- Audit: `plans/260517-0310-next-sweep-inngest-export-hardening-playbook/reports/phase-01-inngest-audit.md`
- Doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`
- Canonical video pipeline: `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`
- P27 benchmark (uses `videos` table): `apps/sophia-ai-factory/src/lib/analytics/video-render-benchmark.ts`
