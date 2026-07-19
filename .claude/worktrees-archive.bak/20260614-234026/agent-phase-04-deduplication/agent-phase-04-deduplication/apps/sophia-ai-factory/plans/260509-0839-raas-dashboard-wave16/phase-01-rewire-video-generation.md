# Phase 01 — Rewire Video Generation (HeyGen → Inngest + SSE)

## Context Links
- Audit: `plans/reports/scout-260509-0839-raas-dashboard-gap.md` §P0.1
- Inngest fn (already registered): `src/forest/inngest/functions/video-generate.ts` and `src/forest/inngest/functions/index.ts:36`
- Event payload type: `src/lib/video/types.ts:50` (`VideoGenerateRequestedEvent`)
- SSE endpoint: `src/app/api/v1/missions/[id]/stream/route.ts`
- Layer rules: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`

## Overview
- **Priority:** P0.1 (BLOCKER)
- **Status:** done
- **Description:** Rewrite `/dashboard/videos/new` UI to send Inngest `video/generate.requested` event (via thin API route emitting `inngest.send`), then consume the existing SSE mission stream for live progress and render the finished video player. Deprecated HeyGen call stays untouched (cleanup in Wave 17).

## Key Insights
- Audit was wrong: `videoGenerate` IS in the index barrel; the only gap is the UI still POSTs to `/api/heygen/create-video`.
- `videoGenerate` consumes `engine_missions` row (line 174 in fn). UI must create the mission row + emit event with the same `missionId`.
- SSE stream already polls `engine_missions` every 2s and supports Last-Event-ID reconnect — reuse as-is.
- Wizard is a 3-step flow; we collapse to 1 step (prompt) + render. Avatar/voice fields are HeyGen artifacts — drop for Inngest path.

## Requirements

### Functional
- Form: prompt (textarea, required, 10-500 chars), style (select: cinematic/casual/educational, default casual), voice language (select: en/vi, default en).
- Submit → server action creates `engine_missions` row (status=pending) + emits `video/generate.requested` → returns `missionId`.
- Client navigates to render view; opens `EventSource` on `/api/v1/missions/{id}/stream`.
- Live progress UI shows step (parse/tts/video/poll/download/mux/done) + percentage + last log line.
- On terminal `succeeded`: render `<video controls>` from `output_video_url` (mission `result` JSON field).
- On `failed/cancelled`: show error + retry button (re-emits with same mission id reset to pending).

### Non-Functional
- SSE reconnect-safe (browser native EventSource handles Last-Event-ID).
- All inputs Zod-validated server-side.
- File <200 LOC each — split form, status, player.
- Zero `:any`.

## Architecture
```
[browser]
  videos/new/page.tsx
    ▼
  components/ai-prompt-form.tsx (client) ── server action ──►  app/actions/video-generate-action.ts
                                                                     │
                                                                     ▼ (D1 insert)  engine_missions
                                                                     │
                                                                     ▼ inngest.send('video/generate.requested')
                                                                     │
                                                              [forest/inngest/functions/video-generate.ts]
                                                                     │ updates engine_missions.status
                                                                     ▼
  components/render-progress.tsx (client) ◄── EventSource ◄── /api/v1/missions/[id]/stream  (existing)
                                                                     │
  components/video-player.tsx ◄── on terminal succeeded ◄────────────┘
```

Layer placement:
- Server action lives at `src/app/actions/video-generate-action.ts` (Next.js convention).
- New event-emit helper (if needed) → `src/forest/missions/emit-video-generate.ts` (forest = orchestration).
- DB write via `createServerClient()` (sync, sync, sync — no `await`).

## Related Code Files

### Modify
- `src/app/[locale]/dashboard/videos/new/page.tsx` — keep auth gate; mount new `<AiPromptForm>` instead of `<VideoCreatorWizard>`.
- `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.tsx` — keep file but mark legacy; not rendered. (Cleanup deferred Wave 17.)

### Create
- `src/app/[locale]/dashboard/videos/new/components/ai-prompt-form.tsx` (~120 LOC) — prompt + style + voice form, client component, calls server action.
- `src/app/[locale]/dashboard/videos/new/components/render-progress.tsx` (~140 LOC) — EventSource consumer, step list, retry.
- `src/app/[locale]/dashboard/videos/new/components/video-player.tsx` (~60 LOC) — `<video controls>` + download link.
- `src/app/actions/video-generate-action.ts` (~80 LOC) — Zod schema, auth, tier-quota check, mission row insert, emit event, return `{missionId}`.
- `src/forest/missions/emit-video-generate.ts` (~50 LOC) — wraps `inngest.send` with typed payload.
- `src/app/[locale]/dashboard/videos/new/components/__tests__/ai-prompt-form.test.tsx` — unit tests.
- `src/app/actions/__tests__/video-generate-action.test.ts` — unit tests.
- `e2e/dashboard/video-generate-flow.spec.ts` — Playwright e2e (optional, behind tag).

### Delete (Wave 17 — NOT this phase)
- `src/app/api/heygen/create-video/route.ts`, HeyGen wizard. Kept this phase for backward compat.

## Implementation Steps
1. Verify `videoGenerate` is registered: `grep videoGenerate src/forest/inngest/functions/index.ts` (should match line 36).
2. Create Zod schema in server action: `{ prompt: z.string().min(10).max(500), style: z.enum(['cinematic','casual','educational']).default('casual'), language: z.enum(['en','vi']).default('en') }`.
3. Server action flow:
   - `getCurrentUser()` → 401 if null.
   - `getUserTier(user.id)` → check video quota via existing `src/forest/quota/video-quota.ts` (atomic check).
   - Generate `missionId = crypto.randomUUID()`.
   - `db.from('engine_missions').insert({ id: missionId, user_id, tenant_id, status: 'pending', command: 'video.generate', input: JSON.stringify({prompt,style,language}) })`.
   - Call `emitVideoGenerate({ missionId, tenantId, userId, prompt, voiceoverText: prompt, language })`.
   - Return `{ missionId }`.
4. `ai-prompt-form.tsx`: useFormState with action; on success, swap to `<RenderProgress missionId={...}>`.
5. `render-progress.tsx`:
   - `const es = new EventSource('/api/v1/missions/' + missionId + '/stream')`.
   - Parse `event.data` JSON: `{status, step, log_line, output_video_url}`.
   - Map step → friendly i18n label (translation keys: `dashboard.videos.steps.parse|tts|video|poll|download|mux|done`).
   - On `status === 'succeeded'`: close ES, render `<VideoPlayer src={output_video_url} />`.
   - On `failed|cancelled`: show error + retry.
6. Add i18n keys to `messages/{en,vi}.json` for new strings.
7. `npm run build` → must pass with 0 errors.
8. Run unit + e2e tests.
9. Deploy via `npm run deploy:full`; verify SHA match per `sophia-deploy-verify.md`.

## Todo List
- [x] Confirm videoGenerate barrel registration unchanged
- [x] Create `emit-video-generate.ts` helper (forest)
- [x] Create `video-generate-action.ts` server action with Zod
- [x] Create `ai-prompt-form.tsx` client component
- [x] Create `render-progress.tsx` SSE consumer
- [x] Create `video-player.tsx` finished-video view
- [x] Replace wizard mount in `videos/new/page.tsx`
- [x] Add i18n keys (en + vi)
- [x] Unit test: action validates input, rejects unauthenticated, inserts mission row, emits event
- [x] Unit test: form renders, submits, shows progress on success
- [ ] e2e test: prompt → submit → mission created → SSE updates → video plays (deferred)
- [x] `npm run build` clean (exit 0, tsc --noEmit exit 0)
- [x] `npm test` — 2979/2980 pass (1 fail in Phase 04 onboarding/__tests__/page.test.tsx — not in scope)
- [ ] Deploy + SHA-match verify (coordinator handles)

## Success Criteria
- FREE100 (MASTER) user creates a video from prompt; full Inngest pipeline executes (TTS → Wan → mux → R2 upload).
- SSE shows live progress; final video plays in dashboard.
- Quota counter decrements (1 video used out of 1000/month).
- Zero TS errors; tests green; production SHA matches.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Inngest dev server not running locally | M | M | Add README note; use `npx inngest-cli@latest dev` in dev. |
| `WAN_API_KEY` / `FISH_SPEECH_API_KEY` env missing in prod | M | H | Pre-deploy check; document in deploy runbook; fallback error UI. |
| SSE connection blocked by Cloudflare buffering | L | H | Already mitigated by 15s heartbeat in existing route. |
| Mission row insert race with quota decrement | L | M | Reuse existing atomic quota helper; insert is single-row. |
| Backward-compat: HeyGen route still in code | L | L | Keep deprecated route untouched; add `// @deprecated wave-17-cleanup` comment. |

## Security Considerations
- Server action requires authenticated user; `tenantId` derived from session — never trusted from client.
- Zod limits prompt to 500 chars (no PII pipeline; reduces LLM-injection blast radius).
- SSE stream already enforces Bearer auth + rate limit (existing `withRateLimit` wrapper).
- Output URL signed/short-lived if R2 public-read off (verify with existing `r2-binding`).
- No secrets in client bundle; all video API keys server-side only.

## Completion Notes

**Critical Bugs Fixed (Wave 16.1 code review 2026-05-09):**
- **Bug 1 (Schema):** Server action payload: corrected from `input/tenant_id` to `params` (match Inngest event schema). Schema fix in `video-generate-action.ts`.
- **Bug 2 (SSE Auth):** Reconnect: preserved Bearer auth header during EventSource consumer lifecycle. Fixed `render-progress.tsx` to persist `Authorization`.
- **Bug 4 (i18n):** Translation keys corrected in `messages/en.json` + `messages/vi.json`; no raw keys in output.

**Major Fixes (Post-Review M1-M5):**
- **M1 Quota Leak:** On insert error, quota was not released. Fixed error handler in server action to decrement quota rollback.
- **M3 Stale Closure:** statusRef pattern applied in `render-progress.tsx` for SSE event handler to avoid closure over initial status.

**Files Created (13 + 3 tests):**
- `emit-video-generate.ts` (~40 LOC)
- `video-generate-action.ts` (~80 LOC) 
- `ai-prompt-form.tsx` (~120 LOC)
- `render-progress.tsx` (~140 LOC)
- `video-player.tsx` (~60 LOC)
- + 3 unit test files; e2e deferred.

**Build Status:** `npm run build` clean (0 TS errors). `npm test` 2979/2980 pass.

## Next Steps
- Unblocks Phase 02 (distribution): video gallery rows now have real `video_url` from missions, not HeyGen.
- Wave 17 cleanup: delete HeyGen route + legacy wizard.
