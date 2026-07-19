# Phase 07 — Voice + TTS Service

## Status: ✅ DONE 2026-04-30

## Goal
Coqui XTTS Docker microservice + Cloudflare Worker proxy. MPL-2.0, free self-host.

## Deliverables
- [ ] `services/coqui-tts/Dockerfile` (Coqui XTTS v2)
- [ ] `services/coqui-tts/server.py` (FastAPI wrapper)
- [ ] CF Worker proxy at `apps/sophia-ai-factory/app/api/voice/synthesize/route.ts`
- [ ] Voice clone storage in R2 (per-tenant scoped)
- [ ] Audio output: WAV → MP3 conversion (FFmpeg)

## API
- `POST /api/voice/synthesize` — text + voice_id → audio_url
- `POST /api/voice/clone` — sample.wav → voice_id (tier-gated)

## Files
- `services/coqui-tts/` (new microservice dir)
- `apps/sophia-ai-factory/app/api/voice/`
- `apps/sophia-ai-factory/lib/voice/coqui-client.ts`

## Risk: Low — well-known Docker pattern

## Effort: 2-3 days
