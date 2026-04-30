# Phase 07 — Voice + TTS Service

## Status: ✅ DONE 2026-04-29 21:50 (verified TSC 0 err, vitest 12/12 pass)

## Goal
Coqui XTTS Docker microservice + Cloudflare Worker proxy. MPL-2.0, free self-host.

## Deliverables
- [x] `services/coqui-tts/Dockerfile` (Coqui XTTS v2) — fly.toml + requirements.txt + server.py shipped
- [x] `services/coqui-tts/server.py` (FastAPI wrapper) — /synth endpoint
- [x] Internal TTS proxy at `apps/sophia-ai-factory/src/app/api/internal/tts/route.ts` — token-auth, idempotent, dev mock
- [x] Voice management API at `src/app/api/voices/` (route.ts + [id]/) — tenant-scoped CRUD
- [x] D1 migrations: `0032-voices.sql` + `20260430_voices.sql`
- [x] Client lib: `src/lib/video/tts-client.ts`
- [x] R2 multipart upload helper: `src/lib/video/r2-multipart-upload.ts`
- [x] Inngest wired: `src/lib/inngest/functions/video-tts.ts` (FSM transition)
- [x] Tests: `src/lib/video/__tests__/tts-client.test.ts` + `src/app/api/voices/__tests__/`

## API (shipped)
- `POST /api/internal/tts` — internal-only, token-protected: text + voiceId → r2Key
- `GET/POST /api/voices` — list/create voice presets (tenant-scoped)
- `GET/PUT/DELETE /api/voices/[id]` — manage voice presets

## Architecture
- **Microservice:** Fly.io-deployed Coqui XTTS v2 container (`COQUI_FLY_URL` env)
- **Internal proxy:** `/api/internal/tts` validates `x-internal-token` (timing-safe), fetches from Coqui, streams WAV to R2, persists `audio_r2_key` on `video_jobs`
- **Dev fallback:** silent 1-sec WAV when `COQUI_FLY_URL` unset
- **Idempotency:** check `video_jobs.audio_r2_key` before re-synthesizing

## Risk: Low — well-known Docker pattern ✅ realized

## Effort: 2-3 days → completed in 1 session

## Quality Gates (verified)
- ✅ TypeScript: 0 errors (npx tsc --noEmit --skipLibCheck)
- ✅ Tests: 12/12 passed (vitest tts-client + voices suite)
- ✅ Zod validation on all inputs
- ✅ Zero `:any` types
- ✅ Timing-safe token compare (no leak via length comparison)
