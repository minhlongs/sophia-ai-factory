# Phase 01 — Inngest `video_jobs` Chain Audit + Cleanup

## Context Links

- `apps/sophia-ai-factory/src/forest/inngest/functions/video-upload.ts` — Listens `video.composed`, updates `video_jobs.status='uploaded'`
- `apps/sophia-ai-factory/src/forest/inngest/functions/video-publish.ts` — Listens `video.uploaded`, creates `publishing_jobs` per active channel
- `apps/sophia-ai-factory/src/forest/inngest/functions/video-scripting.ts`, `video-tts.ts`, `video-visual.ts`, `video-compose.ts` — Earlier stages of same chain
- `apps/sophia-ai-factory/src/forest/inngest/functions/url-revenue-video-handler.ts` — Creates `video_jobs` row → triggers chain
- `apps/sophia-ai-factory/src/forest/inngest/functions/index.ts` — Exports all
- `apps/sophia-ai-factory/src/forest/inngest/client.ts:99-100` — Event payload typings
- `apps/sophia-ai-factory/src/app/api/inngest/route.ts:36-37` — Inngest serve registration
- `apps/sophia-ai-factory/src/lib/factory/url-to-revenue.ts` — Dispatches `url_revenue.video.requested`
- `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts` — HeyGen path, targets `videos` table (separate pipeline)
- Migrations: `migrations/0031-video-pipeline-jobs.sql`, `0096-video-jobs-output-columns.sql`, `0113-video-jobs-completed-at.sql`
- Rules: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`, `cross-layer-orchestration.md`

## Overview

- **Priority:** P2 (tech debt; not customer-facing)
- **Status:** pending
- **Description:** Audit whether `video_jobs` Inngest chain is actively used in prod (URL-to-Revenue) or orphaned. Decide: deprecate, env-gate, or migrate-to-`videos`. Implement chosen path.

## Key Insights (from scout pass)

1. **Two parallel video pipelines exist in prod:**
   - **Pipeline A (`video_jobs` + Inngest):** `url-revenue-video-handler` → `video.requested` → scripting → tts → visual → compose → upload → publish. Uses `video_jobs` table. Used by URL-to-Revenue moat feature.
   - **Pipeline B (`videos` + direct fulfillment):** HeyGen webhook → `complete-video-from-webhook.ts` → upserts `videos` table directly. Used by `video:create` mission + direct user purchase.
2. **`video_jobs` table DOES exist in remote D1** — migrations 0031/0096/0113 are applied. Cascade-delete + observability queries reference it (`land/observability/`, `land/account/cascade-delete.ts`, `land/analytics/funnel-stats.ts`). Conclusion: NOT orphaned, NOT safe to drop.
3. **Inngest dispatch is env-gated:** `url-to-revenue.ts:102-107` skips `inngest.send` when `INNGEST_EVENT_KEY` unset. Need to confirm wrangler secret state in prod.
4. **`video-upload.ts` calls `assertValidTransition`** — FSM enforcement is real. If chain is replayed, idempotency is via status check.
5. **Possible bug:** `video-upload.ts:55-56` HEAD-checks the final URL with 10s timeout — Cloudflare Worker subrequest budget can be tight if many videos compose in burst.

## Requirements

### Functional

- F-01: Determine actual usage of `video_jobs` Inngest chain in prod (last 30 days).
- F-02: Confirm `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` state in prod wrangler secrets.
- F-03: Document decision tree: deprecate / env-gate harder / keep-as-is with monitoring.
- F-04: Implement chosen path with rollback notes.

### Non-functional

- NF-01: No prod regression on URL-to-Revenue moat flow.
- NF-02: Doctrine compliance (no-tech: do not introduce operator-side third-party action).
- NF-03: Documentation: ADR file in `docs/architecture-decisions/` for pipeline keep-vs-deprecate.

## Architecture

```
Customer URL submit
        │
        ▼
url-to-revenue.ts ──── inngest.send('url_revenue.video.requested')
                                  │
                                  ▼
              url-revenue-video-handler.ts (creates video_jobs row,
                                            sends 'video.requested')
                                  │
                                  ▼
          video-scripting → tts → visual → compose
                                  │
                                  ▼
                        inngest.send('video.composed')
                                  │
                                  ▼
                            video-upload.ts ──── inngest.send('video.uploaded')
                                                          │
                                                          ▼
                                                    video-publish.ts
                                                          │
                                                          ▼
                                      INSERT INTO publishing_jobs (per active channel)
                                      inngest.send('publish.scheduled')
```

Parallel (separate pipeline, untouched by this phase):
```
HeyGen webhook → complete-video-from-webhook.ts → UPSERT videos
```

## Related Code Files

### Modify (if chain kept)

- `apps/sophia-ai-factory/src/forest/inngest/functions/video-upload.ts` — add hard env-gate check at function entry; log no-op if `INNGEST_EVENT_KEY` missing (defensive, won't run anyway via Inngest server but defensive for any direct invocation in tests).
- `apps/sophia-ai-factory/src/forest/inngest/functions/video-publish.ts` — same defensive guard.
- `apps/sophia-ai-factory/src/lib/factory/url-to-revenue.ts:100-107` — escalate the WARN log to a `metric.dispatch_skipped` event (no-op if metrics not wired) so we can observe skip rate.

### Add (if deprecating)

- `docs/architecture-decisions/0007-deprecate-video-jobs-inngest-chain.md` — ADR with rationale.
- New migration `migrations/NNNN-deprecate-video-jobs-chain.sql` — NO-OP marker migration (DO NOT drop table; cascade-delete references it).
- `apps/sophia-ai-factory/src/app/api/inngest/route.ts:36-37` — remove `videoUpload`/`videoPublish` from `functions` array (kill switch).

### Add (always — audit doc)

- `apps/sophia-ai-factory/plans/260517-0310-next-sweep-inngest-export-hardening-playbook/reports/phase-01-inngest-audit.md` — D1 count + 30-day usage analysis output.

### Do NOT modify

- `src/land/observability/*.ts` — read-only query consumers of `video_jobs`. Leave.
- `src/land/account/cascade-delete.ts` — references table as part of GDPR cascade. Leave.
- `src/lib/fulfillment/complete-video-from-webhook.ts` — separate pipeline. Out of scope.

## Implementation Steps

1. **Audit prod usage** (read-only):
   - `npx wrangler d1 execute sophia-raas-db --remote --command "SELECT status, COUNT(*) AS n FROM video_jobs WHERE created_at > unixepoch() - 86400*30 GROUP BY status;"`
   - Inspect Inngest dashboard for `video.composed` / `video.uploaded` invocation counts last 30d.
   - Check wrangler secrets: `npx wrangler secret list | grep INNGEST` (should show keys present or absent).
   - Save findings to `reports/phase-01-inngest-audit.md`.
2. **Decision tree based on audit result:**
   - **If `video_jobs` has >0 rows last 30d AND Inngest keys present:** CHAIN IS LIVE → take path A (keep + defensive hardening).
   - **If `video_jobs` has 0 rows last 30d OR Inngest keys absent:** CHAIN IS DORMANT → take path B (env-gate harder + ADR).
   - **If `video_jobs` table is empty AND no Inngest config:** CHAIN IS DEAD → take path C (deprecate + remove from serve handler).
3. **Path A — keep + harden:**
   - Add early env-guard in `video-upload.ts` + `video-publish.ts`: if no `INNGEST_EVENT_KEY`, log + return early.
   - Tighten HEAD check in `video-upload.ts:55-56` to 5s (Cloudflare Worker subrequest budget friendlier).
   - Add metric counter via `recordCost`'s pattern for chain progression.
4. **Path B — env-gate + ADR:**
   - Defensive env-guard same as Path A.
   - Write ADR documenting dormancy + revive path (set Inngest keys + verify in staging).
5. **Path C — deprecate:**
   - ADR with deprecation rationale + cascade-delete reference preservation.
   - Remove `videoUpload`, `videoPublish` from `src/app/api/inngest/route.ts` functions array.
   - Mark `video-upload.ts` + `video-publish.ts` as `@deprecated` JSDoc + keep file (test coverage references).
   - No table drop — `video_jobs` rows remain for GDPR/observability legacy.
6. **Test:** run `npm test` — should pass with no test changes (chain handlers covered by unit tests, env-guard branch needs 1 added test per file).
7. **Deploy:** `npm run deploy:full`; verify SHA match per `sophia-deploy-verify.md`.

## Todo List

- [x] Run D1 audit query — capture row counts by status, last 30d window
- [x] Inspect Inngest dashboard for `video.composed`/`video.uploaded` invocations
- [x] `npx wrangler secret list` → confirm INNGEST_EVENT_KEY state
- [x] Write `reports/phase-01-inngest-audit.md` with findings + selected path (A/B/C)
- [x] Implement chosen path (code changes scoped above)
- [x] Add env-guard tests (1 per file) covering missing INNGEST_EVENT_KEY no-op
- [x] `npm run build` → 0 errors
- [x] `npm test` → all green
- [x] `npm run deploy:full` → wrangler success
- [x] Verify SHA match (`/api/version` == local short SHA)
- [x] Smoke test: trigger one URL-to-Revenue job (or document why skipped if Path C)
- [x] If Path C: ADR committed; if Path A/B: env-guard logs visible in `wrangler tail`
- [x] Update `docs/development-roadmap.md` + `docs/project-changelog.md`

## Success Criteria

- Audit doc committed under `plans/260517-.../reports/`.
- Decision (A/B/C) documented with concrete evidence (row counts + secret state).
- All code changes (if any) pass build + test.
- Deploy SHA-verified.
- No regression on URL-to-Revenue happy path (smoke test or rationale to skip).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chain is live + we break it via misclassification | LOW | HIGH | Audit BEFORE code change; require 0 rows + no Inngest keys for Path C |
| `assertValidTransition` blocks legitimate replays | LOW | MED | Already idempotent (FSM checks status before transition) |
| Cascade-delete breaks if table-drop attempted | N/A | — | Plan explicitly forbids drop |
| Wrangler secret state misread | MED | LOW | Confirm via `wrangler secret list` AND test dispatch in staging |
| HEAD-check 5s tightening triggers more `warn` noise | LOW | LOW | Already non-fatal; logs only |

## Security Considerations

- Read-only D1 query: no PII exfil (table has no PII fields).
- Wrangler secrets inspection: do NOT echo secret values, only names.
- No new endpoints; no auth/authz change.
- If Path C: removed handlers cannot be abused (Inngest serve simply won't dispatch).

## Next Steps

- Phase 02 (lead:export) independent — can proceed in parallel.
- If Path A chosen, follow-up phase needed: emit metric for chain skip rate, monitor 7 days, decide steady state.
- If Path C chosen, follow-up phase: in 90 days, evaluate dropping `video_jobs` table after confirming no cascade-delete invocations need it.
