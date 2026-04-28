# Video Pipeline Content Factory — Plan

**Created:** 2026-04-28 | **Status:** Phase 1+2 SHIPPED (deploy deferred), Phase 3-4 pending

## Goal

User-facing video creation pipeline (script → avatar/voice → render → gallery), reusing existing Sophia agent stack (`generateScript`, HeyGen, ElevenLabs, NOWPayments tier gating).

## Phases

### ✅ Phase 1 — Script Generation API (SHIPPED 2026-04-28)
- `POST /api/scripts/generate` — auth via Better Auth session, tier-gated (BASIC min), zod-validated, returns ephemeral `requestId` + script content + accurate model metadata.
- Helper `selectModelForTier(tier)` exported from `script-generator.ts` as SSOT.
- Tests: 8 cases (401/400/402/500 + tier escalation defense + ENTERPRISE model routing).
- Files: `src/app/api/scripts/generate/route.ts`, `route.test.ts`, `src/lib/ai/script-generator.ts` (added `selectModelForTier`).

### ✅ Phase 2 — Avatar/Voice UI (SHIPPED 2026-04-28)
- Frontend page `/[locale]/dashboard/videos/new` — 3-step wizard (Script → Assets → Render).
- Components split per 200-LOC rule: `video-creator-wizard.tsx`, `script-step.tsx`, `asset-picker.tsx`, `render-status.tsx`.
- Step 1 calls `/api/scripts/generate` (Phase 1).
- Step 2 fetches `/api/heygen/avatars` + `/api/heygen/voices` in parallel; grid + list selectors.
- Step 3 POSTs `/api/heygen/create-video` with concatenated script (hook + body + cta), then polls `/api/heygen/status/[id]` every 5s until terminal.
- Smoke test: 2 vitest cases (initial render, progress indicator).
- Files: `src/app/[locale]/dashboard/videos/new/page.tsx`, `components/video-creator-wizard.tsx` + 3 sibling components + 1 test.
- **Blockers (production):** HEYGEN_API_KEY production secret + Cloudflare Actions re-enable.

### Phase 3 — Gallery + D1 Persistence (pending)
- New D1 table `videos` (id, user_id, script_request_id, heygen_job_id, status, video_url, thumbnail_url, created_at).
- Migration `0024-videos.sql`.
- `GET /api/videos` (list) + `GET /api/videos/[id]` (detail).
- Frontend `/dashboard/videos` gallery view.

### Phase 4 — Remotion Render (optional, deferred)
- Self-hosted alternative to HeyGen for ENTERPRISE+ tier (cost reduction).
- Requires Remotion worker + R2 storage for renders.
- Decision pending: revenue per video > Remotion infra cost?

## Dependencies

- Better Auth session (origin migrated 2026-04-14 — Phase 1 already integrated)
- D1 `sophia-raas-db` binding `DB`
- OpenRouter API key (BYOK fallback to env)
- HeyGen API key (Phase 2 blocker)

## Open Questions

1. Tier credit consumption: should script generation deduct from monthly campaign quota or be metered separately?
2. Script persistence: persist all generated scripts (audit trail) or only those tied to videos?
3. Rate limiting: add `withRateLimit` wrapper to script endpoint? (currently unbounded per-user)
