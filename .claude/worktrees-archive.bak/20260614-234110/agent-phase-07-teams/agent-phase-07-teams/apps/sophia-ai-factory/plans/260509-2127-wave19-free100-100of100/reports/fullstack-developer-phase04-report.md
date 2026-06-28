# Phase 04 Implementation Report — Distribute Publish-Status Polling (M1)

## Schema Discovery

- `publishing_jobs` has NO `user_id` column. Ownership via JOIN through `publishing_channels.user_id`.
- `video_job_id` stores `videos.id` (NOT `video_jobs.id` — Wave 17 Phase 02 change, column rename deferred).
- Telegram special-case: `provider='telegram'` rows use `tenant_id = user.id` — no `publishing_channels` row. UNION query handles both paths.
- `publishing_jobs.status` enum: `scheduled|uploading|processing|live|failed` (no `queued` or `paused` at insert time).
- `retry_count` = attempts field. `error` = last_error field.

## Files Created/Modified

| File | LOC | Action |
|---|---|---|
| `src/app/api/v1/distribute/jobs/[videoId]/status/route.ts` | 121 | CREATE |
| `src/seed/hooks/use-distribute-jobs-polling.ts` | 140 | CREATE |
| `src/components/distribute/distribute-status-panel.tsx` | 118 | CREATE |
| `src/app/api/v1/distribute/jobs/[videoId]/status/__tests__/route.test.ts` | 151 | CREATE |
| `src/seed/hooks/__tests__/use-distribute-jobs-polling.test.ts` | 145 | CREATE |
| `src/app/[locale]/dashboard/videos/[id]/distribute/page.tsx` | +2 lines | UPDATE |
| `messages/en.json` | +5 keys | UPDATE |
| `messages/vi.json` | +5 keys | UPDATE |

## Tests

- New tests: 19 (5 route + 4 hook)
- Full suite: 3064 passed / 0 failed (was 3045+19)
- i18n validate: 0 missing keys

## Build/Test Status

- `npm run build`: pass (new route appears at `ƒ /api/v1/distribute/jobs/[videoId]/status`)
- `npm test`: 316 files pass / 0 fail
- TypeScript: 0 errors
- All files < 200 LOC

## Key Decisions

- UNION query for jobs: handles both OAuth (JOIN publishing_channels) + Telegram (WHERE tenant_id = user.id) paths in one query.
- Hook uses `void tick()` pattern + `stoppedRef` ref to prevent setState after unmount.
- `z.string().uuid()` rejects nil UUIDs like `00000000-0000-0000-0000-000000000001` (Zod enforces variant bits) — test uses proper v4 UUID.
- i18n keys placed at `dashboard.distribute.statusPanel.*` (not `dashboard.videos.distribute.statusPanel.*`).

## Blockers

None.
